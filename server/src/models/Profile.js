import mongoose from 'mongoose';
import {
  PROFILE_STATUSES,
  PROFILE_SEX_VALUES,
  PROFILE_WORK_ROLE_VALUES,
  CONTACT_HANDLE_PLATFORMS,
  PLATFORM_CREDENTIAL_STATUSES,
  DEFAULT_PLATFORM_CREDENTIAL_STATUS,
  REMOTE_TOOLS,
  BUYER_TYPES,
  DEFAULT_CURRENCY,
  CURRENCY_CODES,
} from '../constants/profiles.js';

const { Schema } = mongoose;

/**
 * Profile = CLIENT record. Sections:
 *   1. Base Information (everyone reads; admin triad writes)
 *   2. Contact Information (admin triad only)
 *   3. Contract Information (admin triad only — revenue split percentages)
 *   4. Working-Role tabs (one per selected workingRole) — per-tab gating
 *
 * Sensitive device.remoteId / remotePassword stored as AES-256-GCM
 * ciphertext (see utils/encryption.js); masked on read; revealed via the
 * audit-logged `/profiles/:id/tabs/:role/reveal` endpoint.
 */
const encryptedField = { type: String, default: '' };

const messagingHandleSchema = new Schema({
  platform: { type: String, enum: CONTACT_HANDLE_PLATFORMS, default: 'custom' },
  customLabel: { type: String, default: '' },
  handle: { type: String, default: '' },
}, { _id: true });

const deviceItemSchema = new Schema({
  detail: { type: String, default: '' },                          // visible — e.g. "Lenovo X1 Carbon, 2023"
  price: { type: Number, default: 0 },                            // visible
  currency: { type: String, enum: CURRENCY_CODES, default: DEFAULT_CURRENCY },
  buyerType: { type: String, enum: BUYER_TYPES, default: 'client' },
  buyerUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // only when buyerType==='user'
  // Remote-access block
  remoteEnabled: { type: Boolean, default: false },
  remoteTool: { type: String, enum: ['', ...REMOTE_TOOLS], default: '' },
  remoteToolCustomName: { type: String, default: '' },            // when remoteTool === 'custom'
  remoteId: encryptedField,                                       // encrypted login id
  remotePassword: encryptedField,                                 // encrypted password
  notes: { type: String, default: '' },                           // visible (non-sensitive notes only)
}, { _id: true });

const tabManagerSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true },
}, { _id: true });

/**
 * Platform credential stored inside a working-role tab. `gmail` (login email) and
 * `password` are encrypted at rest. `allowedMembers` is the per-credential ACL —
 * a regular team member can only reveal this credential if listed here with
 * `isActive: true`. Tab editors (super-admin or group-boss of the role) can
 * always reveal.
 */
const platformCredentialAllowedMemberSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true },
}, { _id: true });

const platformCredentialSchema = new Schema({
  platform: { type: String, default: '' },           // visible — e.g. "Upwork"
  /** Account lifecycle: new | using | not_using | dead. Visible to every tab viewer. */
  status: {
    type: String,
    enum: PLATFORM_CREDENTIAL_STATUSES,
    default: DEFAULT_PLATFORM_CREDENTIAL_STATUS,
  },
  hint: { type: String, default: '' },               // visible — e.g. "@user_xx"
  gmail: { type: String, default: '' },              // ENCRYPTED login email
  password: { type: String, default: '' },           // ENCRYPTED password
  notes: { type: String, default: '' },              // visible non-sensitive
  allowedMembers: { type: [platformCredentialAllowedMemberSchema], default: [] },
}, { _id: true });

/**
 * Income transaction recorded against a working-role tab. Only `income` is user-supplied;
 * `given` and `profit` are derived on read from the profile's `clientSharePercent`.
 */
const transactionSchema = new Schema({
  income: { type: Number, default: 0, min: 0 },
  description: { type: String, default: '' },
  date: { type: String, default: '' },            // YYYY-MM-DD (optional)
  currency: { type: String, enum: CURRENCY_CODES, default: DEFAULT_CURRENCY },
  createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const workingRoleTabSchema = new Schema({
  role: { type: String, enum: PROFILE_WORK_ROLE_VALUES, required: true },
  /** When work on this role started for this client. Surfaced in the view body. */
  startedAt: { type: String, default: '' },        // YYYY-MM-DD (optional)
  devices: { type: [deviceItemSchema], default: [] },
  platformCredentials: { type: [platformCredentialSchema], default: [] },
  managers: { type: [tabManagerSchema], default: [] },
  transactions: { type: [transactionSchema], default: [] },
  notes: { type: String, default: '' },
}, { _id: true });

const profileSchema = new Schema({
  // === Meta ===
  /** Current owner — reassignable to any member holding the `hunting_profile` role. */
  ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  /** Immutable — the user who first created the profile. Surfaced as "Hunting Owner". */
  huntingOwnerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: PROFILE_STATUSES, default: 'active' },
  group: { type: String, default: '' },

  // === Base Information ===
  name: { type: String, required: true, trim: true },
  countryCode: { type: String, default: '', uppercase: true, trim: true, maxlength: 2 },
  address: { type: String, default: '' },
  age: { type: Number, min: 0, max: 150 },
  sex: { type: String, enum: PROFILE_SEX_VALUES, default: '' },
  /** Manual quality / engagement score, 0–5 (star rating). */
  statusScore: { type: Number, min: 0, max: 5, default: 0 },
  /** Multi-select from {ai_training, freelancing, job_working}. Drives tab visibility. */
  workingRoles: {
    type: [{ type: String, enum: PROFILE_WORK_ROLE_VALUES }],
    default: [],
  },
  currency: { type: String, enum: CURRENCY_CODES, default: DEFAULT_CURRENCY },
  /** When true, the optional `callerUserId` is meaningful. */
  callSupportEnabled: { type: Boolean, default: false },
  callerUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  comment: { type: String, default: '' },

  // === Contact Information (private — admin triad only) ===
  email: { type: String, lowercase: true, trim: true, default: '' },
  phone: { type: String, default: '' },
  contactHandles: { type: [messagingHandleSchema], default: [] },
  linkedinUrl: { type: String, default: '' },
  githubUrl: { type: String, default: '' },
  websiteUrl: { type: String, default: '' },

  // === Contract Information (admin triad only) ===
  clientSharePercent: { type: Number, min: 0, max: 100, default: 0 },
  internalHiringSharePercent: { type: Number, min: 0, max: 100, default: 0 },

  // === Working-Role tabs (per-tab gating; one entry per selected role) ===
  workingRoleTabs: { type: [workingRoleTabSchema], default: [] },

  // === Avatar + tags ===
  pictureFileId: { type: Schema.Types.ObjectId, ref: 'FileMeta', default: null },
  tags: { type: [String], default: [] },
}, {
  timestamps: true,
});

// Compound indexes for common query patterns
profileSchema.index({ status: 1, createdAt: -1 });
profileSchema.index({ group: 1, status: 1 });
profileSchema.index({ countryCode: 1, status: 1 });
profileSchema.index({ workingRoles: 1 });
profileSchema.index({ ownerUserId: 1 });
profileSchema.index({ huntingOwnerId: 1 });
profileSchema.index({ 'workingRoleTabs.managers.userId': 1 });
profileSchema.index({ name: 'text', email: 'text', comment: 'text' });

export default mongoose.model('Profile', profileSchema);
