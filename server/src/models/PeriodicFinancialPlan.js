import mongoose from 'mongoose';

/**
 * PeriodicFinancialPlan
 * - Financial goal for a user within a FinancePeriod
 */

const periodicFinancialPlanSchema = new mongoose.Schema({
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

  periodicFinancialGoal: {
    type: Number,
    required: true,
    min: 0
  },

  note: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Prevent duplicate plans per user per period
periodicFinancialPlanSchema.index(
  { userId: 1, periodId: 1 },
  { unique: true }
);

export default mongoose.model('PeriodicFinancialPlan', periodicFinancialPlanSchema);
