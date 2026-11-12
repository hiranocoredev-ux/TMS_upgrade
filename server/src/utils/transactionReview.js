/**
 * Transaction review: the finance manager is the only approver, and their
 * approval is final — the transaction counts in totals and is locked.
 *
 *   awaiting_fm --(finance manager approves)----------------> approved (locked)
 *   awaiting_fm --(finance manager rejects, with reason)----> rejected
 *   rejected    --(creator or a finance manager saves an edit)--> awaiting_fm
 *   approved    --(finance manager unlocks, with reason)----> awaiting_fm
 *
 * Super admin and admin see finance read-only and take no part. Transactions
 * created before the review existed have no stage: they wait for the finance
 * manager like new ones. `fm_approved` is left over from the former two-step
 * review (finance manager, then super admin); with the finance manager's
 * approval now final, it is treated exactly like `approved`.
 */
import { normalizeRole, ROLES } from '../constants/roles.js';

export const REVIEW = Object.freeze({
  AWAITING_FM: 'awaiting_fm',
  /** Legacy (two-step review): treated as approved. */
  FM_APPROVED: 'fm_approved',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

/** Stages that mean approved & locked (the legacy fm_approved included). */
export const APPROVED_STAGES = [REVIEW.APPROVED, REVIEW.FM_APPROVED];

/** Stage of a transaction; older ones without a stage are awaiting the finance manager. */
export const reviewStageOf = (tx) => {
  const stage = tx?.reviewStage || REVIEW.AWAITING_FM;
  return stage === REVIEW.FM_APPROVED ? REVIEW.APPROVED : stage;
};

export const isLocked = (tx) => reviewStageOf(tx) === REVIEW.APPROVED;

const roleOf = (user) => normalizeRole(user?.role, user?.degree);
/** The only reviewer: a finance manager. */
export const isReviewer = (user) => roleOf(user) === ROLES.FINANCE_MANAGER;

/** A group boss's submission is frozen while it waits for the finance manager. */
export const isFrozenSubmission = (tx) =>
  tx?.createdByRole === ROLES.GROUP_BOSS && reviewStageOf(tx) === REVIEW.AWAITING_FM;

/**
 * Why `user` may not edit / delete this transaction right now, or null if they may.
 * (Group scoping and requireFinanceManager are checked separately by the routes.)
 * @param {'edit'|'delete'|'status'} action - status = the Accept / Cancel buttons
 */
export function changeBlockedReason(tx, user, action = 'edit') {
  if (isLocked(tx)) {
    return 'This transaction is approved and locked. A Finance Manager must unlock it first.';
  }
  if (isFrozenSubmission(tx)) {
    // The finance manager may still mark a frozen submission Accepted / Canceled; nobody edits its details.
    if (action === 'status' && isReviewer(user)) return null;
    return 'This transaction was submitted by a group boss and is waiting for the Finance Manager. It can be changed only after the Finance Manager rejects it.';
  }
  return null;
}

/** Which review buttons `user` gets for this transaction. */
export function reviewActionsFor(tx, user) {
  const stage = reviewStageOf(tx);
  const fm = isReviewer(user);
  return {
    approve: stage === REVIEW.AWAITING_FM && fm,
    reject: stage === REVIEW.AWAITING_FM && fm,
    unlock: stage === REVIEW.APPROVED && fm,
  };
}

/** Fields that reset the review to the start (used on create, resubmit and unlock). */
export const restartReviewFields = () => ({
  reviewStage: REVIEW.AWAITING_FM,
  fmApprovedByUserId: null,
  fmApprovedAt: null,
  adminApprovedByUserId: null,
  adminApprovedAt: null,
});

export const MAX_REVIEW_REASON_LENGTH = 1000;

/*
 * Which transactions count in totals (summaries, overview, dashboard, reports,
 * competition): everything created before APPROVAL_REQUIRED_FROM counts as it
 * always has; anything created from then on counts only once approved by the
 * finance manager. The usual Accepted / Canceled rules still apply on top.
 * Override the cut-off with FINANCE_APPROVAL_REQUIRED_FROM (ISO date).
 */
const DEFAULT_APPROVAL_REQUIRED_FROM = '2026-11-08T22:30:00.000Z';
const parsedCutoff = new Date(process.env.FINANCE_APPROVAL_REQUIRED_FROM || DEFAULT_APPROVAL_REQUIRED_FROM);
export const APPROVAL_REQUIRED_FROM = Number.isNaN(parsedCutoff.getTime())
  ? new Date(DEFAULT_APPROVAL_REQUIRED_FROM)
  : parsedCutoff;

/** Mongo condition: the transaction counts in totals. */
export const countableCondition = () => ({
  $or: [{ createdAt: { $lt: APPROVAL_REQUIRED_FROM } }, { reviewStage: { $in: APPROVED_STAGES } }],
});

/** `match` narrowed to transactions that count in totals (safe even if `match` has its own $or). */
export const withCountable = (match = {}) => ({ $and: [match, countableCondition()] });

/** Same rule for a transaction already loaded. */
export const countsInTotals = (tx) =>
  reviewStageOf(tx) === REVIEW.APPROVED ||
  (tx?.createdAt != null && new Date(tx.createdAt) < APPROVAL_REQUIRED_FROM);
