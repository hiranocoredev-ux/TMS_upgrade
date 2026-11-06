import mongoose from 'mongoose';

const checklistItemSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  done: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const commentSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const taskSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['todo', 'in_progress', 'done'],
    default: 'todo',
    required: true,
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  dueDate: {
    type: Date,
    index: true
  },
  checklist: [checklistItemSchema],
  comments: [commentSchema],
  attachments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FileMeta'
  }]
}, {
  timestamps: true
});

// Indexes
taskSchema.index({ projectId: 1, status: 1 });
taskSchema.index({ projectId: 1, dueDate: 1 });
taskSchema.index({ status: 1, dueDate: 1 });

export default mongoose.model('Task', taskSchema);

