import mongoose from 'mongoose';
import { DEFAULT_ENTITY_GROUP } from '../constants/groups.js';

const jobProfileSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  ownerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active',
    required: true,
    index: true
  },
  group: {
    type: String,
    default: DEFAULT_ENTITY_GROUP,
    required: true,
    index: true
  },
  // Contact information
  email: {
    type: String,
    trim: true,
    lowercase: true,
    index: true
  },
  phone: {
    type: String,
    trim: true
  },
  // Location
  country: {
    type: String,
    trim: true,
    index: true
  },
  address: {
    type: String,
    trim: true
  },
  // Social links
  socialLinks: {
    linkedin: String,
    github: String,
    website: String,
    other: [String] // Array of other social links
  },
  // Sensitive fields (masked for non-owners)
  bankAccount: {
    type: String,
    trim: true
  },
  idNumber: {
    type: String,
    trim: true
  },
  driverLicenseNumber: {
    type: String,
    trim: true
  },
  // Profile picture
  pictureFileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FileMeta',
    default: null
  },
  // Professional information (text fields)
  experience: {
    type: String,
    default: ''
  },
  education: {
    type: String,
    default: ''
  },
  // Attachments (resume + other docs) - unified array
  attachments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FileMeta'
  }],
  tags: [String],
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes
jobProfileSchema.index({ ownerUserId: 1, status: 1 });
jobProfileSchema.index({ status: 1, createdAt: -1 });
jobProfileSchema.index({ country: 1, status: 1 });
jobProfileSchema.index({ group: 1, status: 1 });
jobProfileSchema.index({ email: 1 }); // For search/filtering
jobProfileSchema.index({ name: 1, status: 1 }); // For search/filtering

export default mongoose.model('JobProfile', jobProfileSchema);

