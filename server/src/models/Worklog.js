import mongoose from 'mongoose';

const manualAdjustmentSubSchema = new mongoose.Schema(
  {
    seconds: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
    // Short, tooltip-friendly reason shown on the worktime graph hover.
    shortReason: { type: String, default: '' },
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
        /** Line-items for super-admin manual time (sum must match numeric add_time). */
        manualAdjustments: { type: [manualAdjustmentSubSchema], default: [] },
    },
    { timestamps: true }
);

export default mongoose.model('Worklog', worklogSchema);
