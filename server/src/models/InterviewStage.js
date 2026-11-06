import mongoose from 'mongoose';

/**
 * InterviewStage Model
 * 
 * PRD v3.0: Stages (columns) within an InterviewBoard
 * - Each board can have multiple stages
 * - Stages have an order for display
 * - Default stages can be created for new boards
 */

const interviewStageSchema = new mongoose.Schema({
  boardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InterviewBoard',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  order: {
    type: Number,
    required: true,
    default: 0,
    index: true
  },
  // Color for UI display (optional)
  color: {
    type: String,
    default: '#3498db',
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Optional: Stage-specific settings
  settings: {
    wipLimit: {
      type: Number,
      default: null // Work-in-progress limit (null = unlimited)
    },
    autoMoveRules: {
      type: String, // JSON string for complex rules (can be enhanced later)
      default: null
    }
  }
}, {
  timestamps: { createdAt: true, updatedAt: true }
});

// Compound indexes for common queries
interviewStageSchema.index({ boardId: 1, order: 1 });

// Ensure unique stage names per board (optional, can be relaxed)
// interviewStageSchema.index({ boardId: 1, name: 1 }, { unique: true });

export default mongoose.model('InterviewStage', interviewStageSchema);

