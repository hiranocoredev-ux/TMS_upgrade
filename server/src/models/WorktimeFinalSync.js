import mongoose from 'mongoose';

const worktimeFinalSyncSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      unique: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    confirmed: {
      type: Boolean,
      default: false,
    },
    source: {
      type: String,
      default: 'hub',
      trim: true,
      maxlength: 60,
    },
    syncedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    syncedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model('WorktimeFinalSync', worktimeFinalSyncSchema);
