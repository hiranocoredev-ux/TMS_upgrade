/**
 * Two-step transaction review — mirrors server/src/utils/transactionReview.js.
 *
 *   awaiting_fm -> (finance manager approves) fm_approved
 *               -> (super admin approves)     approved = locked
 *   a super admin may also approve straight from awaiting_fm: final on its own
 *   either reviewer may reject (with a reason) -> rejected; editing resubmits
 *   a super admin may unlock an approved one (with a reason) -> awaiting_fm
 *
 * Transactions created before the review existed have no stage: they wait for
 * Finance Manager approval like new ones.
 * The server enforces all of this; the client only decides which buttons to show.
 */
import { normalizeRole, ROLES } from '../constants/roles';

export const REVIEW = Object.freeze({
  AWAITING_FM: 'awaiting_fm',
  FM_APPROVED: 'fm_approved',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

const UNDER_REVIEW = [REVIEW.AWAITING_FM, REVIEW.FM_APPROVED];

export const reviewStageOf = (tx) => tx?.reviewStage || REVIEW.AWAITING_FM;
export const isLocked = (tx) => reviewStageOf(tx) === REVIEW.APPROVED;

const roleOf = (user) => normalizeRole(user?.role, user?.degree);
export const isFinanceManagerReviewer = (user) => roleOf(user) === ROLES.FINANCE_MANAGER;
export const isAdminReviewer = (user) => roleOf(user) === ROLES.SUPER_ADMIN;
export const isReviewer = (user) => isFinanceManagerReviewer(user) || isAdminReviewer(user);

/** A group boss's submission is frozen while it is under review. */
export const isFrozenSubmission = (tx) =>
  tx?.createdByRole === ROLES.GROUP_BOSS && UNDER_REVIEW.includes(reviewStageOf(tx));

/** May `user` edit the details of this transaction right now? */
export const canEditTransaction = (tx, user) => !isLocked(tx) && !isFrozenSubmission(tx);

/** May `user` use the Accept / Cancel buttons on it? Reviewers may on a frozen submission. */
export const canChangeStatus = (tx, user) =>
  !isLocked(tx) && (!isFrozenSubmission(tx) || isReviewer(user));

/** Which review buttons `user` gets for this transaction. */
export const reviewActionsFor = (tx, user) => {
  const stage = reviewStageOf(tx);
  return {
    fmApprove: stage === REVIEW.AWAITING_FM && isFinanceManagerReviewer(user),
    // A super admin's approval is final, with or without the finance manager's.
    adminApprove: UNDER_REVIEW.includes(stage) && isAdminReviewer(user),
    reject: UNDER_REVIEW.includes(stage) && isReviewer(user),
    unlock: stage === REVIEW.APPROVED && isAdminReviewer(user),
  };
};

/**
 * Does this transaction count in totals yet? The server decides (new ones count
 * only once fully approved) and sends `countsInTotals`; rows without the flag
 * (older API responses) count as before.
 */
export const countsInTotals = (tx) => tx?.countsInTotals !== false;

const nameOf = (ref) => (ref && typeof ref === 'object' ? ref.name : '') || '';
const dayOf = (d) => (d ? new Date(d).toLocaleDateString() : '');

/** Badge for the Status column: { key, label, title }. */
export const reviewBadge = (tx) => {
  const badge = baseReviewBadge(tx);
  return countsInTotals(tx)
    ? badge
    : { ...badge, title: `${badge.title}. Not counted in totals until fully approved.` };
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
  if (stage === REVIEW.FM_APPROVED) {
    const by = nameOf(tx.fmApprovedByUserId);
    return {
      key: 'fm',
      label: 'FM Approved',
      title: `Approved by Finance Manager${by ? ` ${by}` : ''}${tx.fmApprovedAt ? ` on ${dayOf(tx.fmApprovedAt)}` : ''} — waiting for Admin approval`,
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
  const admin = nameOf(tx.adminApprovedByUserId);
  const when = tx.adminApprovedAt ? ` on ${dayOf(tx.adminApprovedAt)}` : '';
  // Approved by the super admin without a finance manager approval first.
  if (!tx.fmApprovedAt) {
    return {
      key: 'locked',
      label: 'Approved by Admin · Locked',
      title: `Approved by Super Admin${admin ? ` ${admin}` : ''}${when} without Finance Manager approval — locked`,
    };
  }
  const fm = nameOf(tx.fmApprovedByUserId);
  return {
    key: 'locked',
    label: 'Approved · Locked',
    title: `Approved by Finance Manager${fm ? ` ${fm}` : ''} and Super Admin${admin ? ` ${admin}` : ''}${when} — locked`,
  };
};

/** Short explanation shown when a transaction cannot be edited. */
export const lockedMessage = (tx) => {
  if (isLocked(tx)) return 'This transaction is approved and locked. A Super Admin must unlock it before it can be changed.';
  if (isFrozenSubmission(tx)) return 'Submitted by a group boss and under review. It can be changed only after a Finance Manager or Admin rejects it.';
  return '';
};
