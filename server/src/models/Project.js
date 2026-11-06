import mongoose from 'mongoose';

const milestoneSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  percent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  }
}, { _id: false });

const progressLogSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  attachments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FileMeta'
  }],
  createdByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const commentSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  clientCompanyName: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'done'],
    default: 'active',
    required: true,
    index: true
  },
  ownerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  collaboratorUserIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  clientContacts: {
    email: String,
    phone: String,
    telegram: String
  },
  attachments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FileMeta'
  }],
  sourceJobTicketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobTicket',
    index: true
  },
  milestones: [milestoneSchema],
  progressPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  repoLinks: [String],
  progressLogs: [progressLogSchema],
  comments: [commentSchema]
}, {
  timestamps: true
});

// Indexes
projectSchema.index({ ownerUserId: 1, status: 1 });
projectSchema.index({ 'collaboratorUserIds': 1 });
projectSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Project', projectSchema);

