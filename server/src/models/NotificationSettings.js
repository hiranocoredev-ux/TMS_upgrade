import mongoose from 'mongoose';

const reportReminderSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    timeEst: { type: String, default: '23:00' }, // HH:mm in EST
    templateUser: { type: String, default: '' },
  },
  { _id: false }
);

const notificationSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'main' },
    ipMessage: {
      enabled: { type: Boolean, default: true },
      ipcmdPath: { type: String, default: '' },
      senderLabel: { type: String, default: 'TMS System' },
    },
    reportReminder: {
      daily: {
        type: reportReminderSchema,
        default: () => ({
          enabled: true,
          timeEst: '23:00',
          templateUser:
            '[TMS] Daily report reminder: {userName}, please submit your daily report before end of today (EST).',
        }),
      },
      weekly: {
        type: reportReminderSchema,
        default: () => ({
          enabled: true,
          timeEst: '20:00',
          templateUser:
            '[TMS] Weekly report reminder: {userName}, please submit your weekly report before week end (EST).',
        }),
      },
      monthly: {
        type: reportReminderSchema,
        default: () => ({
          enabled: true,
          timeEst: '20:00',
          templateUser:
            '[TMS] Monthly report reminder: {userName}, please submit your monthly report before month end (EST).',
        }),
      },
    },
    worktimeCheck: {
      enabled: { type: Boolean, default: true },
      timeEst: { type: String, default: '23:15' },
      thresholdPercent: { type: Number, default: 100 },
      templateUser: {
        type: String,
        default:
          '[TMS] Worktime alert: {userName}, today you reached {percent}% ({workedHours}h/{targetHours}h).',
      },
      templateBoss: {
        type: String,
        default:
          '[TMS] Team alert: {userName} in group {group} reached {percent}% ({workedHours}h/{targetHours}h).',
      },
      templateAdmin: {
        type: String,
        default:
          '[TMS] Admin alert: {userName} ({group}) reached {percent}% ({workedHours}h/{targetHours}h).',
      },
    },
    penaltyNotify: {
      enabled: { type: Boolean, default: true },
      templateUser: {
        type: String,
        default:
          '[TMS] Penalty notice: {userName}, penalty "{penaltyTitle}" was applied ({points} points).',
      },
      templateBoss: {
        type: String,
        default:
          '[TMS] Team penalty notice: {userName} received penalty "{penaltyTitle}" ({points} points).',
      },
    },
    manualNotify: {
      enabled: { type: Boolean, default: true },
      templateDefault: {
        type: String,
        default: '[TMS] {message}',
      },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export default mongoose.model('NotificationSettings', notificationSettingsSchema);

