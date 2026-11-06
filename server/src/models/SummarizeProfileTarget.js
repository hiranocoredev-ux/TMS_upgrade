import mongoose from 'mongoose';

/**
 * A member's monthly profile targets, entered by a super admin on the Monthly
 * Summarize page.
 *
 *   profileTarget — how many accounts the member should hold this month, which
 *                   the counted accounts are measured against.
 *   offerTarget / offerResult — job members only: the job offers they were meant
 *                   to land this month, and how many they actually got.
 */
const summarizeProfileTargetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    /** YYYY-MM */
    month: { type: String, required: true },
    profileTarget: { type: Number, min: 0, default: 0 },
    offerTarget: { type: Number, min: 0, default: 0 },
    offerResult: { type: Number, min: 0, default: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

summarizeProfileTargetSchema.index({ userId: 1, month: 1 }, { unique: true });
summarizeProfileTargetSchema.index({ month: 1 });

export default mongoose.model('SummarizeProfileTarget', summarizeProfileTargetSchema);
