import mongoose from 'mongoose';

/**
 * InterviewActivityLog Model
 * 
 * PRD v3.0: Activity logging for interview tickets
 * - Tracks all changes to tickets (stage moves, field updates, etc.)
 * - Records who made the change and what changed
 * - Used for audit trail and activity feed
 */

const interviewActivityLogSchema = new mongoose.Schema({
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InterviewTicket',
    required: true,
    index: true
  },
  boardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InterviewBoard',
    required: true,
    index: true
  },
  actorUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  actionType: {
    type: String,
    required: true,
    enum: [
      'TICKET_CREATE',
      'TICKET_UPDATE',
      'STAGE_MOVE',
      'FIELD_UPDATE',
      'COMMENT_ADD',
      'ATTACHMENT_ADD',
      'ATTACHMENT_DELETE',
      'DATE_ADD',
      'DATE_UPDATE',
      'DATE_DELETE',
      'STATUS_CHANGE',
      'PRIORITY_CHANGE',
      'ASSIGNEE_CHANGE',
      'TICKET_DELETE'
    ],
    index: true
  },
  // What changed (JSON object describing the change)
  diff: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Human-readable description
  description: {
    type: String,
    trim: true
  },
  // Optional: Link to related entity
  relatedEntityId: {
    type: String
  },
  relatedEntityType: {
    type: String
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

// Compound indexes for common queries
interviewActivityLogSchema.index({ ticketId: 1, createdAt: -1 });
interviewActivityLogSchema.index({ boardId: 1, createdAt: -1 });
interviewActivityLogSchema.index({ actorUserId: 1, createdAt: -1 });
interviewActivityLogSchema.index({ actionType: 1, createdAt: -1 });
interviewActivityLogSchema.index({ createdAt: -1 });

export default mongoose.model('InterviewActivityLog', interviewActivityLogSchema);

