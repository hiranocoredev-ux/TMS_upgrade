import mongoose from 'mongoose';

/**
 * OPTIMIZED FinanceTransaction Model
 * 
 * Index Optimization:
 * - Removed redundant individual indexes covered by compound indexes
 * - Added critical compound index for summary queries: { userId: 1, status: 1, date: -1 }
 * - Added compound index for category breakdowns: { status: 1, type: 1, category: 1, date: -1 }
 */

const financeTransactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['income', 'outcome'],
    required: true
    // Removed individual index - covered by compound indexes
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
    // Removed individual index - covered by compound indexes
  },
  date: {
    type: Date,
    required: true
    // Removed individual index - covered by compound indexes
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USD'
    // Removed individual index - covered by compound index { currency: 1, date: -1 }
  },
  category: {
    type: String,
    required: function() {
      return this.type === 'outcome';
    }
  },
  source: {
    type: String,
    required: function() {
      return this.type === 'income';
    }
  },
  description: {
    type: String,
    default: ''
  },
  attachments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FileMeta'
  }],
  linkedProjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  linkedJobTicketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobTicket',
    index: true  // Keep - used for project linking queries
  },
  approvalStatus: {
    type: String,
    enum: ['not_required', 'pending', 'approved', 'rejected'],
    default: 'not_required',
    required: true
    // Removed individual index - covered by compound index { approvalStatus: 1, type: 1 }
  },
  approvedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'canceled'],
    default: 'accepted',
    required: true
    // Removed individual index - covered by compound indexes
  }
}, {
  timestamps: true
});

// ============================================
// OPTIMIZED INDEXES
// ============================================

// 1. User transaction lists (most common query)
// Used in: GET /finance/transactions
financeTransactionSchema.index({ userId: 1, date: -1 });

// 2. ⭐ CRITICAL: Summary endpoint queries
// Used in: GET /finance/summary (line 730)
// Pattern: { userId, status: { $ne: 'canceled' }, date: { $gte, $lte } }
financeTransactionSchema.index({ userId: 1, status: 1, date: -1 });

// 3. Date + type queries
// Used in: Various aggregations
financeTransactionSchema.index({ date: 1, type: 1 });

// 4. Approval workflow
// Used in: Budget calculations, approval endpoints
financeTransactionSchema.index({ approvalStatus: 1, type: 1 });

// 5. Currency-based queries
// Used in: Currency filtering, budget calculations
financeTransactionSchema.index({ currency: 1, date: -1 });

// 6. Category breakdowns
// Used in: GET /finance/summary breakdownByCategory
// Pattern: { status: { $ne: 'canceled' }, type: 'outcome', category, date }
financeTransactionSchema.index({ status: 1, type: 1, category: 1, date: -1 });

// 7. Status + type filtering
// Used in: Status-based filtering
financeTransactionSchema.index({ status: 1, type: 1 });

// 8. Status + date queries
// Used in: Trend aggregations
financeTransactionSchema.index({ status: 1, date: -1 });

// 9. Budget calculations
// Used in: getAvailableBudget() - outcome approval queries
financeTransactionSchema.index({ type: 1, currency: 1, approvalStatus: 1, status: 1, date: 1 });

export default mongoose.model('FinanceTransaction', financeTransactionSchema);
