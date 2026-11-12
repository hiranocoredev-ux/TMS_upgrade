/**
 * Transaction review: a finance manager OR a super admin approves, and either
 * approval is final — the transaction counts in totals everywhere and is locked.
 *
 *   awaiting_fm --(finance manager or super admin approves)--> approved (locked)
 *   awaiting_fm --(either rejects, with reason)---------------> rejected
 *   rejected    --(the creator saves an edit)-----------------> awaiting_fm
 *   approved    --(either unlocks, with reason)---------------> awaiting_fm
 *
 * The admin role sees finance read-only and takes no part. Transactions created
 * before the review existed have no stage: they wait for approval like new ones.
 * `fm_approved` is left over from the former two-step review (finance manager,
 * then super admin); with either approval now final, it is treated as `approved`.
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
/** Reviewers: a finance manager or a super admin (the admin role never reviews). */
export const isReviewer = (user) => [ROLES.FINANCE_MANAGER, ROLES.SUPER_ADMIN].includes(roleOf(user));

/** A group boss's submission is frozen while it waits for approval. */
export const isFrozenSubmission = (tx) =>
  tx?.createdByRole === ROLES.GROUP_BOSS && reviewStageOf(tx) === REVIEW.AWAITING_FM;

/**
 * Why `user` may not edit / delete this transaction right now, or null if they may.
 * (Group scoping and requireFinanceManager are checked separately by the routes.)
 * @param {'edit'|'delete'|'status'} action - status = the Accept / Cancel buttons
 */
export function changeBlockedReason(tx, user, action = 'edit') {
  if (isLocked(tx)) {
    return 'This transaction is approved and locked. A Finance Manager or Super Admin must unlock it first.';
  }
  if (isFrozenSubmission(tx)) {
    // A reviewer may still mark a frozen submission Accepted / Canceled; nobody edits its details.
    if (action === 'status' && isReviewer(user)) return null;
    return 'This transaction was submitted by a group boss and is waiting for approval. It can be changed only after a Finance Manager or Super Admin rejects it.';
  }
  return null;
}

/** Which review buttons `user` gets for this transaction. */
export function reviewActionsFor(tx, user) {
  const stage = reviewStageOf(tx);
  const reviewer = isReviewer(user);
  return {
    approve: stage === REVIEW.AWAITING_FM && reviewer,
    reject: stage === REVIEW.AWAITING_FM && reviewer,
    unlock: stage === REVIEW.APPROVED && reviewer,
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
 * always has; anything created from then on counts only once approved by a
 * finance manager or super admin. The usual Accepted / Canceled rules still apply on top.
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
