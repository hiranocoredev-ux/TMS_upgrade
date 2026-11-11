import mongoose from 'mongoose';
import Daily from "../models/Daily.js";
import Weekly from "../models/Weekly.js";
import Monthly from "../models/Monthly.js";
import { normalizeRole, ROLES, isFullAdminRole } from "../constants/roles.js";
import {
    getESTDateKey,
    getESTMonthStartKey,
    normalizeReportDateByPeriodEST,
    isAllowedPlanSubmitAnchorEST
} from '../utils/estTime.js';
import { sendReportRejectedNotification } from '../services/notification.service.js';
import { buildDailyReportHistorySummary } from '../services/dailyReportHistorySummary.js';
import { DOCUMENT_KIND, normalizeDocumentKind } from '../constants/documentKind.js';
import { financeTargetFor } from './reportFinance.controller.js';
import { weekRangeKeys } from '../utils/weekRule.js';

const MODELS = {
    daily: Daily,
    weekly: Weekly,
    monthly: Monthly
};

const resolveModel = (period, res) => {
    const model = MODELS[period];
    if (!model) {
        res.status(400).json({ message: 'Invalid report period' });
        return null;
    }
    return model;
};

function resolveKind(req) {
    return normalizeDocumentKind(req.documentKind);
}

/** Mongo filter for listing documents of a given kind (includes legacy combined reports). */
function listFilterForKind(kind, base = {}) {
    if (kind === DOCUMENT_KIND.PLAN) {
        return { ...base, kind: DOCUMENT_KIND.PLAN };
    }
    return {
        ...base,
        $or: [{ kind: DOCUMENT_KIND.REPORT }, { kind: { $exists: false } }]
    };
}

function upsertKindValue(kind) {
    return kind === DOCUMENT_KIND.PLAN ? DOCUMENT_KIND.PLAN : DOCUMENT_KIND.REPORT;
}

/**
 * The span a weekly or monthly document covers, as instants.
 *
 * A period holds one document, whatever date inside it that document happens
 * to be anchored on. Documents written before the week unit became Saturday →
 * Friday sit on a Monday, and they must keep being found and updated in place
 * rather than spawning a second record for the same week.
 */
function periodSpanOf(normalizedDate, period) {
    const dateKey = new Date(normalizedDate).toISOString().slice(0, 10);

    if (period === 'weekly') {
        const { start, endExclusive } = weekRangeKeys(dateKey);
        return { start: new Date(`${start}T00:00:00.000Z`), endExclusive: new Date(`${endExclusive}T00:00:00.000Z`) };
    }

    if (period === 'monthly') {
        // Monthly documents are anchored on the 1st of the month they name, so
        // the span is that calendar month — the business month's days are a
        // different question, answered where the figures are computed.
        const monthKey = dateKey.slice(0, 7);
        const [y, m] = monthKey.split('-').map(Number);
        return {
            start: new Date(Date.UTC(y, m - 1, 1)),
            endExclusive: new Date(Date.UTC(y, m, 1)),
        };
    }

    return null;
}

/** The document already stored for this period, whatever day it is anchored on. */
async function findInPeriod(Model, userId, normalizedDate, kind, period) {
    const span = periodSpanOf(normalizedDate, period);
    if (!span) return null;
    const k = upsertKindValue(kind);
    return Model.findOne({
        userId,
        kind: k,
        date: { $gte: span.start, $lt: span.endExclusive },
    })
        .sort({ date: 1, createdAt: 1 })
        .lean();
}

async function findByUserDate(Model, userId, normalizedDate, kind) {
    const k = upsertKindValue(kind);
    let doc = await Model.findOne({ userId, date: normalizedDate, kind: k }).lean();
    if (!doc && k === DOCUMENT_KIND.REPORT) {
        doc = await Model.findOne({
            userId,
            date: normalizedDate,
            $or: [{ kind: { $exists: false } }, { kind: DOCUMENT_KIND.REPORT }]
        }).lean();
    }
    return doc;
}

/** GET /api/reports/daily/history-summary?userId=&date=YYYY-MM-DD */
export const getDailyReportHistorySummary = async (req, res) => {
    try {
        const userId = String(req.query.userId || '').trim();
        const date = String(req.query.date || '').split('T')[0];
        if (!userId) {
            return res.status(400).json({ ok: false, message: 'userId is required' });
        }
        if (!date) {
            return res.status(400).json({ ok: false, message: 'date is required' });
        }
        const data = await buildDailyReportHistorySummary(req.user, userId, date);
        return res.status(200).json({ ok: true, data });
    } catch (error) {
        const status = error.status || 500;
        return res.status(status).json({
            ok: false,
            message: error.message || 'Failed to load report history summary'
        });
    }
};

export const getReportsByUser = async (req, res) => {
    const { userId, period } = req.params;
    const kind = resolveKind(req);
    const Model = resolveModel(period, res);
    if (!Model) return;

    try {
        const reports = await Model.find(listFilterForKind(kind, { userId })).sort({ date: -1 });
        res.status(200).json(reports);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};

export const getAllReports = async (req, res) => {
    const { period } = req.params;
    const group = req.user?.group;
    const kind = resolveKind(req);
    const Model = resolveModel(period, res);
    if (!Model) return;

    try {
        const effective = normalizeRole(req.user?.role, req.user?.degree);
        const base = isFullAdminRole(effective) ? {} : { group };

        const reports = await Model.find(listFilterForKind(kind, base)).sort({ date: -1 });
        res.status(200).json(reports);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};

export const getTeamReports = async (req, res) => {
    const { groupID, period } = req.params;
    const kind = resolveKind(req);
    const Model = resolveModel(period, res);
    if (!Model) return;

    try {
        const effective = normalizeRole(req.user?.role, req.user?.degree);
        if (!isFullAdminRole(effective) && groupID !== req.user?.group) {
            return res.status(403).json({ message: 'You can only view your own team\'s reports' });
        }

        const reports = await Model.find(listFilterForKind(kind, { group: groupID })).sort({ date: -1 });
        res.status(200).json(reports);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};

export const updateReport = async (req, res) => {
    const { userId, username, group, date, period } = req.params;
    const { sections, state, rejectReason } = req.body;
    const user = req.user;
    const kind = resolveKind(req);
    const docKind = upsertKindValue(kind);
    const Model = resolveModel(period, res);
    if (!Model) return;

    try {
        const isSelfReport = String(userId) === String(user?._id || '');
        const effective = normalizeRole(user?.role, user?.degree);
        const isLeader = isFullAdminRole(effective) || effective === ROLES.GROUP_BOSS;
        const normalizedDate = normalizeReportDateByPeriodEST(date, period);
        const trimmedRejectReason = String(rejectReason || '').trim();
        const nextIsRejected = [3, 4].includes(Number(state));
        if (!isFullAdminRole(effective) && group !== user?.group) {
            return res.status(403).json({ message: 'You can only edit your own group\'s reports' });
        }
        if (nextIsRejected) {
            if (!isLeader) {
                return res.status(403).json({ message: 'Only group boss or super admin can reject reports' });
            }
            if (isSelfReport) {
                return res.status(400).json({ message: 'You cannot reject your own report' });
            }
            if (!trimmedRejectReason) {
                return res.status(400).json({ message: 'Reject reason is required' });
            }
        }

        /** Resubmit after rejection: member/boss may submit any past period for that saved report. */
        let existingForSubmitWindow = null;
        if (
            isSelfReport &&
            state === 2 &&
            (effective === ROLES.GROUP_MEMBER || effective === ROLES.GROUP_BOSS)
        ) {
            existingForSubmitWindow = await findByUserDate(Model, userId, normalizedDate, kind);
        }
        const isRejectedResubmit =
            existingForSubmitWindow &&
            [3, 4].includes(Number(existingForSubmitWindow.state));

        if (
            isSelfReport &&
            state === 2 &&
            (effective === ROLES.GROUP_MEMBER || effective === ROLES.GROUP_BOSS) &&
            !isRejectedResubmit
        ) {
            const targetDateKey = normalizedDate.toISOString().slice(0, 10);
            const isPlan = docKind === DOCUMENT_KIND.PLAN;

            if (isPlan) {
                if (!isAllowedPlanSubmitAnchorEST(targetDateKey, period)) {
                    return res.status(400).json({
                        message: 'Plan submit date is outside the allowed range (EST)'
                    });
                }
            } else if (period === 'daily') {
                // Allow any past or current day; block only future dates (EST).
                const todayEST = getESTDateKey();
                if (targetDateKey > todayEST) {
                    return res.status(400).json({
                        message: 'Daily submit cannot be a future date (EST)'
                    });
                }
            } else if (period === 'weekly') {
                // Allow any past or current week; block only future weeks (EST).
                const currentWeek = normalizeReportDateByPeriodEST(getESTDateKey(), 'weekly').toISOString().slice(0, 10);
                if (targetDateKey > currentWeek) {
                    return res.status(400).json({
                        message: 'Weekly submit cannot be a future week (EST)'
                    });
                }
            } else if (period === 'monthly') {
                // Allow any past or current month; block only future months (EST).
                const currentMonth = getESTMonthStartKey();
                if (targetDateKey > currentMonth) {
                    return res.status(400).json({
                        message: 'Monthly submit cannot be a future month (EST)'
                    });
                }
            }

            /**
             * A monthly or weekly plan opens with the income / outcome target from
             * Finance Management, so it cannot be submitted before that target exists.
             */
            if (isPlan && (period === 'monthly' || period === 'weekly')) {
                const target = await financeTargetFor(userId, period, targetDateKey);
                if (target.missing) {
                    return res.status(400).json({
                        message:
                            period === 'monthly'
                                ? 'This month has no financial plan yet, so the monthly plan cannot be submitted. Ask your team boss to set it in Finance Management.'
                                : 'This week has no financial plan yet, so the weekly plan cannot be submitted. Ask your team boss to set it in Finance Management.'
                    });
                }
            }
        }

        // One document per period: update the one already there, wherever it is
        // anchored, so an older anchor never turns into a second record.
        const existingInPeriod = await findInPeriod(Model, userId, normalizedDate, kind, period);
        const targetDate = existingInPeriod?.date ? new Date(existingInPeriod.date) : normalizedDate;

        const prevReport = existingInPeriod || (await findByUserDate(Model, userId, normalizedDate, kind));
        const resolvedRejectReason = nextIsRejected
            ? trimmedRejectReason
            : [2, 5, 6].includes(Number(state))
                ? ''
                : String(prevReport?.rejectReason || '');
        const updatedReport = await Model.findOneAndUpdate(
            { userId, date: targetDate, kind: docKind },
            {
                $set: {
                    userId,
                    username,
                    group,
                    date: targetDate,
                    kind: docKind,
                    sections,
                    state,
                    rejectReason: resolvedRejectReason
                }
            },
            {
                new: true,
                upsert: true
            }
        );

        if (nextIsRejected && updatedReport) {
            await sendReportRejectedNotification({
                period,
                report: updatedReport,
                actor: user,
                reason: trimmedRejectReason,
                previousState: Number(prevReport?.state || 0)
            });
        }

        res.status(200).json(updatedReport);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteReport = async (req, res) => {
    const { id, period } = req.params;
    const user = req.user;
    const Model = resolveModel(period, res);
    if (!Model) return;

    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).send(`No post with id: ${id}`);

    const report = await Model.findById(id);
    if (!report) return res.status(404).json({ message: 'Report not found' });

    const effective = normalizeRole(user?.role, user?.degree);
    if (!isFullAdminRole(effective) && report.group !== user?.group) {
        return res.status(403).json({ message: 'You can only delete your own group\'s reports' });
    }

    await Model.findByIdAndRemove(id);
    res.json({ message: "Report deleted successfully." });
};
