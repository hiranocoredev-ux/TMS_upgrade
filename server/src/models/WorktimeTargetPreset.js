import mongoose from 'mongoose';

const worktimeTargetPresetSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 180,
    },
    color: {
      type: String,
      default: '#8b5cf6',
      trim: true,
      match: /^#([A-Fa-f0-9]{6})$/,
    },
    minutes: {
      type: Number,
      required: true,
      min: 0,
      max: 24 * 60,
    },
    active: {
      type: Boolean,
      default: true,
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

export default mongoose.model('WorktimeTargetPreset', worktimeTargetPresetSchema);

