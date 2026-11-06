import mongoose from 'mongoose';

/**
 * Global competition weights (single document).
 * financeWeight / worktimeWeight multiply the respective score components.
 */
const competitionSettingsSchema = new mongoose.Schema(
  {
    financeWeight: { type: Number, default: 1, min: 0 },
    worktimeWeight: { type: Number, default: 1, min: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

competitionSettingsSchema.statics.getSingleton = async function getSingleton() {
  let doc = await this.findOne();
  if (!doc) {
    doc = await this.create({});
  }
  return doc;
};

export default mongoose.model('CompetitionSettings', competitionSettingsSchema);
