import express from "express";
import { z } from "zod";
import mongoose from "mongoose";
import {
  requireAuth,
  requireRole,
  requireFinanceManager,
  requireFinanceWriter,
} from "../middleware/auth.middleware.js";
import FinanceTransaction from "../models/FinanceTransaction.js";
import FinanceGoal from "../models/FinanceGoal.js";
import Budget from "../models/Budget.js";
import User from "../models/User.js";
import MonthlyFinancialPlan from "../models/MonthlyFinancialPlan.js";
import PeriodicFinancialPlan from "../models/PeriodicFinancialPlan.js";
import { createErrorResponse, createSuccessResponse } from "../utils/errors.js";
import { log as auditLog, getRequestMeta } from "../utils/audit.js";
import {
  normalizeRole,
  ROLES,
  hasAdminPrivileges,
} from "../utils/roleMapper.js";
import { financeTransactionPermissions } from "../utils/permissions/entityPermissions.js";
import {
  calculateFinancialMetrics,
  calculateFinancialMetricsForMonth,
  calculateFinancialMetricsForDateRange,
} from "../utils/financeCalculations.js";
import dotenv from "dotenv";
import FinancePeriod from "../models/FinancePeriod.js";
import Group from "../models/Group.js";
import * as financeOverviewController from "../controllers/financeOverviewController.js";
import {
  resolveFinanceListUserIdFilter,
  assertTransactionOwnerInFinanceScope,
  assertUserIdInFinanceScope,
  getUserIdsInGroup,
  isGlobalFinanceViewer,
  FINANCE_META_GROUPS,
} from "../utils/financeTeamScope.js";
import { isSuperAdminRole, canManageAllFinance, isSystemAdminRole } from "../constants/roles.js";
import {
  REVIEW,
  reviewStageOf,
  isLocked,
  isReviewerFinanceManager,
  isReviewerAdmin,
  isReviewer,
  changeBlockedReason,
  restartReviewFields,
  MAX_REVIEW_REASON_LENGTH,
  withCountable,
  countsInTotals,
} from "../utils/transactionReview.js";
dotenv.config();

const OUTCOME_APPROVAL_THRESHOLD = parseFloat(
  process.env.OUTCOME_APPROVAL_THRESHOLD || "1000",
);
const FINANCE_BLOCK_OVER_BUDGET =
  process.env.FINANCE_BLOCK_OVER_BUDGET === "true";

const router = express.Router();

router.use(requireAuth);

/**
 * Every transaction needs two things, on create and on every edit:
 * - transactionUrl: a full http(s) link to the transaction, e.g. a block
 *   explorer or payment page. Only http(s) is accepted so it is safe to open.
 * - description: what was received / paid and how (amount, coin, network...).
 */
const MAX_TRANSACTION_URL_LENGTH = 2000;
const TRANSACTION_URL_MESSAGE = "Transaction URL must be a full link starting with https:// or http://";
export const isTransactionUrl = (value) => {
  const text = String(value ?? "").trim();
  if (!text || text.length > MAX_TRANSACTION_URL_LENGTH) return false;
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};
const transactionUrlField = z
  .string({ required_error: "Transaction URL is required" })
  .trim()
  .min(1, "Transaction URL is required")
  .refine(isTransactionUrl, TRANSACTION_URL_MESSAGE);
const MAX_DESCRIPTION_LENGTH = 2000;
const descriptionField = z
  .string({ required_error: "Description is required" })
  .trim()
  .min(1, "Description is required")
  .max(MAX_DESCRIPTION_LENGTH, `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);

const transactionSchema = z.object({
  userId: z.string().min(1, "UserId is required"),
  type: z.enum(["income", "outcome"]),
  date: z.union([z.string().datetime(), z.date()]),
  amount: z.number().positive("Amount must be positive"),
  inputPrice: z.number().positive("Price must be positive").optional(),
  currency: z.string().default("USD"),
  category: z.string().optional(),
  source: z.string().optional(),
  description: descriptionField,
  transactionUrl: transactionUrlField,
  throughTeamWallet: z.boolean().optional(),
  isTron: z.boolean().optional(),
  attachments: z.array(z.string()).optional(),
  linkedProjectId: z.string().optional(),
  linkedJobTicketId: z.string().optional(),
  status: z.enum(["pending", "accepted", "canceled"]).optional(),
});

const updateTransactionSchema = transactionSchema.partial();

// Non-Tron transfers lose a 2% fee, so only 98% of the entered price lands.
const NON_TRON_RATE = 0.98;

/**
 * Effective Tron state of a transaction.
 * The Tron fee only ever applies to income: outcomes are always recorded at the
 * full price. For income, a transaction that did NOT go through the team wallet
 * is always Tron; otherwise the explicit flag decides, and a missing flag
 * (legacy rows) means not Tron.
 */
const resolveIsTron = (type, throughTeamWallet, isTron) => {
  if (type !== "income") return true;
  return throughTeamWallet === false ? true : isTron === true;
};

/** Final recorded amount for a given entered price and Tron state. */
const deriveAmount = (inputPrice, isTron) => {
  const price = Number(inputPrice) || 0;
  return Math.round((isTron ? price : price * NON_TRON_RATE) * 100) / 100;
};

const goalSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),
  incomeGoal: z.number().min(0, "Income goal must be non-negative"),
  expenseLimit: z
    .number()
    .min(0, "Expense limit must be non-negative")
    .optional()
    .nullable(),
});

// Helper to check budget availability
const getAvailableBudget = async (currency, date) => {
  const queryDate = new Date(date);

  // Find active budget for the currency and date
  const budget = await Budget.findOne({
    currency: currency,
    $or: [
      {
        periodType: "monthly",
        periodStart: { $lte: queryDate },
        periodEnd: { $gte: queryDate },
      },
      {
        periodType: "rolling",
      },
    ],
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!budget) {
    return { available: null, budget: null };
  }

  // Calculate approved outcomes in the period
  let dateQuery = {};
  if (budget.periodType === "monthly") {
    dateQuery = {
      date: {
        $gte: budget.periodStart,
        $lte: budget.periodEnd,
      },
    };
  } else {
    // Rolling: use all time or last 30 days as default
    const rollingStart = new Date(queryDate);
    rollingStart.setMonth(rollingStart.getMonth() - 1);
    dateQuery = {
      date: { $gte: rollingStart },
    };
  }

  const approvedOutcomes = await FinanceTransaction.aggregate([
    {
      $match: {
        type: "outcome",
        currency: currency,
        approvalStatus: { $in: ["approved", "not_required"] },
        status: { $ne: "canceled" }, // Exclude canceled transactions from budget calculations
        ...dateQuery,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
      },
    },
  ]);

  const totalApproved = approvedOutcomes[0]?.total || 0;
  const available = budget.startingAmount - totalApproved;

  return { available, budget };
};

// GET /finance/transactions - List with filters
router.get("/transactions", async (req, res, next) => {
  try {
    const {
      type,
      currency,
      category,
      source,
      memberId,
      groupId,
      from,
      to,
      approvalStatus,
      status,
      description,
      page = "1",
      limit = "20",
    } = req.query;

    const user = req.user;
    const query = {};

    if (
      groupId &&
      String(groupId).trim() &&
      String(groupId).trim() !== "all" &&
      !isGlobalFinanceViewer(user)
    ) {
      return res
        .status(403)
        .json(
          createErrorResponse(
            "ACCESS_DENIED",
            "groupId filter is only available to platform administrators",
            403,
          ),
        );
    }

    const userIdFilter = await resolveFinanceListUserIdFilter(
      user,
      memberId,
      groupId,
    );
    if (userIdFilter === null) {
      return res
        .status(403)
        .json(
          createErrorResponse(
            "ACCESS_DENIED",
            "You can only view transactions for your team",
            403,
          ),
        );
    }
    Object.assign(query, userIdFilter);

    if (type) {
      query.type = type;
    }

    if (currency) {
      query.currency = currency;
    }

    if (category) {
      query.category = category;
    }

    if (source) {
      query.source = source;
    }

    if (approvalStatus) {
      query.approvalStatus = approvalStatus;
    }

    if (status) {
      query.status = status;
    } else {
      // By default, exclude canceled transactions from calculations
      // But they can still be returned if explicitly requested
      // For now, we'll include all statuses in the query
      // The calculation utilities will handle filtering canceled transactions
    }

    if (description) {
      // Plain-text search over the description and the transaction URL. URLs
      // contain ?, +, ( and . which must not act as a pattern.
      const escaped = String(description).slice(0, 2000).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = { $regex: escaped, $options: "i" };
      query.$or = [{ description: match }, { transactionUrl: match }];
    }

    if (from || to) {
      query.date = {};
      if (from) {
        query.date.$gte = new Date(from);
      }
      if (to) {
        query.date.$lte = new Date(to);
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await Promise.all([
      FinanceTransaction.find(query)
        .populate("userId", "email name")
        .populate("approvedByUserId", "email name")
        .populate("createdByUserId", "name")
        .populate("fmApprovedByUserId", "name")
        .populate("adminApprovedByUserId", "name")
        .populate("reviewRejectedByUserId", "name")
        .populate("linkedJobTicketId", "title")
        .populate("attachments")
        .sort({ date: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      FinanceTransaction.countDocuments(query),
    ]);

    res.json(
      createSuccessResponse({
        // Every transaction is listed; `countsInTotals` says whether it is in the totals yet.
        transactions: transactions.map((t) => ({ ...t, countsInTotals: countsInTotals(t) })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      }),
    );
  } catch (error) {
    next(error);
  }
});

// GET /finance/transactions/:id
router.get("/transactions/:id", async (req, res, next) => {
  try {
    const transaction = await FinanceTransaction.findById(req.params.id)
      .populate("userId", "email name")
      .populate("approvedByUserId", "email name")
      .populate("linkedJobTicketId", "title")
      .populate("attachments");

    if (!transaction) {
      return res
        .status(404)
        .json(createErrorResponse("NOT_FOUND", "Transaction not found", 404));
    }

    const ownerId = transaction.userId._id
      ? transaction.userId._id
      : transaction.userId;
    const canView = await assertTransactionOwnerInFinanceScope(
      req.user,
      ownerId,
    );
    if (!canView) {
      return res
        .status(403)
        .json(
          createErrorResponse(
            "ACCESS_DENIED",
            "You do not have permission to view this transaction",
            403,
          ),
        );
    }

    res.json(createSuccessResponse({ transaction }));
  } catch (error) {
    next(error);
  }
});

// POST /finance/transactions - Create (boss / team boss / superadmin)
router.post(
  "/transactions",
  requireFinanceManager,
  async (req, res, next) => {
    try {
      const validatedData = transactionSchema.parse(req.body);

      // Derive the recorded amount from the entered price + Tron state. The
      // client sends both, but the server is authoritative. Callers that only
      // send `amount` (no `inputPrice`) keep their value as the entered price.
      const isTron = resolveIsTron(
        validatedData.type,
        validatedData.throughTeamWallet,
        validatedData.isTron,
      );
      const inputPrice =
        validatedData.inputPrice !== undefined
          ? validatedData.inputPrice
          : validatedData.amount;
      validatedData.isTron = isTron;
      validatedData.inputPrice = inputPrice;
      validatedData.amount = deriveAmount(inputPrice, isTron);

      // Validate required fields based on type
      if (validatedData.type === "outcome" && !validatedData.category) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              "VALIDATION_ERROR",
              "Category is required for outcome transactions",
              400,
            ),
          );
      }

      if (validatedData.type === "income" && !validatedData.source) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              "VALIDATION_ERROR",
              "Source is required for income transactions",
              400,
            ),
          );
      }

      // Determine userId: boss / finance manager can create for another user, otherwise use own userId
      let targetUserId = req.user._id;
      if (validatedData.userId) {
        const canSetOtherUser =
          hasAdminPrivileges(req.user) || canManageAllFinance(req.user.role, req.user.degree);
        if (!canSetOtherUser) {
          return res
            .status(403)
            .json(
              createErrorResponse(
                "ACCESS_DENIED",
                "Only team managers can create transactions for other users",
                403,
              ),
            );
        }
        // Validate target user exists and is in same group (unless super admin)
        const targetUser = await User.findById(validatedData.userId);
        if (!targetUser) {
          return res
            .status(404)
            .json(
              createErrorResponse(
                "USER_NOT_FOUND",
                "Target user not found",
                404,
              ),
            );
        }
        const reqGroup = req.user?.group;
        if (normalizeRole(req.user.role, req.user.degree) !== ROLES.SUPER_ADMIN && reqGroup && !['SUPER_ADMIN', 'ADMIN'].includes(reqGroup)) {
          if (targetUser.group !== reqGroup) {
            return res
              .status(403)
              .json(
                createErrorResponse(
                  "ACCESS_DENIED",
                  "You can only create transactions for users in your own group",
                  403,
                ),
              );
          }
        }
        targetUserId = validatedData.userId;
      }

      // Determine approval status
      let approvalStatus = "not_required";
      if (
        validatedData.type === "outcome" &&
        validatedData.amount >= OUTCOME_APPROVAL_THRESHOLD
      ) {
        approvalStatus = "pending";
      }

      // Determine transaction status (default to 'accepted' if not provided)
      const transactionStatus = validatedData.status || "accepted";

      // Check budget for outcomes
      if (validatedData.type === "outcome") {
        const { available, budget } = await getAvailableBudget(
          validatedData.currency || "USD",
          validatedData.date || new Date(),
        );

        if (budget && available !== null) {
          const remainingAfter = available - validatedData.amount;

          if (remainingAfter < 0) {
            if (FINANCE_BLOCK_OVER_BUDGET) {
              return res
                .status(400)
                .json(
                  createErrorResponse(
                    "BUDGET_EXCEEDED",
                    `Transaction exceeds available budget. Available: ${available}, Requested: ${validatedData.amount}`,
                    400,
                  ),
                );
            } else {
              // Warn but allow
              console.warn(
                `Budget warning: Transaction exceeds available budget. Available: ${available}, Requested: ${validatedData.amount}`,
              );
            }
          }
        }
      }

      // Convert date string to Date object
      const transactionData = {
        ...validatedData,
        date:
          validatedData.date instanceof Date
            ? validatedData.date
            : new Date(validatedData.date),
        userId: targetUserId,
        approvalStatus,
        status: transactionStatus,
        // Every new transaction starts the two-step review (finance manager, then admin).
        ...restartReviewFields(),
        createdByUserId: req.user._id,
        createdByRole: normalizeRole(req.user.role, req.user.degree),
      };

      // Remove userId from transactionData as it's not a field in the schema
      // delete transactionData.userId;

      const transaction = new FinanceTransaction(transactionData);
      await transaction.save();
      await transaction.populate("userId", "email name");
      await transaction.populate("linkedJobTicketId", "title");
      await transaction.populate("attachments");

      // Audit log
      await auditLog(
        req,
        "FINANCE_TRANSACTION_CREATE",
        "FINANCE_TRANSACTION",
        transaction._id.toString(),
        {
          ...getRequestMeta(req),
          transaction: {
            type: transaction.type,
            amount: transaction.amount,
            currency: transaction.currency,
            approvalStatus: transaction.approvalStatus,
          },
        },
      );

      const responseData = { transaction };

      // Add budget warning if applicable
      if (validatedData.type === "outcome") {
        const { available, budget } = await getAvailableBudget(
          validatedData.currency || "USD",
          transaction.date,
        );
        if (
          budget &&
          available !== null &&
          available - validatedData.amount < 0
        ) {
          responseData.budgetWarning = {
            available,
            requested: validatedData.amount,
            remaining: available - validatedData.amount,
          };
        }
      }

      res
        .status(201)
        .json(
          createSuccessResponse(
            responseData,
            "Transaction created successfully",
          ),
        );
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              "VALIDATION_ERROR",
              error.errors[0]?.message || "Validation error",
              400,
            ),
          );
      }
      next(error);
    }
  },
);

// PUT /finance/transactions/:id - Update (team managers)
router.put(
  "/transactions/:id",
  requireFinanceManager,
  async (req, res, next) => {
    try {
      const transaction = await FinanceTransaction.findById(req.params.id);

      if (!transaction) {
        return res
          .status(404)
          .json(createErrorResponse("NOT_FOUND", "Transaction not found", 404));
      }

      // Only own group can edit: get transaction owner's group
      const txOwner = await User.findById(transaction.userId).select("group").lean();
      const reqGroup = req.user?.group;
      if (req.user.role !== ROLES.SUPER_ADMIN && reqGroup && !["SUPER_ADMIN", "ADMIN"].includes(reqGroup)) {
        if (txOwner?.group !== reqGroup) {
          return res
            .status(403)
            .json(
              createErrorResponse(
                "ACCESS_DENIED",
                "You can only edit transactions for your own group",
                403,
              ),
            );
        }
      }

      const validatedData = updateTransactionSchema.parse(req.body);

      // The Accept / Cancel buttons send only `status`; anything else is an edit.
      const changedKeys = Object.keys(validatedData).filter((k) => validatedData[k] !== undefined);
      const statusOnly = changedKeys.length > 0 && changedKeys.every((k) => k === "status");

      // Approved transactions are locked; a group boss's submission is frozen while under review.
      const blocked = changeBlockedReason(transaction, req.user, statusOnly ? "status" : "edit");
      if (blocked) {
        return res.status(403).json(createErrorResponse("TRANSACTION_LOCKED", blocked, 403));
      }

      // Every edit must leave the transaction with a description and a valid
      // URL, so older transactions saved without them get both the next time
      // they are edited. (Accept / Cancel alone does not need them.)
      if (!statusOnly && validatedData.description === undefined && !String(transaction.description || "").trim()) {
        return res
          .status(400)
          .json(createErrorResponse("VALIDATION_ERROR", "Description is required", 400));
      }
      if (!statusOnly && validatedData.transactionUrl === undefined && !isTransactionUrl(transaction.transactionUrl)) {
        return res
          .status(400)
          .json(createErrorResponse("VALIDATION_ERROR", "Transaction URL is required", 400));
      }

      // Re-derive the recorded amount whenever any of its inputs change,
      // merging the patch over the stored document.
      if (
        validatedData.inputPrice !== undefined ||
        validatedData.amount !== undefined ||
        validatedData.isTron !== undefined ||
        validatedData.throughTeamWallet !== undefined ||
        validatedData.type !== undefined
      ) {
        const nextType = validatedData.type || transaction.type;
        const nextThroughTeamWallet =
          validatedData.throughTeamWallet !== undefined
            ? validatedData.throughTeamWallet
            : transaction.throughTeamWallet !== false;
        const nextIsTron = resolveIsTron(
          nextType,
          nextThroughTeamWallet,
          validatedData.isTron !== undefined
            ? validatedData.isTron
            : transaction.isTron === true,
        );
        const nextInputPrice =
          validatedData.inputPrice !== undefined
            ? validatedData.inputPrice
            : validatedData.amount !== undefined
              ? validatedData.amount
              : transaction.inputPrice != null
                ? transaction.inputPrice
                : transaction.amount;

        validatedData.throughTeamWallet = nextThroughTeamWallet;
        validatedData.isTron = nextIsTron;
        validatedData.inputPrice = nextInputPrice;
        validatedData.amount = deriveAmount(nextInputPrice, nextIsTron);
      }

      // Store old values for audit
      const oldValues = {
        amount: transaction.amount,
        type: transaction.type,
        approvalStatus: transaction.approvalStatus,
        status: transaction.status,
      };

      // Update approval status if amount changed for outcome
      if (
        validatedData.amount !== undefined &&
        transaction.type === "outcome"
      ) {
        if (validatedData.amount >= OUTCOME_APPROVAL_THRESHOLD) {
          if (transaction.approvalStatus === "not_required") {
            transaction.approvalStatus = "pending";
          }
        } else {
          transaction.approvalStatus = "not_required";
          transaction.approvedByUserId = undefined;
          transaction.approvedAt = undefined;
        }
      }

      // Check budget if updating outcome amount
      if (
        validatedData.type === "outcome" ||
        (transaction.type === "outcome" && validatedData.amount !== undefined)
      ) {
        const amountToCheck =
          validatedData.amount !== undefined
            ? validatedData.amount
            : transaction.amount;
        const { available, budget } = await getAvailableBudget(
          validatedData.currency || transaction.currency,
          validatedData.date || transaction.date,
        );

        if (budget && available !== null) {
          // Exclude current transaction amount from calculation
          const currentAmount = transaction.amount;
          const adjustedAvailable = available + currentAmount - amountToCheck;

          if (adjustedAvailable < 0) {
            if (FINANCE_BLOCK_OVER_BUDGET) {
              return res
                .status(400)
                .json(
                  createErrorResponse(
                    "BUDGET_EXCEEDED",
                    `Transaction exceeds available budget. Available: ${adjustedAvailable + amountToCheck}, Requested: ${amountToCheck}`,
                    400,
                  ),
                );
            }
          }
        }
      }

      // Convert date string to Date object if provided
      if (validatedData.date !== undefined) {
        transaction.date =
          validatedData.date instanceof Date
            ? validatedData.date
            : new Date(validatedData.date);
      }

      // Update other fields (including status)
      Object.keys(validatedData).forEach((key) => {
        if (
          key !== "date" &&
          key !== "userId" &&
          validatedData[key] !== undefined
        ) {
          transaction[key] = validatedData[key];
        }
      });

      // Handle userId update if boss wants to reassign transaction
      if (validatedData.userId !== undefined) {
        const targetUser = await User.findById(validatedData.userId);
        if (!targetUser) {
          return res
            .status(404)
            .json(
              createErrorResponse(
                "USER_NOT_FOUND",
                "Target user not found",
                404,
              ),
            );
        }
        const allowed = await assertUserIdInFinanceScope(
          req.user,
          validatedData.userId,
        );
        if (!allowed) {
          return res
            .status(403)
            .json(
              createErrorResponse(
                "ACCESS_DENIED",
                "You can only assign transactions to users in your team",
                403,
              ),
            );
        }
        transaction.userId = validatedData.userId;
      }

      // Approvals cover the data as it was; changing it sends the transaction
      // back to the start of the review. Editing a rejected one resubmits it.
      const stageBefore = reviewStageOf(transaction);
      if (!statusOnly && (stageBefore === REVIEW.FM_APPROVED || stageBefore === REVIEW.REJECTED)) {
        Object.assign(transaction, restartReviewFields());
        transaction.reviewRejectReason = "";
        transaction.reviewRejectedByUserId = null;
        transaction.reviewRejectedAt = null;
      }

      await transaction.save();
      await transaction.populate("userId", "email name");
      await transaction.populate("approvedByUserId", "email name");
      await transaction.populate("linkedJobTicketId", "title");
      await transaction.populate("attachments");

      // Audit log
      await auditLog(
        req,
        "FINANCE_TRANSACTION_UPDATE",
        "FINANCE_TRANSACTION",
        transaction._id.toString(),
        {
          ...getRequestMeta(req),
          oldValues,
          newValues: {
            amount: transaction.amount,
            type: transaction.type,
            approvalStatus: transaction.approvalStatus,
            status: transaction.status,
          },
          reviewStage: { before: stageBefore, after: reviewStageOf(transaction) },
        },
      );

      res.json(
        createSuccessResponse(
          { transaction },
          "Transaction updated successfully",
        ),
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              "VALIDATION_ERROR",
              error.errors[0]?.message || "Validation error",
              400,
            ),
          );
      }
      next(error);
    }
  },
);

// DELETE /finance/transactions/:id
router.delete(
  "/transactions/:id",
  requireFinanceManager,
  async (req, res, next) => {
    try {
      const transaction = await FinanceTransaction.findById(req.params.id);

      if (!transaction) {
        return res
          .status(404)
          .json(createErrorResponse("NOT_FOUND", "Transaction not found", 404));
      }

      // RBAC: plain members only delete their own (team bosses handled by group rule below)
      const isPlainMember =
        normalizeRole(req.user.role, req.user.degree) === ROLES.GROUP_MEMBER;
      if (
        isPlainMember &&
        transaction.userId.toString() !== req.user._id.toString()
      ) {
        return res
          .status(403)
          .json(
            createErrorResponse(
              "ACCESS_DENIED",
              "You do not have permission to delete this transaction",
              403,
            ),
          );
      }

      // Only own group can delete: boss/admin can only delete for their group
      const txOwner = await User.findById(transaction.userId).select("group").lean();
      const reqGroup = req.user?.group;
      if (req.user.role !== ROLES.SUPER_ADMIN && reqGroup && !["SUPER_ADMIN", "ADMIN"].includes(reqGroup)) {
        if (txOwner?.group !== reqGroup) {
          return res
            .status(403)
            .json(
              createErrorResponse(
                "ACCESS_DENIED",
                "You can only delete transactions for your own group",
                403,
              ),
            );
        }
      }

      // Locked (fully approved) and frozen (group boss submission under review)
      // transactions cannot be deleted by anyone.
      const deleteBlocked = changeBlockedReason(transaction, req.user, "delete");
      if (deleteBlocked) {
        return res.status(403).json(createErrorResponse("TRANSACTION_LOCKED", deleteBlocked, 403));
      }

      // Cannot delete approved transactions (unless boss/admin/finance manager)
      if (transaction.approvalStatus === "approved") {
        if (
          !canManageAllFinance(req.user.role, req.user.degree) &&
          !hasAdminPrivileges(req.user)
        ) {
          return res
            .status(403)
            .json(
              createErrorResponse(
                "CANNOT_DELETE",
                "Cannot delete approved transaction",
                403,
              ),
            );
        }
      }

      await transaction.deleteOne();

      // Audit log
      await auditLog(
        req,
        "FINANCE_TRANSACTION_DELETE",
        "FINANCE_TRANSACTION",
        transaction._id.toString(),
        {
          ...getRequestMeta(req),
          transaction: {
            type: transaction.type,
            amount: transaction.amount,
            currency: transaction.currency,
          },
        },
      );

      res.json(createSuccessResponse(null, "Transaction deleted successfully"));
    } catch (error) {
      next(error);
    }
  },
);

// POST /finance/transactions/:id/approve - Approve transaction (team managers)
router.post(
  "/transactions/:id/approve",
  requireFinanceManager,
  async (req, res, next) => {
    try {
      const transaction = await FinanceTransaction.findById(req.params.id);

      if (!transaction) {
        return res
          .status(404)
          .json(createErrorResponse("NOT_FOUND", "Transaction not found", 404));
      }

      const canApprove = await assertTransactionOwnerInFinanceScope(
        req.user,
        transaction.userId,
      );
      if (!canApprove) {
        return res
          .status(403)
          .json(
            createErrorResponse(
              "ACCESS_DENIED",
              "You can only approve transactions for your team",
              403,
            ),
          );
      }

      if (transaction.type !== "outcome") {
        return res
          .status(400)
          .json(
            createErrorResponse(
              "INVALID_TYPE",
              "Only outcome transactions require approval",
              400,
            ),
          );
      }

      if (isLocked(transaction)) {
        return res.status(403).json(createErrorResponse(
          "TRANSACTION_LOCKED",
          "This transaction is approved and locked. A Super Admin must unlock it first.",
          403,
        ));
      }

      if (transaction.approvalStatus !== "pending") {
        return res
          .status(400)
          .json(
            createErrorResponse(
              "INVALID_STATUS",
              `Transaction is not pending approval. Current status: ${transaction.approvalStatus}`,
              400,
            ),
          );
      }

      transaction.approvalStatus = "approved";
      transaction.approvedByUserId = req.user._id;
      transaction.approvedAt = new Date();

      await transaction.save();
      await transaction.populate("userId", "email name");
      await transaction.populate("approvedByUserId", "email name");

      // Audit log
      await auditLog(
        req,
        "FINANCE_TRANSACTION_APPROVE",
        "FINANCE_TRANSACTION",
        transaction._id.toString(),
        {
          ...getRequestMeta(req),
          transaction: {
            type: transaction.type,
            amount: transaction.amount,
            currency: transaction.currency,
          },
          approvedBy: {
            id: req.user._id,
            email: req.user.email,
            name: req.user.name,
          },
        },
      );

      res.json(
        createSuccessResponse(
          { transaction },
          "Transaction approved successfully",
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

// POST /finance/transactions/:id/reject - Reject transaction (team managers)
router.post(
  "/transactions/:id/reject",
  requireFinanceManager,
  async (req, res, next) => {
    try {
      const { reason } = req.body;
      const transaction = await FinanceTransaction.findById(req.params.id);

      if (!transaction) {
        return res
          .status(404)
          .json(createErrorResponse("NOT_FOUND", "Transaction not found", 404));
      }

      const canReject = await assertTransactionOwnerInFinanceScope(
        req.user,
        transaction.userId,
      );
      if (!canReject) {
        return res
          .status(403)
          .json(
            createErrorResponse(
              "ACCESS_DENIED",
              "You can only reject transactions for your team",
              403,
            ),
          );
      }

      if (isLocked(transaction)) {
        return res.status(403).json(createErrorResponse(
          "TRANSACTION_LOCKED",
          "This transaction is approved and locked. A Super Admin must unlock it first.",
          403,
        ));
      }

      if (transaction.approvalStatus !== "pending") {
        return res
          .status(400)
          .json(
            createErrorResponse(
              "INVALID_STATUS",
              `Transaction is not pending approval. Current status: ${transaction.approvalStatus}`,
              400,
            ),
          );
      }

      transaction.approvalStatus = "rejected";
      transaction.approvedByUserId = req.user._id;
      transaction.approvedAt = new Date();
      transaction.rejectionReason = reason || "";

      await transaction.save();
      await transaction.populate("userId", "email name");
      await transaction.populate("approvedByUserId", "email name");

      // Audit log
      await auditLog(
        req,
        "FINANCE_TRANSACTION_REJECT",
        "FINANCE_TRANSACTION",
        transaction._id.toString(),
        {
          ...getRequestMeta(req),
          transaction: {
            type: transaction.type,
            amount: transaction.amount,
            currency: transaction.currency,
          },
          rejectedBy: {
            id: req.user._id,
            email: req.user.email,
            name: req.user.name,
          },
          reason: reason || "",
        },
      );

      res.json(createSuccessResponse({ transaction }, "Transaction rejected"));
    } catch (error) {
      next(error);
    }
  },
);

/* =====================================================================
   Two-step review: finance manager approves, then super admin approves
   (which locks the transaction). A super admin's approval is final on its own,
   so it may also come first. See utils/transactionReview.js.
   POST /finance/transactions/:id/review/fm-approve      finance manager
   POST /finance/transactions/:id/review/admin-approve   super admin (with or without FM)
   POST /finance/transactions/:id/review/reject          either, { reason }
   POST /finance/transactions/:id/review/unlock          super admin, { reason }
   Each step only applies while the transaction is at the expected stage, so
   two reviewers clicking at once cannot both succeed.
===================================================================== */
const reviewReasonSchema = z.object({
  reason: z
    .string({ required_error: "A reason is required" })
    .trim()
    .min(1, "A reason is required")
    .max(MAX_REVIEW_REASON_LENGTH, `Reason must be at most ${MAX_REVIEW_REASON_LENGTH} characters`),
});

/** Match transactions at one of `stages`; transactions from before the review count as awaiting FM. */
const reviewStageFilter = (stages) =>
  stages.includes(REVIEW.AWAITING_FM)
    ? { $or: [{ reviewStage: { $in: stages } }, { reviewStage: { $exists: false } }, { reviewStage: null }] }
    : { reviewStage: { $in: stages } };

const REVIEW_STAGE_LABELS = {
  [REVIEW.AWAITING_FM]: "awaiting Finance Manager approval",
  [REVIEW.FM_APPROVED]: "approved by the Finance Manager, awaiting Admin approval",
  [REVIEW.APPROVED]: "approved and locked",
  [REVIEW.REJECTED]: "rejected",
};

const reviewRoute = ({ path, allowed, deniedMessage, fromStages, needsReason, buildUpdate, auditAction, successMessage }) =>
  router.post(`/transactions/:id/review/${path}`, async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json(createErrorResponse("INVALID_ID", "Invalid transaction id", 400));
      }
      if (!allowed(req.user)) {
        return res.status(403).json(createErrorResponse("INSUFFICIENT_PERMISSIONS", deniedMessage, 403));
      }
      const reason = needsReason ? reviewReasonSchema.parse(req.body || {}).reason : "";

      const existing = await FinanceTransaction.findById(id).select("reviewStage").lean();
      if (!existing) {
        return res.status(404).json(createErrorResponse("NOT_FOUND", "Transaction not found", 404));
      }

      const updated = await FinanceTransaction.findOneAndUpdate(
        { _id: id, ...reviewStageFilter(fromStages) },
        { $set: buildUpdate(req.user, reason, new Date()) },
        { new: true },
      );
      if (!updated) {
        return res.status(409).json(createErrorResponse(
          "REVIEW_STAGE_CHANGED",
          `This transaction is ${REVIEW_STAGE_LABELS[reviewStageOf(existing)]}. Refresh and try again.`,
          409,
        ));
      }

      await auditLog(req, auditAction, "FINANCE_TRANSACTION", id, {
        ...getRequestMeta(req),
        reviewStage: { before: reviewStageOf(existing), after: updated.reviewStage },
        ...(reason ? { reason } : {}),
      });

      await updated.populate([
        { path: "userId", select: "email name" },
        { path: "createdByUserId", select: "name" },
        { path: "fmApprovedByUserId", select: "name" },
        { path: "adminApprovedByUserId", select: "name" },
        { path: "reviewRejectedByUserId", select: "name" },
      ]);
      res.json(createSuccessResponse({ transaction: updated }, successMessage));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(createErrorResponse("VALIDATION_ERROR", error.errors[0]?.message || "Validation error", 400));
      }
      next(error);
    }
  });

reviewRoute({
  path: "fm-approve",
  allowed: isReviewerFinanceManager,
  deniedMessage: "Only a Finance Manager can give the first approval",
  fromStages: [REVIEW.AWAITING_FM],
  buildUpdate: (user, _reason, now) => ({
    reviewStage: REVIEW.FM_APPROVED,
    fmApprovedByUserId: user._id,
    fmApprovedAt: now,
  }),
  auditAction: "FINANCE_TRANSACTION_FM_APPROVE",
  successMessage: "Approved by Finance Manager",
});

reviewRoute({
  path: "admin-approve",
  allowed: isReviewerAdmin,
  deniedMessage: "Only a Super Admin can give the final approval",
  // Final on its own: also allowed before the finance manager has approved.
  fromStages: [REVIEW.AWAITING_FM, REVIEW.FM_APPROVED],
  buildUpdate: (user, _reason, now) => ({
    reviewStage: REVIEW.APPROVED,
    adminApprovedByUserId: user._id,
    adminApprovedAt: now,
  }),
  auditAction: "FINANCE_TRANSACTION_ADMIN_APPROVE",
  successMessage: "Approved and locked",
});

reviewRoute({
  path: "reject",
  allowed: isReviewer,
  deniedMessage: "Only a Finance Manager or Super Admin can reject",
  fromStages: [REVIEW.AWAITING_FM, REVIEW.FM_APPROVED],
  needsReason: true,
  buildUpdate: (user, reason, now) => ({
    reviewStage: REVIEW.REJECTED,
    reviewRejectedByUserId: user._id,
    reviewRejectedAt: now,
    reviewRejectReason: reason,
    fmApprovedByUserId: null,
    fmApprovedAt: null,
  }),
  auditAction: "FINANCE_TRANSACTION_REVIEW_REJECT",
  successMessage: "Rejected — it can now be edited and resubmitted",
});

reviewRoute({
  path: "unlock",
  allowed: isReviewerAdmin,
  deniedMessage: "Only a Super Admin can unlock a transaction",
  fromStages: [REVIEW.APPROVED],
  needsReason: true,
  buildUpdate: (user, reason, now) => ({
    ...restartReviewFields(),
    unlockedByUserId: user._id,
    unlockedAt: now,
    unlockReason: reason,
  }),
  auditAction: "FINANCE_TRANSACTION_UNLOCK",
  successMessage: "Unlocked — it now needs approval again",
});

// GET /finance/summary - Financial summary with breakdowns
// Supports: ?month=YYYY-MM OR ?from=...&to=... (for backward compatibility)
router.get("/summary", async (req, res, next) => {
  try {
    const { month, from, to, memberId, currency } = req.query;
    const user = req.user;

    let dateQuery = {};
    let monthStr = month;

    // Support month parameter (YYYY-MM) or from/to for backward compatibility
    if (month) {
      // Validate month format
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              "INVALID_MONTH_FORMAT",
              "Month must be in YYYY-MM format",
              400,
            ),
          );
      }

      // Calculate date range for the month
      const [year, monthNum] = month.split("-").map(Number);
      const monthStart = new Date(year, monthNum - 1, 1);
      const monthEnd = new Date(year, monthNum, 0, 23, 59, 59, 999);

      dateQuery = {
        $gte: monthStart,
        $lte: monthEnd,
      };
    } else if (from && to) {
      dateQuery = {
        $gte: new Date(from),
        $lte: new Date(to),
      };
    } else {
      return res
        .status(400)
        .json(
          createErrorResponse(
            "DATE_RANGE_REQUIRED",
            "Either month (YYYY-MM) or both from and to date parameters are required",
            400,
          ),
        );
    }

    const query = {
      date: dateQuery,
    };

    // RBAC: Members can only see their own transactions
    if (normalizeRole(user.role, user.degree) === ROLES.GROUP_MEMBER) {
      query.userId = user._id;
    } else if (memberId) {
      query.userId = memberId;
    }

    if (currency) {
      query.currency = currency;
    }

    // Exclude canceled transactions from calculations at DB level for efficiency
    // Note: Canceled transactions can still be returned if explicitly requested via status filter
    const calculationQuery = { ...query };
    if (!calculationQuery.status) {
      // Only exclude canceled if status filter not explicitly set
      calculationQuery.status = { $ne: "canceled" };
    }

    const allTransactions = await FinanceTransaction.find(withCountable(calculationQuery))
      .select("type amount status date")
      .lean();

    // Calculate metrics using new status-based logic
    let metrics;
    let target = 0;
    let monthlyPlan = null;

    const baseQuery = {};
    if (memberId) {
      baseQuery.userId = memberId; // specific member
    }

    if (monthStr) {
      // Check for MonthlyFinancialPlan
      // const userIdForPlan = normalizeRole(user.role, user.degree) === ROLES.GROUP_MEMBER ? user._id : (memberId || user._id);

      baseQuery.month = monthStr;

      const monthlyPlans = await MonthlyFinancialPlan.find(baseQuery).lean();
      if (monthlyPlans.length > 0) {
        target = monthlyPlans.reduce(
          (sum, plan) => sum + (plan.monthlyFinancialGoal || 0),
          0,
        );
      }

      metrics = calculateFinancialMetricsForMonth(
        allTransactions,
        monthStr,
        target,
      );
    } else {
      // For date range, check if there's a monthly plan that overlaps
      // const userIdForPlan = normalizeRole(user.role, user.degree) === ROLES.GROUP_MEMBER ? user._id : (memberId || user._id);
      // const startDate = new Date(from);
      // const endDate = new Date(to);

      // // Try to find monthly plans in the range
      // const monthlyPlans = await MonthlyFinancialPlan.find({
      //   userId: userIdForPlan,
      //   month: { $gte: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}` }
      // }).lean();

      // // For simplicity, use the first plan's goal if available
      // if (monthlyPlans.length > 0) {
      //   target = monthlyPlans[0].monthlyFinancialGoal;
      // }

      const startDate = new Date(from);
      const endDate = new Date(to);

      const startMonth = `${startDate.getFullYear()}-${String(
        startDate.getMonth() + 1,
      ).padStart(2, "0")}`;

      const endMonth = `${endDate.getFullYear()}-${String(
        endDate.getMonth() + 1,
      ).padStart(2, "0")}`;

      baseQuery.month = { $gte: startMonth, $lte: endMonth };

      const monthlyPlans = await MonthlyFinancialPlan.find(baseQuery).lean();

      // Sum monthlyFinancialGoal
      if (monthlyPlans.length > 0) {
        target = monthlyPlans.reduce(
          (sum, plan) => sum + (plan.monthlyFinancialGoal || 0),
          0,
        );
      }

      metrics = calculateFinancialMetricsForDateRange(
        allTransactions,
        startDate,
        endDate,
        target,
      );
    }

    // Legacy totals for backward compatibility
    const totalIncome = metrics.actualIncome;
    const totalOutcome = metrics.actualExpense;
    const net = totalIncome - totalOutcome;

    // Get finance goal for the month (if month parameter provided) - legacy FinanceGoal
    let goal = null;
    let goalProgress = null;
    if (monthStr) {
      const userIdForGoal =
        normalizeRole(user.role, user.degree) === ROLES.GROUP_MEMBER
          ? user._id
          : memberId || user._id;
      goal = await FinanceGoal.findOne({
        userId: userIdForGoal,
        month: monthStr,
      }).lean();

      if (goal) {
        // Calculate goal progress using actual income (accepted only)
        const incomeProgress =
          goal.incomeGoal > 0
            ? (metrics.actualIncome / goal.incomeGoal) * 100
            : 0;
        const expenseProgress =
          goal.expenseLimit && goal.expenseLimit > 0
            ? (metrics.actualExpense / goal.expenseLimit) * 100
            : null;

        goalProgress = {
          incomeGoal: goal.incomeGoal,
          incomeProgress: Math.min(incomeProgress, 100), // Cap at 100%
          incomeAchieved: metrics.actualIncome,
          expenseLimit: goal.expenseLimit,
          expenseProgress:
            expenseProgress !== null ? Math.min(expenseProgress, 100) : null,
          expenseUsed: metrics.actualExpense,
          isOverExpenseLimit: goal.expenseLimit
            ? metrics.actualExpense > goal.expenseLimit
            : false,
          isIncomeGoalMet: metrics.actualIncome >= goal.incomeGoal,
        };
      }
    }

    // Breakdown by category (outcome only, excluding canceled)
    const breakdownByCategory = await FinanceTransaction.aggregate([
      { $match: withCountable({ ...query, type: "outcome", status: { $ne: "canceled" } }) },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // Breakdown by member (excluding canceled transactions)
    const breakdownByMember = await FinanceTransaction.aggregate([
      { $match: withCountable({ ...query, status: { $ne: "canceled" } }) },
      {
        $group: {
          _id: "$userId",
          income: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$type", "income"] },
                    { $eq: ["$status", "accepted"] },
                  ],
                },
                "$amount",
                0,
              ],
            },
          },
          outcome: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$type", "outcome"] },
                    { $eq: ["$status", "accepted"] },
                  ],
                },
                "$amount",
                0,
              ],
            },
          },
          net: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$type", "income"] },
                    { $eq: ["$status", "accepted"] },
                  ],
                },
                "$amount",
                {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$type", "outcome"] },
                        { $eq: ["$status", "accepted"] },
                      ],
                    },
                    { $multiply: ["$amount", -1] },
                    0,
                  ],
                },
              ],
            },
          },
        },
      },
    ]);

    // Populate user info for breakdown by member - optimized to avoid N+1 queries
    const userIds = breakdownByMember.map((item) => item._id);
    const users = await User.find({ _id: { $in: userIds } })
      .select("email name")
      .lean();

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const memberBreakdown = breakdownByMember.map((item) => {
      const user = userMap.get(item._id.toString());
      return {
        user: user
          ? { id: user._id, email: user.email, name: user.name }
          : null,
        income: item.income,
        outcome: item.outcome,
        net: item.net,
      };
    });

    // Trend by month (excluding canceled transactions)
    const trendByMonth = await FinanceTransaction.aggregate([
      { $match: withCountable({ ...query, status: { $ne: "canceled" } }) },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
            type: "$type",
          },
          total: {
            $sum: {
              $cond: [{ $eq: ["$status", "accepted"] }, "$amount", 0],
            },
          },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    // Process trend data
    const trendMap = {};
    trendByMonth.forEach((item) => {
      const key = `${item._id.year}-${String(item._id.month).padStart(2, "0")}`;
      if (!trendMap[key]) {
        trendMap[key] = { month: key, income: 0, outcome: 0, net: 0 };
      }
      if (item._id.type === "income") {
        trendMap[key].income = item.total;
      } else {
        trendMap[key].outcome = item.total;
      }
      trendMap[key].net = trendMap[key].income - trendMap[key].outcome;
    });

    const trend = Object.values(trendMap).sort((a, b) =>
      a.month.localeCompare(b.month),
    );

    // Calculate available budget
    const currencyFilter = currency || "USD";
    const queryDate = monthStr ? new Date(dateQuery.$lte) : new Date(to);
    const { available, budget } = await getAvailableBudget(
      currencyFilter,
      queryDate,
    );

    res.json(
      createSuccessResponse({
        period: monthStr ? { month: monthStr } : { from, to },
        totals: {
          totalIncome,
          totalOutcome,
          net,
        },
        metrics: {
          actualIncome: metrics.actualIncome,
          actualExpense: metrics.actualExpense,
          pendingIncome: metrics.pendingIncome,
          budgetedPerformance: metrics.budgetedPerformance,
          gap: metrics.gap,
          target: target,
        },
        goalProgress,
        breakdownByCategory: breakdownByCategory.map((item) => ({
          category: item._id,
          total: item.total,
          count: item.count,
        })),
        breakdownByMember: memberBreakdown,
        trendByMonth: trend,
        availableBudget: available,
        budget: budget
          ? {
              periodType: budget.periodType,
              periodStart: budget.periodStart,
              periodEnd: budget.periodEnd,
              startingAmount: budget.startingAmount,
              currency: budget.currency,
            }
          : null,
      }),
    );
  } catch (error) {
    next(error);
  }
});

// GET /finance/goals - Get finance goal for a month
router.get("/goals", async (req, res, next) => {
  try {
    const { month } = req.query;
    const user = req.user;

    if (!month) {
      return res
        .status(400)
        .json(
          createErrorResponse(
            "MONTH_REQUIRED",
            "Month parameter (YYYY-MM) is required",
            400,
          ),
        );
    }

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res
        .status(400)
        .json(
          createErrorResponse(
            "INVALID_MONTH_FORMAT",
            "Month must be in YYYY-MM format",
            400,
          ),
        );
    }

    // Members can only see their own goals
    const userId =
      normalizeRole(user.role, user.degree) === ROLES.GROUP_MEMBER
        ? user._id
        : req.query.userId || user._id;

    const goal = await FinanceGoal.findOne({ userId, month }).lean();

    if (!goal) {
      return res
        .status(404)
        .json(
          createErrorResponse(
            "NOT_FOUND",
            "Finance goal not found for this month",
            404,
          ),
        );
    }

    res.json(createSuccessResponse({ goal }));
  } catch (error) {
    next(error);
  }
});

// PUT /finance/goals - Create or update finance goal for a month
router.put("/goals", async (req, res, next) => {
  try {
    const { month } = req.query;
    const user = req.user;

    if (isSystemAdminRole(user.role, user.degree)) {
      return res
        .status(403)
        .json(createErrorResponse("INSUFFICIENT_PERMISSIONS", "Finance is read-only for the Admin role", 403));
    }

    if (!month) {
      return res
        .status(400)
        .json(
          createErrorResponse(
            "MONTH_REQUIRED",
            "Month parameter (YYYY-MM) is required",
            400,
          ),
        );
    }

    // Members can only set their own goals
    const userId =
      normalizeRole(user.role, user.degree) === ROLES.GROUP_MEMBER
        ? user._id
        : req.body.userId || user._id;

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res
        .status(400)
        .json(
          createErrorResponse(
            "INVALID_MONTH_FORMAT",
            "Month must be in YYYY-MM format",
            400,
          ),
        );
    }

    const validatedData = goalSchema.parse({
      ...req.body,
      month, // Ensure month from query is used
    });

    // Find or create goal
    const goal = await FinanceGoal.findOneAndUpdate(
      { userId, month },
      {
        userId,
        month,
        incomeGoal: validatedData.incomeGoal,
        expenseLimit:
          validatedData.expenseLimit !== undefined
            ? validatedData.expenseLimit
            : null,
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      },
    );

    // Audit log
    await auditLog(
      req,
      "FINANCE_GOAL_UPDATE",
      "FINANCE_GOAL",
      goal._id.toString(),
      {
        ...getRequestMeta(req),
        goal: {
          month: goal.month,
          incomeGoal: goal.incomeGoal,
          expenseLimit: goal.expenseLimit,
        },
      },
    );

    res.json(
      createSuccessResponse({ goal }, "Finance goal updated successfully"),
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json(
          createErrorResponse(
            "VALIDATION_ERROR",
            error.errors[0]?.message || "Validation error",
            400,
          ),
        );
    }
    next(error);
  }
});

// GET /finance/team-summary - Team summary by month (team managers, privacy-enforced)
router.get(
  "/team-summary",
  requireFinanceManager,
  async (req, res, next) => {
    try {
      const { month, currency } = req.query;

      if (!month) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              "MONTH_REQUIRED",
              "Month parameter (YYYY-MM) is required",
              400,
            ),
          );
      }

      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              "INVALID_MONTH_FORMAT",
              "Month must be in YYYY-MM format",
              400,
            ),
          );
      }

      // Calculate date range for the month
      const [year, monthNum] = month.split("-").map(Number);
      const monthStart = new Date(year, monthNum - 1, 1);
      const monthEnd = new Date(year, monthNum, 0, 23, 59, 59, 999);

      const query = {
        date: {
          $gte: monthStart,
          $lte: monthEnd,
        },
      };

      if (currency) {
        query.currency = currency;
      }

      if (!isGlobalFinanceViewer(req.user)) {
        const teamIds = await getUserIdsInGroup(req.user.group);
        query.userId =
          teamIds.length > 0 ? { $in: teamIds } : req.user._id;
      }

      // Aggregate by user (PRIVACY: totals only, no descriptions or details)
      const perUserTotals = await FinanceTransaction.aggregate([
        { $match: withCountable(query) },
        {
          $group: {
            _id: "$userId",
            income: {
              $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
            },
            outcome: {
              $sum: { $cond: [{ $eq: ["$type", "outcome"] }, "$amount", 0] },
            },
            transactionCount: { $sum: 1 },
          },
        },
        {
          $addFields: {
            net: { $subtract: ["$income", "$outcome"] },
          },
        },
      ]);

      // Populate user info (only email/name, no sensitive data)
      const userSummaries = await Promise.all(
        perUserTotals.map(async (item) => {
          const user = await User.findById(item._id)
            .select("email name")
            .lean();
          return {
            user: user
              ? { id: user._id, email: user.email, name: user.name }
              : null,
            totals: {
              income: item.income,
              outcome: item.outcome,
              net: item.net,
              transactionCount: item.transactionCount,
            },
            // Note: No descriptions, categories, sources, or other sensitive details
          };
        }),
      );

      // Calculate team totals
      const teamTotals = perUserTotals.reduce(
        (acc, item) => ({
          income: acc.income + item.income,
          outcome: acc.outcome + item.outcome,
          transactionCount: acc.transactionCount + item.transactionCount,
        }),
        { income: 0, outcome: 0, transactionCount: 0 },
      );
      teamTotals.net = teamTotals.income - teamTotals.outcome;

      // Audit log (admin viewing team summary)
      await auditLog(req, "FINANCE_TEAM_SUMMARY_VIEW", "FINANCE", null, {
        ...getRequestMeta(req),
        month,
        currency: currency || "all",
      });

      res.json(
        createSuccessResponse({
          month,
          currency: currency || "all",
          teamTotals,
          perUserTotals: userSummaries,
          // Note: No sensitive transaction details (descriptions, etc.) are included
        }),
      );
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// MONTHLY FINANCIAL PLAN ROUTES
// ============================================

const monthlyPlanSchema = z.object({
  userId: z.string().min(1, "UserId is required"),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),
  monthlyFinancialGoal: z
    .number()
    .min(0, "Monthly financial goal must be non-negative"),
  note: z.string().optional(),
});

const updateMonthlyPlanSchema = monthlyPlanSchema.partial();

// POST /finance/monthly-plans - Create monthly plan (team managers)
router.post(
  "/monthly-plans",
  requireFinanceManager,
  async (req, res, next) => {
    try {
      const validatedData = monthlyPlanSchema.parse(req.body);

      // Validate userId exists and is in same group
      const user = await User.findById(validatedData.userId);
      if (!user) {
        return res
          .status(404)
          .json(createErrorResponse("USER_NOT_FOUND", "User not found", 404));
      }
      const reqGroup = req.user?.group;
      if (req.user.role !== ROLES.SUPER_ADMIN && reqGroup && !["SUPER_ADMIN", "ADMIN"].includes(reqGroup)) {
        if (user.group !== reqGroup) {
          return res
            .status(403)
            .json(
              createErrorResponse(
                "ACCESS_DENIED",
                "You can only create plans for users in your own group",
                403,
              ),
            );
        }
      }

      // Check if plan already exists for this user and month
      const existingPlan = await MonthlyFinancialPlan.findOne({
        userId: validatedData.userId,
        month: validatedData.month,
      });

      if (existingPlan) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              "PLAN_EXISTS",
              "Monthly financial plan already exists for this user and month",
              400,
            ),
          );
      }

      const plan = new MonthlyFinancialPlan({
        userId: validatedData.userId,
        month: validatedData.month,
        monthlyFinancialGoal: validatedData.monthlyFinancialGoal,
        note: validatedData.note || "",
        periodicPlanIds: [],
      });

      await plan.save();
      await plan.populate("userId", "email name");

      // Audit log
      await auditLog(
        req,
        "MONTHLY_FINANCIAL_PLAN_CREATE",
        "MONTHLY_FINANCIAL_PLAN",
        plan._id.toString(),
        {
          ...getRequestMeta(req),
          plan: {
            userId: plan.userId._id.toString(),
            month: plan.month,
            monthlyFinancialGoal: plan.monthlyFinancialGoal,
          },
        },
      );

      res
        .status(201)
        .json(
          createSuccessResponse(
            { plan },
            "Monthly financial plan created successfully",
          ),
        );
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              "VALIDATION_ERROR",
              error.errors[0]?.message || "Validation error",
              400,
            ),
          );
      }
      if (error.code === 11000) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              "DUPLICATE_PLAN",
              "Monthly financial plan already exists for this user and month",
              400,
            ),
          );
      }
      next(error);
    }
  },
);

// PUT /finance/monthly-plans/:id - Update monthly plan (team managers)
router.put(
  "/monthly-plans/:id",
  requireFinanceManager,
  async (req, res, next) => {
    try {
      const plan = await MonthlyFinancialPlan.findById(req.params.id);

      if (!plan) {
        return res
          .status(404)
          .json(
            createErrorResponse(
              "NOT_FOUND",
              "Monthly financial plan not found",
              404,
            ),
          );
      }

      const planUser = await User.findById(plan.userId).select("group").lean();
      const reqGroup = req.user?.group;
      if (req.user.role !== ROLES.SUPER_ADMIN && reqGroup && !["SUPER_ADMIN", "ADMIN"].includes(reqGroup)) {
        if (planUser?.group !== reqGroup) {
          return res
            .status(403)
            .json(
              createErrorResponse(
                "ACCESS_DENIED",
                "You can only edit plans for your own group",
                403,
              ),
            );
        }
      }

      const validatedData = updateMonthlyPlanSchema.parse(req.body);

      // Store old values for audit
      const oldValues = {
        monthlyFinancialGoal: plan.monthlyFinancialGoal,
        note: plan.note,
      };

      // Update fields
      if (validatedData.monthlyFinancialGoal !== undefined) {
        plan.monthlyFinancialGoal = validatedData.monthlyFinancialGoal;
      }
      if (validatedData.note !== undefined) {
        plan.note = validatedData.note;
      }

      await plan.save();
      await plan.populate("userId", "email name");

      // Audit log
      await auditLog(
        req,
        "MONTHLY_FINANCIAL_PLAN_UPDATE",
        "MONTHLY_FINANCIAL_PLAN",
        plan._id.toString(),
        {
          ...getRequestMeta(req),
          oldValues,
          newValues: {
            monthlyFinancialGoal: plan.monthlyFinancialGoal,
            note: plan.note,
          },
        },
      );

      res.json(
        createSuccessResponse(
          { plan },
          "Monthly financial plan updated successfully",
        ),
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              "VALIDATION_ERROR",
              error.errors[0]?.message || "Validation error",
              400,
            ),
          );
      }
      next(error);
    }
  },
);

/**
 * The members a finance overview lists, in reading order: by group, the group
 * boss first, then by name. Every signed-in user sees every team here; who may
 * *change* a plan is a separate question (see planEditScope).
 */
const overviewMembers = async (user, groupCode) => {
  const query = {
    role: { $ne: "SUPER_ADMIN" },
    group: { $nin: [...FINANCE_META_GROUPS, null, ""] },
    status: { $ne: "disabled" },
  };

  const wanted = groupCode && String(groupCode).trim() && String(groupCode).trim() !== "all"
    ? String(groupCode).trim()
    : null;
  if (wanted) query.group = wanted;

  const [users, groups] = await Promise.all([
    User.find(query).select("_id name email group role degree avatarUrl").lean(),
    Group.find().select("code name sortOrder type").sort({ sortOrder: 1, code: 1 }).lean(),
  ]);

  const order = new Map(groups.map((g, i) => [g.code, g.sortOrder ?? i]));
  const isBoss = (u) => normalizeRole(u.role, u.degree) === ROLES.GROUP_BOSS;

  const members = users
    .map((u) => ({
      id: String(u._id),
      name: u.name || u.email,
      email: u.email,
      group: u.group,
      avatarUrl: u.avatarUrl || "",
      isBoss: isBoss(u),
    }))
    .sort(
      (a, b) =>
        (order.get(a.group) ?? 99) - (order.get(b.group) ?? 99) ||
        String(a.group).localeCompare(String(b.group)) ||
        Number(b.isBoss) - Number(a.isBoss) ||
        a.name.localeCompare(b.name),
    );

  const present = new Set(members.map((m) => m.group));
  return {
    members,
    groups: groups.filter((g) => present.has(g.code)).map((g) => ({
      code: g.code,
      name: g.name || g.code,
      sortOrder: g.sortOrder ?? 0,
      type: g.type || "normal",
    })),
  };
};

/**
 * Who this viewer may edit plans for:
 *   canEdit false            → read only
 *   editableGroup null       → any team (super admin / finance admin)
 *   editableGroup "<code>"   → that team only (its group boss)
 */
const planEditScope = (user) => {
  // Admin sees every team's plans but finance is read-only for them.
  if (isSystemAdminRole(user?.role, user?.degree)) return { canEdit: false, editableGroup: null };
  if (isGlobalFinanceViewer(user)) return { canEdit: true, editableGroup: null };
  const role = normalizeRole(user?.role, user?.degree);
  if (role === ROLES.GROUP_BOSS && user?.group) {
    return { canEdit: true, editableGroup: user.group };
  }
  return { canEdit: false, editableGroup: null };
};

/**
 * GET /finance/monthly-plans/matrix?year=YYYY[&groupId=]
 *
 * One year of monthly goals as a grid: every member the viewer may see, with
 * the goal they carry in each month. The overview page reads this instead of
 * pulling every plan ever written.
 */
router.get("/monthly-plans/matrix", async (req, res, next) => {
  try {
    const year = String(req.query.year || "").trim() || String(new Date().getFullYear());
    if (!/^\d{4}$/.test(year)) {
      return res
        .status(400)
        .json(createErrorResponse("INVALID_YEAR", "Year must be YYYY", 400));
    }

    const { members, groups } = await overviewMembers(req.user, req.query.groupId);
    const memberIds = members.map((m) => m.id);

    const plans = memberIds.length
      ? await MonthlyFinancialPlan.find({
          userId: { $in: memberIds },
          month: { $regex: `^${year}-` },
        })
          .select("_id userId month monthlyFinancialGoal")
          .lean()
      : [];

    res.json(
      createSuccessResponse({
        year,
        groups,
        members,
        cells: plans.map((p) => ({
          planId: String(p._id),
          userId: String(p.userId),
          month: p.month,
          goal: Number(p.monthlyFinancialGoal) || 0,
        })),
        ...planEditScope(req.user),
      }),
    );
  } catch (error) {
    next(error);
  }
});

// GET /finance/monthly-plans - List monthly plans (team-scoped)
router.get("/monthly-plans", async (req, res, next) => {
  try {
    const { userId, month, groupId } = req.query;
    const user = req.user;

    const query = {};

    if (
      groupId &&
      String(groupId).trim() &&
      String(groupId).trim() !== "all" &&
      !isGlobalFinanceViewer(user)
    ) {
      return res
        .status(403)
        .json(
          createErrorResponse(
            "ACCESS_DENIED",
            "groupId filter is only available to platform administrators",
            403,
          ),
        );
    }

    const userIdFilter = await resolveFinanceListUserIdFilter(
      user,
      userId,
      groupId,
    );
    if (userIdFilter === null) {
      return res
        .status(403)
        .json(
          createErrorResponse(
            "ACCESS_DENIED",
            "You can only view plans for your team",
            403,
          ),
        );
    }
    Object.assign(query, userIdFilter);

    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              "INVALID_MONTH_FORMAT",
              "Month must be in YYYY-MM format",
              400,
            ),
          );
      }
      query.month = month;
    }

    const plans = await MonthlyFinancialPlan.find(query)
      .populate("userId", "email name")
      .populate("periodicPlanIds")
      .sort({ month: -1, createdAt: -1 })
      .lean();

    res.json(createSuccessResponse({ plans }));
  } catch (error) {
    next(error);
  }
});

// GET /finance/monthly-plans/:id - Get monthly plan by ID (all users, read-only)
router.get("/monthly-plans/:id", async (req, res, next) => {
  try {
    const plan = await MonthlyFinancialPlan.findById(req.params.id)
      .populate("userId", "email name")
      .populate("periodicPlanIds");

    if (!plan) {
      return res
        .status(404)
        .json(
          createErrorResponse(
            "NOT_FOUND",
            "Monthly financial plan not found",
            404,
          ),
        );
    }

    const planOwnerId = plan.userId._id
      ? plan.userId._id
      : plan.userId;
    const canView = await assertTransactionOwnerInFinanceScope(
      req.user,
      planOwnerId,
    );
    if (!canView) {
      return res
        .status(403)
        .json(
          createErrorResponse(
            "ACCESS_DENIED",
            "You do not have permission to view this plan",
            403,
          ),
        );
    }

    res.json(createSuccessResponse({ plan }));
  } catch (error) {
    next(error);
  }
});

// ============================================
// PERIODIC FINANCIAL PLAN ROUTES
// ============================================

// const periodicPlanSchema = z.object({
//   userId: z.string().min(1, 'UserId is required'),
//   month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
//   startDate: z.union([z.string().datetime(), z.date()]),
//   endDate: z.union([z.string().datetime(), z.date()]),
//   periodicFinancialGoal: z.number().min(0, 'Periodic financial goal must be non-negative'),
//   definition: z.string().optional(),
//   note: z.string().optional()
// });

// const updatePeriodicPlanSchema = periodicPlanSchema.partial();

// // POST /finance/periodic-plans - Create periodic plan (boss only)
// router.post('/periodic-plans', requireRole('SUPER_ADMIN', 'ADMIN', 'BOSS'), async (req, res, next) => {
//   try {
//     const validatedData = periodicPlanSchema.parse(req.body);

//     // Validate userId exists
//     const user = await User.findById(validatedData.userId);
//     if (!user) {
//       return res.status(404).json(createErrorResponse(
//         'USER_NOT_FOUND',
//         'User not found',
//         404
//       ));
//     }

//     // Convert date strings to Date objects
//     const startDate = validatedData.startDate instanceof Date
//       ? validatedData.startDate
//       : new Date(validatedData.startDate);
//     const endDate = validatedData.endDate instanceof Date
//       ? validatedData.endDate
//       : new Date(validatedData.endDate);

//     // Validate date range
//     if (startDate > endDate) {
//       return res.status(400).json(createErrorResponse(
//         'INVALID_DATE_RANGE',
//         'startDate must be less than or equal to endDate',
//         400
//       ));
//     }

//     // Validate dates are within the selected month
//     const [year, monthNum] = validatedData.month.split('-').map(Number);
//     const monthStart = new Date(year, monthNum - 1, 1);
//     const monthEnd = new Date(year, monthNum, 0, 23, 59, 59, 999);

//     if (startDate < monthStart || startDate > monthEnd) {
//       return res.status(400).json(createErrorResponse(
//         'INVALID_START_DATE',
//         'startDate must be within the selected month',
//         400
//       ));
//     }

//     if (endDate < monthStart || endDate > monthEnd) {
//       return res.status(400).json(createErrorResponse(
//         'INVALID_END_DATE',
//         'endDate must be within the selected month',
//         400
//       ));
//     }

//     // Find or create the related monthly plan
//     let monthlyPlan = await MonthlyFinancialPlan.findOne({
//       userId: validatedData.userId,
//       month: validatedData.month
//     });

//     if (!monthlyPlan) {
//       return res.status(404).json(createErrorResponse(
//         'MONTHLY_PLAN_NOT_FOUND',
//         'Monthly financial plan must exist before creating periodic plans',
//         404
//       ));
//     }

//     const periodicPlan = new PeriodicFinancialPlan({
//       userId: validatedData.userId,
//       month: validatedData.month,
//       startDate,
//       endDate,
//       periodicFinancialGoal: validatedData.periodicFinancialGoal,
//       definition: validatedData.definition || '',
//       note: validatedData.note || ''
//     });

//     await periodicPlan.save();

//     // Add periodic plan ID to monthly plan
//     if (!monthlyPlan.periodicPlanIds.includes(periodicPlan._id)) {
//       monthlyPlan.periodicPlanIds.push(periodicPlan._id);
//       await monthlyPlan.save();
//     }

//     await periodicPlan.populate('userId', 'email name');

//     // Audit log
//     await auditLog(req, 'PERIODIC_FINANCIAL_PLAN_CREATE', 'PERIODIC_FINANCIAL_PLAN', periodicPlan._id.toString(), {
//       ...getRequestMeta(req),
//       plan: {
//         userId: periodicPlan.userId._id.toString(),
//         month: periodicPlan.month,
//         startDate: periodicPlan.startDate,
//         endDate: periodicPlan.endDate,
//         definition: periodicPlan.definition,
//         periodicFinancialGoal: periodicPlan.periodicFinancialGoal
//       }
//     });

//     res.status(201).json(createSuccessResponse({ periodicPlan }, 'Periodic financial plan created successfully'));
//   } catch (error) {
//     if (error instanceof z.ZodError) {
//       return res.status(400).json(createErrorResponse(
//         'VALIDATION_ERROR',
//         error.errors[0]?.message || 'Validation error',
//         400
//       ));
//     }
//     next(error);
//   }
// });

// // PUT /finance/periodic-plans/:id - Update periodic plan (boss only)
// router.put('/periodic-plans/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'BOSS'), async (req, res, next) => {
//   try {
//     const periodicPlan = await PeriodicFinancialPlan.findById(req.params.id);

//     if (!periodicPlan) {
//       return res.status(404).json(createErrorResponse(
//         'NOT_FOUND',
//         'Periodic financial plan not found',
//         404
//       ));
//     }

//     const validatedData = updatePeriodicPlanSchema.parse(req.body);

//     // Store old values for audit
//     const oldValues = {
//       startDate: periodicPlan.startDate,
//       endDate: periodicPlan.endDate,
//       definition: periodicPlan.definition,
//       periodicFinancialGoal: periodicPlan.periodicFinancialGoal,
//       note: periodicPlan.note
//     };

//     // Convert date strings to Date objects if provided
//     let startDate = periodicPlan.startDate;
//     let endDate = periodicPlan.endDate;
//     let month = periodicPlan.month;

//     if (validatedData.startDate !== undefined) {
//       startDate = validatedData.startDate instanceof Date
//         ? validatedData.startDate
//         : new Date(validatedData.startDate);
//     }

//     if (validatedData.endDate !== undefined) {
//       endDate = validatedData.endDate instanceof Date
//         ? validatedData.endDate
//         : new Date(validatedData.endDate);
//     }

//     if (validatedData.month !== undefined) {
//       month = validatedData.month;
//     }

//     // Validate date range
//     if (startDate > endDate) {
//       return res.status(400).json(createErrorResponse(
//         'INVALID_DATE_RANGE',
//         'startDate must be less than or equal to endDate',
//         400
//       ));
//     }

//     // Validate dates are within the selected month
//     const [year, monthNum] = month.split('-').map(Number);
//     const monthStart = new Date(year, monthNum - 1, 1);
//     const monthEnd = new Date(year, monthNum, 0, 23, 59, 59, 999);

//     if (startDate < monthStart || startDate > monthEnd) {
//       return res.status(400).json(createErrorResponse(
//         'INVALID_START_DATE',
//         'startDate must be within the selected month',
//         400
//       ));
//     }

//     if (endDate < monthStart || endDate > monthEnd) {
//       return res.status(400).json(createErrorResponse(
//         'INVALID_END_DATE',
//         'endDate must be within the selected month',
//         400
//       ));
//     }

//     // Update fields
//     if (validatedData.startDate !== undefined) {
//       periodicPlan.startDate = startDate;
//     }
//     if (validatedData.endDate !== undefined) {
//       periodicPlan.endDate = endDate;
//     }
//     if (validatedData.month !== undefined) {
//       periodicPlan.month = month;
//     }
//     if (validatedData.periodicFinancialGoal !== undefined) {
//       periodicPlan.periodicFinancialGoal = validatedData.periodicFinancialGoal;
//     }
//         if (validatedData.definition !== undefined) {
//       periodicPlan.definition = validatedData.definition;
//     }
//     if (validatedData.note !== undefined) {
//       periodicPlan.note = validatedData.note;
//     }

//     await periodicPlan.save();
//     await periodicPlan.populate('userId', 'email name');

//     // Audit log
//     await auditLog(req, 'PERIODIC_FINANCIAL_PLAN_UPDATE', 'PERIODIC_FINANCIAL_PLAN', periodicPlan._id.toString(), {
//       ...getRequestMeta(req),
//       oldValues,
//       newValues: {
//         startDate: periodicPlan.startDate,
//         endDate: periodicPlan.endDate,
//         definition: periodicPlan.definition,
//         periodicFinancialGoal: periodicPlan.periodicFinancialGoal,
//         note: periodicPlan.note
//       }
//     });

//     res.json(createSuccessResponse({ periodicPlan }, 'Periodic financial plan updated successfully'));
//   } catch (error) {
//     if (error instanceof z.ZodError) {
//       return res.status(400).json(createErrorResponse(
//         'VALIDATION_ERROR',
//         error.errors[0]?.message || 'Validation error',
//         400
//       ));
//     }
//     next(error);
//   }
// });

// // GET /finance/periodic-plans - List periodic plans (all users, read-only)
// router.get('/periodic-plans', async (req, res, next) => {
//   try {
//     const { userId, month } = req.query;
//     const user = req.user;

//     const query = {};

//     // RBAC: Members can only see their own plans
//     if (normalizeRole(user.role, user.degree) === ROLES.GROUP_MEMBER) {
//       query.userId = user._id;
//     } else if (userId) {
//       // Boss/Admin can filter by user
//       query.userId = userId;
//     }

//     if (month) {
//       if (!/^\d{4}-\d{2}$/.test(month)) {
//         return res.status(400).json(createErrorResponse(
//           'INVALID_MONTH_FORMAT',
//           'Month must be in YYYY-MM format',
//           400
//         ));
//       }
//       query.month = month;
//     }

//     const plans = await PeriodicFinancialPlan.find(query)
//       .populate('userId', 'email name')
//       .sort({ startDate: -1, createdAt: -1 })
//       .lean();

//     res.json(createSuccessResponse({ plans }));
//   } catch (error) {
//     next(error);
//   }
// });

// const periodicPlanSchema = z.object({
//   userId: z.string().min(1, "UserId is required"),
//   period: z.object({
//     definition: z.string().min(1, "Period definition is required"),
//     month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM"),
//     startDate: z.union([z.string().datetime(), z.date()]),
//     endDate: z.union([z.string().datetime(), z.date()]),
//   }),
//   periodicFinancialGoal: z.number().min(0),
//   note: z.string().optional(),
// });

// const updatePeriodicPlanSchema = z.object({
//   period: z
//     .object({
//       definition: z.string().optional(),
//       month: z
//         .string()
//         .regex(/^\d{4}-\d{2}$/)
//         .optional(),
//       startDate: z.union([z.string().datetime(), z.date()]).optional(),
//       endDate: z.union([z.string().datetime(), z.date()]).optional(),
//     })
//     .optional(),

//   periodicFinancialGoal: z.number().min(0).optional(),
//   note: z.string().optional(),
// });

// router.post(
//   "/periodic-plans",
//   requireRole("SUPER_ADMIN", "ADMIN", "BOSS"),
//   async (req, res, next) => {
//     try {
//       const validated = periodicPlanSchema.parse(req.body);

//       const user = await User.findById(validated.userId);
//       if (!user) {
//         return res
//           .status(404)
//           .json(createErrorResponse("USER_NOT_FOUND", "User not found", 404));
//       }
//       const monthlyPlan = await MonthlyFinancialPlan.findOne({
//         userId: validated.userId,
//         month: validated.period.month,
//       });

//       if (!monthlyPlan) {
//         return res
//           .status(404)
//           .json(
//             createErrorResponse(
//               "MONTHLY_PLAN_NOT_FOUND",
//               "Monthly financial plan not found",
//               404,
//             ),
//           );
//       }

//       const period = await FinancePeriod.create({
//         definition: validated.period.definition,
//         month: validated.period.month,
//         startDate: validated.period.startDate,
//         endDate: validated.period.endDate,
//       });
//       const periodicPlan = await PeriodicFinancialPlan.create({
//         userId: validated.userId,
//         periodId: period._id,
//         periodicFinancialGoal: validated.periodicFinancialGoal,
//         note: validated.note || "",
//       });
//       monthlyPlan.periodicPlanIds.push(periodicPlan._id);
//       await monthlyPlan.save();
//       await periodicPlan.populate([
//         { path: "userId", select: "email name" },
//         { path: "periodId" },
//       ]);

//       await auditLog(
//         req,
//         "PERIODIC_FINANCIAL_PLAN_CREATE",
//         "PERIODIC_FINANCIAL_PLAN",
//         periodicPlan._id.toString(),
//         {
//           ...getRequestMeta(req),
//           period: period.toObject(),
//           periodicFinancialGoal: periodicPlan.periodicFinancialGoal,
//         },
//       );

//       res
//         .status(201)
//         .json(
//           createSuccessResponse(
//             { periodicPlan },
//             "Periodic financial plan created successfully",
//           ),
//         );
//     } catch (error) {
//       if (error instanceof z.ZodError) {
//         return res
//           .status(400)
//           .json(
//             createErrorResponse(
//               "VALIDATION_ERROR",
//               error.errors[0]?.message || "Validation error",
//               400,
//             ),
//           );
//       }
//       next(error);
//     }
//   },
// );

// router.put(
//   "/periodic-plans/:id",
//   requireRole("SUPER_ADMIN", "ADMIN", "BOSS"),
//   async (req, res, next) => {
//     try {
//       const periodicPlan = await PeriodicFinancialPlan.findById(
//         req.params.id,
//       ).populate("periodId");

//       if (!periodicPlan) {
//         return res
//           .status(404)
//           .json(
//             createErrorResponse(
//               "NOT_FOUND",
//               "Periodic financial plan not found",
//               404,
//             ),
//           );
//       }

//       const validated = updatePeriodicPlanSchema.parse(req.body);

//       const oldValues = {
//         period: periodicPlan.periodId.toObject(),
//         periodicFinancialGoal: periodicPlan.periodicFinancialGoal,
//         note: periodicPlan.note,
//       };

//       if (validated.period) {
//         Object.assign(periodicPlan.periodId, {
//           ...(validated.period.definition && {
//             definition: validated.period.definition,
//           }),
//           ...(validated.period.month && { month: validated.period.month }),
//           ...(validated.period.startDate && {
//             startDate: validated.period.startDate,
//           }),
//           ...(validated.period.endDate && {
//             endDate: validated.period.endDate,
//           }),
//         });
//         await periodicPlan.periodId.save();

//         if (validated.periodicFinancialGoal !== undefined) {
//           periodicPlan.periodicFinancialGoal = validated.periodicFinancialGoal;
//         }

//         if (validated.note !== undefined) {
//           periodicPlan.note = validated.note;
//         }

//         await periodicPlan.save();
//         await periodicPlan.populate([
//           { path: "userId", select: "email name" },
//           { path: "periodId" },
//         ]);

//         await auditLog(
//           req,
//           "PERIODIC_FINANCIAL_PLAN_UPDATE",
//           "PERIODIC_FINANCIAL_PLAN",
//           periodicPlan._id.toString(),
//           {
//             ...getRequestMeta(req),
//             oldValues,
//             newValues: {
//               period: periodicPlan.periodId.toObject(),
//               periodicFinancialGoal: periodicPlan.periodicFinancialGoal,
//               note: periodicPlan.note,
//             },
//           },
//         );
//         res.json(
//           createSuccessResponse(
//             { periodicPlan },
//             "Periodic Financial plan updated successfully",
//           ),
//         );
//       }
//     } catch (error) {
//       if (error instanceof z.ZodError) {
//         return res
//           .status(400)
//           .json(
//             createErrorResponse(
//               "VALIDATION_ERROR",
//               error.errors[0]?.message,
//               400,
//             ),
//           );
//       }
//       next(error);
//     }
//   },
// );

// router.get("/periodic-plans", async (req, res, next) => {
//   try {
//     const { userId, month } = req.query;

//     const query = {};
//     if (normalizeRole(req.user.role) === ROLES.MEMBER) {
//       query.userId = req.user._id;
//     } else if (userId) {
//       query.userId = userId;
//     }
//     const plans = await PeriodicFinancialPlan.find(query)
//       .populate("userId", "email name")
//       .populate({
//         path: "periodId",
//         ...(month && { match: { month } }),
//       })
//       .sort({ createdAt: -1 })
//       .lean();

//     const filtered = month ? plans.filter((p) => p.periodId) : plans;
//   } catch (error) {
//     next(error);
//   }
// });
const assignPeriodicPlanSchema = z.object({
  userId: z.string().min(1, 'UserId is required'),
  periodId: z.string().min(1, 'PeriodId is required'),
  periodicFinancialGoal: z.number().min(0),
  note: z.string().optional(),
});

const updatePeriodicPlanSchema = z.object({
  periodId: z.string().min(1).optional(), // ✅ now changeable
  periodicFinancialGoal: z.number().min(0).optional(),
  note: z.string().optional(),
});
/**
 * Week plans may be created / edited by super admin or finance manager (any
 * user) or a group boss (members of their own group only). Plain members never
 * reach here (requireFinanceManager).
 */
const canManageWeekPlanFor = (reqUser, targetGroup) => {
  if (canManageAllFinance(reqUser.role, reqUser.degree)) return true;
  const reqGroup = reqUser.group;
  if (reqGroup && FINANCE_META_GROUPS.has(reqGroup)) return true;
  return !!reqGroup && targetGroup === reqGroup;
};

router.post(
  '/periodic-plans',
  requireFinanceManager,
  async (req, res, next) => {
    try {
      const data = assignPeriodicPlanSchema.parse(req.body);

      const [user, period] = await Promise.all([
        User.findById(data.userId),
        FinancePeriod.findById(data.periodId),
      ]);

      if (!user) {
        return res.status(404).json(
          createErrorResponse('USER_NOT_FOUND', 'User not found', 404)
        );
      }

      if (!period) {
        return res.status(404).json(
          createErrorResponse('PERIOD_NOT_FOUND', 'Period not found', 404)
        );
      }

      if (!canManageWeekPlanFor(req.user, user.group)) {
        return res.status(403).json(
          createErrorResponse(
            'ACCESS_DENIED',
            'You can only create plans for users in your own group',
            403
          )
        );
      }

      const exists = await PeriodicFinancialPlan.findOne({
        userId: data.userId,
        periodId: data.periodId,
      });

      if (exists) {
        return res.status(409).json(
          createErrorResponse(
            'DUPLICATE_PLAN',
            'User already has a goal for this period',
            409
          )
        );
      }

      const periodicPlan = await PeriodicFinancialPlan.create({
        userId: data.userId,
        periodId: data.periodId,
        periodicFinancialGoal: data.periodicFinancialGoal,
        note: data.note || '',
      });

      await periodicPlan.populate([
        { path: 'userId', select: 'email name' },
        { path: 'periodId' },
      ]);

      res.status(201).json(
        createSuccessResponse(
          { periodicPlan },
          'Periodic goal assigned successfully'
        )
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(
          createErrorResponse(
            'VALIDATION_ERROR',
            error.errors[0].message,
            400
          )
        );
      }
      next(error);
    }
  }
);
router.put(
  '/periodic-plans/:id',
  requireFinanceManager,
  async (req, res, next) => {
    try {
      const data = updatePeriodicPlanSchema.parse(req.body);

      const periodicPlan = await PeriodicFinancialPlan.findById(req.params.id);

      if (!periodicPlan) {
        return res.status(404).json(
          createErrorResponse(
            'NOT_FOUND',
            'Periodic financial plan not found',
            404
          )
        );
      }

      const planUser = await User.findById(periodicPlan.userId).select('group').lean();
      if (!canManageWeekPlanFor(req.user, planUser?.group)) {
        return res.status(403).json(
          createErrorResponse(
            'ACCESS_DENIED',
            'You can only edit plans for your own group',
            403
          )
        );
      }

      // ✅ Change periodId (safe reassignment)
      if (data.periodId && data.periodId !== periodicPlan.periodId.toString()) {
        const newPeriod = await FinancePeriod.findById(data.periodId);
        if (!newPeriod) {
          return res.status(404).json(
            createErrorResponse('PERIOD_NOT_FOUND', 'Period not found', 404)
          );
        }

        // Prevent duplicates after reassignment
        const duplicate = await PeriodicFinancialPlan.findOne({
          _id: { $ne: periodicPlan._id },
          userId: periodicPlan.userId,
          periodId: data.periodId,
        });

        if (duplicate) {
          return res.status(409).json(
            createErrorResponse(
              'DUPLICATE_PLAN',
              'User already has a goal for this period',
              409
            )
          );
        }

        periodicPlan.periodId = data.periodId;
      }

      if (data.periodicFinancialGoal !== undefined) {
        periodicPlan.periodicFinancialGoal = data.periodicFinancialGoal;
      }

      if (data.note !== undefined) {
        periodicPlan.note = data.note;
      }

      await periodicPlan.save();
      await periodicPlan.populate([
        { path: 'userId', select: 'email name' },
        { path: 'periodId' },
      ]);

      res.json(
        createSuccessResponse(
          { periodicPlan },
          'Periodic plan updated successfully'
        )
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(
          createErrorResponse(
            'VALIDATION_ERROR',
            error.errors[0].message,
            400
          )
        );
      }
      next(error);
    }
  }
);
/**
 * GET /finance/periodic-plans/matrix?month=YYYY-MM[&groupId=]
 *
 * One month of week goals as a grid: the month's week periods as columns,
 * members as rows, with each member's goal per week, what they have actually
 * booked in that week, and the monthly goal the weeks are measured against.
 */
router.get('/periodic-plans/matrix', async (req, res, next) => {
  try {
    const month = String(req.query.month || '').trim();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res
        .status(400)
        .json(createErrorResponse('INVALID_MONTH_FORMAT', 'Month must be in YYYY-MM format', 400));
    }

    const { members, groups } = await overviewMembers(req.user, req.query.groupId);
    const memberIds = members.map((m) => m.id);

    const periods = await FinancePeriod.find({ month })
      .select('_id definition month startDate endDate')
      .sort({ startDate: 1, createdAt: 1 })
      .lean();

    const [plans, monthlyPlans] = await Promise.all([
      memberIds.length && periods.length
        ? PeriodicFinancialPlan.find({
            userId: { $in: memberIds },
            periodId: { $in: periods.map((p) => p._id) },
          })
            .select('_id userId periodId periodicFinancialGoal')
            .lean()
        : [],
      memberIds.length
        ? MonthlyFinancialPlan.find({ userId: { $in: memberIds }, month })
            .select('userId monthlyFinancialGoal')
            .lean()
        : [],
    ]);

    // What each member has actually booked inside each week of the month.
    const income = new Map();
    if (memberIds.length && periods.length) {
      const start = new Date(Math.min(...periods.map((p) => new Date(p.startDate).getTime())));
      const end = new Date(Math.max(...periods.map((p) => new Date(p.endDate).getTime())));
      end.setUTCHours(23, 59, 59, 999);

      const rows = await FinanceTransaction.find(withCountable({
        userId: { $in: memberIds },
        type: 'income',
        status: 'accepted',
        date: { $gte: start, $lte: end },
      }))
        .select('userId date amount')
        .lean();

      for (const tx of rows) {
        const when = new Date(tx.date).getTime();
        const period = periods.find((p) => {
          const s = new Date(p.startDate).getTime();
          const e = new Date(p.endDate).setUTCHours(23, 59, 59, 999);
          return when >= s && when <= e;
        });
        if (!period) continue;
        const key = `${tx.userId}|${period._id}`;
        income.set(key, (income.get(key) || 0) + (Number(tx.amount) || 0));
      }
    }

    res.json(
      createSuccessResponse({
        month,
        groups,
        members,
        periods: periods.map((p) => ({
          id: String(p._id),
          definition: p.definition,
          month: p.month,
          startDate: p.startDate,
          endDate: p.endDate,
        })),
        cells: plans.map((p) => ({
          planId: String(p._id),
          userId: String(p.userId),
          periodId: String(p.periodId),
          goal: Number(p.periodicFinancialGoal) || 0,
          income: income.get(`${p.userId}|${p.periodId}`) || 0,
        })),
        monthlyGoals: monthlyPlans.map((p) => ({
          userId: String(p.userId),
          goal: Number(p.monthlyFinancialGoal) || 0,
        })),
        ...planEditScope(req.user),
      }),
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /finance/periodic-plans/:id
 *
 * One week plan, for the editor dialog. Week plans are readable by every
 * signed-in user, the same as the list below.
 *
 * Registered after /periodic-plans/matrix so that path is never read as an id.
 */
router.get('/periodic-plans/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid plan id', 400));
    }

    const periodicPlan = await PeriodicFinancialPlan.findById(id)
      .populate('userId', 'email name group')
      .populate('periodId')
      .lean();

    if (!periodicPlan) {
      return res.status(404).json(createErrorResponse('NOT_FOUND', 'Week plan not found', 404));
    }

    res.json(createSuccessResponse({ periodicPlan }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /finance/periodic-plans?[userId=][&periodId=][&groupId=]
 *
 * Week plans are visible to every signed-in user, across all groups.
 * Each plan carries its week's income rollup so the list is correct for
 * groups whose transactions the viewer cannot list:
 *   actualIncome  = accepted income in the week
 *   pendingIncome = pending income in the week
 */
router.get('/periodic-plans', async (req, res, next) => {
  try {
    const { userId, periodId, groupId } = req.query;
    const query = {};

    if (userId) {
      if (!mongoose.isValidObjectId(userId)) {
        return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid userId', 400));
      }
      query.userId = userId;
    }

    const g = groupId && String(groupId).trim() && String(groupId).trim() !== "all"
      ? String(groupId).trim()
      : null;
    if (g) {
      const teamIds = await getUserIdsInGroup(g);
      if (query.userId) {
        if (!teamIds.some((id) => id.toString() === String(query.userId))) {
          return res.json(createSuccessResponse({ periodicPlans: [] }));
        }
      } else {
        query.userId = { $in: teamIds };
      }
    }

    if (periodId) {
      query.periodId = periodId;
    }

    const plans = await PeriodicFinancialPlan.find(query)
      .populate('userId', 'email name group')
      .populate('periodId')
      .sort({ createdAt: -1 })
      .lean();

    // Income rollup per plan: one aggregate over the covered users and date span.
    const withPeriod = plans.filter((p) => p.userId?._id && p.periodId?.startDate && p.periodId?.endDate);
    const endOfDay = (d) => {
      const e = new Date(d);
      e.setUTCHours(23, 59, 59, 999);
      return e;
    };
    const rollup = new Map(); // `${userId}|${periodId}` -> { actualIncome, pendingIncome }
    if (withPeriod.length > 0) {
      const minStart = new Date(Math.min(...withPeriod.map((p) => new Date(p.periodId.startDate).getTime())));
      const maxEnd = endOfDay(Math.max(...withPeriod.map((p) => new Date(p.periodId.endDate).getTime())));
      const incomes = await FinanceTransaction.find(withCountable({
        type: 'income',
        status: { $in: ['accepted', 'pending'] },
        userId: { $in: [...new Set(withPeriod.map((p) => String(p.userId._id)))] },
        date: { $gte: minStart, $lte: maxEnd },
      }))
        .select('userId date amount status')
        .lean();

      const byUser = new Map();
      for (const tx of incomes) {
        const uid = String(tx.userId);
        if (!byUser.has(uid)) byUser.set(uid, []);
        byUser.get(uid).push(tx);
      }
      for (const p of withPeriod) {
        const uid = String(p.userId._id);
        const start = new Date(p.periodId.startDate);
        const end = endOfDay(p.periodId.endDate);
        let actualIncome = 0;
        let pendingIncome = 0;
        for (const tx of byUser.get(uid) || []) {
          if (tx.date < start || tx.date > end) continue;
          if (tx.status === 'accepted') actualIncome += tx.amount;
          else pendingIncome += tx.amount;
        }
        rollup.set(`${uid}|${p.periodId._id}`, { actualIncome, pendingIncome });
      }
    }

    const periodicPlans = plans.map((p) => ({
      ...p,
      ...(rollup.get(`${p.userId?._id}|${p.periodId?._id}`) || { actualIncome: 0, pendingIncome: 0 }),
    }));

    res.json(createSuccessResponse({ periodicPlans }));
  } catch (error) {
    next(error);
  }
});


const financePeriodSchema = z.object({
  definition: z.string().min(1, "Definition is required"),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),
  startDate: z.union([z.string().datetime(), z.date()]),
  endDate: z.union([z.string().datetime(), z.date()]),
});

const updateFinancePeriodSchema = financePeriodSchema.partial();


// Weeks are created / edited by super admin or finance manager.
router.post('/periods', requireFinanceWriter, async (req, res, next) => {
  try {
    const data = financePeriodSchema.parse(req.body);
    const period = await FinancePeriod.create({
      definition: data.definition,
      month:data.month,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
    })

    await auditLog(
      req,
      'FINANCE_PERIOD_CREATE',
      "FINANCE_PERIOD",
      period._id.toString(),
      {
        ...getRequestMeta(req),
        period: period.toObject(),
      }
    );
      res.status(201).json(createSuccessResponse({ period }, "Period created successfully"));
  } catch (error) {
    if (error instanceof z.ZodError) {
        return res.status(400).json(createErrorResponse(
          'VALIDATION_ERROR',
          error.errors[0]?.message,
          400
        ));
      }
      next(error);
  }
});

router.put('/periods/:id', requireFinanceWriter, async (req, res, next) => {
  try {
    const period = await FinancePeriod.findById(req.params.id);
    if (!period) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Finance period not found',
        404
      ));
    }

    const data = updateFinancePeriodSchema.parse(req.body);

    const oldValues = period.toObject();
    Object.assign(period, {
      ...(data.definition && {definition: data.definition}),
      ...(data.month && {month: data.month}),
      ...(data.startDate && {startDate: new Date(data.startDate)}),
      ...(data.endDate && {endDate: new Date(data.endDate)}),
    });
    await period.save();

    await auditLog(
      req,
      'FINANCE_PERIOD_UPDATE',
      "FINANCE_PERIOD",
      period._id.toString(),
      {
        ...getRequestMeta(req),
        oldValues,
        newValues: {
          definition: period.definition,
          month: period.month,
          startDate: period.startDate,
          endDate: period.endDate,
        },
      }
    );

    res.json(createSuccessResponse({ period }, "Finance period updated successfully"));
  } catch (error) {
    if (error instanceof z.ZodError) {
        return res.status(400).json(createErrorResponse(
          'VALIDATION_ERROR',
          error.errors[0]?.message,
          400
        ));
      }
      next(error);
  }
});

router.get('/periods', async (req, res, next) => {
  try {
    const {month} = req.query;
    const query = {};

    if(month){
      if(!/^\d{4}-\d{2}$/.test(month)){
        return res.status(400).json(createErrorResponse(
          'INVALID_MONTH_FORMAT',
          'Month must be in YYYY-MM format',
          400
        ));
      }
      query.month = month;
    }

    const periods =  await FinancePeriod.find(query).sort({ createdAt: -1 }).lean();
    res.json(createSuccessResponse({periods}));
  } catch (error) {
    
  }
});

router.get('/periods/:id', async (req, res, next) => {
  try {
    const period = await FinancePeriod.findById(req.params.id).lean();

    if (!period) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Finance period not found',
        404
      ));
    }

    res.json(createSuccessResponse({ period }));
  } catch (error) {
    next(error);
  }
});

router.get('/finance-overview', financeOverviewController.getFinanceMetrics);
router.get('/quarter-profit', financeOverviewController.getQuarterProfit);
export default router;
