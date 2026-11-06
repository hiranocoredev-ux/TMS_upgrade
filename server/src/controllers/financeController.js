import { z } from 'zod';
import FinanceTransaction from '../models/FinanceTransaction.js';
import MonthlyFinancialPlan from '../models/MonthlyFinancialPlan.js';
import PeriodicFinancialPlan from '../models/PeriodicFinancialPlan.js';
import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';
import { normalizeRole, ROLES } from '../utils/roleMapper.js';
import mongoose from 'mongoose';
import Periodic from '../models/Periodic.js';
import UserPeriodicPlan from '../models/UserPeriodicPlan.js';
import User from '../models/User.js';
import {
  parseMonthToDateRange,
  isValidMonthFormat,
  calculateTransactionTotals,
  buildDateRangeFilter,
  buildTextSearchFilter,
  validateDateRange
} from '../utils/financeHelpers.js';

/* ======================================================
   VALIDATION SCHEMAS
====================================================== */

// Transaction validation schema
// Note: Approval/status logic removed - all transactions are final at creation time
const transactionSchema = z.object({
  userId: z.string(),
  type: z.enum(['deposit', 'expenditure']),
  date: z.union([z.string().datetime(), z.date()]),
  amount: z.number().min(0), // Amount must be >= 0
  description: z.string().optional(),
  source: z.string().optional()
});

const monthlyPlanSchema = z.object({
  userId: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  monthlyFinancialGoal: z.number().min(0).optional(),
  note: z.string().optional()
});

const periodicPlanSchema = z.object({
  userId: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  monthlyPlanId: z.string(),
  startDate: z.union([z.string().datetime(), z.date()]),
  endDate: z.union([z.string().datetime(), z.date()]),
  periodicFinancialGoal: z.number().min(0),
  note: z.string().optional()
});

/* ======================================================
   HELPERS
====================================================== */

const assertFinanceAdmin = (user) => {
  const role = normalizeRole(user.role);
  if (![ROLES.BOSS, ROLES.SUPER_ADMIN].includes(role)) {
    throw createErrorResponse('FORBIDDEN', 'Permission denied', 403);
  }
};

/* ======================================================
   MONTHLY FINANCIAL PLAN
====================================================== */

export const getMonthlyPlans = async (req, res, next) => {
  try {
    const plans = await MonthlyFinancialPlan.find()
      .populate('userId', 'name email')
      .sort({ month: -1 })
      .lean();

    res.json(createSuccessResponse({ plans }));
  } catch (err) {
    next(err);
  }
};

export const upsertMonthlyPlan = async (req, res, next) => {
  try {
    assertFinanceAdmin(req.user);

    const data = monthlyPlanSchema.parse(req.body);

    const plan = await MonthlyFinancialPlan.findOneAndUpdate(
      { userId: data.userId, month: data.month },
      {
        ...data,
        monthlyDepositTarget: data.monthlyFinancialGoal ?? 0,
        createdBy: req.user._id
      },
      { upsert: true, new: true }
    );

    res.json(createSuccessResponse({ plan }));
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   FINANCE OVERVIEW
====================================================== */

// Get finance overview/summary
// Note: Approval/status logic removed - all transactions are final
// Summary calculations:
// - deposits = sum of all deposit transactions in date range
// - expenditures = sum of all expenditure transactions in date range
// - gap = target - deposits - expenditures
export const getFinanceOverview = async (req, res, next) => {
  try {
    const { scope, month, periodId, userId } = req.query;

    let dateFilter = {};
    let depositTarget = 0;

    // Monthly view: include only transactions within that month
    if (scope === 'monthly') {
      if (!month) {
        return res.status(400).json(
          createErrorResponse('VALIDATION_ERROR', 'Month parameter required for monthly scope', 400)
        );
      }
      if (!isValidMonthFormat(month)) {
        return res.status(400).json(
          createErrorResponse('VALIDATION_ERROR', 'Invalid month format. Expected YYYY-MM', 400)
        );
      }
      dateFilter = parseMonthToDateRange(month);

      // Get monthly deposit target
      if (userId && userId !== 'all') {
        const plan = await MonthlyFinancialPlan.findOne({ userId, month });
        depositTarget = plan?.monthlyDepositTarget || 0;
      }
    }

    // Periodic view: include only transactions within selected start/end date
    if (scope === 'periodic') {
      if (!periodId) {
        return res.status(400).json(
          createErrorResponse('VALIDATION_ERROR', 'PeriodId parameter required for periodic scope', 400)
        );
      }
      const period = await Periodic.findById(periodId);
      if (!period) {
        return res.status(404).json(
          createErrorResponse('NOT_FOUND', 'Period not found', 404)
        );
      }
      dateFilter = { $gte: period.startDate, $lte: period.endDate };

      // Get periodic deposit target
      if (userId && userId !== 'all') {
        const plan = await UserPeriodicPlan.findOne({ userId, periodId });
        depositTarget = plan?.periodicFinancialGoal || 0;
      }
    }

    // Build query - filter by userId if specified (not 'all')
    const query = {
      date: dateFilter
    };
    if (userId && userId !== 'all') {
      query.userId = userId;
    }

    // Get all transactions in date range (no status filtering)
    const txs = await FinanceTransaction.find(query).lean();

    // Calculate deposits and expenditures
    // All transactions are final - no pending/accepted distinction
    const { deposits, expenditures } = calculateTransactionTotals(txs);

    const gap = depositTarget - deposits - expenditures;

    res.json(createSuccessResponse({
      depositTarget,
      deposits,
      expenditures,
      gap
    }));
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   PERIODIC FINANCIAL PLAN
====================================================== */

export const getPeriodicPlans = async (req, res, next) => {
  try {
    const { userId, month } = req.query;

    if (!userId || !month) {
      return res.json(createSuccessResponse({ plans: [] }));
    }

    if (!isValidMonthFormat(month)) {
      return res.status(400).json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid month format. Expected YYYY-MM', 400)
      );
    }

    const dateRange = parseMonthToDateRange(month);
    const startOfMonth = dateRange.$gte;
    const endOfMonth = dateRange.$lte;

    const plans = await PeriodicFinancialPlan.find({
      userId,
      startDate: { $lte: endOfMonth },
      endDate: { $gte: startOfMonth }
    }).sort({ startDate: 1 });

    res.json(createSuccessResponse({ plans }));
  } catch (err) {
    next(err);
  }
};

export const upsertPeriodicPlan = async (req, res, next) => {
  try {
    assertFinanceAdmin(req.user);

    const data = periodicPlanSchema.parse(req.body);

    const dateValidation = validateDateRange(data.startDate, data.endDate);
    if (!dateValidation.isValid) {
      return res.status(400).json(
        createErrorResponse('VALIDATION_ERROR', dateValidation.message, 400)
      );
    }

    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    // Overlap check
    const overlap = await PeriodicFinancialPlan.findOne({
      userId: data.userId,
      _id: { $ne: data._id },
      startDate: { $lte: end },
      endDate: { $gte: start }
    });

    if (overlap) {
      return res.status(400).json(
        createErrorResponse('VALIDATION_ERROR', 'This period overlaps with an existing plan', 400)
      );
    }

    const plan = await PeriodicFinancialPlan.findOneAndUpdate(
      { _id: data._id || new mongoose.Types.ObjectId() },
      {
        userId: data.userId,
        month: data.month,
        monthlyPlanId: data.monthlyPlanId,
        startDate: start,
        endDate: end,
        periodicDepositTarget: data.periodicFinancialGoal,
        note: data.note,
        createdBy: req.user._id
      },
      { upsert: true, new: true }
    );

    res.json(createSuccessResponse({ plan }));
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   TRANSACTIONS
====================================================== */

// Get transactions with filters
// Note: Status/approval filters removed - all transactions are final
export const getTransactions = async (req, res, next) => {
  try {
    const {
      userId,
      type,
      from,
      to,
      description,
      source
    } = req.query;

    const query = {};

    if (userId) query.userId = userId;
    if (type) query.type = type;
    
    const descriptionFilter = buildTextSearchFilter('description', description);
    if (descriptionFilter) query.description = descriptionFilter;
    
    const sourceFilter = buildTextSearchFilter('source', source);
    if (sourceFilter) query.source = sourceFilter;

    const dateFilter = buildDateRangeFilter(from, to);
    if (dateFilter) query.date = dateFilter;

    const transactions = await FinanceTransaction.find(query)
      .populate('userId', 'name email')
      .sort({ date: -1 })
      .lean();

    res.json(createSuccessResponse({ transactions }));
  } catch (err) {
    next(err);
  }
};

// Create transaction
// Note: All transactions are final at creation - no approval/status logic
// Only BOSS/SUPER_ADMIN can create transactions
export const createTransaction = async (req, res, next) => {
  try {
    assertFinanceAdmin(req.user);

    const data = transactionSchema.parse(req.body);

    const tx = await FinanceTransaction.create({
      ...data,
      createdBy: req.user._id
    });

    res.json(createSuccessResponse({ transaction: tx }));
  } catch (err) {
    next(err);
  }
};

// Update transaction
// Note: Approval/status logic removed - transactions can be updated by BOSS/SUPER_ADMIN only
export const updateTransaction = async (req, res, next) => {
  try {
    assertFinanceAdmin(req.user);

    const data = transactionSchema.partial().parse(req.body);

    const tx = await FinanceTransaction.findByIdAndUpdate(
      req.params.id,
      data,
      { new: true }
    );

    if (!tx) {
      return res.status(404).json(
        createErrorResponse('NOT_FOUND', 'Transaction not found')
      );
    }

    res.json(createSuccessResponse({ transaction: tx }));
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   PERIODS
====================================================== */

export const getPeriods = async (req, res, next) => {
  try {
    const { month } = req.query;

    const periods = await Periodic.find(
      month ? { month } : {}
    ).sort({ startDate: 1 });

    res.json(createSuccessResponse({ periods }));
  } catch (err) {
    next(err);
  }
};

export const createPeriod = async (req, res, next) => {
  try {
    const { month, startDate, endDate } = req.body;

    if (month && !isValidMonthFormat(month)) {
      return res.status(400).json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid month format. Expected YYYY-MM', 400)
      );
    }

    const dateValidation = validateDateRange(startDate, endDate);
    if (!dateValidation.isValid) {
      return res.status(400).json(
        createErrorResponse('VALIDATION_ERROR', dateValidation.message, 400)
      );
    }

    const period = await Periodic.create({
      month,
      startDate,
      endDate
    });

    res.json(createSuccessResponse({ period }));
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   USER PERIODIC PLANS
====================================================== */

export const getUserPeriodicPlans = async (req, res, next) => {
  try {
    const { periodicId } = req.query;

    const users = await User.find().lean();
    const plans = await UserPeriodicPlan.find({ periodicId }).lean();

    const rows = users.map((u) => {
      const plan = plans.find(
        (p) => p.userId.toString() === u._id.toString()
      );

      return {
        userId: u._id,
        name: u.name,
        periodicFinancialGoal: plan?.periodicFinancialGoal || 0,
        note: plan?.note || ''
      };
    });

    res.json(createSuccessResponse({ rows }));
  } catch (err) {
    next(err);
  }
};

export const upsertUserPeriodicPlan = async (req, res, next) => {
  try {
    const { userId, periodicId, periodicFinancialGoal, note } = req.body;

    const plan = await UserPeriodicPlan.findOneAndUpdate(
      { userId, periodicId },
      { periodicFinancialGoal, note },
      { upsert: true, new: true }
    );

    res.json(createSuccessResponse({ plan }));
  } catch (err) {
    next(err);
  }
};
