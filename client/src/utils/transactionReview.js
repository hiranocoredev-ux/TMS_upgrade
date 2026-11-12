/**
 * Transaction review — mirrors server/src/utils/transactionReview.js.
 *
 * A finance manager OR a super admin approves, and either approval is final:
 *   awaiting_fm -> (either approves)            approved = counted everywhere & locked
 *   awaiting_fm -> (either rejects, with reason) rejected; editing resubmits
 *   approved    -> (either unlocks, with reason) awaiting_fm
 *
 * The admin role sees finance read-only and takes no part. Transactions created
 * before the review existed have no stage: they wait for approval like new ones. `fm_approved` is left over from the former two-step
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
/** Reviewers: a finance manager or a super admin (the admin role never reviews). */
export const isReviewer = (user) => [ROLES.FINANCE_MANAGER, ROLES.SUPER_ADMIN].includes(roleOf(user));

/** A group boss's submission is frozen while it waits for approval. */
export const isFrozenSubmission = (tx) =>
  tx?.createdByRole === ROLES.GROUP_BOSS && reviewStageOf(tx) === REVIEW.AWAITING_FM;

/** May `user` edit the details of this transaction right now? */
export const canEditTransaction = (tx, user) => !isLocked(tx) && !isFrozenSubmission(tx);

/** May `user` use the Accept / Cancel buttons on it? A reviewer may on a frozen submission. */
export const canChangeStatus = (tx, user) =>
  !isLocked(tx) && (!isFrozenSubmission(tx) || isReviewer(user));

/** Which review buttons `user` gets for this transaction. */
export const reviewActionsFor = (tx, user) => {
  const stage = reviewStageOf(tx);
  const reviewer = isReviewer(user);
  return {
    approve: stage === REVIEW.AWAITING_FM && reviewer,
    reject: stage === REVIEW.AWAITING_FM && reviewer,
    unlock: stage === REVIEW.APPROVED && reviewer,
  };
};

/**
 * Does this transaction count in totals yet? The server decides (new ones count
 * only once approved by a finance manager or super admin) and sends `countsInTotals`; rows
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
        ? 'Waiting for approval by a Finance Manager or Super Admin'
        : 'Created before the approval workflow — waiting for approval by a Finance Manager or Super Admin',
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
  // Approved by a finance manager or a super admin.
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
  if (isLocked(tx)) return 'This transaction is approved and locked. A Finance Manager or Super Admin must unlock it before it can be changed.';
  if (isFrozenSubmission(tx)) return 'Submitted by a group boss and waiting for approval. It can be changed only after a Finance Manager or Super Admin rejects it.';
  return '';
};
