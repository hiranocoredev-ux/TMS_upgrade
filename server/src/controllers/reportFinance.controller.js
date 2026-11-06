import mongoose from 'mongoose';
import User from '../models/User.js';
import FinancePeriod from '../models/FinancePeriod.js';
import FinanceTransaction from '../models/FinanceTransaction.js';
import MonthlyFinancialPlan from '../models/MonthlyFinancialPlan.js';
import PeriodicFinancialPlan from '../models/PeriodicFinancialPlan.js';
import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';
import { hasAdminPrivileges, normalizeRole, ROLES } from '../utils/roleMapper.js';
import { monthRangeKeys, monthRangeLabel } from '../utils/businessMonth.js';

/**
 * The income / outcome block that opens every monthly and weekly plan and
 * report: the target comes from Finance Management, the result from the
 * member's own transactions inside the same date range.
 *
 * A plan may not be submitted while its target is missing, so the client asks
 * for this before letting the member send anything.
 */

const dayKey = (date) => new Date(date).toISOString().slice(0, 10);

const startOfDay = (value) => {
  const d = new Date(`${value}T00:00:00.000Z`);
  return d;
};

const endOfDay = (value) => {
  const d = new Date(`${value}T00:00:00.000Z`);
  d.setUTCHours(23, 59, 59, 999);
  return d;
};

const monthKeyOf = (dateKey) => String(dateKey).slice(0, 7);

const monthLabel = (monthKey) => {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const dayLabel = (dateKey) =>
  new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

/** The days a monthly report covers: the 6th through the 5th of the next month. */
const monthRange = (monthKey) => {
  const keys = monthRangeKeys(monthKey);
  return { from: keys.start, to: keys.end, label: `${monthLabel(monthKey)} · ${monthRangeLabel(monthKey)}` };
};

/**
 * The finance week a weekly report belongs to: the FinancePeriod covering the
 * report's own week, so plan and result are measured over the same days. Weeks
 * are ranked by how much they overlap the reported week.
 */
const weekRangeFor = async (anchorKey) => {
  const weekFrom = anchorKey;
  const weekTo = dayKey(new Date(startOfDay(anchorKey).getTime() + 6 * 86400000));

  const periods = await FinancePeriod.find({
    startDate: { $lte: endOfDay(weekTo) },
    endDate: { $gte: startOfDay(weekFrom) },
  })
    .select('_id definition month startDate endDate')
    .sort({ startDate: 1 })
    .lean();

  if (!periods.length) {
    return {
      period: null,
      from: weekFrom,
      to: weekTo,
      label: `${dayLabel(weekFrom)} – ${dayLabel(weekTo)}`,
    };
  }

  const overlap = (p) => {
    const start = Math.max(new Date(p.startDate).getTime(), startOfDay(weekFrom).getTime());
    const end = Math.min(new Date(p.endDate).getTime(), endOfDay(weekTo).getTime());
    return Math.max(0, end - start);
  };
  const best = periods.reduce((a, b) => (overlap(b) > overlap(a) ? b : a));

  return {
    period: best,
    from: dayKey(best.startDate),
    to: dayKey(best.endDate),
    label: `${best.definition} · ${dayLabel(dayKey(best.startDate))} – ${dayLabel(dayKey(best.endDate))}`,
  };
};

/**
 * The target a monthly or weekly document is measured against, with the range
 * it covers. Shared by the read endpoint and the submit guard.
 *
 * @param {string} userId
 * @param {'monthly'|'weekly'} period
 * @param {string} dateKey - the document's anchor date, YYYY-MM-DD
 */
export const financeTargetFor = async (userId, period, dateKey) => {
  if (period === 'monthly') {
    const monthKey = monthKeyOf(dateKey);
    const range = monthRange(monthKey);
    const doc = await MonthlyFinancialPlan.findOne({ userId, month: monthKey })
      .select('monthlyFinancialGoal')
      .lean();
    const amount = Number(doc?.monthlyFinancialGoal) || 0;
    return {
      range,
      plan: { amount, missing: !doc || amount <= 0, source: 'month', label: range.label },
    };
  }

  const week = await weekRangeFor(dateKey);
  const range = { from: week.from, to: week.to, label: week.label };
  let amount = 0;
  let doc = null;
  if (week.period) {
    doc = await PeriodicFinancialPlan.findOne({ userId, periodId: week.period._id })
      .select('periodicFinancialGoal')
      .lean();
    amount = Number(doc?.periodicFinancialGoal) || 0;
  }
  return {
    range,
    plan: {
      amount,
      missing: !week.period || !doc || amount <= 0,
      source: 'week',
      label: week.period ? week.period.definition : range.label,
      reason: week.period ? '' : 'No finance week covers this report week yet',
    },
  };
};

/** Who may read someone else's finance block. */
const mayReadOthers = (viewer, target) => {
  if (hasAdminPrivileges(viewer)) return true;
  if (normalizeRole(viewer?.role, viewer?.degree) === ROLES.GROUP_BOSS) {
    return !!viewer.group && viewer.group === target.group;
  }
  return false;
};

/**
 * GET /reports/finance-section?period=weekly|monthly&date=YYYY-MM-DD[&userId=]
 */
export const getReportFinanceSection = async (req, res, next) => {
  try {
    const period = req.query.period === 'weekly' ? 'weekly' : 'monthly';
    const date = String(req.query.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json(createErrorResponse('INVALID_DATE', 'date must be YYYY-MM-DD', 400));
    }

    const requestedId = String(req.query.userId || '').trim();
    let target = req.user;
    if (requestedId && requestedId !== String(req.user._id)) {
      if (!mongoose.isValidObjectId(requestedId)) {
        return res.status(400).json(createErrorResponse('INVALID_USER', 'Invalid userId', 400));
      }
      target = await User.findById(requestedId).select('_id name email group role degree').lean();
      if (!target) {
        return res.status(404).json(createErrorResponse('NOT_FOUND', 'User not found', 404));
      }
      if (!mayReadOthers(req.user, target)) {
        return res
          .status(403)
          .json(createErrorResponse('ACCESS_DENIED', 'You may not read this member\'s finance block', 403));
      }
    }

    /* ---------- the range this block covers, and the plan behind it ---------- */
    const { range, plan } = await financeTargetFor(target._id, period, date);

    /* ---------- what actually came in over that range ---------- */
    const rows = await FinanceTransaction.find({
      userId: target._id,
      date: { $gte: startOfDay(range.from), $lte: endOfDay(range.to) },
      status: { $in: ['accepted', 'pending'] },
    })
      .select('_id type status amount currency category source description date')
      .sort({ date: 1, createdAt: 1 })
      .lean();

    const result = { income: 0, outcome: 0, profit: 0, pendingIncome: 0, count: 0 };
    for (const tx of rows) {
      const amount = Number(tx.amount) || 0;
      if (tx.status === 'pending') {
        if (tx.type === 'income') result.pendingIncome += amount;
        continue;
      }
      if (tx.type === 'income') result.income += amount;
      else result.outcome += amount;
      result.count += 1;
    }
    result.profit = result.income - result.outcome;

    const percent = plan.amount > 0 ? Math.round((result.profit / plan.amount) * 1000) / 10 : null;

    res.json(
      createSuccessResponse({
        period,
        date,
        userId: String(target._id),
        range,
        plan,
        result,
        percent,
        // Listed on the report so the number can be read line by line.
        transactions: rows.map((tx) => ({
          id: String(tx._id),
          date: dayKey(tx.date),
          type: tx.type,
          status: tx.status,
          amount: Number(tx.amount) || 0,
          currency: tx.currency || 'USD',
          category: tx.category || '',
          source: tx.source || '',
          description: tx.description || '',
        })),
      }),
    );
  } catch (error) {
    next(error);
  }
};
