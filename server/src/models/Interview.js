import mongoose from 'mongoose';

const interviewSchema = new mongoose.Schema({
  jobTicketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobTicket',
    required: true,
    index: true
  },
  scheduledAt: {
    type: Date,
    required: true,
    index: true
  },
  durationMinutes: {
    type: Number,
    required: true,
    min: 1
  },
  meetingLink: {
    type: String,
    trim: true
  },
  interviewType: {
    type: String,
    trim: true
  },
  platform: {
    type: String,
    trim: true
  },
  participants: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    default: ''
  },
  prepChecklist: [{
    type: String
  }],
  resumeFileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FileMeta'
  },
  outcomeNotes: {
    type: String,
    default: ''
  },
  nextActionDate: {
    type: Date
  },
  createdByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for common queries
interviewSchema.index({ scheduledAt: 1, createdAt: -1 });
interviewSchema.index({ createdByUserId: 1, scheduledAt: 1 });
interviewSchema.index({ jobTicketId: 1, scheduledAt: -1 });
interviewSchema.index({ nextActionDate: 1 });

export default mongoose.model('Interview', interviewSchema);

