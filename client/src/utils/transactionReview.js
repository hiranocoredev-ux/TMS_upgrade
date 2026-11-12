/**
 * Transaction review — mirrors server/src/utils/transactionReview.js.
 *
 * The finance manager is the only approver, and their approval is final:
 *   awaiting_fm -> (finance manager approves)            approved = counted & locked
 *   awaiting_fm -> (finance manager rejects, with reason) rejected; editing resubmits
 *   approved    -> (finance manager unlocks, with reason) awaiting_fm
 *
 * Super admin and admin see finance read-only and take no part. Transactions
 * created before the review existed have no stage: they wait for the finance
 * manager like new ones. `fm_approved` is left over from the former two-step
 * review and is treated as approved.
 * The server enforces all of this; the client only decides which buttons to show.
 */
import { normalizeRole, ROLES } from '../constants/roles';

export const REVIEW = Object.freeze({
  AWAITING_FM: 'awaiting_fm',
  /** Legacy (two-step review): treated as approved. */
  FM_APPROVED: 'fm_approved',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

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

/** May `user` edit the details of this transaction right now? */
export const canEditTransaction = (tx, user) => !isLocked(tx) && !isFrozenSubmission(tx);

/** May `user` use the Accept / Cancel buttons on it? The finance manager may on a frozen submission. */
export const canChangeStatus = (tx, user) =>
  !isLocked(tx) && (!isFrozenSubmission(tx) || isReviewer(user));

/** Which review buttons `user` gets for this transaction. */
export const reviewActionsFor = (tx, user) => {
  const stage = reviewStageOf(tx);
  const fm = isReviewer(user);
  return {
    approve: stage === REVIEW.AWAITING_FM && fm,
    reject: stage === REVIEW.AWAITING_FM && fm,
    unlock: stage === REVIEW.APPROVED && fm,
  };
};

/**
 * Does this transaction count in totals yet? The server decides (new ones count
 * only once approved by the finance manager) and sends `countsInTotals`; rows
 * without the flag (older API responses) count as before.
 */
export const countsInTotals = (tx) => tx?.countsInTotals !== false;

const nameOf = (ref) => (ref && typeof ref === 'object' ? ref.name : '') || '';
const dayOf = (d) => (d ? new Date(d).toLocaleDateString() : '');

/** Badge for the Status column: { key, label, title }. */
export const reviewBadge = (tx) => {
  const badge = baseReviewBadge(tx);
  return countsInTotals(tx)
    ? badge
    : { ...badge, title: `${badge.title}. Not counted in totals until approved.` };
};

const baseReviewBadge = (tx) => {
  const stage = reviewStageOf(tx);
  if (stage === REVIEW.AWAITING_FM) {
    return {
      key: 'awaiting',
      label: isFrozenSubmission(tx) ? 'Submitted · awaiting FM' : 'Awaiting FM',
      title: tx?.reviewStage
        ? 'Waiting for Finance Manager approval'
        : 'Created before the approval workflow — waiting for Finance Manager approval',
    };
  }
  if (stage === REVIEW.REJECTED) {
    const by = nameOf(tx.reviewRejectedByUserId);
    return {
      key: 'rejected',
      label: 'Rejected',
      title: `Rejected${by ? ` by ${by}` : ''}: ${tx.reviewRejectReason || 'no reason given'} — edit and save to resubmit`,
    };
  }
  // Approved: by the finance manager, or by a super admin under the former rules.
  const fm = nameOf(tx.fmApprovedByUserId);
  const admin = nameOf(tx.adminApprovedByUserId);
  const by = fm ? `Finance Manager ${fm}` : admin ? `Super Admin ${admin}` : tx.fmApprovedAt ? 'Finance Manager' : 'Super Admin';
  const at = tx.adminApprovedAt || tx.fmApprovedAt;
  return {
    key: 'locked',
    label: 'Approved · Locked',
    title: `Approved by ${by}${at ? ` on ${dayOf(at)}` : ''} — locked`,
  };
};

/** Short explanation shown when a transaction cannot be edited. */
export const lockedMessage = (tx) => {
  if (isLocked(tx)) return 'This transaction is approved and locked. A Finance Manager must unlock it before it can be changed.';
  if (isFrozenSubmission(tx)) return 'Submitted by a group boss and waiting for the Finance Manager. It can be changed only after the Finance Manager rejects it.';
  return '';
};
