import mongoose from 'mongoose';

/**
 * Catalog entry for manual penalty / bonus rules (title, description, default points).
 * Super admin picks a rule when recording an adjustment; points can be overridden.
 */
const competitionRuleDefinitionSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ['penalty', 'bonus'],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    /** Positive magnitude; sign is applied from kind when creating adjustments. */
    weightPoints: { type: Number, required: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

competitionRuleDefinitionSchema.index({ kind: 1, isActive: 1, sortOrder: 1 });

export default mongoose.model('CompetitionRuleDefinition', competitionRuleDefinitionSchema);
