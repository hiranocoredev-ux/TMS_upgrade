import mongoose from 'mongoose';

/**
 * Hubstaff organization ID (one document). It is part of the links to a
 * member's Hubstaff activity page and changes every two weeks, so the super
 * admin / admins are reminded to update it (see services/hubstaffOrg.js).
 */
const hubstaffSettingsSchema = new mongoose.Schema(
  {
    organizationId: { type: String, default: '' },
    organizationIdUpdatedAt: { type: Date, default: null },
    organizationIdUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    organizationIdUpdatedByName: { type: String, default: '' },
  },
  { timestamps: true }
);

hubstaffSettingsSchema.statics.getSingleton = async function getSingleton() {
  let doc = await this.findOne();
  if (!doc) {
    doc = await this.create({});
  }
  return doc;
};

export default mongoose.model('HubstaffSettings', hubstaffSettingsSchema);
