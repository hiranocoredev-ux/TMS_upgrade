import mongoose from 'mongoose';
import { z } from 'zod';
import PaymentRequest, {
  PAYMENT_REQUEST_FLOW,
  PAYMENT_REQUEST_STATUS,
} from '../models/PaymentRequest.js';
import { normalizeRole, ROLES, canManageAllFinance } from '../constants/roles.js';
import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';

const isSuperAdmin = (u) => normalizeRole(u?.role, u?.degree) === ROLES.SUPER_ADMIN;
const isGroupBoss = (u) => normalizeRole(u?.role, u?.degree) === ROLES.GROUP_BOSS;

/**
 * Super admin, finance manager, or users flagged as payment request reviewers
 * (set by super admin).
 */
export const canHandleBossToPlatformRequests = (u) => {
  if (!u) return false;
  if (canManageAllFinance(u.role, u.degree)) return true;
  return u.paymentRequestApprover === true;
};

const createSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  currency: z.string().trim().min(1).max(8).optional(),
  reason: z.string().trim().min(1, 'Reason is required').max(4000),
  untilDate: z.union([z.string().datetime(), z.coerce.date()]),
});

const statusUpdateSchema = z.object({
  status: z.enum([
    PAYMENT_REQUEST_STATUS.DISCUSSING,
    PAYMENT_REQUEST_STATUS.ACCEPTED,
    PAYMENT_REQUEST_STATUS.REJECTED,
  ]),
  comment: z.string().max(4000).optional().default(''),
});

const toRequestDto = (doc, requesterLean = null) => {
  const populated =
    doc.requesterId &&
    typeof doc.requesterId === 'object' &&
    ('name' in doc.requesterId || 'email' in doc.requesterId);
  const reqUser = requesterLean || (populated ? doc.requesterId : null);
  const rid = populated ? doc.requesterId._id : doc.requesterId;
  return {
    id: String(doc._id),
    flowType: doc.flowType,
    amount: doc.amount,
    currency: doc.currency || 'USD',
    reason: doc.reason,
    untilDate: doc.untilDate,
    status: doc.status,
    resolverComment: doc.resolverComment || '',
    group: doc.group || '',
    requester: reqUser
      ? {
          id: String(rid),
          name: reqUser.name || '',
          email: reqUser.email || '',
        }
      : { id: String(doc.requesterId), name: '', email: '' },
    handledByUserId: doc.handledByUserId ? String(doc.handledByUserId) : null,
    handledAt: doc.handledAt || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

/**
 * POST /finance/payment-requests
 * - GROUP_MEMBER: MEMBER_TO_BOSS (own group implied)
 * - GROUP_BOSS: BOSS_TO_PLATFORM
 */
export const createPaymentRequest = async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const role = normalizeRole(req.user.role, req.user.degree);

    let flowType;
    if (role === ROLES.GROUP_MEMBER) {
      flowType = PAYMENT_REQUEST_FLOW.MEMBER_TO_BOSS;
    } else if (role === ROLES.GROUP_BOSS) {
      flowType = PAYMENT_REQUEST_FLOW.BOSS_TO_PLATFORM;
    } else if (isSuperAdmin(req.user)) {
      return res.status(400).json(
        createErrorResponse('INVALID_ROLE', 'Super admin does not submit payment requests here', 400),
      );
    } else {
      return res.status(403).json(createErrorResponse('FORBIDDEN', 'Your role cannot create payment requests', 403));
    }

    const g = String(req.user.group ?? '').trim();
    if (role !== ROLES.SUPER_ADMIN && !g) {
      return res.status(400).json(createErrorResponse('GROUP_REQUIRED', 'User must belong to a group', 400));
    }

    const untilDate = body.untilDate instanceof Date ? body.untilDate : new Date(body.untilDate);
    if (Number.isNaN(untilDate.getTime())) {
      return res.status(400).json(createErrorResponse('INVALID_DATE', 'Invalid until date', 400));
    }

    const doc = await PaymentRequest.create({
      requesterId: req.user._id,
      group: role === ROLES.SUPER_ADMIN ? '' : g,
      flowType,
      amount: body.amount,
      currency: (body.currency || 'USD').toUpperCase(),
      reason: body.reason.trim(),
      untilDate,
      status: PAYMENT_REQUEST_STATUS.PENDING,
    });

    const populated = await PaymentRequest.findById(doc._id)
      .populate('requesterId', 'name email')
      .lean();

    res.status(201).json(createSuccessResponse({ request: toRequestDto(populated) }, 'Payment request submitted'));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res
        .status(400)
        .json(createErrorResponse('VALIDATION_ERROR', err.errors[0]?.message || 'Invalid input', 400));
    }
    return next(err);
  }
};

/** Who may update status for a given request */
const assertCanHandleRequest = (viewer, doc) => {
  if (doc.status === PAYMENT_REQUEST_STATUS.ACCEPTED || doc.status === PAYMENT_REQUEST_STATUS.REJECTED) {
    return { ok: false, code: 'TERMINAL', message: 'This request is already closed' };
  }

  if (doc.flowType === PAYMENT_REQUEST_FLOW.MEMBER_TO_BOSS) {
    if (!isGroupBoss(viewer)) {
      return { ok: false, code: 'FORBIDDEN', message: 'Only the group boss can handle member requests' };
    }
    const bossGroup = String(viewer.group ?? '').trim();
    if (!bossGroup || bossGroup !== String(doc.group || '').trim()) {
      return { ok: false, code: 'FORBIDDEN', message: 'You can only handle requests from your group' };
    }
    return { ok: true };
  }

  if (doc.flowType === PAYMENT_REQUEST_FLOW.BOSS_TO_PLATFORM) {
    if (!canHandleBossToPlatformRequests(viewer)) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'Only super admin or payment approvers can handle boss requests',
      };
    }
    return { ok: true };
  }

  return { ok: false, code: 'FORBIDDEN', message: 'Unknown flow' };
};

/**
 * PATCH /finance/payment-requests/:id/status
 */
export const updatePaymentRequestStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(createErrorResponse('INVALID_ID', 'Invalid request id', 400));
    }

    const body = statusUpdateSchema.parse(req.body);
    if (body.status === PAYMENT_REQUEST_STATUS.REJECTED && !String(body.comment || '').trim()) {
      return res.status(400).json(createErrorResponse('COMMENT_REQUIRED', 'A comment is required when rejecting', 400));
    }

    const doc = await PaymentRequest.findById(id);
    if (!doc) {
      return res.status(404).json(createErrorResponse('NOT_FOUND', 'Payment request not found', 404));
    }

    const gate = assertCanHandleRequest(req.user, doc);
    if (!gate.ok) {
      const status = gate.code === 'TERMINAL' ? 400 : 403;
      return res.status(status).json(createErrorResponse(gate.code, gate.message, status));
    }

    doc.status = body.status;
    doc.resolverComment = String(body.comment || '').trim();
    doc.handledByUserId = req.user._id;
    doc.handledAt = new Date();
    await doc.save();

    const populated = await PaymentRequest.findById(doc._id)
      .populate('requesterId', 'name email')
      .lean();

    res.json(createSuccessResponse({ request: toRequestDto(populated) }, 'Status updated'));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res
        .status(400)
        .json(createErrorResponse('VALIDATION_ERROR', err.errors[0]?.message || 'Invalid input', 400));
    }
    next(err);
  }
};

/**
 * GET /finance/payment-requests?scope=my|team_inbox|platform_inbox
 */
export const listPaymentRequests = async (req, res, next) => {
  try {
    const scope = String(req.query.scope || 'my').trim();
    const role = normalizeRole(req.user.role, req.user.degree);
    let query = {};

    if (scope === 'my') {
      query.requesterId = req.user._id;
    } else if (scope === 'team_inbox') {
      if (!isGroupBoss(req.user)) {
        return res.status(403).json(createErrorResponse('FORBIDDEN', 'Team inbox is for group bosses only', 403));
      }
      const g = String(req.user.group ?? '').trim();
      query.flowType = PAYMENT_REQUEST_FLOW.MEMBER_TO_BOSS;
      query.group = g;
      query.requesterId = { $ne: req.user._id };
    } else if (scope === 'platform_inbox') {
      if (!canHandleBossToPlatformRequests(req.user)) {
        return res.status(403).json(createErrorResponse('FORBIDDEN', 'Not allowed to view platform inbox', 403));
      }
      query.flowType = PAYMENT_REQUEST_FLOW.BOSS_TO_PLATFORM;
    } else {
      return res.status(400).json(createErrorResponse('INVALID_SCOPE', 'scope must be my, team_inbox, or platform_inbox', 400));
    }

    const rows = await PaymentRequest.find(query)
      .populate('requesterId', 'name email')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.json(
      createSuccessResponse({
        requests: rows.map((r) => toRequestDto(r)),
      }),
    );
  } catch (err) {
    next(err);
  }
};
