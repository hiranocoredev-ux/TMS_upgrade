import mongoose from 'mongoose';

/** Member → group boss (same group). Group boss → super admin / payment reviewers. */
export const PAYMENT_REQUEST_FLOW = {
  MEMBER_TO_BOSS: 'MEMBER_TO_BOSS',
  BOSS_TO_PLATFORM: 'BOSS_TO_PLATFORM',
};

export const PAYMENT_REQUEST_STATUS = {
  PENDING: 'PENDING',
  DISCUSSING: 'DISCUSSING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
};

const paymentRequestSchema = new mongoose.Schema(
  {
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** Snapshot of requester's group at creation (for boss inbox queries). */
    group: { type: String, default: '', index: true },
    flowType: {
      type: String,
      enum: Object.values(PAYMENT_REQUEST_FLOW),
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD', trim: true },
    reason: { type: String, required: true, trim: true, maxlength: 4000 },
    untilDate: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(PAYMENT_REQUEST_STATUS),
      default: PAYMENT_REQUEST_STATUS.PENDING,
      index: true,
    },
    /** Latest note from approver (discussion, acceptance note, or rejection reason). */
    resolverComment: { type: String, default: '', maxlength: 4000 },
    handledByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    handledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

paymentRequestSchema.index({ createdAt: -1 });
paymentRequestSchema.index({ flowType: 1, status: 1, group: 1 });

export default mongoose.model('PaymentRequest', paymentRequestSchema);
