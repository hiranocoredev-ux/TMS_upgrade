import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { normalizeRole } from '../constants/roles.js';
import { WORKING_ROLE_VALUES, workingRoleTabs } from '../constants/profiles.js';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  group: {
    type: String,
    default: null,
    required: false
  },
  /** @deprecated Prefer role only; kept for legacy documents until migrate-roles runs */
  degree: {
    type: String,
    enum: ['SUPER_ADMIN', 'ADMIN', 'TEAM_BOSS', 'MEMBER'],
    required: false,
  },
  role: {
    type: String,
    enum: [
      'SUPER_ADMIN',
      'GROUP_BOSS',
      'GROUP_MEMBER',
      'FINANCE_MANAGER',
      'ADMIN',
      'BOSS',
      'MEMBER',
      'GUEST',
    ],
    default: 'GROUP_MEMBER',
    required: true
  },
  // Hubstaff numeric user_id  links this user to Hubstaff API activity/time data
  hubstaff_id: {
    type: String,
    default: null,
    index: true,
    sparse: true,
  },
  /**
   * When true (set by Super Admin), user may accept/reject/discuss group-boss payment requests
   * alongside Super Admin (platform inbox).
   */
  paymentRequestApprover: {
    type: Boolean,
    default: false,
  },
/**
   * The one working role the member fills: Normal Working, Bittensor or Job
   * Working. Decides which profile tabs they work in. Empty for SUPER_ADMIN or
   * anyone unassigned.
   */
  workingRole: {
    type: String,
    enum: ['', ...WORKING_ROLE_VALUES],
    default: '',
  },
  /**
   * Profile tabs this member works in, derived from `workingRole` and kept in
   * step by the pre-save hook below. The profile module reads this to decide
   * tab access.
   */
  workingRoles: {
    type: [{ type: String }],
    default: [],
  },
  status: {
    type: String,
    enum: ['active', 'disabled', 'pending'],
    default: 'pending',
    required: true
  },
  avatarUrl: {
    type: String,
    default: ''
  },
  notification: {
    enabled: {
      type: Boolean,
      default: false
    },
    slack: {
      enabled: {
        type: Boolean,
        default: false
      },
      webhookUrl: {
        type: String,
        default: ''
      }
    },
    telegram: {
      enabled: {
        type: Boolean,
        default: false
      },
      botToken: {
        type: String,
        default: ''
      },
      chatId: {
        type: String,
        default: ''
      }
    },
    ipMessage: {
      enabled: {
        type: Boolean,
        default: false
      },
      ipAddress: {
        type: String,
        default: ''
      },
      ipcmdPath: {
        type: String,
        default: ''
      }
    }
  }
}, {
  timestamps: true
});

/** Keeps the derived tab list in step with the member's working role. */
userSchema.pre('save', function syncWorkingRoles(next) {
  if (this.isModified('workingRole') || this.isNew) {
    this.workingRoles = workingRoleTabs(this.workingRole);
  }
  next();
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash if passwordHash is modified
  if (!this.isModified('passwordHash')) return next();
  
  // Skip if passwordHash is empty (shouldn't happen due to required, but safety check)
  if (!this.passwordHash) {
    return next();
  }
  
  // Check if already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
  if (this.passwordHash.startsWith('$2a$') || this.passwordHash.startsWith('$2b$') || this.passwordHash.startsWith('$2y$')) {
    return next();
  }
  
  // Hash the password
  this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Method to get user summary (without passwordHash)
userSchema.methods.toSummary = function() {
  const notif = this.notification || {};
  const slack = notif.slack || {};
  const telegram = notif.telegram || {};
  const ipMessage = notif.ipMessage || {};
  const canUseSlack = !!String(slack.webhookUrl || '').trim();
  const canUseTelegram = !!String(telegram.botToken || '').trim() && !!String(telegram.chatId || '').trim();
  const canUseIpMessage = !!String(ipMessage.ipAddress || '').trim() && !!String(ipMessage.ipcmdPath || '').trim();
  const hasAnyConnection = canUseSlack || canUseTelegram || canUseIpMessage;
  const notifyEnabled = !!notif.enabled && hasAnyConnection;
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    group: normalizeRole(this.role, this.degree) === 'SUPER_ADMIN' ? null : this.group,
    role: normalizeRole(this.role, this.degree),
    paymentRequestApprover: !!this.paymentRequestApprover,
    workingRole: this.workingRole || '',
    workingRoles: Array.isArray(this.workingRoles) ? [...this.workingRoles] : [],
    status: this.status,
    avatarUrl: this.avatarUrl || '',
    hubstaff_id: this.hubstaff_id || null,
    notification: {
      enabled: notifyEnabled,
      hasAnyConnection,
      needsSetupWarning: !notifyEnabled,
      slack: {
        enabled: !!slack.enabled,
        webhookUrl: slack.webhookUrl || '',
        connected: canUseSlack,
      },
      telegram: {
        enabled: !!telegram.enabled,
        botToken: telegram.botToken || '',
        chatId: telegram.chatId || '',
        connected: canUseTelegram,
      },
      ipMessage: {
        enabled: !!ipMessage.enabled,
        ipAddress: ipMessage.ipAddress || '',
        ipcmdPath: ipMessage.ipcmdPath || '',
        connected: canUseIpMessage,
      },
    },
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

export default mongoose.model('User', userSchema);

