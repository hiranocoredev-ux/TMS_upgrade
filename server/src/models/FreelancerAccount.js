import mongoose from 'mongoose';
import { ENTITY_GROUP_VALUES, DEFAULT_ENTITY_GROUP } from '../constants/groups.js';

const freelancerAccountSchema = new mongoose.Schema({
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
    enum: ENTITY_GROUP_VALUES,
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
  anydeskId: {
    type: String,
    trim: true
  },
  // Professional information (text fields)
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
freelancerAccountSchema.index({ ownerUserId: 1, status: 1 });
freelancerAccountSchema.index({ status: 1, createdAt: -1 });
freelancerAccountSchema.index({ country: 1, status: 1 });
freelancerAccountSchema.index({ group: 1, status: 1 });
freelancerAccountSchema.index({ email: 1 }); // For search/filtering
freelancerAccountSchema.index({ name: 1, status: 1 }); // For search/filtering

export default mongoose.model('FreelancerAccount', freelancerAccountSchema);

