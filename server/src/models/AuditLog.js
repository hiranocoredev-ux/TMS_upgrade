import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  actorUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  entityType: {
    type: String,
    required: true,
    index: true
  },
  entityId: {
    type: String,
    required: true,
    index: true
  },
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

// Compound index for common queries
auditLogSchema.index({ actorUserId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

export default mongoose.model('AuditLog', auditLogSchema);

