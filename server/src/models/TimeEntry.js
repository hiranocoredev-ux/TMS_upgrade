import mongoose from 'mongoose';

const timeEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Denormalized for fast group-filtered queries
    group: {
      type: String,
      default: '',
    },
    date: {
      type: String, // YYYY-MM-DD  (local date at log time)
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      default: null,
    },
    // Computed seconds between startTime and endTime; 0 while running
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },
    description: {
      type: String,
      default: '',
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['running', 'completed'],
      default: 'completed',
    },
  },
  { timestamps: true }
);

// Index for efficient per-user and per-date queries
timeEntrySchema.index({ userId: 1, date: -1 });
timeEntrySchema.index({ group: 1, date: -1 });
timeEntrySchema.index({ status: 1, userId: 1 });

const TimeEntry = mongoose.model('TimeEntry', timeEntrySchema);
export default TimeEntry;
