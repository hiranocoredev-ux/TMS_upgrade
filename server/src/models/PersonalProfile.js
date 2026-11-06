import mongoose from 'mongoose';

const personalProfileSchema = new mongoose.Schema({
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
personalProfileSchema.index({ ownerUserId: 1, status: 1 });
personalProfileSchema.index({ status: 1, createdAt: -1 });
personalProfileSchema.index({ country: 1, status: 1 });
personalProfileSchema.index({ email: 1 }); // For search/filtering
personalProfileSchema.index({ name: 1, status: 1 }); // For search/filtering

export default mongoose.model('PersonalProfile', personalProfileSchema);

