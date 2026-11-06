import mongoose from 'mongoose';

const worktimeTargetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    month: {
      type: String, // YYYY-MM
      required: true,
      match: /^\d{4}-\d{2}$/,
      index: true,
    },
    targetMinutes: {
      type: Number,
      required: true,
      min: 0,
      max: 24 * 60,
      default: 810, // 13h 30m
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

worktimeTargetSchema.index({ userId: 1, month: 1 }, { unique: true });

export default mongoose.model('WorktimeTarget', worktimeTargetSchema);

