import express from 'express';
import { z } from 'zod';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { requireAuth } from '../middleware/auth.middleware.js';
import User from '../models/User.js';
import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';
import { createModuleStorage } from '../middleware/upload.middleware.js';

const router = express.Router();

const updateMeSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long')
});
const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters')
});
const updateNotificationSchema = z.object({
  enabled: z.boolean(),
  slack: z.object({
    enabled: z.boolean(),
    webhookUrl: z.string().optional().default(''),
  }),
  telegram: z.object({
    enabled: z.boolean(),
    botToken: z.string().optional().default(''),
    chatId: z.string().optional().default(''),
  }),
  ipMessage: z.object({
    enabled: z.boolean(),
    ipAddress: z.string().optional().default(''),
    ipcmdPath: z.string().optional().default(''),
  }),
});
const testNotificationSchema = z.object({
  channel: z.enum(['slack', 'telegram', 'ipMessage']),
  config: z.object({
    slack: z.object({
      webhookUrl: z.string().optional().default(''),
    }).optional(),
    telegram: z.object({
      botToken: z.string().optional().default(''),
      chatId: z.string().optional().default(''),
    }).optional(),
    ipMessage: z.object({
      ipAddress: z.string().optional().default(''),
      ipcmdPath: z.string().optional().default(''),
    }).optional(),
  }).optional(),
});

const execFileAsync = promisify(execFile);

const avatarUpload = multer({
  storage: createModuleStorage('avatars'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype?.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

// Get current user
router.get('/me', requireAuth, async (req, res) => {
  res.json(createSuccessResponse({
    user: req.user.toSummary()
  }));
});

// Update current user (name only)
router.put('/me', requireAuth, async (req, res, next) => {
  try {
    const validatedData = updateMeSchema.parse(req.body);
    
    req.user.name = validatedData.name;
    await req.user.save();
    
    res.json(createSuccessResponse({
      user: req.user.toSummary()
    }, 'Profile updated successfully'));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(createErrorResponse(
        'VALIDATION_ERROR',
        error.errors[0]?.message || 'Validation error',
        400
      ));
    }
    next(error);
  }
});

router.put('/me/password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = updatePasswordSchema.parse(req.body);
    const isValid = await req.user.comparePassword(currentPassword);
    if (!isValid) {
      return res.status(400).json(createErrorResponse(
        'INVALID_CURRENT_PASSWORD',
        'Current password is incorrect',
        400
      ));
    }
    req.user.passwordHash = newPassword;
    await req.user.save();
    res.json(createSuccessResponse(null, 'Password updated successfully'));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(createErrorResponse(
        'VALIDATION_ERROR',
        error.errors[0]?.message || 'Validation error',
        400
      ));
    }
    next(error);
  }
});

router.post('/me/avatar', requireAuth, avatarUpload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json(createErrorResponse(
        'FILE_REQUIRED',
        'Avatar file is required',
        400
      ));
    }

    // Delete old local avatar file to avoid orphaned files.
    if (req.user.avatarUrl?.startsWith('/uploads/')) {
      const absoluteOldPath = path.resolve(process.cwd(), req.user.avatarUrl.slice(1));
      if (fs.existsSync(absoluteOldPath)) {
        fs.unlinkSync(absoluteOldPath);
      }
    }

    req.user.avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await req.user.save();

    res.json(createSuccessResponse({
      user: req.user.toSummary()
    }, 'Avatar updated successfully'));
  } catch (error) {
    next(error);
  }
});

const trimOrEmpty = (v) => String(v || '').trim();

const notificationStateFromUser = (user) => {
  const n = user.notification || {};
  const slack = n.slack || {};
  const telegram = n.telegram || {};
  const ipMessage = n.ipMessage || {};
  const slackConnected = !!trimOrEmpty(slack.webhookUrl);
  const telegramConnected = !!trimOrEmpty(telegram.botToken) && !!trimOrEmpty(telegram.chatId);
  const ipMessageConnected = !!trimOrEmpty(ipMessage.ipAddress) && !!trimOrEmpty(ipMessage.ipcmdPath);
  const hasAnyConnection = slackConnected || telegramConnected || ipMessageConnected;
  const enabled = !!n.enabled && hasAnyConnection;
  return {
    enabled,
    hasAnyConnection,
    needsSetupWarning: !enabled,
    slack: { enabled: !!slack.enabled, connected: slackConnected },
    telegram: { enabled: !!telegram.enabled, connected: telegramConnected },
    ipMessage: { enabled: !!ipMessage.enabled, connected: ipMessageConnected },
  };
};

router.put('/me/notifications', requireAuth, async (req, res, next) => {
  try {
    const payload = updateNotificationSchema.parse(req.body);
    const webhookUrl = trimOrEmpty(payload.slack.webhookUrl);
    const botToken = trimOrEmpty(payload.telegram.botToken);
    const chatId = trimOrEmpty(payload.telegram.chatId);
    const ipAddress = trimOrEmpty(payload.ipMessage.ipAddress);
    const ipcmdPath = trimOrEmpty(payload.ipMessage.ipcmdPath);
    const canSlack = !!webhookUrl;
    const canTelegram = !!botToken && !!chatId;
    const canIp = !!ipAddress && !!ipcmdPath;
    const hasAnyConnection = canSlack || canTelegram || canIp;

    req.user.notification = {
      enabled: hasAnyConnection ? !!payload.enabled : false,
      slack: {
        enabled: canSlack ? !!payload.slack.enabled : false,
        webhookUrl,
      },
      telegram: {
        enabled: canTelegram ? !!payload.telegram.enabled : false,
        botToken,
        chatId,
      },
      ipMessage: {
        enabled: canIp ? !!payload.ipMessage.enabled : false,
        ipAddress,
        ipcmdPath,
      },
    };

    await req.user.save();
    return res.json(
      createSuccessResponse(
        { user: req.user.toSummary(), notificationState: notificationStateFromUser(req.user) },
        'Notification settings updated'
      )
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(createErrorResponse('VALIDATION_ERROR', error.errors[0]?.message || 'Validation error', 400));
    }
    return next(error);
  }
});

router.post('/me/notifications/test', requireAuth, async (req, res, next) => {
  try {
    const { channel, config } = testNotificationSchema.parse(req.body);
    const n = req.user.notification || {};
    const now = new Date().toISOString();
    const baseText = `[TMS] Test notification (${channel}) for ${req.user.name} at ${now}`;
    const slackCfg = config?.slack || {};
    const telegramCfg = config?.telegram || {};
    const ipCfg = config?.ipMessage || {};

    if (channel === 'slack') {
      const webhookUrl = trimOrEmpty(slackCfg.webhookUrl || n.slack?.webhookUrl);
      if (!webhookUrl) {
        return res.status(400).json(createErrorResponse('NOT_CONFIGURED', 'Slack webhook URL is not configured', 400));
      }
      const r = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: baseText }),
      });
      if (!r.ok) {
        const txt = await r.text();
        return res.status(502).json(createErrorResponse('SLACK_SEND_FAILED', `Slack send failed: ${txt || r.status}`, 502));
      }
      return res.json(createSuccessResponse({ ok: true }, 'Slack test message sent'));
    }

    if (channel === 'telegram') {
      const botToken = trimOrEmpty(telegramCfg.botToken || n.telegram?.botToken);
      const chatId = trimOrEmpty(telegramCfg.chatId || n.telegram?.chatId);
      if (!botToken || !chatId) {
        return res.status(400).json(createErrorResponse('NOT_CONFIGURED', 'Telegram bot token/chat id is not configured', 400));
      }
      const endpoint = `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`;
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: baseText }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok || body.ok === false) {
        return res.status(502).json(createErrorResponse('TELEGRAM_SEND_FAILED', `Telegram send failed: ${body.description || r.status}`, 502));
      }
      return res.json(createSuccessResponse({ ok: true }, 'Telegram test message sent'));
    }

    const ipAddress = trimOrEmpty(ipCfg.ipAddress || n.ipMessage?.ipAddress);
    const ipcmdPath = trimOrEmpty(ipCfg.ipcmdPath || n.ipMessage?.ipcmdPath);
    if (!ipAddress || !ipcmdPath) {
      return res.status(400).json(createErrorResponse('NOT_CONFIGURED', 'IP Message IP/cmd path is not configured', 400));
    }
    if (!fs.existsSync(ipcmdPath)) {
      return res.status(400).json(createErrorResponse('NOT_CONFIGURED', 'ipcmd.exe path does not exist', 400));
    }
    const args = ['send', ipAddress, baseText];
    try {
      await execFileAsync(ipcmdPath, args, { timeout: 15000, windowsHide: true });
    } catch (err) {
      const stdoutText = String(err?.stdout || '').trim();
      const stderrText = String(err?.stderr || '').trim();
      const stdioText = `${stdoutText} ${stderrText}`.trim();
      const errMsg = String(err?.message || '');
      const isCommandFailedOnly = errMsg.startsWith('Command failed:');
      // ipcmd may return non-zero despite sending successfully (observed on some environments).
      if (!stderrText && (isCommandFailedOnly || !stdioText)) {
        return res.json(
          createSuccessResponse(
            { ok: true, warning: err?.code ? `ipcmd exited with code ${err.code}` : 'ipcmd returned non-zero without stderr' },
            'IP Message test message sent'
          )
        );
      }
      return res.status(502).json(
        createErrorResponse(
          'IPMSG_SEND_FAILED',
          `IP Message send failed. Check ipcmd path and syntax. (${err.message || 'unknown error'})`,
          502
        )
      );
    }
    return res.json(createSuccessResponse({ ok: true }, 'IP Message test message sent'));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(createErrorResponse('VALIDATION_ERROR', error.errors[0]?.message || 'Validation error', 400));
    }
    return next(error);
  }
});

export default router;

