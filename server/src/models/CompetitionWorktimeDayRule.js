import mongoose from 'mongoose';

const competitionWorktimeDayRuleSchema = new mongoose.Schema(
  {
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    isHoliday: { type: Boolean, default: false },
    // Signed delta minutes against base daily target, e.g. -120 means reduce by 2h.
    targetDeltaMinutes: { type: Number, default: 0 },
    reasonType: { type: String, enum: ['', 'holiday', 'reason'], default: '' },
    note: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

competitionWorktimeDayRuleSchema.index({ month: 1, date: 1 }, { unique: true });

export default mongoose.model('CompetitionWorktimeDayRule', competitionWorktimeDayRuleSchema);
