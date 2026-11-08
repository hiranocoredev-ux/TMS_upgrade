/**
 * Two-step transaction review: a finance manager approves first, then a super
 * admin gives final approval, which locks the transaction.
 *
 *   awaiting_fm --(finance manager approves)--> fm_approved
 *   fm_approved --(super admin approves)------> approved   (locked)
 *   awaiting_fm / fm_approved --(either rejects, with reason)--> rejected
 *   rejected --(creator or a finance manager / super admin saves an edit)--> awaiting_fm
 *   approved --(super admin unlocks, with reason)--> awaiting_fm
 *
 * Totals are unaffected: they still follow the Accepted / Pending / Canceled status.
 * Transactions created before the review existed have no stage: they wait for
 * Finance Manager approval like new ones.
 */
import { normalizeRole, ROLES } from '../constants/roles.js';

export const REVIEW = Object.freeze({
  AWAITING_FM: 'awaiting_fm',
  FM_APPROVED: 'fm_approved',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

const UNDER_REVIEW = [REVIEW.AWAITING_FM, REVIEW.FM_APPROVED];

/** Stage of a transaction; older ones without a stage are awaiting the Finance Manager. */
export const reviewStageOf = (tx) => tx?.reviewStage || REVIEW.AWAITING_FM;

export const isLocked = (tx) => reviewStageOf(tx) === REVIEW.APPROVED;

const roleOf = (user) => normalizeRole(user?.role, user?.degree);
export const isReviewerFinanceManager = (user) => roleOf(user) === ROLES.FINANCE_MANAGER;
export const isReviewerAdmin = (user) => roleOf(user) === ROLES.SUPER_ADMIN;
export const isReviewer = (user) => isReviewerFinanceManager(user) || isReviewerAdmin(user);

/** A group boss's submission is frozen while it is under review. */
export const isFrozenSubmission = (tx) =>
  tx?.createdByRole === ROLES.GROUP_BOSS && UNDER_REVIEW.includes(reviewStageOf(tx));

/**
 * Why `user` may not edit / delete this transaction right now, or null if they may.
 * (Group scoping and requireFinanceManager are checked separately by the routes.)
 * @param {'edit'|'delete'|'status'} action - status = the Accept / Cancel buttons
 */
export function changeBlockedReason(tx, user, action = 'edit') {
  if (isLocked(tx)) {
    return 'This transaction is approved and locked. A Super Admin must unlock it first.';
  }
  if (isFrozenSubmission(tx)) {
    // Reviewers may still mark a frozen submission Accepted / Canceled; nobody edits its details.
    if (action === 'status' && isReviewer(user)) return null;
    return 'This transaction was submitted by a group boss and is under review. It can be changed only after a Finance Manager or Admin rejects it.';
  }
  return null;
}

/** Which review buttons `user` gets for this transaction. */
export function reviewActionsFor(tx, user) {
  const stage = reviewStageOf(tx);
  return {
    fmApprove: stage === REVIEW.AWAITING_FM && isReviewerFinanceManager(user),
    adminApprove: stage === REVIEW.FM_APPROVED && isReviewerAdmin(user),
    reject: UNDER_REVIEW.includes(stage) && isReviewer(user),
    unlock: stage === REVIEW.APPROVED && isReviewerAdmin(user),
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
 * always has; anything created from then on counts only once fully approved
 * (finance manager + super admin). The usual Accepted / Canceled rules still
 * apply on top. Override the cut-off with FINANCE_APPROVAL_REQUIRED_FROM (ISO date).
 */
const DEFAULT_APPROVAL_REQUIRED_FROM = '2026-11-08T22:30:00.000Z';
const parsedCutoff = new Date(process.env.FINANCE_APPROVAL_REQUIRED_FROM || DEFAULT_APPROVAL_REQUIRED_FROM);
export const APPROVAL_REQUIRED_FROM = Number.isNaN(parsedCutoff.getTime())
  ? new Date(DEFAULT_APPROVAL_REQUIRED_FROM)
  : parsedCutoff;

/** Mongo condition: the transaction counts in totals. */
export const countableCondition = () => ({
  $or: [{ createdAt: { $lt: APPROVAL_REQUIRED_FROM } }, { reviewStage: REVIEW.APPROVED }],
});

/** `match` narrowed to transactions that count in totals (safe even if `match` has its own $or). */
export const withCountable = (match = {}) => ({ $and: [match, countableCondition()] });

/** Same rule for a transaction already loaded. */
export const countsInTotals = (tx) =>
  reviewStageOf(tx) === REVIEW.APPROVED ||
  (tx?.createdAt != null && new Date(tx.createdAt) < APPROVAL_REQUIRED_FROM);
