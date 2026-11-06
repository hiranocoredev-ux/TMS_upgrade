import mongoose from 'mongoose';
import {
  PROFILE_ACCOUNT_KEYS,
  PROFILE_ACCOUNT_SIZES,
  DEFAULT_PROFILE_ACCOUNT_SIZE,
  PROFILE_STATUSES,
} from '../constants/profiles.js';

/**
 * CitizenProfile — one client ("citizen") a team member works under.
 *
 * The profile carries a photo, who owns it, the revenue share and the platform
 * accounts it holds (Upwork dev / client, Freelancer, Contra and the
 * AI-training platforms). Each account is either an established ("big") profile
 * or a fresh ("new") one, the Upwork / Freelancer accounts also track a review
 * count, and every account names the members who manage it and keeps its own
 * screenshots and comment.
 */

/** A screenshot showing the state of one account. */
const accountImageSchema = new mongoose.Schema(
  {
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'FileMeta', required: true },
    caption: { type: String, default: '', maxlength: 300 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const accountSchema = new mongoose.Schema(
  {
    platform: { type: String, enum: PROFILE_ACCOUNT_KEYS, required: true },
    /** big = established profile · new = freshly created */
    size: { type: String, enum: PROFILE_ACCOUNT_SIZES, default: DEFAULT_PROFILE_ACCOUNT_SIZE },
    /** Upwork / Freelancer only; null means no reviews yet. */
    reviewCount: { type: Number, min: 0, default: null },
    /** The members who run this account day to day; an account may have several. */
    managerUserIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    /** Free notes about the account, shown on its detail panel. */
    comment: { type: String, default: '', maxlength: 4000 },
    images: { type: [accountImageSchema], default: [] },
    note: { type: String, default: '', maxlength: 300 },
  },
  { _id: false },
);

const citizenProfileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    /** Profile photo, uploaded through /files with module `citizen_profiles`. */
    photoFileId: { type: mongoose.Schema.Types.ObjectId, ref: 'FileMeta', default: null },
    countryCode: { type: String, default: '', uppercase: true, trim: true, maxlength: 2 },
    /** Revenue share for this profile, in percent. */
    sharePercent: { type: Number, min: 0, max: 100, default: 0 },
    /** The team member who owns the profile. */
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    /** Owner's group at the time of writing, kept for filtering. */
    group: { type: String, default: '', index: true },
    status: { type: String, enum: PROFILE_STATUSES, default: 'active', index: true },
    accounts: { type: [accountSchema], default: [] },
    note: { type: String, default: '', maxlength: 2000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

citizenProfileSchema.index({ ownerUserId: 1, name: 1 });

export default mongoose.model('CitizenProfile', citizenProfileSchema);
