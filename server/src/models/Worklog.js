import mongoose from 'mongoose';

const manualAdjustmentSubSchema = new mongoose.Schema(
  {
    seconds: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
    // Short, tooltip-friendly reason shown on the worktime graph hover.
    shortReason: { type: String, default: '' },
    /**
     * The period the time was added for, "HH:MM" (00:00–24:00) on the worklog's
     * day; `seconds` is end - start. Empty on entries made before ranges existed.
     */
    startTime: { type: String, default: '' },
    endTime: { type: String, default: '' },
    /** Optional proof: a screenshot under /uploads/worktime_screenshots. */
    screenshotUrl: { type: String, default: '' },
    /**
     * Only `approved` time counts (add_time, charts, achievement, competition).
     * Time a group boss adds starts `pending` until a super admin / admin
     * approves it; time they add themselves is approved at once. Entries from
     * before this field existed have no value and count as approved.
     */
    status: { type: String, enum: ['approved', 'pending', 'rejected'], default: 'approved' },
    addedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedByName: { type: String, default: '' },
    addedByRole: { type: String, default: '' },
    reviewedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedByName: { type: String, default: '' },
    reviewedAt: { type: Date },
    rejectReason: { type: String, default: '' },
  },
  { _id: true, timestamps: true }
);

/**
 * Worklog matches the pre-existing `worklogs` collection shape:
 *   { hubstaff_id, user_id, date (Date), real_time, add_time, total_time,
 *     activities, productivity, note, status, source }
 *
 * One record per user per day. Hours in `real_time` come from Hubstaff sync;
 * `add_time` is added manually by admin via the Workflow page.
 */
const worklogSchema = new mongoose.Schema(
  {
        member: {
            type: String,
            required: true,
        },
        // YYYY-MM-DD
        date: {
            type: String,
            required: true,
        },
        real_time: {
            type: Number,
            required: true,
        },
        total_time: {
            type: Number,
            required: true,
        },
        efficiency: {
            type: Number,
            required: true,
        },
        add_time: {
            type: String,
            default: '0',
        },
        note: {
            type: String,
        },
        /** Line-items for manual time (add_time = the sum of the APPROVED ones). */
        manualAdjustments: { type: [manualAdjustmentSubSchema], default: [] },
    },
    { timestamps: true }
);

export default mongoose.model('Worklog', worklogSchema);
