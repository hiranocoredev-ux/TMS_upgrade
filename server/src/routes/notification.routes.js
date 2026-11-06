import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import NotificationSettings from '../models/NotificationSettings.js';
import NotificationDispatchLog from '../models/NotificationDispatchLog.js';
import User from '../models/User.js';
import { normalizeRole, ROLES } from '../constants/roles.js';
import {
  getOrCreateNotificationSettings,
  runScheduledNotificationTick,
  sendManualIpMessage,
  sendUserConnectionTestByAdmin,
} from '../services/notification.service.js';

const router = express.Router();

const settingsSchema = z.object({
  ipMessage: z.object({
    enabled: z.boolean(),
    ipcmdPath: z.string(),
    senderLabel: z.string(),
  }),
  reportReminder: z.object({
    daily: z.object({ enabled: z.boolean(), timeEst: z.string(), templateUser: z.string() }),
    weekly: z.object({ enabled: z.boolean(), timeEst: z.string(), templateUser: z.string() }),
    monthly: z.object({ enabled: z.boolean(), timeEst: z.string(), templateUser: z.string() }),
  }),
  worktimeCheck: z.object({
    enabled: z.boolean(),
    timeEst: z.string(),
    thresholdPercent: z.number(),
    templateUser: z.string(),
    templateBoss: z.string(),
    templateAdmin: z.string(),
  }),
  penaltyNotify: z.object({
    enabled: z.boolean(),
    templateUser: z.string(),
    templateBoss: z.string(),
  }),
  manualNotify: z.object({
    enabled: z.boolean(),
    templateDefault: z.string(),
  }),
});

const manualSchema = z.object({
  targetType: z.enum(['all', 'groups', 'users']),
  groupCodes: z.array(z.string()).optional().default([]),
  userIds: z.array(z.string()).optional().default([]),
  message: z.string().min(1).max(5000),
});

const isSuperAdmin = (user) => normalizeRole(user?.role, user?.degree) === ROLES.SUPER_ADMIN;
const isGroupBoss = (user) => normalizeRole(user?.role, user?.degree) === ROLES.GROUP_BOSS;

router.get('/notifications/settings', requireAuth, async (req, res, next) => {
  try {
    const settings = await getOrCreateNotificationSettings();
    const users = await User.find({ status: 'active' })
      .select('_id name group role degree avatarUrl notification')
      .sort({ name: 1 })
      .lean();
    const groups = [...new Set(users.map((u) => String(u.group || '')).filter(Boolean))].sort();
    res.json({
      ok: true,
      data: {
        canEdit: isSuperAdmin(req.user),
        settings,
        groups,
        users: users
          .filter((u) => normalizeRole(u.role, u.degree) !== ROLES.SUPER_ADMIN)
          .map((u) => {
            const roleNormalized = normalizeRole(u.role, u.degree);
            const n = u.notification || {};
            const slackConnected = !!String(n.slack?.webhookUrl || '').trim();
            const telegramConnected =
              !!String(n.telegram?.botToken || '').trim() &&
              !!String(n.telegram?.chatId || '').trim();
            const ipConnected =
              !!String(n.ipMessage?.ipAddress || '').trim() &&
              !!String(n.ipMessage?.ipcmdPath || '').trim();
            const anyConnected = slackConnected || telegramConnected || ipConnected;
            const totalConnected = !!n.enabled && anyConnected;
            return {
              userId: u._id,
              name: u.name,
              group: u.group || '',
              role: roleNormalized,
              avatarUrl: u.avatarUrl || '',
              notifyState: {
                enabled: !!n.enabled,
                slackConnected,
                telegramConnected,
                ipMessageConnected: ipConnected,
                totalConnected,
              },
            };
          }),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.put('/notifications/settings', requireAuth, async (req, res, next) => {
  try {
    if (!isSuperAdmin(req.user)) return res.status(403).json({ ok: false, message: 'Only super admin can edit notification settings' });
    const payload = settingsSchema.parse(req.body);
    const settings = await getOrCreateNotificationSettings();
    settings.ipMessage = payload.ipMessage;
    settings.reportReminder = payload.reportReminder;
    settings.worktimeCheck = payload.worktimeCheck;
    settings.penaltyNotify = payload.penaltyNotify;
    settings.manualNotify = payload.manualNotify;
    settings.updatedBy = req.user._id;
    await settings.save();
    res.json({ ok: true, data: settings, message: 'Notification settings updated' });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ ok: false, message: err.errors?.[0]?.message || 'Validation error' });
    next(err);
  }
});

router.post('/notifications/manual', requireAuth, async (req, res, next) => {
  try {
    const payload = manualSchema.parse(req.body);
    let groupCodes = payload.groupCodes || [];
    // Everyone can send to all users or selected users.
    // Group targeting is restricted to super admin / group boss.
    if (payload.targetType === 'groups') {
      if (!isSuperAdmin(req.user) && !isGroupBoss(req.user)) {
        return res.status(403).json({ ok: false, message: 'Group message is allowed only for super admin or group boss' });
      }
      if (isGroupBoss(req.user) && !isSuperAdmin(req.user)) {
        const myGroup = String(req.user.group || '').trim();
        groupCodes = myGroup ? [myGroup] : [];
        if (!groupCodes.length) {
          return res.status(400).json({ ok: false, message: 'Group boss has no group assigned' });
        }
      }
    }
    const sentTo = await sendManualIpMessage({
      actor: req.user,
      targetType: payload.targetType,
      groupCodes,
      userIds: payload.userIds,
      message: payload.message,
      includeSuperAdmin: true,
    });
    res.json({ ok: true, data: { sentCount: sentTo.length, sentTo } });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ ok: false, message: err.errors?.[0]?.message || 'Validation error' });
    next(err);
  }
});

router.get('/messages/targets', requireAuth, async (req, res, next) => {
  try {
    const users = await User.find({ status: 'active' })
      .select('_id name group role degree avatarUrl')
      .sort({ name: 1 })
      .lean();
    const groups = [...new Set(users.map((u) => String(u.group || '').trim()).filter(Boolean))].sort();
    res.json({
      ok: true,
      data: {
        canTargetGroups: isSuperAdmin(req.user) || isGroupBoss(req.user),
        forceGroupCode: isGroupBoss(req.user) && !isSuperAdmin(req.user) ? String(req.user.group || '').trim() : '',
        users: users.map((u) => ({
          userId: u._id,
          name: u.name,
          group: u.group || '',
          role: normalizeRole(u.role, u.degree),
          avatarUrl: u.avatarUrl || '',
        })),
        groups,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/run-now', requireAuth, async (req, res, next) => {
  try {
    if (!isSuperAdmin(req.user)) return res.status(403).json({ ok: false, message: 'Only super admin can run notification checks' });
    await runScheduledNotificationTick();
    res.json({ ok: true, message: 'Notification checks executed' });
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/test-user', requireAuth, async (req, res, next) => {
  try {
    if (!isSuperAdmin(req.user)) return res.status(403).json({ ok: false, message: 'Only super admin can test users' });
    const userId = String(req.body?.userId || '').trim();
    if (!userId) return res.status(400).json({ ok: false, message: 'userId is required' });
    const out = await sendUserConnectionTestByAdmin({ actor: req.user, userId });
    if (!out.ok) return res.status(400).json({ ok: false, message: out.message || 'Failed to send test' });
    return res.json({ ok: true, message: out.message || 'Test message sent' });
  } catch (err) {
    next(err);
  }
});

router.get('/notifications/logs', requireAuth, async (req, res, next) => {
  try {
    if (!isSuperAdmin(req.user)) return res.status(403).json({ ok: false, message: 'Only super admin can view logs' });
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 100)));
    const rows = await NotificationDispatchLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('recipientUserId', 'name avatarUrl group')
      .lean();
    const logs = rows.map((r) => {
      const targetType = String(r.meta?.targetType || '');
      let recipientKind = 'user';
      let recipientLabel = r.recipientUserId?.name || 'Unknown user';
      if (targetType === 'all') {
        recipientKind = 'all';
        recipientLabel = 'All users';
      } else if (targetType === 'groups') {
        recipientKind = 'group';
        recipientLabel = r.recipientGroup ? `Group: ${r.recipientGroup}` : 'Group target';
      }
      return {
        ...r,
        recipientKind,
        recipientLabel,
        recipientUser: r.recipientUserId
          ? {
              userId: r.recipientUserId._id,
              name: r.recipientUserId.name,
              group: r.recipientUserId.group || '',
              avatarUrl: r.recipientUserId.avatarUrl || '',
            }
          : null,
      };
    });
    res.json({ ok: true, data: { logs } });
  } catch (err) {
    next(err);
  }
});

export default router;

