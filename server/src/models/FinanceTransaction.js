import mongoose from 'mongoose';

const financeTransactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['income', 'outcome'],
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  // Final recorded value. Derived from `inputPrice` and the effective Tron
  // state: Tron -> amount === inputPrice, otherwise amount === inputPrice * 0.98.
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  // Raw price entered by the user, before the non-Tron fee is applied. Legacy
  // rows created before this field existed have no value; those fall back to
  // `amount`.
  inputPrice: {
    type: Number,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USD',
    index: true
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
  // Whether this transaction went through the team wallet. Legacy rows created
  // before this field existed have no value; those are treated as `true`.
  throughTeamWallet: {
    type: Boolean,
    default: true
  },
  // Whether the money moved over Tron. Only meaningful for income that went
  // through the team wallet -- outcomes and non-wallet income are always Tron
  // (recorded at the full price). Legacy rows created before this field existed
  // have no value; those are treated as `false` (not Tron).
  isTron: {
    type: Boolean,
    default: false
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
    index: true
  },
  approvalStatus: {
    type: String,
    enum: ['not_required', 'pending', 'approved', 'rejected'],
    default: 'not_required',
    required: true,
    index: true
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
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Indexes
financeTransactionSchema.index({ userId: 1, date: -1 });
financeTransactionSchema.index({ date: 1, type: 1 });
financeTransactionSchema.index({ approvalStatus: 1, type: 1 });
financeTransactionSchema.index({ currency: 1, date: -1 });
financeTransactionSchema.index({ category: 1, date: -1 });
financeTransactionSchema.index({ status: 1, type: 1 });
financeTransactionSchema.index({ status: 1, date: -1 });

export default mongoose.model('FinanceTransaction', financeTransactionSchema);

