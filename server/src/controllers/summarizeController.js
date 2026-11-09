import mongoose from 'mongoose';
import { z } from 'zod';
import FinanceTransaction from '../models/FinanceTransaction.js';
import MonthlyFinancialPlan from '../models/MonthlyFinancialPlan.js';
import PeriodicFinancialPlan from '../models/PeriodicFinancialPlan.js';
import FinancePeriod from '../models/FinancePeriod.js';
import SummarizeCallCount from '../models/SummarizeCallCount.js';
import SummarizeGroupCount from '../models/SummarizeGroupCount.js';
import SummarizeProfileTarget from '../models/SummarizeProfileTarget.js';
import SummarizeWorktimeDeduction from '../models/SummarizeWorktimeDeduction.js';
import { withCountable } from '../utils/transactionReview.js';
import CitizenProfile from '../models/CitizenProfile.js';
import User from '../models/User.js';
import Group from '../models/Group.js';
import { AppError, createSuccessResponse } from '../utils/errors.js';
import { log as auditLog, getRequestMeta } from '../utils/audit.js';
import { isValidMonthFormat } from '../utils/financeHelpers.js';
import { getESTDateKey } from '../utils/estTime.js';
import { normalizeRole, ROLES } from '../constants/roles.js';
import { buildSummarize } from '../utils/summarize/buildSummarize.js';
import { monthRangeDates } from '../utils/businessMonth.js';
import { buildProfileSummarize } from '../utils/summarize/buildProfileSummarize.js';
import { applyWeekendWorkRules } from '../services/summarizeWeekendRules.js';
import {
  DEFAULT_GROUP_COUNT_PLAN,
  GROUP_COUNT_METRIC_VALUES,
  GROUP_METRICS_BY_TYPE,
  GROUP_TYPE_VALUES,
} from '../constants/summarize.js';

/** A month runs from the 6th to the 5th of the next month. */
const monthRange = (month) => {
  const { start, end } = monthRangeDates(month);
  return { start, end };
};

const toDateKey = (d) => new Date(d).toISOString().slice(0, 10);

const isSuperAdmin = (user) => !!user && normalizeRole(user.role, user.degree) === ROLES.SUPER_ADMIN;

/**
 * Default week for a month: the period containing today (EST), otherwise the
 * latest period that has already started, otherwise the first one.
 */
const pickDefaultPeriod = (periods) => {
  if (periods.length === 0) return null;
  const today = getESTDateKey();
  const current = periods.find((p) => toDateKey(p.startDate) <= today && today <= toDateKey(p.endDate));
  if (current) return current;
  const started = periods.filter((p) => toDateKey(p.startDate) <= today);
  return started.length ? started[started.length - 1] : periods[0];
};

/**
 * GET /summarize?mode=week|month&month=YYYY-MM[&periodId=<FinancePeriod id>]
 *
 * Summarize table for one week period or one month: finance (plan vs. profit),
 * call counts per member and the weekly group counts (getting citizen for normal
 * teams, job interviews / job offers for job teams). A month sums its week periods.
 *
 * Every signed-in user sees all members of all groups; only super admin may enter
 * the weekly counts. SUPER_ADMIN and ungrouped users are not listed as members.
 */
export const getSummarize = async (req, res, next) => {
  try {
    const mode = req.query.mode === 'week' ? 'week' : 'month';
    const month = req.query.month ? String(req.query.month) : getESTDateKey().slice(0, 7);
    if (!isValidMonthFormat(month)) {
      throw new AppError('INVALID_MONTH_FORMAT', 'Month must be in YYYY-MM format', 400);
    }

    const periods = await FinancePeriod.find({ month })
      .select('_id definition month startDate endDate')
      .sort({ startDate: 1, createdAt: 1 })
      .lean();

    let period = null;
    let range = monthRange(month);
    if (mode === 'week') {
      const { periodId } = req.query;
      if (periodId && !mongoose.isValidObjectId(periodId)) {
        throw new AppError('INVALID_PERIOD', 'Invalid periodId', 400);
      }
      period = periodId
        ? periods.find((p) => String(p._id) === String(periodId)) || null
        : pickDefaultPeriod(periods);
      if (periodId && !period) {
        throw new AppError('NOT_FOUND', 'Week period not found for this month', 404);
      }
      range = period ? { start: new Date(period.startDate), end: new Date(period.endDate) } : null;
    }
    // Weeks whose call / group counts make up this window.
    const periodIds = mode === 'week' ? (period ? [period._id] : []) : periods.map((p) => p._id);

    /* ---------- members listed (every team, for every signed-in user) ---------- */
    const reqUser = req.user;
    const userQuery = { role: { $ne: 'SUPER_ADMIN' }, group: { $nin: ['SUPER_ADMIN', 'ADMIN', null, ''] } };

    const [users, groups] = await Promise.all([
      User.find(userQuery).select('_id name email role group status avatarUrl workingRole').lean(),
      Group.find().select('code name sortOrder type').lean(),
    ]);
    const userIds = users.map((u) => u._id);

    /* ---------- plans, transactions and weekly counts for the window ---------- */
    const planByUser = new Map();
    let txRows = [];
    let callRows = [];
    let groupCountRows = [];
    let deductionRows = [];

    if (userIds.length > 0) {
      if (range) {
        if (mode === 'week') {
          const plans = await PeriodicFinancialPlan.find({ periodId: period._id, userId: { $in: userIds } })
            .select('userId periodicFinancialGoal')
            .lean();
          for (const p of plans) planByUser.set(String(p.userId), Number(p.periodicFinancialGoal) || 0);
        } else {
          const plans = await MonthlyFinancialPlan.find({ month, userId: { $in: userIds } })
            .select('userId monthlyFinancialGoal')
            .lean();
          for (const p of plans) planByUser.set(String(p.userId), Number(p.monthlyFinancialGoal) || 0);
        }

        const rows = await FinanceTransaction.aggregate([
          {
            // Only transactions that count in totals (created before approval was required, or fully approved).
            $match: withCountable({
              userId: { $in: userIds },
              date: { $gte: range.start, $lte: range.end },
              status: { $in: ['accepted', 'pending'] },
            }),
          },
          {
            $group: {
              _id: { userId: '$userId', type: '$type', status: '$status' },
              total: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
        ]);
        txRows = rows.map((r) => ({ ...r._id, total: r.total, count: r.count }));
      }

      if (periodIds.length > 0) {
        [callRows, groupCountRows, deductionRows] = await Promise.all([
          SummarizeCallCount.find({ periodId: { $in: periodIds }, userId: { $in: userIds } })
            .select('userId periodId plan result excluded')
            .lean(),
          SummarizeGroupCount.find({ periodId: { $in: periodIds } })
            .select('groupCode periodId metric plan result')
            .lean(),
          // WorkTime is scored on the weekly view only, so its deductions are too.
          mode === 'week'
            ? SummarizeWorktimeDeduction.find({ periodId: { $in: periodIds }, userId: { $in: userIds } })
                .select('userId points')
                .lean()
            : [],
        ]);
      }
    }

    // Excluding a member is a weekly decision; the monthly view ignores it.
    const excludedUserIds = new Set(
      mode === 'week' ? callRows.filter((r) => r.excluded).map((r) => String(r.userId)) : [],
    );

    let profileSummary = null;
    if (mode === 'month' && userIds.length > 0) {
      const [citizenProfiles, targetRows] = await Promise.all([
        CitizenProfile.find({ status: 'active', ownerUserId: { $in: userIds } })
          .select('ownerUserId accounts.platform accounts.size accounts.reviewCount')
          .lean(),
        SummarizeProfileTarget.find({ month, userId: { $in: userIds } })
          .select('userId profileTarget offerTarget offerResult')
          .lean(),
      ]);
      const targets = new Map(
        targetRows.map((row) => [
          String(row.userId),
          {
            profileTarget: row.profileTarget || 0,
            offerTarget: row.offerTarget || 0,
            offerResult: row.offerResult || 0,
          },
        ]),
      );
      profileSummary = buildProfileSummarize({ groups, users, profiles: citizenProfiles, targets });
    }

    const summary = buildSummarize({
      groups,
      users,
      planByUser,
      txRows,
      callRows,
      groupCountRows,
      periodIds,
      excludedUserIds,
      worktimeDeductionByUser: new Map(deductionRows.map((r) => [String(r.userId), Number(r.points) || 0])),
    });

    // Weekly view: say when today, or counted transactions of this month, fall
    // outside every week. Those never appear in any week, which looks like
    // missing data unless the page says why. Same date test as the week totals.
    let weekCoverage = null;
    if (mode === 'week' && userIds.length > 0) {
      const monthWindow = monthRange(month);
      const inSomeWeek = (date) =>
        periods.some((p) => date >= new Date(p.startDate) && date <= new Date(p.endDate));
      const monthRows = await FinanceTransaction.find(withCountable({
        userId: { $in: userIds },
        date: { $gte: monthWindow.start, $lte: monthWindow.end },
        status: { $in: ['accepted', 'pending'] },
      }))
        .select('date amount type')
        .lean();
      const outside = monthRows.filter((t) => !inSomeWeek(new Date(t.date)));
      const today = getESTDateKey();
      const todayInMonth = today >= toDateKey(monthWindow.start) && today <= toDateKey(monthWindow.end);
      weekCoverage = {
        today,
        todayCovered: !todayInMonth || periods.some((p) => toDateKey(p.startDate) <= today && today <= toDateKey(p.endDate)),
        outsideCount: outside.length,
        outsideIncome: outside.filter((t) => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0),
        outsideDates: [...new Set(outside.map((t) => toDateKey(t.date)))].sort(),
      };
    }

    res.json(
      createSuccessResponse({
        mode,
        month,
        range: range ? { start: range.start.toISOString(), end: range.end.toISOString() } : null,
        periods,
        period,
        canEditWeeklyInputs: isSuperAdmin(reqUser),
        defaultGroupCountPlan: DEFAULT_GROUP_COUNT_PLAN,
        groupMetricsByType: GROUP_METRICS_BY_TYPE,
        groupTypes: GROUP_TYPE_VALUES,
        canEditProfileTargets: isSuperAdmin(reqUser),
        profiles: profileSummary,
        weekCoverage,
        ...summary,
      }),
    );
  } catch (err) {
    next(err);
  }
};

const profileTargetSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
  targets: z
    .array(
      z.object({
        userId: z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid userId'),
        profileTarget: z.number().int().min(0).max(100000).optional(),
        offerTarget: z.number().int().min(0).max(100000).optional(),
        offerResult: z.number().int().min(0).max(100000).optional(),
      }),
    )
    .max(500),
});

/**
 * PUT /summarize/profile-targets   (super admin only)
 * Body: { month, targets: [{ userId, profileTarget, offerTarget, offerResult }] }
 *
 * The monthly profile target each member is measured against, plus the job
 * offers a job member was meant to land and actually landed.
 */
export const saveProfileTargets = async (req, res, next) => {
  try {
    const { month, targets } = profileTargetSchema.parse(req.body || {});

    const operations = targets.map((row) => ({
      updateOne: {
        filter: { userId: row.userId, month },
        update: {
          $set: {
            profileTarget: row.profileTarget ?? 0,
            offerTarget: row.offerTarget ?? 0,
            offerResult: row.offerResult ?? 0,
            updatedBy: req.user._id,
          },
        },
        upsert: true,
      },
    }));

    if (operations.length > 0) await SummarizeProfileTarget.bulkWrite(operations, { ordered: false });

    await auditLog(req, 'SUMMARIZE_PROFILE_TARGETS_SAVE', 'SUMMARIZE', month, {
      ...getRequestMeta(req),
      month,
      members: targets.length,
    });

    res.json(createSuccessResponse({ month, saved: targets.length }, 'Profile targets saved'));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /summarize/weekend-rules   (super admin only)
 * Body: { periodId?, dryRun? }
 *
 * Scores the week that just finished and sets the 12-hour Saturday / Sunday rule
 * for the members who came in under the threshold (and clears it for those who
 * did not). The scheduler runs this too; this is the manual trigger.
 */
export const runWeekendRules = async (req, res, next) => {
  try {
    const { periodId, dryRun } = req.body || {};
    if (periodId && !mongoose.isValidObjectId(periodId)) {
      throw new AppError('INVALID_PERIOD', 'Invalid periodId', 400);
    }
    const result = await applyWeekendWorkRules({ periodId, dryRun: !!dryRun });
    res.json(
      createSuccessResponse(
        result,
        result.period
          ? `Weekend rules ${result.dryRun ? 'previewed' : 'updated'} for ${result.weekend.saturday} and ${result.weekend.sunday}`
          : 'No finished week to score yet',
      ),
    );
  } catch (err) {
    next(err);
  }
};

const objectId = (label) => z.string().refine((v) => mongoose.isValidObjectId(v), `Invalid ${label}`);

const worktimeDeductionSchema = z.object({
  periodId: objectId('periodId'),
  userId: objectId('userId'),
  points: z
    .number()
    .int('Deduction must be a whole number of percent')
    .min(0, 'Deduction cannot be negative')
    .max(100, 'Deduction cannot be more than 100%'),
});

/**
 * PUT /summarize/worktime-deduction   (super admin only)
 * Body: { periodId, userId, points }
 *
 * Sets how many percentage points come off a member's Final WorkTime % for one
 * week. `points` is the new total for that member and week (0 clears it), so
 * repeating a request gives the same result.
 */
export const saveWorktimeDeduction = async (req, res, next) => {
  try {
    // The route is already limited to super admin; check again because this
    // changes a member's score.
    if (!isSuperAdmin(req.user)) {
      throw new AppError('INSUFFICIENT_PERMISSIONS', 'Only super admin can change WorkTime deductions', 403);
    }
    const { periodId, userId, points } = worktimeDeductionSchema.parse(req.body || {});

    const [period, user] = await Promise.all([
      FinancePeriod.findById(periodId).select('_id definition month').lean(),
      User.findById(userId).select('_id name').lean(),
    ]);
    if (!period) throw new AppError('NOT_FOUND', 'Week period not found', 404);
    if (!user) throw new AppError('INVALID_USER', 'User does not exist', 400);

    const filter = { userId: user._id, periodId: period._id };
    const previous = await SummarizeWorktimeDeduction.findOne(filter).select('points').lean();
    if (points === 0) {
      await SummarizeWorktimeDeduction.deleteOne(filter);
    } else {
      await SummarizeWorktimeDeduction.updateOne(
        filter,
        { $set: { points, updatedBy: req.user._id } },
        { upsert: true },
      );
    }

    await auditLog(req, 'SUMMARIZE_WORKTIME_DEDUCTION_UPDATE', 'FINANCE_PERIOD', period._id.toString(), {
      ...getRequestMeta(req),
      period: { definition: period.definition, month: period.month },
      userId: String(user._id),
      userName: user.name,
      from: previous?.points ?? 0,
      to: points,
    });

    res.json(
      createSuccessResponse(
        { periodId: String(period._id), userId: String(user._id), points },
        points ? `WorkTime deduction set to ${points}%` : 'WorkTime deduction cleared',
      ),
    );
  } catch (err) {
    next(err);
  }
};
const count = z.number().int('Counts must be whole numbers').min(0, 'Counts cannot be negative').nullable();

const weeklyInputsSchema = z.object({
  periodId: objectId('periodId'),
  callCounts: z
    .array(z.object({ userId: objectId('userId'), plan: count, result: count, excluded: z.boolean().optional() }))
    .max(2000)
    .default([]),
  groupCounts: z
    .array(
      z.object({
        groupCode: z.string().trim().min(1).max(64),
        metric: z.enum(GROUP_COUNT_METRIC_VALUES),
        plan: count,
        result: count,
      }),
    )
    .max(1500)
    .default([]),
});

/**
 * PUT /summarize/weekly-inputs   (super admin only)
 * Body: { periodId, callCounts: [{ userId, plan, result }],
 *         groupCounts: [{ groupCode, metric: 'citizen'|'interview'|'offer', plan, result }] }
 *
 * Saves one week's per-member rows (count plan + result, and whether the member is
 * excluded from that week) and the group counts (getting citizen for normal teams,
 * job offers for job teams). Send only the rows that changed; a member row with no
 * counts and no exclusion is cleared, and a cleared group metric falls back to the
 * default plan.
 */
export const saveWeeklyInputs = async (req, res, next) => {
  try {
    const data = weeklyInputsSchema.parse(req.body);

    const period = await FinancePeriod.findById(data.periodId).select('_id definition month').lean();
    if (!period) {
      throw new AppError('NOT_FOUND', 'Week period not found', 404);
    }

    const callUserIds = [...new Set(data.callCounts.map((c) => c.userId))];
    if (callUserIds.length > 0) {
      const found = await User.countDocuments({ _id: { $in: callUserIds } });
      if (found !== callUserIds.length) {
        throw new AppError('INVALID_USER', 'One or more users do not exist', 400);
      }
    }

    const updatedBy = req.user._id;
    const callOps = data.callCounts.map(({ userId, plan, result, excluded }) => {
      const filter = { userId, periodId: period._id };
      if (plan == null && result == null && !excluded) return { deleteOne: { filter } };
      return {
        updateOne: {
          filter,
          update: { $set: { plan, result: result ?? 0, excluded: !!excluded, updatedBy } },
          upsert: true,
        },
      };
    });
    const groupOps = data.groupCounts.map(({ groupCode, metric, plan, result }) => {
      const filter = { groupCode, periodId: period._id, metric };
      if (plan == null && result == null) return { deleteOne: { filter } };
      return {
        updateOne: {
          filter,
          update: { $set: { plan: plan ?? DEFAULT_GROUP_COUNT_PLAN, result: result ?? 0, updatedBy } },
          upsert: true,
        },
      };
    });

    await Promise.all([
      callOps.length ? SummarizeCallCount.bulkWrite(callOps) : null,
      groupOps.length ? SummarizeGroupCount.bulkWrite(groupOps) : null,
    ]);

    await auditLog(req, 'SUMMARIZE_WEEKLY_INPUTS_UPDATE', 'FINANCE_PERIOD', period._id.toString(), {
      ...getRequestMeta(req),
      period: { definition: period.definition, month: period.month },
      callCounts: data.callCounts,
      groupCounts: data.groupCounts,
    });

    res.json(
      createSuccessResponse(
        { periodId: String(period._id), callCounts: data.callCounts.length, groupCounts: data.groupCounts.length },
        'Weekly counts saved',
      ),
    );
  } catch (err) {
    next(err);
  }
};
