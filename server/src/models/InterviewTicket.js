// import mongoose from 'mongoose';

// /**
//  * InterviewTicket Model
//  * 
//  * PRD v3.0: Interview tickets (cards) within a board
//  * - Each ticket belongs to a board and stage
//  * - Tracks interview details, dates, candidate info
//  * - Can be linked to JobProfile
//  * - Supports attachments and activity logging
//  */

// const interviewTicketSchema = new mongoose.Schema({
//   boardId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'InterviewBoard',
//     required: true,
//     index: true
//   },
//   stageId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'InterviewStage',
//     required: true,
//     index: true
//   },
//   ownerUserId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true,
//     index: true
//   },
//   // Job Profile link (optional - ticket can exist without profile)
//   jobProfileId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'JobProfile',
//     index: true
//   },
//   // Interview details
//   companyName: {
//     type: String,
//     required: true,
//     trim: true,
//     maxlength: 200,
//     index: true
//   },
//   position: {
//     type: String,
//     required: true,
//     trim: true,
//     maxlength: 200,
//     index: true
//   },
//   candidateName: {
//     type: String,
//     trim: true,
//     maxlength: 200
//   },
//   // Interview dates (array of dates for multiple rounds)
//   dates: [{
//     scheduledAt: {
//       type: Date,
//       required: true
//     },
//     durationMinutes: {
//       type: Number,
//       default: 60
//     },
//     interviewType: {
//       type: String,
//       enum: ['phone', 'video', 'onsite', 'assessment', 'other'],
//       default: 'video'
//     },
//     meetingLink: {
//       type: String,
//       trim: true
//     },
//     platform: {
//       type: String,
//       trim: true
//     },
//     participants: {
//       type: String,
//       trim: true
//     },
//     status: {
//       type: String,
//       enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'],
//       default: 'scheduled'
//     },
//     notes: {
//       type: String,
//       default: ''
//     },
//     outcome: {
//       type: String,
//       enum: ['pending', 'passed', 'failed', 'cancelled'],
//       default: 'pending'
//     }
//   }],
//   // General notes about the interview process
//   notes: {
//     type: String,
//     default: '',
//     trim: true
//   },
//   // Attachments (resume, cover letter, etc.)
//   attachments: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'FileMeta'
//   }],
//   // Tags for categorization
//   tags: [{
//     type: String,
//     trim: true,
//     index: true
//   }],
//   // Priority level
//   priority: {
//     type: String,
//     enum: ['low', 'medium', 'high', 'urgent'],
//     default: 'medium',
//     index: true
//   },
//   // Ticket status
//   status: {
//     type: String,
//     enum: ['active', 'completed', 'cancelled', 'on_hold'],
//     default: 'active',
//     required: true,
//     index: true
//   },
//   // Optional: Due date for follow-up
//   dueDate: {
//     type: Date,
//     index: true
//   },
//   // Metadata for tracking
//   metadata: {
//     source: {
//       type: String, // Where did this interview come from? (job board, referral, etc.)
//       trim: true
//     },
//     jobUrl: {
//       type: String,
//       trim: true
//     },
//     salaryRange: {
//       type: String,
//       trim: true
//     },
//     location: {
//       type: String,
//       trim: true
//     },
//     remote: {
//       type: Boolean,
//       default: false
//     }
//   }
// }, {
//   timestamps: true
// });

// // Compound indexes for common queries
// interviewTicketSchema.index({ boardId: 1, stageId: 1, status: 1 });
// interviewTicketSchema.index({ boardId: 1, ownerUserId: 1, status: 1 });
// interviewTicketSchema.index({ boardId: 1, status: 1, priority: 1 });
// interviewTicketSchema.index({ boardId: 1, createdAt: -1 });
// interviewTicketSchema.index({ ownerUserId: 1, status: 1 });
// interviewTicketSchema.index({ jobProfileId: 1, status: 1 });
// interviewTicketSchema.index({ 'dates.scheduledAt': 1 }); // For calendar queries
// interviewTicketSchema.index({ dueDate: 1, status: 1 }); // For due date queries

// export default mongoose.model('InterviewTicket', interviewTicketSchema);

// import mongoose from 'mongoose';

// /**
//  * InterviewTicket Model
//  * 
//  * PRD v3.0: Interview tickets (cards) within a board
//  * - Each ticket belongs to a board and stage
//  * - Tracks interview details, dates, candidate info
//  * - Can be linked to JobProfile
//  * - Supports attachments and activity logging
//  */

// const interviewTicketSchema = new mongoose.Schema({
//   boardId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'InterviewBoard',
//     required: true,
//     index: true
//   },
//   stageId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'InterviewStage',
//     required: true,
//     index: true
//   },
//   ownerUserId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true,
//     index: true
//   },
//   // Job Profile link (optional - ticket can exist without profile)
//   jobProfileId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'JobProfile',
//     index: true
//   },
//   // Interview details
//   companyName: {
//     type: String,
//     required: true,
//     trim: true,
//     maxlength: 200,
//     index: true
//   },
//   position: {
//     type: String,
//     required: true,
//     trim: true,
//     maxlength: 200,
//     index: true
//   },
//   candidateName: {
//     type: String,
//     trim: true,
//     maxlength: 200
//   },
//   // Interview dates (array of dates for multiple rounds)
//   dates: [{
//     scheduledAt: {
//       type: Date,
//       required: true
//     },
//     durationMinutes: {
//       type: Number,
//       default: 60
//     },
//     interviewType: {
//       type: String,
//       enum: ['phone', 'video', 'onsite', 'assessment', 'other'],
//       default: 'video'
//     },
//     meetingLink: {
//       type: String,
//       trim: true
//     },
//     platform: {
//       type: String,
//       trim: true
//     },
//     participants: {
//       type: String,
//       trim: true
//     },
//     status: {
//       type: String,
//       enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'],
//       default: 'scheduled'
//     },
//     notes: {
//       type: String,
//       default: ''
//     },
//     outcome: {
//       type: String,
//       enum: ['pending', 'passed', 'failed', 'cancelled'],
//       default: 'pending'
//     }
//   }],
//   // General notes about the interview process
//   notes: {
//     type: String,
//     default: '',
//     trim: true
//   },
//   // Attachments (resume, cover letter, etc.)
//   attachments: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'FileMeta'
//   }],
//   // Tags for categorization
//   tags: [{
//     type: String,
//     trim: true,
//     index: true
//   }],
//   // Priority level
//   priority: {
//     type: String,
//     enum: ['low', 'medium', 'high', 'urgent'],
//     default: 'medium',
//     index: true
//   },
//   // Ticket status
//   status: {
//     type: String,
//     enum: ['active', 'completed', 'cancelled', 'on_hold'],
//     default: 'active',
//     required: true,
//     index: true
//   },
//   // Optional: Due date for follow-up
//   dueDate: {
//     type: Date,
//     index: true
//   },
//   // Metadata for tracking
//   metadata: {
//     source: {
//       type: String, // Where did this interview come from? (job board, referral, etc.)
//       trim: true
//     },
//     jobUrl: {
//       type: String,
//       trim: true
//     },
//     salaryRange: {
//       type: String,
//       trim: true
//     },
//     location: {
//       type: String,
//       trim: true
//     },
//     remote: {
//       type: Boolean,
//       default: false
//     }
//   }
// }, {
//   timestamps: true
// });

// // Compound indexes for common queries
// interviewTicketSchema.index({ boardId: 1, stageId: 1, status: 1 });
// interviewTicketSchema.index({ boardId: 1, ownerUserId: 1, status: 1 });
// interviewTicketSchema.index({ boardId: 1, status: 1, priority: 1 });
// interviewTicketSchema.index({ boardId: 1, createdAt: -1 });
// interviewTicketSchema.index({ ownerUserId: 1, status: 1 });
// interviewTicketSchema.index({ jobProfileId: 1, status: 1 });
// interviewTicketSchema.index({ 'dates.scheduledAt': 1 }); // For calendar queries
// interviewTicketSchema.index({ dueDate: 1, status: 1 }); // For due date queries

// export default mongoose.model('InterviewTicket', interviewTicketSchema);

import mongoose from 'mongoose';

/**
 * InterviewTicket Model
 *
 * PRD v3.0: Interview tickets (cards) within a board
 * - Supports Kanban view (by stage)
 * - Supports Time view (by scheduled date)
 * - Supports multiple interview rounds
 */

const interviewTicketSchema = new mongoose.Schema({
  boardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InterviewBoard',
    required: true,
    index: true
  },
  stageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InterviewStage',
    required: true,
    index: true
  },
  ownerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Optional Job Profile link
  jobProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobProfile',
    index: true
  },

  // Interview basic info
  companyName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    index: true
  },
  position: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    index: true
  },
  candidateName: {
    type: String,
    trim: true,
    maxlength: 200
  },

  /**
   * Interview rounds / scheduled times
   * Time View uses dates[primaryDateIndex]
   */
  dates: [{
    scheduledAt: {
      type: Date,
      required: true
    },
    scheduledDay: {
      type: String, // YYYY-MM-DD (derived from scheduledAt)
      index: true
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    durationMinutes: {
      type: Number,
      default: 40
    },
    interviewType: {
      type: String,
      enum: ['phone', 'video', 'onsite', 'assessment', 'other'],
      default: 'video'
    },
    meetingLink: {
      type: String,
      trim: true
    },
    platform: {
      type: String,
      trim: true
    },
    participants: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'],
      default: 'scheduled'
    },
    notes: {
      type: String,
      default: ''
    },
    outcome: {
      type: String,
      enum: ['pending', 'passed', 'failed', 'cancelled'],
      default: 'pending'
    }
  }],

  /**
   * Index of primary date inside dates[]
   * Used for Time View, Calendar, Notifications
   */
  primaryDateIndex: {
    type: Number,
    default: 0
  },

  // General notes
  notes: {
    type: String,
    default: '',
    trim: true
  },

  // Attachments
  attachments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FileMeta'
  }],

  // Tags
  tags: [{
    type: String,
    trim: true,
    index: true
  }],

  // Priority
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },

  // Ticket status
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled', 'on_hold'],
    default: 'active',
    required: true,
    index: true
  },

  // Follow-up
  dueDate: {
    type: Date,
    index: true
  },

  // Metadata
  metadata: {
    source: { type: String, trim: true },
    jobUrl: { type: String, trim: true },
    salaryRange: { type: String, trim: true },
    location: { type: String, trim: true },
    remote: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

/**
 * Indexes
 */
interviewTicketSchema.index({ boardId: 1, stageId: 1, status: 1 });
interviewTicketSchema.index({ boardId: 1, ownerUserId: 1, status: 1 });
interviewTicketSchema.index({ boardId: 1, status: 1, priority: 1 });
interviewTicketSchema.index({ boardId: 1, createdAt: -1 });
interviewTicketSchema.index({ ownerUserId: 1, status: 1 });
interviewTicketSchema.index({ jobProfileId: 1, status: 1 });
interviewTicketSchema.index({ 'dates.scheduledAt': 1 });
interviewTicketSchema.index({ 'dates.scheduledDay': 1 });
interviewTicketSchema.index({ dueDate: 1, status: 1 });

export default mongoose.model('InterviewTicket', interviewTicketSchema);
