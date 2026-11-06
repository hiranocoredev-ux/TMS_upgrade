import mongoose from 'mongoose';

/**
 * SummarizeCitizenCount
 * - Weekly "getting citizen" plan and result for one group, entered by super
 *   admin on the Summarize page. One row per group per week (FinancePeriod).
 * - Weeks without a row use the default plan (DEFAULT_CITIZEN_PLAN) and a 0 result.
 */
const summarizeCitizenCountSchema = new mongoose.Schema({
  groupCode: {
    type: String,
    required: true,
    trim: true,
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
    default: 2
  },
  result: {
    type: Number,
    min: 0,
    default: 0
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

summarizeCitizenCountSchema.index({ groupCode: 1, periodId: 1 }, { unique: true });

export default mongoose.model('SummarizeCitizenCount', summarizeCitizenCountSchema);
