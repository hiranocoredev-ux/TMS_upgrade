import mongoose from 'mongoose';
import { monthKeyOfDateKey } from '../utils/businessMonth.js';
import User from '../models/User.js';
import Worklog from '../models/Worklog.js';
import WorktimeTarget from '../models/WorktimeTarget.js';
import CompetitionWorktimeDayRule from '../models/CompetitionWorktimeDayRule.js';
import CompetitionWorktimeUserDayRule from '../models/CompetitionWorktimeUserDayRule.js';
import FinanceTransaction from '../models/FinanceTransaction.js';
import { withCountable } from '../utils/transactionReview.js';
import MonthlyFinancialPlan from '../models/MonthlyFinancialPlan.js';
import { normalizeRole, ROLES } from '../constants/roles.js';

const DEFAULT_TARGET_MINUTES = 13 * 60 + 30;

const addUtcDays = (dateKey, deltaDays) => {
  const base = new Date(`${dateKey}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
};

const isWeekend = (dateKey) => {
  const [y, m, dd] = dateKey.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, dd)).getUTCDay();
  return wd === 0 || wd === 6;
};

async function dailyTargetMinutesForUser(userId, dateKey) {
  // The monthly target is a month-level setting (a month runs 6th → 5th),
  // while a day rule is found by its date — its `month` field is just the
  // calendar month it was filed under.
  const monthKey = monthKeyOfDateKey(dateKey);
  const [monthTarget, dayRule, userDayRule] = await Promise.all([
    WorktimeTarget.findOne({ userId, month: monthKey }).select('targetMinutes').lean(),
    CompetitionWorktimeDayRule.findOne({ date: dateKey })
      .select('isHoliday targetDeltaMinutes')
      .lean(),
    CompetitionWorktimeUserDayRule.findOne({ userId, date: dateKey })
      .select('targetMinutes')
      .lean()
  ]);

  const baseParsed = Number(monthTarget?.targetMinutes);
  let target = Number.isFinite(baseParsed) ? baseParsed : DEFAULT_TARGET_MINUTES;
  const holiday = dayRule ? !!dayRule.isHoliday : isWeekend(dateKey);
  if (holiday) target = 0;
  if (dayRule) {
    target = Math.max(0, Math.min(1440, target + (Number(dayRule.targetDeltaMinutes) || 0)));
  }
  if (userDayRule && Number.isFinite(Number(userDayRule.targetMinutes))) {
    target = Math.max(0, Math.min(1440, Number(userDayRule.targetMinutes)));
  }
  return target;
}

function calculateFinanceMetrics(txs) {
  let actualIncome = 0;
  let actualExpense = 0;
  let pendingIncome = 0;

  for (const tx of txs) {
    if (tx.type === 'income') {
      if (tx.status === 'accepted') actualIncome += tx.amount;
      else if (tx.status === 'pending') pendingIncome += tx.amount;
    } else if (tx.type === 'outcome' && tx.status === 'accepted') {
      actualExpense += tx.amount;
    }
  }

  return { actualIncome, actualExpense, pendingIncome, profit: actualIncome - actualExpense };
}

/**
 * @param {string} viewerUser - req.user
 * @param {string} targetUserId
 * @param {string} dateKey YYYY-MM-DD
 */
export async function buildDailyReportHistorySummary(viewerUser, targetUserId, dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    const err = new Error('Invalid date. Use YYYY-MM-DD');
    err.status = 400;
    throw err;
  }

  const target = await User.findById(targetUserId)
    .select('name email group hubstaff_id role degree status')
    .lean();
  if (!target || target.status === 'disabled') {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const viewerRole = normalizeRole(viewerUser?.role, viewerUser?.degree);
  const isSuperAdmin = viewerRole === ROLES.SUPER_ADMIN;
  const viewerGroup = viewerUser?.group;

  if (!isSuperAdmin) {
    if (String(viewerUser._id) !== String(targetUserId)) {
      if (viewerRole !== ROLES.GROUP_BOSS || !viewerGroup || target.group !== viewerGroup) {
        const err = new Error('Access denied');
        err.status = 403;
        throw err;
      }
    }
  }

  const monthKey = dateKey.slice(0, 7);
  const monthStart = new Date(`${monthKey}-01T00:00:00.000Z`);
  const monthEnd = new Date(monthStart);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  monthEnd.setUTCMilliseconds(monthEnd.getUTCMilliseconds() - 1);

  const dayStart = new Date(`${dateKey}T00:00:00.000Z`);
  const dayEnd = new Date(`${dateKey}T23:59:59.999Z`);

  const userObjectId = new mongoose.Types.ObjectId(targetUserId);

  const [targetMinutes, worklog, monthTxs, dayTxs, monthlyPlan] = await Promise.all([
    dailyTargetMinutesForUser(targetUserId, dateKey),
    target.hubstaff_id
      ? Worklog.findOne({ member: String(target.hubstaff_id), date: dateKey })
          .select('real_time add_time total_time')
          .lean()
      : null,
    // Only transactions that count in totals (created before approval was required, or fully approved).
    FinanceTransaction.find(withCountable({
      userId: userObjectId,
      date: { $gte: monthStart, $lte: monthEnd }
    }))
      .select('type amount status date description category source currency')
      .lean(),
    FinanceTransaction.find(withCountable({
      userId: userObjectId,
      date: { $gte: dayStart, $lte: dayEnd }
    }))
      .select('type amount status date description category source currency')
      .sort({ date: -1 })
      .lean(),
    MonthlyFinancialPlan.findOne({ userId: userObjectId, month: monthKey })
      .select('monthlyFinancialGoal')
      .lean()
  ]);

  const workingSeconds = Math.max(0, Math.floor(Number(worklog?.real_time) || 0));
  const manualSeconds = Math.max(0, Math.floor(Number(worklog?.add_time) || 0));
  const totalSeconds = Math.min(24 * 3600, workingSeconds + manualSeconds);
  const targetSeconds = Math.max(0, targetMinutes * 60);
  const achievementPercent =
    targetSeconds > 0 ? Math.min(999, (totalSeconds / targetSeconds) * 100) : null;

  const monthFinance = calculateFinanceMetrics(monthTxs);
  monthFinance.target = monthlyPlan?.monthlyFinancialGoal || 0;
  monthFinance.monthKey = monthKey;

  const dayFinance = calculateFinanceMetrics(dayTxs);
  dayFinance.transactions = dayTxs.map((tx) => ({
    id: String(tx._id),
    type: tx.type,
    amount: tx.amount,
    status: tx.status,
    currency: tx.currency || 'USD',
    description: tx.description || '',
    category: tx.category || '',
    source: tx.source || '',
    date: tx.date
  }));

  return {
    user: {
      id: String(target._id),
      name: target.name || '',
      group: target.group || ''
    },
    date: dateKey,
    time: {
      targetSeconds,
      workingSeconds,
      manualSeconds,
      totalSeconds,
      achievementPercent
    },
    monthFinance,
    dayFinance
  };
}

export { addUtcDays };
