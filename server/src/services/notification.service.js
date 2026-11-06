import fs from 'fs';
import { monthKeyOfDateKey } from '../utils/businessMonth.js';
import { promisify } from 'util';
import { execFile } from 'child_process';
import User from '../models/User.js';
import Daily from '../models/Daily.js';
import Weekly from '../models/Weekly.js';
import Monthly from '../models/Monthly.js';
import Worklog from '../models/Worklog.js';
import WorktimeTarget from '../models/WorktimeTarget.js';
import NotificationSettings from '../models/NotificationSettings.js';
import NotificationDispatchLog from '../models/NotificationDispatchLog.js';
import CompetitionWorktimeDayRule from '../models/CompetitionWorktimeDayRule.js';
import CompetitionWorktimeUserDayRule from '../models/CompetitionWorktimeUserDayRule.js';
import { normalizeRole, ROLES } from '../constants/roles.js';
import { EST_TIMEZONE, getESTDateKey, normalizeReportDateByPeriodEST } from '../utils/estTime.js';

const execFileAsync = promisify(execFile);
const DEFAULT_TARGET_MINUTES = 13 * 60 + 30;

const pad2 = (n) => String(n).padStart(2, '0');

function nowEstParts(now = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: EST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(now);
  const get = (t) => p.find((x) => x.type === t)?.value || '';
  return {
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
    timeKey: `${get('hour')}:${get('minute')}`,
    weekDay: get('weekday'),
  };
}

function compileTemplate(template, vars) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k])));
}

export async function getOrCreateNotificationSettings() {
  let doc = await NotificationSettings.findOne({ key: 'main' });
  if (!doc) {
    doc = await NotificationSettings.create({ key: 'main' });
  }
  return doc;
}

async function hasBeenSent(dedupeKey) {
  const existing = await NotificationDispatchLog.findOne({ dedupeKey }).lean();
  return !!existing;
}

async function writeLog({ dedupeKey, type, recipientUserId, recipientGroup = '', message, status, error = '', meta = {} }) {
  try {
    await NotificationDispatchLog.create({
      dedupeKey,
      type,
      recipientUserId: recipientUserId || null,
      recipientGroup,
      channel: 'ipMessage',
      message: message || '',
      status,
      error,
      meta,
    });
  } catch (e) {
    // ignore duplicate log races
  }
}

async function sendIpMessageToUser({ settings, user, message, type, dedupeKey, meta = {} }) {
  if (!settings?.ipMessage?.enabled) {
    await writeLog({ dedupeKey, type, recipientUserId: user._id, recipientGroup: user.group || '', message, status: 'skipped', error: 'ipMessage disabled' });
    return;
  }
  const ipcmdPath = String(settings?.ipMessage?.ipcmdPath || '').trim();
  const recipientIp = String(user?.notification?.ipMessage?.ipAddress || '').trim();
  const userNotifyEnabled = !!user?.notification?.enabled;
  if (!userNotifyEnabled || !recipientIp || !ipcmdPath) {
    await writeLog({ dedupeKey, type, recipientUserId: user._id, recipientGroup: user.group || '', message, status: 'skipped', error: 'user notify off or missing ip/path' });
    return;
  }
  if (!fs.existsSync(ipcmdPath)) {
    await writeLog({ dedupeKey, type, recipientUserId: user._id, recipientGroup: user.group || '', message, status: 'failed', error: 'ipcmd path not found' });
    return;
  }
  try {
    await execFileAsync(ipcmdPath, ['send', recipientIp, message], { timeout: 15000, windowsHide: true });
    await writeLog({ dedupeKey, type, recipientUserId: user._id, recipientGroup: user.group || '', message, status: 'sent', meta });
  } catch (err) {
    const stderr = String(err?.stderr || '').trim();
    const stdout = String(err?.stdout || '').trim();
    const errMsg = String(err?.message || '');
    const isCommandFailedOnly = errMsg.startsWith('Command failed:');
    if (!stderr && (!stdout || isCommandFailedOnly)) {
      await writeLog({ dedupeKey, type, recipientUserId: user._id, recipientGroup: user.group || '', message, status: 'sent', meta: { ...meta, warning: 'non-zero exit with no stderr' } });
      return;
    }
    await writeLog({ dedupeKey, type, recipientUserId: user._id, recipientGroup: user.group || '', message, status: 'failed', error: errMsg || 'ipcmd send failed', meta });
  }
}

async function activeUsersNoSuperAdmin() {
  const users = await User.find({ status: 'active' }).lean();
  return users.filter((u) => normalizeRole(u.role, u.degree) !== ROLES.SUPER_ADMIN);
}

async function activeUsersAll() {
  return User.find({ status: 'active' }).lean();
}

async function superAdmins() {
  const users = await User.find({ status: 'active' }).lean();
  return users.filter((u) => normalizeRole(u.role, u.degree) === ROLES.SUPER_ADMIN);
}

function isReportSubmitted(row) {
  return Number(row?.state || 0) >= 2;
}

async function runDailyReportReminder(settings, est) {
  const cfg = settings.reportReminder?.daily;
  if (!cfg?.enabled || cfg.timeEst !== est.timeKey) return;
  const users = await activeUsersNoSuperAdmin();
  const dateObj = normalizeReportDateByPeriodEST(est.dateKey, 'daily');
  const rows = await Daily.find({ date: dateObj }).select('userId state').lean();
  const submitted = new Set(rows.filter(isReportSubmitted).map((r) => String(r.userId)));
  for (const u of users) {
    if (submitted.has(String(u._id))) continue;
    const dedupeKey = `daily-reminder:${est.dateKey}:${u._id}`;
    if (await hasBeenSent(dedupeKey)) continue;
    const message = compileTemplate(cfg.templateUser, { userName: u.name, date: est.dateKey });
    await sendIpMessageToUser({ settings, user: u, message, type: 'daily_report_reminder', dedupeKey, meta: { date: est.dateKey } });
  }
}

function isWeekEnd(weekDay) {
  return String(weekDay || '').toLowerCase().startsWith('sun');
}

async function runWeeklyReportReminder(settings, est) {
  const cfg = settings.reportReminder?.weekly;
  if (!cfg?.enabled || cfg.timeEst !== est.timeKey || !isWeekEnd(est.weekDay)) return;
  const users = await activeUsersNoSuperAdmin();
  const weekDate = normalizeReportDateByPeriodEST(est.dateKey, 'weekly');
  const rows = await Weekly.find({ date: weekDate }).select('userId state').lean();
  const submitted = new Set(rows.filter(isReportSubmitted).map((r) => String(r.userId)));
  for (const u of users) {
    if (submitted.has(String(u._id))) continue;
    const dedupeKey = `weekly-reminder:${est.dateKey}:${u._id}`;
    if (await hasBeenSent(dedupeKey)) continue;
    const message = compileTemplate(cfg.templateUser, { userName: u.name, date: est.dateKey });
    await sendIpMessageToUser({ settings, user: u, message, type: 'weekly_report_reminder', dedupeKey, meta: { date: est.dateKey } });
  }
}

function isMonthEnd(dateKey) {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.getUTCMonth() !== dt.getUTCMonth();
}

async function runMonthlyReportReminder(settings, est) {
  const cfg = settings.reportReminder?.monthly;
  if (!cfg?.enabled || cfg.timeEst !== est.timeKey || !isMonthEnd(est.dateKey)) return;
  const users = await activeUsersNoSuperAdmin();
  const monthDate = normalizeReportDateByPeriodEST(est.dateKey, 'monthly');
  const rows = await Monthly.find({ date: monthDate }).select('userId state').lean();
  const submitted = new Set(rows.filter(isReportSubmitted).map((r) => String(r.userId)));
  for (const u of users) {
    if (submitted.has(String(u._id))) continue;
    const dedupeKey = `monthly-reminder:${est.dateKey}:${u._id}`;
    if (await hasBeenSent(dedupeKey)) continue;
    const message = compileTemplate(cfg.templateUser, { userName: u.name, date: est.dateKey });
    await sendIpMessageToUser({ settings, user: u, message, type: 'monthly_report_reminder', dedupeKey, meta: { date: est.dateKey } });
  }
}

async function loadTodayTargetMinutesByUser(users, dateKey) {
  const userIds = users.map((u) => u._id);
  const month = monthKeyOfDateKey(dateKey);
  const [monthTargets, dayRules, userRules] = await Promise.all([
    WorktimeTarget.find({ month, userId: { $in: userIds } }).select('userId targetMinutes').lean(),
    CompetitionWorktimeDayRule.find({ month, date: dateKey }).select('date isHoliday targetDeltaMinutes').lean(),
    CompetitionWorktimeUserDayRule.find({ month, date: dateKey, userId: { $in: userIds } })
      .select('userId targetMinutes')
      .lean(),
  ]);
  const byMonth = new Map(monthTargets.map((r) => [String(r.userId), Number(r.targetMinutes)]));
  const byUserRule = new Map(userRules.map((r) => [String(r.userId), Number(r.targetMinutes)]));
  const dayRule = dayRules[0] || null;
  const isWeekend = (() => {
    const [y, m, d] = dateKey.split('-').map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return wd === 0 || wd === 6;
  })();
  const out = new Map();
  for (const u of users) {
    let target = Number.isFinite(byMonth.get(String(u._id))) ? byMonth.get(String(u._id)) : DEFAULT_TARGET_MINUTES;
    const holiday = dayRule ? !!dayRule.isHoliday : isWeekend;
    if (holiday) target = 0;
    if (dayRule) target = Math.max(0, Math.min(1440, target + (Number(dayRule.targetDeltaMinutes) || 0)));
    if (byUserRule.has(String(u._id))) target = byUserRule.get(String(u._id));
    out.set(String(u._id), target);
  }
  return out;
}

async function runWorktimeDailyCheck(settings, est) {
  const cfg = settings.worktimeCheck;
  if (!cfg?.enabled || cfg.timeEst !== est.timeKey) return;
  const users = await activeUsersNoSuperAdmin();
  const hubIds = users.map((u) => String(u.hubstaff_id || '')).filter(Boolean);
  const logs = hubIds.length
    ? await Worklog.find({ date: est.dateKey, member: { $in: hubIds } }).select('member real_time add_time').lean()
    : [];
  const byMemberSec = new Map();
  logs.forEach((w) => {
    const k = String(w.member);
    const sec = (Number(w.real_time) || 0) + (Number(w.add_time) || 0);
    byMemberSec.set(k, (byMemberSec.get(k) || 0) + sec);
  });
  const targets = await loadTodayTargetMinutesByUser(users, est.dateKey);
  const admins = await superAdmins();
  const bosses = users.filter((u) => normalizeRole(u.role, u.degree) === ROLES.GROUP_BOSS);
  const bossByGroup = new Map(bosses.map((b) => [String(b.group || ''), b]));

  for (const u of users) {
    const targetMin = Number(targets.get(String(u._id)) || 0);
    const sec = byMemberSec.get(String(u.hubstaff_id || '')) || 0;
    const workedHours = sec / 3600;
    const targetHours = targetMin / 60;
    const percent = targetMin > 0 ? (sec / 60 / targetMin) * 100 : 100;
    if (percent >= Number(cfg.thresholdPercent || 100)) continue;
    const vars = {
      userName: u.name,
      group: u.group || 'No Group',
      percent: percent.toFixed(1),
      workedHours: workedHours.toFixed(2),
      targetHours: targetHours.toFixed(2),
      date: est.dateKey,
    };
    const dedupeBase = `worktime-check:${est.dateKey}:${u._id}`;
    if (!(await hasBeenSent(`${dedupeBase}:user`))) {
      await sendIpMessageToUser({
        settings,
        user: u,
        message: compileTemplate(cfg.templateUser, vars),
        type: 'worktime_low_user',
        dedupeKey: `${dedupeBase}:user`,
      });
    }
    const boss = bossByGroup.get(String(u.group || ''));
    if (boss && !(await hasBeenSent(`${dedupeBase}:boss:${boss._id}`))) {
      await sendIpMessageToUser({
        settings,
        user: boss,
        message: compileTemplate(cfg.templateBoss, vars),
        type: 'worktime_low_boss',
        dedupeKey: `${dedupeBase}:boss:${boss._id}`,
      });
    }
    for (const admin of admins) {
      const dk = `${dedupeBase}:admin:${admin._id}`;
      if (await hasBeenSent(dk)) continue;
      await sendIpMessageToUser({
        settings,
        user: admin,
        message: compileTemplate(cfg.templateAdmin, vars),
        type: 'worktime_low_admin',
        dedupeKey: dk,
      });
    }
  }
}

export async function runScheduledNotificationTick() {
  const settings = await getOrCreateNotificationSettings();
  const est = nowEstParts(new Date());
  await runDailyReportReminder(settings, est);
  await runWeeklyReportReminder(settings, est);
  await runMonthlyReportReminder(settings, est);
  await runWorktimeDailyCheck(settings, est);
}

export function startNotificationScheduler() {
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try {
      await runScheduledNotificationTick();
    } catch (err) {
      console.error('notification scheduler error:', err.message);
    } finally {
      busy = false;
    }
  };
  run();
  setInterval(run, 60 * 1000);
}

export async function sendPenaltyAddedNotifications({ userId, penaltyTitle, points }) {
  const settings = await getOrCreateNotificationSettings();
  const cfg = settings.penaltyNotify;
  if (!cfg?.enabled) return;
  const user = await User.findById(userId).lean();
  if (!user) return;
  const vars = {
    userName: user.name || 'User',
    penaltyTitle: penaltyTitle || 'Penalty',
    points: Number(points || 0).toFixed(2),
    group: user.group || 'No Group',
  };
  const dateKey = getESTDateKey();
  const dedupeBase = `penalty:${dateKey}:${user._id}:${penaltyTitle}:${vars.points}`;
  await sendIpMessageToUser({
    settings,
    user,
    message: compileTemplate(cfg.templateUser, vars),
    type: 'penalty_user',
    dedupeKey: `${dedupeBase}:user`,
  });
  if (user.group) {
    const boss = await User.findOne({ group: user.group, status: 'active' }).lean();
    if (boss && normalizeRole(boss.role, boss.degree) === ROLES.GROUP_BOSS) {
      await sendIpMessageToUser({
        settings,
        user: boss,
        message: compileTemplate(cfg.templateBoss, vars),
        type: 'penalty_boss',
        dedupeKey: `${dedupeBase}:boss:${boss._id}`,
      });
    }
  }
}

export async function sendReportRejectedNotification({ period, report, actor, reason, previousState = 0 }) {
  const settings = await getOrCreateNotificationSettings();
  const user = await User.findById(report?.userId).lean();
  if (!user) return;
  const dateKey = (() => {
    const raw = report?.date;
    if (!raw) return getESTDateKey();
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? getESTDateKey() : d.toISOString().slice(0, 10);
  })();
  const periodLabel = period === 'weekly' ? 'Weekly' : period === 'monthly' ? 'Monthly' : 'Daily';
  const vars = {
    userName: user.name || 'User',
    actorName: actor?.name || 'Reviewer',
    period: periodLabel,
    reportDate: dateKey,
    reason: String(reason || '').trim(),
  };
  const msg = compileTemplate(
    '[TMS] {period} report was rejected by {actorName} ({reportDate}). Reason: {reason}',
    vars
  );
  const dedupeKey = `report-reject:${period}:${dateKey}:${user._id}:${String(actor?._id || '')}:${previousState}->${report?.state}`;
  await sendIpMessageToUser({
    settings,
    user,
    message: msg,
    type: 'report_reject_user',
    dedupeKey,
    meta: { period, reportDate: dateKey, actorId: String(actor?._id || ''), actorName: actor?.name || '' },
  });
}

export async function sendManualIpMessage({ actor, targetType, groupCodes = [], userIds = [], message, includeSuperAdmin = true }) {
  const settings = await getOrCreateNotificationSettings();
  const users = includeSuperAdmin ? await activeUsersAll() : await activeUsersNoSuperAdmin();
  let targets = [];
  if (targetType === 'all') targets = users;
  if (targetType === 'groups') targets = users.filter((u) => groupCodes.includes(String(u.group || '')));
  if (targetType === 'users') targets = users.filter((u) => userIds.includes(String(u._id)));
  const unique = new Map(targets.map((u) => [String(u._id), u]));
  const sentTo = [];
  for (const u of unique.values()) {
    const dedupeKey = `manual:${Date.now()}:${u._id}`;
    await sendIpMessageToUser({
      settings,
      user: u,
      message,
      type: 'manual_notify',
      dedupeKey,
      meta: {
        actorId: String(actor?._id || ''),
        actorName: actor?.name || '',
        targetType,
        groupCodes,
      },
    });
    sentTo.push({ userId: u._id, name: u.name, group: u.group || '' });
  }
  return sentTo;
}

export async function sendUserConnectionTestByAdmin({ actor, userId }) {
  const settings = await getOrCreateNotificationSettings();
  const user = await User.findById(userId).lean();
  if (!user) {
    return { ok: false, message: 'User not found' };
  }
  const connected =
    !!user?.notification?.enabled &&
    (!!String(user?.notification?.slack?.webhookUrl || '').trim() ||
      (!!String(user?.notification?.telegram?.botToken || '').trim() &&
        !!String(user?.notification?.telegram?.chatId || '').trim()) ||
      (!!String(user?.notification?.ipMessage?.ipAddress || '').trim() &&
        !!String(user?.notification?.ipMessage?.ipcmdPath || '').trim()));
  if (!connected) {
    return { ok: false, message: 'Target user is not connected/enabled' };
  }
  const msg = `[TMS] Connection test from ${actor?.name || 'Super Admin'} to ${user.name} at ${new Date().toISOString()}`;
  const dedupeKey = `admin-test:${Date.now()}:${user._id}`;
  await sendIpMessageToUser({
    settings,
    user,
    message: msg,
    type: 'admin_user_test',
    dedupeKey,
    meta: { actorId: String(actor?._id || ''), actorName: actor?.name || '' },
  });
  return { ok: true, message: 'Test message sent' };
}

