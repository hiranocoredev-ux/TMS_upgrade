import mongoose from 'mongoose';

/**
 * SummarizeCallCount
 * - The weekly per-member row of the Summarize page, entered by super admin:
 *   the member's count plan + result (calls for a normal team, job interviews for
 *   a job team), and whether the member is excluded from that week's summarize.
 * - One row per user per week (FinancePeriod).
 * - `plan: null` means no plan was set for that week.
 */
const summarizeCallCountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  periodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FinancePeriod',
    required: true,
    index: true
  },
  plan: {
    type: Number,
    min: 0,
    default: null
  },
  result: {
    type: Number,
    min: 0,
    default: 0
  },
  /** Excluded members are listed but left out of every weekly percentage. */
  excluded: {
    type: Boolean,
    default: false
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

summarizeCallCountSchema.index({ userId: 1, periodId: 1 }, { unique: true });

export default mongoose.model('SummarizeCallCount', summarizeCallCountSchema);
