// import FinanceTransaction from '../models/FinanceTransaction.js';
// import MonthlyFinancialPlan from '../models/MonthlyFinancialPlan.js';
// import PeriodicFinancialPlan from '../models/PeriodicFinancialPlan.js';
// import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';
// import mongoose from 'mongoose';
// import FinancePeriod from '../models/FinancePeriod.js';
// import {
//     validateDateRange
// } from '../utils/financeHelpers.js';


// export const getFinanceMetrics = async (req, res, next) => {
//     try {
//         const userId = memberId === 'all' ? null : memberId || req.user._id;

//         if (!userId || !start || !end) {
//             throw createErrorResponse(
//                 'BAD_REQUEST',
//                 'userId, start, and end are required',
//                 400
//             );
//         }

//         console.log("================", userId, start, end)

//         const startDate = new Date(start);
//         const endDate = new Date(end);

//         validateDateRange(startDate, endDate);

//         const userObjectId = new mongoose.Types.ObjectId(userId);

//         /* ======================================================
//             TRANSACTION AGGREGATION (SHARED)
//         ====================================================== */

//         const aggregateTransactions = async (from, to) => {
//             const [result] = await FinanceTransaction.aggregate([
//                 {
//                     $match: {
//                         userId: userObjectId,
//                         date: { $gte: from, $lte: to }
//                     }
//                 },
//                 {
//                     $group: {
//                         _id: null,
//                         actualIncome: {
//                             $sum: {
//                                 $cond: [
//                                     {
//                                         $and: [
//                                             { $eq: ['$type', 'income'] },
//                                             { $eq: ['$status', 'accepted'] }
//                                         ]
//                                     },
//                                     '$amount',
//                                     0
//                                 ]
//                             }
//                         },
//                         actualExpense: {
//                             $sum: {
//                                 $cond: [
//                                     {
//                                         $and: [
//                                             { $eq: ['$type', 'outcome'] },
//                                             { $eq: ['$status', 'accepted'] }
//                                         ]
//                                     },
//                                     '$amount',
//                                     0
//                                 ]
//                             }
//                         },
//                         pendingIncome: {
//                             $sum: {
//                                 $cond: [
//                                     {
//                                         $and: [
//                                             { $eq: ['$type', 'income'] },
//                                             { $eq: ['$status', 'pending'] }
//                                         ]
//                                     },
//                                     '$amount',
//                                     0
//                                 ]
//                             }
//                         },
//                         budgetedPerformance: {
//                             $sum: {
//                                 $cond: [
//                                     {
//                                         $and: [
//                                             { $eq: ['$type', 'income'] },
//                                             { $in: ['$status', ['pending', 'accepted']] }
//                                         ]
//                                     },
//                                     '$amount',
//                                     0
//                                 ]
//                             }
//                         }
//                     }
//                 }
//             ]);

//             return result ? {
//                 actualIncome: result?.actualIncome || 0,
//                 actualExpense: result?.actualExpense || 0,
//                 pendingIncome: result?.pendingIncome || 0,
//                 budgetedPerformance: result?.budgetedPerformance || 0
//             } : {
//                 actualIncome: 0,
//                 actualExpense: 0,
//                 pendingIncome: 0,
//                 budgetedPerformance: 0
//             };
//         };

//         const monthKey = startDate.toISOString().slice(0, 7); // YYYY-MM

//         /* ======================================================
//             WEEKLY METRICS
//         ====================================================== */

//         const periods = await FinancePeriod.find({
//             month: monthKey
//         }).lean();
//         console.log("=============periods=============", periods)
//         const periodIds = periods.map(p => p._id);
//         console.log("=============periodIds=============", periodIds)

//         const weeklyPlans = await PeriodicFinancialPlan.find({
//             userId: userObjectId,
//             periodId: { $in: periodIds }
//         })
//             .populate('periodId') // IMPORTANT
//             .lean();

//         const weeklyMetrics = [];

//         for (const plan of weeklyPlans) {
//             const tx = await aggregateTransactions(plan.periodId.startDate, plan.periodId.endDate);

//             weeklyMetrics.push({
//                 target: plan.periodicFinancialGoal,
//                 period: plan.periodId.definition,
//                 ...tx,
//                 gap: plan.periodicFinancialGoal - tx.actualIncome
//             });
//         }
//         // const monthlyTransactions = await FinanceTransaction.find({
//         //     userId: userObjectId,
//         //     date: { $gte: startDate, $lte: endDate }
//         //   }).lean();
//         //   const calculateMetricsFromTransactions = (transactions) => {
//         //     let actualIncome = 0;
//         //     let actualExpense = 0;
//         //     let pendingIncome = 0;
//         //     let budgetedPerformance = 0;

//         //     for (const tx of transactions) {
//         //       if (tx.type === 'income') {
//         //         if (tx.status === 'accepted') {
//         //           actualIncome += tx.amount;
//         //           budgetedPerformance += tx.amount;
//         //         } else if (tx.status === 'pending') {
//         //           pendingIncome += tx.amount;
//         //           budgetedPerformance += tx.amount;
//         //         }
//         //       }

//         //       if (tx.type === 'outcome' && tx.status === 'accepted') {
//         //         actualExpense += tx.amount;
//         //       }
//         //     }

//         //     return {
//         //       actualIncome,
//         //       actualExpense,
//         //       pendingIncome,
//         //       budgetedPerformance
//         //     };
//         //   };
//         // const weeklyMetrics = weeklyPlans.map(plan => {
//         //     const { startDate, endDate } = plan.periodId;

//         //     const txs = monthlyTransactions.filter(
//         //       t => t.date >= startDate && t.date <= endDate
//         //     );

//         //     const metrics = calculateMetricsFromTransactions(txs);

//         //     return {
//         //       period: plan.periodId.definition,
//         //       target: plan.periodicFinancialGoal,
//         //       ...metrics,
//         //       gap: plan.periodicFinancialGoal - metrics.actualIncome
//         //     };
//         //   });

//         console.log("=============weeklyPlans=============", weeklyPlans)

//         /* ======================================================
//             MONTHLY METRICS
//         ====================================================== */

//         const monthlyPlan = await MonthlyFinancialPlan.findOne({
//             userId: userObjectId,
//             month: monthKey
//         }).lean();

//         const monthlyTx = await aggregateTransactions(startDate, endDate);

//         const monthlyTarget = monthlyPlan?.monthlyFinancialGoal || 0;

//         const monthlyMetrics = {
//             ...monthlyTx,
//             target: monthlyTarget,
//             gap: monthlyTarget - monthlyTx.actualIncome
//         };

//         /* ======================================================
//             YEARLY METRICS
//         ====================================================== */

//         const year = startDate.getUTCFullYear();
//         const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
//         const yearEnd = new Date(`${year}-12-31T23:59:59.999Z`);

//         const yearlyTx = await aggregateTransactions(yearStart, yearEnd);

//         const yearlyPlans = await MonthlyFinancialPlan.find({
//             userId: userObjectId,
//             month: { $regex: `^${year}` }
//         }).lean();

//         const yearlyTarget = yearlyPlans.reduce(
//             (sum, p) => sum + (p.monthlyFinancialGoal || 0),
//             0
//         );

//         const yearlyMetrics = {
//             ...yearlyTx,
//             target: yearlyTarget,
//             gap: yearlyTarget - yearlyTx.actualIncome
//         };

//         /* ======================================================
//             RESPONSE
//         ====================================================== */

//         console.log("=============yearlyMetrics=============", yearlyMetrics)
//         console.log("=============monthlyMetrics=============", monthlyMetrics)
//         console.log("=============weeklyMetrics=============", weeklyMetrics)

//         return res.json(createSuccessResponse({
//             metrics: {
//                 year: yearlyMetrics,
//                 month: monthlyMetrics,
//                 week: weeklyMetrics
//             }
//         }));
//         res.json(
//             createSuccessResponse({
//                 metrics: {
//                     year: yearlyMetrics,
//                     month: monthlyMetrics,
//                     week: weeklyMetrics
//                 }
//             })
//         );
//     } catch (err) {
//         next(err);
//     }
// };


import FinanceTransaction from '../models/FinanceTransaction.js';
import {
  monthKeyOfDateKey,
  quarterRangeKeys,
  quarterRangeLabel,
  yearRangeKeys,
} from '../utils/businessMonth.js';
import MonthlyFinancialPlan from '../models/MonthlyFinancialPlan.js';
import PeriodicFinancialPlan from '../models/PeriodicFinancialPlan.js';
import FinancePeriod from '../models/FinancePeriod.js';
import User from '../models/User.js';
import Group from '../models/Group.js';
import mongoose from 'mongoose';
import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';
import { validateDateRange } from '../utils/financeHelpers.js';
import { isCrossTeamFinanceOverviewViewer } from '../utils/financeTeamScope.js';
import { NON_MEMBER_ROLES, isSuperAdminRole, isNonMemberRole, normalizeRole } from '../constants/roles.js';
import { getRoleDisplayName } from '../utils/roleMapper.js';
import { withCountable } from '../utils/transactionReview.js';

/* ======================================================
   HELPERS
====================================================== */

// A transaction counts as "team wallet" unless explicitly flagged false
// (legacy rows without the field are treated as team wallet).
const isTeamWallet = (tx) => tx.throughTeamWallet !== false;

const calculateMetrics = (txs) => {
  let actualIncome = 0;
  let actualExpense = 0;
  let pendingIncome = 0;
  let budgetedPerformance = 0;
  let actualIncomeWallet = 0;
  let actualIncomeNoWallet = 0;
  let actualExpenseWallet = 0;
  let actualExpenseNoWallet = 0;

  for (const tx of txs) {
    const wallet = isTeamWallet(tx);
    if (tx.type === 'income') {
      if (tx.status === 'accepted') {
        actualIncome += tx.amount;
        budgetedPerformance += tx.amount;
        if (wallet) actualIncomeWallet += tx.amount;
        else actualIncomeNoWallet += tx.amount;
      } else if (tx.status === 'pending') {
        pendingIncome += tx.amount;
        budgetedPerformance += tx.amount;
      }
    }

    if (tx.type === 'outcome' && tx.status === 'accepted') {
      actualExpense += tx.amount;
      if (wallet) actualExpenseWallet += tx.amount;
      else actualExpenseNoWallet += tx.amount;
    }
  }

  return {
    actualIncome,
    actualExpense,
    pendingIncome,
    budgetedPerformance,
    actualIncomeWallet,
    actualIncomeNoWallet,
    actualExpenseWallet,
    actualExpenseNoWallet
  };
};

const filterByRange = (txs, start, end) =>
  txs.filter(t => t.date >= start && t.date <= end);

// Zeroed wallet-split fields to spread into a fresh total object.
const walletTotalFields = () => ({
  actualIncomeWallet: 0,
  actualIncomeNoWallet: 0,
  actualExpenseWallet: 0,
  actualExpenseNoWallet: 0
});

// Accumulate a single user's wallet-split metrics into a running total.
const addWalletTotals = (total, metrics) => {
  total.actualIncomeWallet += metrics.actualIncomeWallet;
  total.actualIncomeNoWallet += metrics.actualIncomeNoWallet;
  total.actualExpenseWallet += metrics.actualExpenseWallet;
  total.actualExpenseNoWallet += metrics.actualExpenseNoWallet;
};

const buildFullByUserArray = (users, byUserObj) =>
  users.map(u => {
    const metrics = byUserObj[u._id.toString()] || {
      actualIncome: 0,
      actualExpense: 0,
      pendingIncome: 0,
      budgetedPerformance: 0,
      target: 0,
      gap: 0
    };

    return {
      user: u,
      ...metrics
    };
  });

/* ======================================================
   CONTROLLER
====================================================== */

export const getFinanceMetrics = async (req, res, next) => {
  try {
    const { memberId, start, end, groupId } = req.query;
    const isAllMembers = memberId === 'all';
    const reqUser = req.user;

    if (!start || !end) {
      throw createErrorResponse(
        'BAD_REQUEST',
        'start and end are required',
        400
      );
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    validateDateRange(startDate, endDate);

    const isSuperAdmin = reqUser?.role === 'SUPER_ADMIN';
    const userGroup = reqUser?.group;
    const hasRealGroup = userGroup && !['SUPER_ADMIN', 'ADMIN'].includes(userGroup);
    const crossTeamOverview = isCrossTeamFinanceOverviewViewer(reqUser);

    let userObjectId = null;
    if (!isAllMembers) {
      const resolvedUserId = memberId || req.user?._id;
      if (!resolvedUserId) {
        throw createErrorResponse(
          'UNAUTHORIZED',
          'User authentication required',
          401
        );
      }
      if (!isSuperAdmin && hasRealGroup && !crossTeamOverview) {
        const target = await User.findById(resolvedUserId).select('group').lean();
        if (!target || target.group !== userGroup) {
          throw createErrorResponse(
            'ACCESS_DENIED',
            'You can only view finance for your team',
            403
          );
        }
      }
      userObjectId = new mongoose.Types.ObjectId(resolvedUserId);
    }

    const monthKey = monthKeyOfDateKey(startDate.toISOString().slice(0, 10));
    const year = startDate.getUTCFullYear();
    const yearSpan = yearRangeKeys(year);
    const yearStart = new Date(`${yearSpan.start}T00:00:00.000Z`);
    const yearEnd = new Date(`${yearSpan.endExclusive}T00:00:00.000Z`);

    /* ======================================================
       LOAD USERS (SOURCE OF TRUTH)
       - Exclude SUPER_ADMIN from finance
       - Only include users with a valid group (GROUP_1, etc. - not SUPER_ADMIN/ADMIN)
       - Filter by groupId if provided
       - Team-scoped users: restrict to their group (not cross-team overview viewers)
    ====================================================== */

    const userQuery = { role: { $ne: 'SUPER_ADMIN' } };
    if (!isAllMembers) {
      userQuery._id = userObjectId;
    }

    // Only users with a real group (exclude SUPER_ADMIN, ADMIN, null, empty)
    userQuery.group = { $nin: ['SUPER_ADMIN', 'ADMIN', null, ''] };

    // Team-only users: locked to their group (ignore forged groupId).
    // Cross-team overview viewers: all teams, or optional groupId filter.
    if (!isSuperAdmin && hasRealGroup && !crossTeamOverview) {
      userQuery.group = userGroup;
    } else if (groupId && groupId !== 'all') {
      userQuery.group = groupId;
    }

    const users = await User.find(userQuery)
      .select('_id name email role group')
      .lean();

    const scopedUserIds = users.map(u => u._id);

    /* ======================================================
       LOAD TRANSACTIONS (ONCE)
    ====================================================== */

    const txQuery = {
      date: { $gte: yearStart, $lte: yearEnd }
    };
    if (!isAllMembers) {
      txQuery.userId = userObjectId;
    } else if (scopedUserIds.length > 0) {
      txQuery.userId = { $in: scopedUserIds };
    } else {
      txQuery.userId = { $in: [] };
    }

    // Only transactions that count in totals (created before approval was required, or fully approved).
    const allTransactions = await FinanceTransaction.find(withCountable(txQuery)).lean();

    /* ======================================================
       GROUP_TRANSACTIONS BY USER
    ====================================================== */

    const txByUser = {};
    for (const tx of allTransactions) {
      const uid = tx.userId.toString();
      if (!txByUser[uid]) txByUser[uid] = [];
      txByUser[uid].push(tx);
    }

    /* ======================================================
       YEAR METRICS
    ====================================================== */

    const yearlyPlans = await MonthlyFinancialPlan.find(
      isAllMembers
        ? {
            userId: { $in: scopedUserIds },
            month: { $regex: `^${year}` }
          }
        : { userId: userObjectId, month: { $regex: `^${year}` } }
    ).lean();

    const yearlyTargetByUser = {};
    for (const p of yearlyPlans) {
      const uid = p.userId.toString();
      yearlyTargetByUser[uid] =
        (yearlyTargetByUser[uid] || 0) + (p.monthlyFinancialGoal || 0);
    }

    const yearlyByUser = {};
    let yearlyTotal = {
      actualIncome: 0,
      actualExpense: 0,
      pendingIncome: 0,
      budgetedPerformance: 0,
      target: 0,
      ...walletTotalFields()
    };

    for (const u of users) {
      const uid = u._id.toString();
      const metrics = calculateMetrics(txByUser[uid] || []);
      const target = yearlyTargetByUser[uid] || 0;

      yearlyByUser[uid] = {
        ...metrics,
        target,
        gap: target - metrics.actualIncome
      };

      yearlyTotal.actualIncome += metrics.actualIncome;
      yearlyTotal.actualExpense += metrics.actualExpense;
      yearlyTotal.pendingIncome += metrics.pendingIncome;
      yearlyTotal.budgetedPerformance += metrics.budgetedPerformance;
      yearlyTotal.target += target;
      addWalletTotals(yearlyTotal, metrics);
    }

    /* ======================================================
       MONTH METRICS
    ====================================================== */

    const monthlyPlans = await MonthlyFinancialPlan.find(
      isAllMembers
        ? { userId: { $in: scopedUserIds }, month: monthKey }
        : { userId: userObjectId, month: monthKey }
    ).lean();

    const monthlyTargetByUser = {};
    for (const p of monthlyPlans) {
      const uid = p.userId.toString();
      monthlyTargetByUser[uid] =
        (monthlyTargetByUser[uid] || 0) + (p.monthlyFinancialGoal || 0);
    }

    const monthlyByUser = {};
    let monthlyTotal = {
      actualIncome: 0,
      actualExpense: 0,
      pendingIncome: 0,
      budgetedPerformance: 0,
      target: 0,
      ...walletTotalFields()
    };

    for (const u of users) {
      const uid = u._id.toString();
      const txs = filterByRange(txByUser[uid] || [], startDate, endDate);
      const metrics = calculateMetrics(txs);
      const target = monthlyTargetByUser[uid] || 0;

      monthlyByUser[uid] = {
        ...metrics,
        target,
        gap: target - metrics.actualIncome
      };

      monthlyTotal.actualIncome += metrics.actualIncome;
      monthlyTotal.actualExpense += metrics.actualExpense;
      monthlyTotal.pendingIncome += metrics.pendingIncome;
      monthlyTotal.budgetedPerformance += metrics.budgetedPerformance;
      monthlyTotal.target += target;
      addWalletTotals(monthlyTotal, metrics);
    }

    /* ======================================================
       WEEK METRICS
    ====================================================== */

    const periods = await FinancePeriod.find({ month: monthKey }).sort({ createdAt: -1 }).lean();
    const periodIds = periods.map(p => p._id);

    const weeklyPlans = await PeriodicFinancialPlan.find(
      isAllMembers
        ? { userId: { $in: scopedUserIds }, periodId: { $in: periodIds } }
        : { userId: userObjectId, periodId: { $in: periodIds } }
    )
      .populate('periodId')
      .lean();

    const weeklyMetrics = periods.map(period => {
      const byUser = {};
      let total = {
        actualIncome: 0,
        actualExpense: 0,
        pendingIncome: 0,
        budgetedPerformance: 0,
        target: 0,
        ...walletTotalFields()
      };

      for (const u of users) {
        const uid = u._id.toString();
        const plan = weeklyPlans.find(
          p =>
            p.userId.toString() === uid &&
            p.periodId._id.toString() === period._id.toString()
        );

        const txs = filterByRange(
          txByUser[uid] || [],
          period.startDate,
          period.endDate
        );

        const metrics = calculateMetrics(txs);
        const target = plan?.periodicFinancialGoal || 0;

        byUser[uid] = {
          ...metrics,
          target,
          gap: target - metrics.actualIncome
        };

        total.actualIncome += metrics.actualIncome;
        total.actualExpense += metrics.actualExpense;
        total.pendingIncome += metrics.pendingIncome;
        total.budgetedPerformance += metrics.budgetedPerformance;
        total.target += target;
        addWalletTotals(total, metrics);
      }

      return {
        period: period.definition,
        total: {
          ...total,
          gap: total.target - total.actualIncome
        },
        byUser: buildFullByUserArray(users, byUser)
      };
    });

    /* ======================================================
       BY-GROUP SUMMARY (all groups can see - read-only summary)
       When viewing all members, return summary for every group
    ====================================================== */

    let byGroupSummary = [];
    if (
      isAllMembers &&
      (!groupId || groupId === 'all') &&
      crossTeamOverview
    ) {
      const allGroupUsers = await User.find({
        role: { $ne: 'SUPER_ADMIN' },
        group: { $nin: ['SUPER_ADMIN', 'ADMIN', null, ''] }
      })
        .select('_id name email group')
        .lean();

      const byGroup = {};
      for (const u of allGroupUsers) {
        const g = u.group || 'NONE';
        if (!byGroup[g]) byGroup[g] = { group: g, actualIncome: 0, actualExpense: 0, pendingIncome: 0, target: 0, userCount: 0 };
        const uid = u._id.toString();
        const txs = filterByRange(txByUser[uid] || [], startDate, endDate);
        const m = calculateMetrics(txs);
        const target = monthlyTargetByUser[uid] || 0;
        byGroup[g].actualIncome += m.actualIncome;
        byGroup[g].actualExpense += m.actualExpense;
        byGroup[g].pendingIncome += m.pendingIncome;
        byGroup[g].target += target;
        byGroup[g].userCount += 1;
      }

      const groupList = await Group.find().sort({ sortOrder: 1, code: 1 }).lean();
      byGroupSummary = groupList.map(g => {
        const data = byGroup[g.code] || { actualIncome: 0, actualExpense: 0, pendingIncome: 0, target: 0, userCount: 0 };
        return {
          group: g.code,
          groupName: g.name,
          ...data,
          profit: data.actualIncome - data.actualExpense,
          gap: data.target - data.actualIncome
        };
      });
    }

    /* ======================================================
       RESPONSE
    ====================================================== */

    return res.json(
      createSuccessResponse({
        metrics: {
          year: {
            total: {
              ...yearlyTotal,
              gap: yearlyTotal.target - yearlyTotal.actualIncome
            },
            byUser: buildFullByUserArray(users, yearlyByUser)
          },
          month: {
            total: {
              ...monthlyTotal,
              gap: monthlyTotal.target - monthlyTotal.actualIncome
            },
            byUser: buildFullByUserArray(users, monthlyByUser)
          },
          week: weeklyMetrics
        },
        byGroupSummary
      })
    );
  } catch (err) {
    next(err);
  }
};

/**
 * GET /finance/quarter-profit?year=2026[&groupId=GROUP_1]
 *
 * Per-user profit for each calendar quarter of a year. Profit is derived exactly
 * like the Finance Overview: accepted income − accepted outcome. Scoping matches
 * the overview (excludes SUPER_ADMIN and ungrouped users; team-scoped viewers are
 * locked to their own group). Returns all four quarters so the client can switch
 * the quarter picker with no refetch.
 *
 * Response: { year, quarters:[1,2,3,4], users:[{ userId, name, email, group,
 *             avatarUrl, quarters:{1,2,3,4}, total }] }
 */
export const getQuarterProfit = async (req, res, next) => {
  try {
    const now = new Date();
    const year = Number.parseInt(req.query.year, 10) || now.getUTCFullYear();
    const groupId = req.query.groupId;

    // The jackpot leaderboard is company-wide: every viewer sees ALL members
    // (across every group) — no per-viewer team scoping. Accounts without a
    // group (super admin, admin, finance manager) are left out, except for a
    // super admin viewer, who also sees them, ranked and tagged with their role.
    // An explicit groupId filter is still honored if provided.
    const viewerIsSuperAdmin = isSuperAdminRole(req.user?.role, req.user?.degree);
    const userQuery = viewerIsSuperAdmin ? {} : { role: { $nin: NON_MEMBER_ROLES } };
    if (groupId && groupId !== 'all') {
      userQuery.group = groupId;
    }

    const users = await User.find(userQuery)
      .select('_id name email group avatarUrl role degree')
      .lean();
    const scopedUserIds = users.map((u) => u._id);

    const yearSpan = yearRangeKeys(year);
    const yearStart = new Date(`${yearSpan.start}T00:00:00.000Z`);
    const yearEnd = new Date(`${yearSpan.endExclusive}T00:00:00.000Z`);
    // Each quarter is three of this system's months, so Q3 is Jul 6 to Oct 5.
    const quarterBounds = [1, 2, 3, 4].map((q) => ({
      quarter: q,
      startsAt: new Date(`${quarterRangeKeys(year, q).start}T00:00:00.000Z`),
    }));

    // profit = accepted income − accepted outcome, grouped by (user, quarter).
    const rows = scopedUserIds.length
      ? await FinanceTransaction.aggregate([
          {
            $match: withCountable({
              status: 'accepted',
              userId: { $in: scopedUserIds },
              date: { $gte: yearStart, $lt: yearEnd },
            }),
          },
          {
            $group: {
              _id: {
                userId: '$userId',
                // Bucketed by the quarter's own boundaries, not the calendar's.
                quarter: {
                  $switch: {
                    branches: [...quarterBounds]
                      .reverse()
                      .map(({ quarter, startsAt }) => ({
                        case: { $gte: ['$date', startsAt] },
                        then: quarter,
                      })),
                    default: 1,
                  },
                },
              },
              profit: {
                $sum: {
                  $cond: [{ $eq: ['$type', 'income'] }, '$amount', { $multiply: ['$amount', -1] }],
                },
              },
            },
          },
        ])
      : [];

    const profitByUserQuarter = new Map(); // `${uid}|${q}` -> profit
    for (const r of rows) {
      profitByUserQuarter.set(`${String(r._id.userId)}|${r._id.quarter}`, r.profit);
    }

    const result = users.map((u) => {
      const uid = String(u._id);
      const quarters = {};
      let total = 0;
      for (let q = 1; q <= 4; q += 1) {
        const p = Math.round((profitByUserQuarter.get(`${uid}|${q}`) || 0) * 100) / 100;
        quarters[q] = p;
        total += p;
      }
      // Only present for a super admin viewer: a no-group account and its role name.
      const adminAccount = isNonMemberRole(u.role, u.degree);
      return {
        userId: uid,
        name: u.name,
        email: u.email,
        group: adminAccount ? '' : u.group || '',
        avatarUrl: u.avatarUrl || '',
        ...(adminAccount
          ? { adminAccount: true, roleLabel: getRoleDisplayName(normalizeRole(u.role, u.degree)) }
          : {}),
        quarters,
        total: Math.round(total * 100) / 100,
      };
    });

    res.json(
      createSuccessResponse({
        year,
        quarters: [1, 2, 3, 4],
        // So the page can say which days each quarter covers.
        quarterRanges: Object.fromEntries(
          [1, 2, 3, 4].map((q) => [q, { ...quarterRangeKeys(year, q), label: quarterRangeLabel(year, q) }]),
        ),
        users: result,
      })
    );
  } catch (err) {
    next(err);
  }
};
