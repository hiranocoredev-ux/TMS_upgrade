import mongoose from 'mongoose';

const notificationDispatchLogSchema = new mongoose.Schema(
  {
    dedupeKey: { type: String, unique: true, required: true },
    type: { type: String, required: true },
    recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    recipientGroup: { type: String, default: '' },
    channel: { type: String, default: 'ipMessage' },
    message: { type: String, default: '' },
    status: { type: String, enum: ['sent', 'skipped', 'failed'], default: 'sent' },
    error: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

notificationDispatchLogSchema.index({ createdAt: -1 });

export default mongoose.model('NotificationDispatchLog', notificationDispatchLogSchema);

