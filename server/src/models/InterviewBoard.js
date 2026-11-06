import mongoose from 'mongoose';

/**
 * InterviewBoard Model
 * 
 * PRD v3.0: Collaborative Kanban boards for interview management
 * - Owner can create boards
 * - Visibility: private (owner only), shared (specific users), team (all admins/members)
 * - Boards contain stages (columns) and tickets (cards)
 */

const interviewBoardSchema = new mongoose.Schema({
  ownerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  visibility: {
    type: String,
    enum: ['private', 'shared', 'team'],
    default: 'private',
    required: true,
    index: true
  },
  // Users who have access (for 'shared' visibility)
  sharedWith: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  }],
  // Optional: Board-level settings
  settings: {
    allowAllMembers: {
      type: Boolean,
      default: false // If true, all team members can view (even if visibility is 'shared')
    },
    allowGuests: {
      type: Boolean,
      default: false // If true, guests can view
    }
  },
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active',
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for common queries
interviewBoardSchema.index({ ownerUserId: 1, status: 1 });
interviewBoardSchema.index({ visibility: 1, status: 1 });
interviewBoardSchema.index({ 'sharedWith': 1, status: 1 });
interviewBoardSchema.index({ createdAt: -1 });

export default mongoose.model('InterviewBoard', interviewBoardSchema);

