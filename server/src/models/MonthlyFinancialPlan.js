import mongoose from 'mongoose';

/**
 * MonthlyFinancialPlan Model
 * 
 * Represents monthly financial goals assigned to users by boss/superadmin.
 * - One plan per user per month (enforced by unique index)
 * - Users cannot edit their own plans
 * - month format: YYYY-MM (e.g., "2026-01")
 */

const monthlyFinancialPlanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  month: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}$/, // Format: YYYY-MM
    trim: true,
    index: true
  },
  monthlyFinancialGoal: {
    type: Number, 
    required: true,
    min: 0
  },
  note: {
    type: String,
    default: ''
  },
  periodicPlanIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PeriodicFinancialPlan',
    default: []
  }]
}, {
  timestamps: { createdAt: true, updatedAt: true }
});

// Compound unique index: one plan per user per month
monthlyFinancialPlanSchema.index({ userId: 1, month: 1 }, { unique: true });

// Index for querying by month
monthlyFinancialPlanSchema.index({ month: 1 });

// Index for querying by user
monthlyFinancialPlanSchema.index({ userId: 1, month: -1 });

export default mongoose.model('MonthlyFinancialPlan', monthlyFinancialPlanSchema);
