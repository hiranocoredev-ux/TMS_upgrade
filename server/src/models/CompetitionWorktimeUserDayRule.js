import mongoose from 'mongoose';

const competitionWorktimeUserDayRuleSchema = new mongoose.Schema(
  {
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Final target minutes for this user/date (0..1440)
    targetMinutes: { type: Number, required: true, min: 0, max: 1440 },
    // holiday: personal day off · reduce: smaller target · work: a working day
    // even on a weekend / holiday (used by the Summarize weekend rule)
    kind: { type: String, enum: ['holiday', 'reduce', 'work'], default: 'reduce' },
    reduceMinutes: { type: Number, default: 0, min: 0, max: 1440 },
    note: { type: String, default: '' },
    /** Set by an automatic rule (e.g. 'summarize_weekend') so it can be revoked again. */
    source: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

competitionWorktimeUserDayRuleSchema.index({ month: 1, date: 1, userId: 1 }, { unique: true });

export default mongoose.model('CompetitionWorktimeUserDayRule', competitionWorktimeUserDayRuleSchema);
