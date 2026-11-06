import mongoose from 'mongoose';

/**
 * SummarizeWorktimeDeduction
 * - Percentage points super admin takes off a member's Final WorkTime % for one
 *   week of the Weekly Summarize page (e.g. 3 turns 100% into 97%).
 * - One row per user per week (FinancePeriod). No row means no deduction.
 */
const summarizeWorktimeDeductionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  periodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FinancePeriod',
    required: true,
    index: true
  },
  points: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

summarizeWorktimeDeductionSchema.index({ userId: 1, periodId: 1 }, { unique: true });

export default mongoose.model('SummarizeWorktimeDeduction', summarizeWorktimeDeductionSchema);
