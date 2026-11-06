// models/Assignment.js
import mongoose from 'mongoose';
import { ENTITY_GROUP_VALUES, DEFAULT_ENTITY_GROUP } from '../constants/groups.js';

const activityLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true
    // examples:
    // "CREATED"
    // "UPDATED_STATUS"
    // "UPDATED_PAYMENT"
    // "UPDATED_NOTE"
  },
  summary: {
    type: String,
    required: true
    // human-readable summary
  },
  oldValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  newValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const assignmentSchema = new mongoose.Schema({
  /** Ownership */
  ownerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  /** Core content */
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },

  /** Status */
  status: {
    type: String,
    enum: ['progressing', 'completed'],
    default: 'progressing',
    index: true
  },

  group: {
    type: String,
    enum: ENTITY_GROUP_VALUES,
    default: DEFAULT_ENTITY_GROUP,
    index: true,
    required: true
  },

  /** Simple collaborator input (NO permissions) */
  collaborator: {
    type: String,
    default: ''
  },

  /** Task performance / progress type */
  performanceType: {
    type: String,
    default: ''
    // e.g. "Received payment from partner"
  },

  /** Financial info */
  currencyAmount: {
    type: Number,
    default: 0
  },
  currencyCode: {
    type: String,
    default: 'USD'
  },
  payMethod: {
    type: String,
    default: ''
    // PayPal, Crypto, Bank, Cash, etc.
  },

  /** Notes */
  note: {
    type: String,
    default: ''
  },
  /** Completion */
  completedAt: {
    type: Date,
    default: null,
    index: true
  },
  /** History */
  activityLogs: {
    type: [activityLogSchema],
    default: []
  }

}, {
  timestamps: true
});

export default mongoose.model('Assignment', assignmentSchema);
