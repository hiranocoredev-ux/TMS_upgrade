import mongoose from 'mongoose';

const planTicketTemplateSchema = new mongoose.Schema(
  {
    period: {
      type: String,
      required: true,
      enum: ['daily', 'weekly', 'monthly'],
      index: true
    },
    key: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    sortOrder: {
      type: Number,
      default: 0
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    active: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

planTicketTemplateSchema.index({ period: 1, key: 1 }, { unique: true });
planTicketTemplateSchema.index({ period: 1, sortOrder: 1, active: 1 });

export default mongoose.model('PlanTicketTemplate', planTicketTemplateSchema);
