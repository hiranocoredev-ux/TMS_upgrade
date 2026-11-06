import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema({
  periodType: {
    type: String,
    enum: ['monthly', 'rolling'],
    required: true
  },
  periodStart: {
    type: Date,
    required: function() {
      return this.periodType === 'monthly';
    }
  },
  periodEnd: {
    type: Date,
    required: function() {
      return this.periodType === 'monthly';
    }
  },
  startingAmount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USD',
    index: true
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

// Index for finding active budgets
budgetSchema.index({ currency: 1, periodStart: 1, periodEnd: 1 });

export default mongoose.model('Budget', budgetSchema);

