import mongoose from 'mongoose';

const fileMetaSchema = new mongoose.Schema({
  originalName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  storagePath: {
    type: String,
    required: true,
    unique: true
  },
  uploadedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  module: {
    type: String,
    required: true,
    enum: ['profiles', 'citizen_profiles', 'job_profiles', 'freelancer_accounts', 'personal_profiles', 'job_tickets', 'projects', 'finance'],
    index: true
  },
  entityId: {
    type: String,
    index: true
  },
  entityType: {
    type: String
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

// Compound index for common queries
fileMetaSchema.index({ module: 1, createdAt: -1 });
fileMetaSchema.index({ uploadedByUserId: 1, module: 1 });
fileMetaSchema.index({ entityType: 1, entityId: 1 });

export default mongoose.model('FileMeta', fileMetaSchema);

