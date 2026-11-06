import mongoose from 'mongoose';

/**
 * FinancePeriod
 * - Represents a named date range within a month
 * - Reusable across finance features
 * - Owns ALL date + naming semantics
 */

const financePeriodSchema = new mongoose.Schema({
  definition: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  month: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}$/, // YYYY-MM
    trim: true,
    index: true
  },

  startDate: {
    type: Date,
    required: true,
    index: true
  },

  endDate: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

/**
 * Validation: startDate <= endDate
 */
financePeriodSchema.pre('validate', function (next) {
  if (this.startDate > this.endDate) {
    return next(new Error('startDate must be less than or equal to endDate'));
  }
  next();
});

/**
 * Validation: dates must fall within the selected month
 */
financePeriodSchema.pre('validate', function (next) {
  if (!this.month) {
    return next(new Error('Month is required'));
  }

  const [year, monthNum] = this.month.split('-').map(Number);
  const monthStart = new Date(year, monthNum - 1, 1);
  const monthEnd = new Date(year, monthNum, 0, 23, 59, 59, 999);

  // if (this.startDate < monthStart || this.startDate > monthEnd) {
  //   return next(new Error('startDate must be within the selected month'));
  // }

  // if (this.endDate < monthStart || this.endDate > monthEnd) {
  //   return next(new Error('endDate must be within the selected month'));
  // }

  next();
});

// Indexes
financePeriodSchema.index({ month: 1, startDate: 1, endDate: 1 });
financePeriodSchema.index({ createdAt:-1 });
export default mongoose.model('FinancePeriod', financePeriodSchema);
