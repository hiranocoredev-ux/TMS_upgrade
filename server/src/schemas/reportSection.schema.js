import mongoose from 'mongoose';

/** Shared section shape for daily / weekly / monthly reports and plans. */
export const SectionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true
    },
    /** Plan text (report tickets) or plan content (plan documents). */
    notes: {
      type: String,
      default: '',
      maxlength: 5000
    },
    /** Snapshot of submitted plan for this ticket (report documents). */
    planNotes: {
      type: String,
      default: '',
      maxlength: 5000
    },
    /** Ticket achieved (true) / not achieved (false); omit when unset. */
    checked: {
      type: Boolean,
      default: undefined
    },
    /** Completion % for this ticket (report documents); may exceed 100. */
    percent: {
      type: Number,
      min: 0,
      default: undefined
    }
  },
  { _id: false }
);
