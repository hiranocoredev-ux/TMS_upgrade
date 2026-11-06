import mongoose from 'mongoose';

const TICKET_STAGES = [
  'NEW',
  'BID_SUBMITTED',
  'CLIENT_REPLIED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_DONE',
  'OFFER_CONTRACT',
  'IN_PROGRESS',
  'WON',
  'LOST_CLOSED'
];

const CLOSED_STAGES = ['WON', 'LOST_CLOSED'];

const stageHistorySchema = new mongoose.Schema({
  fromStage: {
    type: String,
    enum: TICKET_STAGES,
    required: true
  },
  toStage: {
    type: String,
    enum: TICKET_STAGES,
    required: true
  },
  changedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  changedAt: {
    type: Date,
    default: Date.now
  },
  reason: {
    type: String,
    default: ''
  }
}, { _id: false });

const jobTicketSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  platformSource: {
    type: String,
    trim: true
  },
  jobUrl: {
    type: String,
    trim: true
  },
  clientName: {
    type: String,
    trim: true
  },
  descriptionRichText: {
    type: String,
    default: ''
  },
  attachments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FileMeta'
  }],
  tags: [String],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  jobProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobProfile'
  },
  bidDate: {
    type: Date
  },
  bidAmount: {
    type: Number
  },
  followUpDate: {
    type: Date
  },
  currentStage: {
    type: String,
    enum: TICKET_STAGES,
    default: 'NEW',
    required: true,
    index: true
  },
  stageHistory: [stageHistorySchema],
  outcomeReason: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open',
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Indexes
jobTicketSchema.index({ jobProfileId: 1 });
jobTicketSchema.index({ currentStage: 1, status: 1 });
jobTicketSchema.index({ status: 1, createdAt: -1 });
jobTicketSchema.index({ platformSource: 1 });
jobTicketSchema.index({ tags: 1 });

// Method to add stage history entry
jobTicketSchema.methods.addStageHistory = function(fromStage, toStage, changedByUserId, reason = '') {
  this.stageHistory.push({
    fromStage,
    toStage,
    changedByUserId,
    changedAt: new Date(),
    reason
  });
};

// Static method to get valid next stages (simplified - all transitions allowed)
// Can be customized based on business rules
jobTicketSchema.statics.getValidNextStages = function(currentStage) {
  // For now, allow any transition (can be restricted later)
  return TICKET_STAGES.filter(stage => stage !== currentStage);
};

export { TICKET_STAGES, CLOSED_STAGES };
export default mongoose.model('JobTicket', jobTicketSchema);

