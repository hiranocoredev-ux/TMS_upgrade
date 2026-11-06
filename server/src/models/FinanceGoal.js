import mongoose from 'mongoose';

/**
 * FinanceGoal Model
 * 
 * Represents monthly financial goals for users:
 * - incomeGoal: Target income for the month
 * - expenseLimit: Optional spending limit for the month
 * - month format: YYYY-MM (e.g., "2026-01")
 */

const financeGoalSchema = new mongoose.Schema({
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
  incomeGoal: {
    type: Number,
    required: true,
    min: 0
  },
  expenseLimit: {
    type: Number,
    min: 0,
    default: null // Optional
  }
}, {
  timestamps: { createdAt: true, updatedAt: true }
});

// Compound unique index: one goal per user per month
financeGoalSchema.index({ userId: 1, month: 1 }, { unique: true });

// Index for querying by month
financeGoalSchema.index({ month: 1 });

export default mongoose.model('FinanceGoal', financeGoalSchema);

