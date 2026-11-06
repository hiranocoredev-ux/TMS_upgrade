import mongoose from 'mongoose';

/**
 * Applied penalty or bonus to a user or a whole group for a given competition month.
 */
const competitionAdjustmentSchema = new mongoose.Schema(
  {
    month: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}$/,
    },
    scope: {
      type: String,
      enum: ['user', 'group'],
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    /** Team code when scope === 'group' */
    groupCode: { type: String, default: '', trim: true, index: true },
    kind: {
      type: String,
      enum: ['penalty', 'bonus'],
      required: true,
    },
    ruleDefinitionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompetitionRuleDefinition',
      default: null,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    /** Signed: bonus > 0, penalty < 0 */
    points: { type: Number, required: true },
    /** Calendar date/time the bonus/penalty applies to (defaults to createdAt for legacy rows). */
    eventAt: { type: Date, default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

competitionAdjustmentSchema.index({ month: 1, scope: 1, userId: 1 });
competitionAdjustmentSchema.index({ month: 1, scope: 1, groupCode: 1 });

export default mongoose.model('CompetitionAdjustment', competitionAdjustmentSchema);
