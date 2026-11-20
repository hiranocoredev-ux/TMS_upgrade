import mongoose from 'mongoose';
import fs from 'fs';
import { validateTimeRange, findOverlap, rangesOverlap, formatTimeOfDay } from '../utils/timeRanges.js';
import HubstaffSettings from '../models/HubstaffSettings.js';
import { orgIdDueDates, orgIdNeedsUpdate } from '../services/hubstaffOrg.js';
import User from '../models/User.js';
import Group from '../models/Group.js';
import { getESTDateKey } from '../utils/estTime.js';
import { sortUsersForDisplay } from '../utils/userOrder.js';
import Worklog from '../models/Worklog.js';
import WorktimeTarget from '../models/WorktimeTarget.js';
import WorktimeTargetPreset from '../models/WorktimeTargetPreset.js';
import WorktimeFinalSync from '../models/WorktimeFinalSync.js';
import CompetitionWorktimeDayRule from '../models/CompetitionWorktimeDayRule.js';
import CompetitionWorktimeUserDayRule from '../models/CompetitionWorktimeUserDayRule.js';
import { buildDayTargets, DEFAULT_TARGET_MINUTES as SHARED_DEFAULT_TARGET_MINUTES } from '../services/worktimeTargets.js';
import { normalizeRole, ROLES, isNonMemberRole, isFinanceManagerRole, isFullAdminRole } from '../constants/roles.js';

const LEGACY_MANUAL_ADJUSTMENT_ID = 'legacy';

/**
 * Manual time entries: only approved ones count anywhere. A group boss's entry
 * is pending until a super admin / admin approves it; entries from before the
 * status existed count as approved.
 */
const ADJ_STATUS = Object.freeze({ APPROVED: 'approved', PENDING: 'pending', REJECTED: 'rejected' });
const adjustmentStatusOf = (adj) => adj?.status || ADJ_STATUS.APPROVED;
const isApprovedAdjustment = (adj) => adjustmentStatusOf(adj) === ADJ_STATUS.APPROVED;
const adjustmentSeconds = (adj) => Math.max(0, Math.floor(Number(adj?.seconds) || 0));

/** Seconds of APPROVED manual time (pending and rejected never count). */
const sumManualAdjustmentSeconds = (adjustments = []) =>
  adjustments.reduce((s, adj) => s + (isApprovedAdjustment(adj) ? adjustmentSeconds(adj) : 0), 0);

const sumPendingAdjustmentSeconds = (adjustments = []) =>
  adjustments.reduce((s, adj) => s + (adjustmentStatusOf(adj) === ADJ_STATUS.PENDING ? adjustmentSeconds(adj) : 0), 0);

/** Keep aggregated add_time (+ total_time) aligned with tracked + adjustment line-items. */
const syncManualTotalsIntoWorklog = (worklog) => {
  if (!worklog) return;
  const real = Number(worklog.real_time) || 0;
  const adjustments = Array.isArray(worklog.manualAdjustments) ? [...worklog.manualAdjustments] : [];
  const sumAdj = sumManualAdjustmentSeconds(adjustments);
  worklog.add_time = String(sumAdj);
  worklog.total_time = Math.max(0, real + sumAdj);
};

/**
 * Persist pre-line-item totals as the first adjustment row once we start tracking items.
 */
const migrateLegacyManualAddTimeToLineItemsIfNeeded = (worklog) => {
  if (!worklog) return;
  if (!Array.isArray(worklog.manualAdjustments)) {
    worklog.manualAdjustments = [];
  }
  const hasRows = worklog.manualAdjustments.length > 0;
  if (hasRows) return;
  const legacy = Math.max(0, Math.floor(Number(worklog.add_time) || 0));
  if (legacy <= 0) return;
  const label = String(worklog.note || '').trim() || 'Earlier manual total (before line-item breakdown)';
  worklog.manualAdjustments.push({ seconds: legacy, description: label });
};

/**
 * Serialized adjustment rows for API (includes synthetic "legacy" when only add_time existed).
 */
const adjustmentsForDayResponseFromWorklog = (worklog) => {
  if (!worklog) return [];
  const rows = Array.isArray(worklog.manualAdjustments) ? worklog.manualAdjustments : [];
  if (rows.length > 0) {
    return rows.map((adj) => ({
      id: String(adj._id),
      synthetic: false,
      seconds: Math.max(0, Math.floor(Number(adj.seconds) || 0)),
      description: adj.description ? String(adj.description) : '',
      shortReason: adj.shortReason ? String(adj.shortReason) : '',
      updatedAt: adj.updatedAt ? adj.updatedAt.toISOString?.() ?? null : null,
      status: adjustmentStatusOf(adj),
      addedByName: adj.addedByName || '',
      reviewedByName: adj.reviewedByName || '',
      rejectReason: adj.rejectReason || '',
      startTime: adj.startTime || '',
      endTime: adj.endTime || '',
      screenshotUrl: adj.screenshotUrl || '',
    }));
  }
  const addOnly = Math.max(0, Math.floor(Number(worklog.add_time) || 0));
  if (addOnly <= 0) return [];
  return [
    {
      id: LEGACY_MANUAL_ADJUSTMENT_ID,
      synthetic: true,
      seconds: addOnly,
      description: String(worklog.note || ''),
      shortReason: '',
      updatedAt: null,
      status: ADJ_STATUS.APPROVED,
      addedByName: '',
      reviewedByName: '',
      rejectReason: '',
      startTime: '',
      endTime: '',
      screenshotUrl: '',
    },
  ];
};

const addUtcDays = (dateKey, deltaDays) => {
  const base = new Date(`${dateKey}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
};

/**
 * GET /api/workflow/chart?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD[&group=all|<groupCode>]
 *
 * Optional `group`: omit, `all`, or empty = every visible member; otherwise only users in that group.
 *
 * Returns per-user worked hours for the given range.
 * worked_seconds = real_time + add_time (both stored on Worklog).
 * date_to is treated as EXCLUSIVE (matches the client convention where
 * single-day = From=D, To=D+1).
 *
 * The authoritative join key from worklogs → users is `user_id`
 * (worklog.user_id references User._id directly). `hubstaff_id` is
 * kept on the response for reference and for any future Hubstaff sync.
 */
export const getChartData = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    if (!date_from || !date_to) {
      return res.status(400).json({ ok: false, message: 'date_from and date_to are required' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date_from) || !/^\d{4}-\d{2}-\d{2}$/.test(date_to)) {
      return res.status(400).json({ ok: false, message: 'Invalid date format. Use YYYY-MM-DD' });
    }
    const fromDate = new Date(`${date_from}T00:00:00Z`);
    const toDate = new Date(`${date_to}T00:00:00Z`);
    const rangeDays = Math.max(1, Math.round((toDate - fromDate) / 86400000));
    // Hard guard to avoid runaway chart values from malformed or duplicated worklogs.
    const maxSecondsPerUser = rangeDays * 24 * 3600;

    // 1. All active users
    const users = await User.find({ status: 'active' })
      .select('name email group hubstaff_id role degree avatarUrl')
      .sort({ name: 1 })
      .lean();
    // Super admins and finance managers are not workers.
    const visibleUsers = users.filter((u) => !isNonMemberRole(u.role, u.degree));

    const groups = [
      ...new Set(
        visibleUsers
          .map((u) => u.group)
          .filter((g) => g != null && String(g).trim() !== '' && String(g) !== '*')
      ),
    ].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }));

    const rawGroupFilter = typeof req.query.group === 'string' ? req.query.group.trim() : '';
    const groupFilterActive =
      rawGroupFilter && rawGroupFilter.toLowerCase() !== 'all';

    const chartUsers = groupFilterActive
      ? visibleUsers.filter((u) => String(u.group) === rawGroupFilter)
      : visibleUsers;

    // Per-user, per-day targets (monthly target + day rules + per-user day rules),
    // shared with the Summarize weekend automation.
    const { dayTargetsByUserId, periodTargetMinutesByUserId } = await buildDayTargets({
      userIds: chartUsers.map((u) => u._id),
      dateFrom: date_from,
      dateToExclusive: date_to,
    });
    const dayDetailByUserId = dayTargetsByUserId;

    // 2. Fetch worklogs in range (date is stored as YYYY-MM-DD string)
    const worklogs = await Worklog.find({
      date: { $gte: date_from, $lt: date_to },
    })
      .select('member date real_time add_time note manualAdjustments')
      .lean();

    // 3. Aggregate real_time + add_time per member (hubstaff_id), and roll up the
    //    manual added time by its short reason (for the graph tooltip).
    const byMember = {};
    // member (hubstaff_id) -> { [date]: { real, add } } for per-day metrics.
    const byMemberDay = {};
    const reasonsByMember = {};
    const addReasonSeconds = (member, shortReason, seconds) => {
      const secs = Math.max(0, Math.floor(Number(seconds) || 0));
      if (secs <= 0) return;
      const key = String(shortReason || '').trim();
      if (!reasonsByMember[member]) reasonsByMember[member] = new Map();
      reasonsByMember[member].set(key, (reasonsByMember[member].get(key) || 0) + secs);
    };
    for (const w of worklogs) {
      const member = w.member;
      if (!member) continue;
      if (!byMember[member]) byMember[member] = { real: 0, add: 0 };
      byMember[member].real += Number(w.real_time) || 0;
      byMember[member].add += Number(w.add_time) || 0;

      if (!byMemberDay[member]) byMemberDay[member] = {};
      if (!byMemberDay[member][w.date]) byMemberDay[member][w.date] = { real: 0, add: 0 };
      byMemberDay[member][w.date].real += Number(w.real_time) || 0;
      byMemberDay[member][w.date].add += Number(w.add_time) || 0;

      const adjustments = Array.isArray(w.manualAdjustments) ? w.manualAdjustments : [];
      const pendingSecs = sumPendingAdjustmentSeconds(adjustments);
      if (pendingSecs > 0) {
        byMember[member].pending = (byMember[member].pending || 0) + pendingSecs;
      }
      if (adjustments.length > 0) {
        // Only approved time is drawn, so only approved reasons are listed.
        for (const adj of adjustments) {
          if (!isApprovedAdjustment(adj)) continue;
          addReasonSeconds(member, adj?.shortReason, adj?.seconds);
        }
      } else {
        // Legacy rows without line-items: fall back to the day note (if any).
        addReasonSeconds(member, w.note, w.add_time);
      }
    }

    // Convert each member's reason map into a sorted (desc by time) array.
    const addedReasonsFor = (member) => {
      const map = reasonsByMember[member];
      if (!map) return [];
      return [...map.entries()]
        .map(([shortReason, seconds]) => ({ shortReason, seconds }))
        .sort((a, b) => b.seconds - a.seconds);
    };

    // 4. Build per-user chart data (users with no matching worklogs show 0)
    const chartData = chartUsers.map(u => {
      const hubstaffId = u.hubstaff_id?.toString();
      const rec = byMember[hubstaffId] || { real: 0, add: 0 };
      const safeReal = Math.max(0, Number.isFinite(rec.real) ? rec.real : 0);
      const safeAdd = Math.max(0, Number.isFinite(rec.add) ? rec.add : 0);
      const totalSeconds = Math.min(maxSecondsPerUser, safeReal + safeAdd);
      const maxSecondsPerDay = 24 * 3600;
      const dayWorked = byMemberDay[hubstaffId] || {};
      const days = (dayDetailByUserId.get(String(u._id)) || []).map((d) => {
        const w = dayWorked[d.date] || { real: 0, add: 0 };
        return {
          date: d.date,
          real_time: Math.max(0, Math.min(maxSecondsPerDay, Number(w.real) || 0)),
          add_time: Math.max(0, Math.min(maxSecondsPerDay, Number(w.add) || 0)),
          target: d.target,
          isHoliday: d.isHoliday,
        };
      });
      return {
        userId: u._id,
        name: u.name,
        email: u.email,
        group: u.group || '',
        avatarUrl: u.avatarUrl || '',
        hubstaff_id: hubstaffId || null,
        real_time: Math.min(maxSecondsPerUser, safeReal),
        add_time: Math.min(maxSecondsPerUser, safeAdd),
        // Added time still waiting for approval: not drawn, not counted.
        pending_add_time: Math.max(0, Number(rec.pending) || 0),
        total_seconds: totalSeconds,
        total_hours: +(totalSeconds / 3600).toFixed(4),
        periodTargetMinutes: periodTargetMinutesByUserId.get(String(u._id)) ?? (SHARED_DEFAULT_TARGET_MINUTES * rangeDays),
        days,
        addedReasons: hubstaffId ? addedReasonsFor(hubstaffId) : [],
      };
    });

    res.json({ ok: true, data: { chartData, groups, date_from, date_to } });
  } catch (err) {
    console.error('workflow getChartData error:', err.message);
    res.status(500).json({ ok: false, message: err.message });
  }
};

/**
 * GET /api/workflow/users
 * Returns the list of active users for the ADD TIME modal dropdown.
 */
export const getWorkflowUsers = async (req, res) => {
  try {
    const [rows, groups] = await Promise.all([
      User.find({ status: 'active' })
        .select('name email group role degree hubstaff_id avatarUrl')
        .lean(),
      Group.find().select('code sortOrder').lean(),
    ]);
    // Listed by team, each team's boss first, then by name. Finance managers
    // track no worktime, so they are left out.
    const workers = rows.filter((u) => !isFinanceManagerRole(u.role, u.degree));
    res.json({ ok: true, data: { users: sortUsersForDisplay(workers, groups) } });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

/**
 * POST /api/workflow/add-time   (JSON, or multipart when screenshots are attached)
 * Body: { userId, date, entries: [{ start: "HH:MM", end: "HH:MM", shortReason?, description? }] }
 *   Multipart: `entries` is a JSON string; the screenshot of entry i is the file
 *   field `screenshot_<i>` (images only).
 * Legacy body (scripts): { userId, date, hours, minutes, shortReason?, description? }
 *
 * Each entry's time is end - start (00:00–24:00 on that day). Entries may not
 * overlap each other or the day's existing ranged entries (rejected ones aside).
 * Super admin / admin entries count at once; a group boss's wait for approval.
 */
const removeUploadedFiles = (req) => {
  for (const f of Array.isArray(req.files) ? req.files : []) {
    fs.promises.unlink(f.path).catch(() => {});
  }
};

const parseEntriesInput = (raw) => {
  if (raw == null || raw === '') return null;
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const MAX_ENTRIES_PER_REQUEST = 20;

export const addTime = async (req, res) => {
  const fail = (status, message) => {
    removeUploadedFiles(req);
    return res.status(status).json({ ok: false, message });
  };
  try {
    const { userId, date, hours, minutes, description = '', shortReason = '' } = req.body;

    if (!userId) return fail(400, 'userId is required');
    if (!date) return fail(400, 'date is required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(400, 'Invalid date format. Use YYYY-MM-DD');

    // Build the list of entries: start–end ranges, or one legacy hours/minutes entry.
    const rawEntries = parseEntriesInput(req.body.entries);
    const filesByField = new Map((Array.isArray(req.files) ? req.files : []).map((f) => [f.fieldname, f]));
    const entries = [];
    if (rawEntries) {
      if (!rawEntries.length) return fail(400, 'Add at least one time entry');
      if (rawEntries.length > MAX_ENTRIES_PER_REQUEST) return fail(400, `At most ${MAX_ENTRIES_PER_REQUEST} entries at once`);
      for (let i = 0; i < rawEntries.length; i += 1) {
        const e = rawEntries[i] || {};
        const range = validateTimeRange(e.start, e.end);
        if (!range.ok) return fail(400, `Entry ${i + 1}: ${range.message}`);
        const file = filesByField.get(`screenshot_${i}`);
        entries.push({
          ...range,
          shortReason: String(e.shortReason || '').trim().slice(0, 120),
          description: String(e.description || '').trim().slice(0, 4000),
          screenshotUrl: file ? `/uploads/worktime_screenshots/${file.filename}` : '',
        });
      }
      const clash = findOverlap(entries);
      if (clash) return fail(400, `Entries overlap: ${clash[0].start}–${clash[0].end} and ${clash[1].start}–${clash[1].end}`);
    } else {
      const h = Number(hours) || 0;
      const m = Number(minutes) || 0;
      if (h < 0) return fail(400, 'hours must be non-negative');
      if (m < 0) return fail(400, 'minutes must be non-negative');
      if (h === 0 && m === 0) return fail(400, 'Time must be greater than 0');
      entries.push({
        seconds: h * 3600 + m * 60,
        start: '',
        end: '',
        shortReason: String(shortReason || '').trim().slice(0, 120),
        description: String(description || '').trim(),
        screenshotUrl: '',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(String(userId))) return fail(400, 'Invalid userId');
    const user = await User.findById(userId).select('name hubstaff_id group').lean();
    if (!user) return fail(404, 'User not found');

    // Super admin / admin: counts at once. Group boss: only for their own
    // group's members, and it waits for a super admin / admin to approve it.
    const actorRole = normalizeRole(req.user?.role, req.user?.degree);
    const actorIsFullAdmin = isFullAdminRole(req.user?.role, req.user?.degree);
    if (!actorIsFullAdmin) {
      if (actorRole !== ROLES.GROUP_BOSS) return fail(403, 'You are not allowed to add time');
      const actorGroup = String(req.user?.group ?? '').trim();
      if (!actorGroup || actorGroup === '*' || String(user.group ?? '').trim() !== actorGroup) {
        return fail(403, 'Group bosses can only add time for members of their own group');
      }
    }
    const entryStatus = actorIsFullAdmin ? ADJ_STATUS.APPROVED : ADJ_STATUS.PENDING;
    if (!user.hubstaff_id) return fail(400, 'User must have a Hubstaff ID before manual time can be added');

    let worklog = await Worklog.findOne({ member: String(user.hubstaff_id), date });
    if (!worklog) {
      worklog = new Worklog({
        member: String(user.hubstaff_id),
        date,
        real_time: 0,
        add_time: '0',
        total_time: 0,
        efficiency: 0,
        manualAdjustments: [],
      });
    }

    // No overlap with the day's existing ranges either (rejected ones do not count).
    const existingRanges = (worklog.manualAdjustments || [])
      .filter((adj) => adjustmentStatusOf(adj) !== ADJ_STATUS.REJECTED && adj.startTime && adj.endTime)
      .map((adj) => validateTimeRange(adj.startTime, adj.endTime))
      .filter((r) => r.ok);
    for (const e of entries.filter((x) => x.start)) {
      const hit = existingRanges.find((r) => rangesOverlap(r, e));
      if (hit) {
        return fail(400, `${e.start}–${e.end} overlaps time already added for ${user.name} on ${date} (${hit.start}–${hit.end})`);
      }
    }

    migrateLegacyManualAddTimeToLineItemsIfNeeded(worklog);
    for (const e of entries) {
      worklog.manualAdjustments.push({
        seconds: e.seconds,
        description: e.description,
        shortReason: e.shortReason,
        startTime: e.start,
        endTime: e.end,
        screenshotUrl: e.screenshotUrl,
        status: entryStatus,
        addedByUserId: req.user?._id || undefined,
        addedByName: String(req.user?.name || ''),
        addedByRole: actorRole || '',
      });
    }
    syncManualTotalsIntoWorklog(worklog);
    const lastDescription = [...entries].reverse().find((e) => e.description)?.description;
    if (entryStatus === ADJ_STATUS.APPROVED && lastDescription) worklog.note = lastDescription;
    await worklog.save();

    const totalSeconds = entries.reduce((s, e) => s + e.seconds, 0);
    const displayH = Math.floor(totalSeconds / 3600);
    const displayM = Math.floor((totalSeconds % 3600) / 60);
    const pending = entryStatus === ADJ_STATUS.PENDING;
    const what = `${displayH}h ${displayM}m${entries.length > 1 ? ` (${entries.length} entries)` : ''}`;
    res.json({
      ok: true,
      data: { worklogId: worklog._id, status: entryStatus, pending, count: entries.length, totalSeconds },
      message: pending
        ? `Submitted ${what} for ${user.name} on ${date} for approval`
        : `Added ${what} for ${user.name} on ${date}`,
    });
  } catch (err) {
    removeUploadedFiles(req);
    console.error('workflow addTime error:', err.message);
    res.status(500).json({ ok: false, message: err.message });
  }
};

/**
 * POST /api/workflow/
 *
 * Public ingest endpoint called by the external Python sync service.
 * Upserts a Worklog for (user, day) keyed by Hubstaff numeric id.
 *
 * Body:
 *   {
 *     member_id:        string  // Hubstaff numeric id (matches User.hubstaff_id)
 *     date:             "YYYY-MM-DD"
 *     work_time:        number  // tracked seconds for the day (overwrites real_time)
 *     total_work_time?: number  // ignored - total_time is recomputed as real_time + add_time
 *     progress?:        number  // productivity %
 *     add_time?:        number  // additional seconds to ADD (incremented onto existing add_time)
 *   }
 *
 * Behaviour:
 *   - real_time = work_time              (overwrite, latest tracked total wins)
 *   - add_time += payload.add_time       (increment)
 *   - total_time = real_time + add_time  (recomputed)
 */

// export const upsertWorkLog = async (req, res) => {
//   try {
//     const { member_id, date, work_time, progress, add_time } = req.body;

//     if (!member_id || !date) {
//       return res.status(400).json({ ok: false, message: 'member_id and date are required' });
//     }
//     if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
//       return res.status(400).json({ ok: false, message: 'Invalid date format. Use YYYY-MM-DD' });
//     }

//     // Resolve the User by Hubstaff id - Worklog.user_id is required by the schema,
//     // so we cannot insert a row without a known User.
//     const hubstaffId = String(member_id);
//     const user = await User.findOne({ hubstaff_id: hubstaffId })
//       .select('_id name hubstaff_id')
//       .lean();
//     if (!user) {
//       return res.status(404).json({
//         ok: false,
//         message: `No user found with hubstaff_id=${hubstaffId}`,
//       });
//     }

//     const workSeconds = Number(work_time) || 0;
//     const addDelta = Number(add_time) || 0;
//     const productivity = Number(progress) || 0;

//     if (workSeconds < 0 || addDelta < 0) {
//       return res.status(400).json({ ok: false, message: 'work_time and add_time must be non-negative' });
//     }

//     // UTC day range - tolerant of legacy rows stored with non-midnight time-of-day.
//     const dayStart = new Date(`${date}T00:00:00.000Z`);
//     const dayEnd = new Date(dayStart.getTime() + 86400000);

//     let worklog = await Worklog.findOne({
//       user_id: user._id,
//       date: { $gte: dayStart, $lt: dayEnd },
//     });

//     if (worklog) {
//       worklog.real_time = workSeconds;
//       worklog.add_time = (worklog.add_time || 0) + addDelta;
//       worklog.total_time = worklog.real_time + worklog.add_time;
//       worklog.efficiency = productivity;
//       worklog.member_id = hubstaffId;
//       worklog.source = 'sync';
//     } else {
//       worklog = new Worklog({
//         user_id: user._id,
//         hubstaff_id: hubstaffId,
//         date: dayStart,
//         real_time: workSeconds,
//         add_time: addDelta,
//         total_time: workSeconds + addDelta,
//         productivity,
//         source: 'sync',
//         status: 'approved',
//       });
//     }
//     await worklog.save();

//     return res.status(200).json({ ok: true, data: worklog });
//   } catch (err) {
//     console.error('workflow upsertWorkLog error:', err.message);
//     if (err.code === 11000) {
//       return res.status(409).json({
//         ok: false,
//         message: 'Duplicate work log entry (unique constraint violation)',
//         error: err.message,
//       });
//     }
//     return res.status(500).json({ ok: false, message: err.message });
//   }
// };

export const upsertWorkLog = async (req, res) => {
    const {
        member_id,
        date,
        work_time,
        total_work_time,
        progress,
        add_time,
    } = req.body;

    if (!member_id || !date) {
        return res.status(400).json({ message: "member_id and date are required" });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
    }

    try {
        const workLog = await Worklog.findOneAndUpdate(
            {
                member: String(member_id),
                date: date,
            },
            {
                $set: {
                    member: String(member_id),
                    date: date,
                    real_time: work_time,
                    total_time: total_work_time,
                    efficiency: progress,
                },
                $setOnInsert: {
                    add_time: add_time ? String(add_time) : '0',
                },
            },
            {
                upsert: true,
                new: true,
                runValidators: true,
            }
        );
        console.log(`Upserted work log for member_id=${member_id} date=${date}: real_time=${work_time}, add_time=${add_time}, total_time=${total_work_time}, progress=${progress}`);
        return res.status(200).json(workLog);
    } catch (err) {
        console.error(err);

        if (err.code === 11000) {
            return res.status(409).json({
                message: "Duplicate work log entry (unique constraint violation)",
                error: err.message
            });
        }

        return res.status(500).json({ message: "Server error", error: err.message });
    }
};

const DEFAULT_TARGET_MINUTES = 13 * 60 + 30;
const STATIC_TARGET_PRESETS = [
  { key: 'NO_TARGET', label: 'No Target', minutes: 0 },
  { key: '12H', label: '12h 00m', minutes: 12 * 60 },
  { key: '13H_30M', label: '13h 30m', minutes: 13 * 60 + 30 },
  { key: '15H_30M', label: '15h 30m', minutes: 15 * 60 + 30 },
];
const TARGET_ELIGIBLE_ROLES = new Set([ROLES.GROUP_MEMBER, ROLES.GROUP_BOSS]);

const isValidMonth = (month) => /^\d{4}-\d{2}$/.test(month || '');

const formatTarget = (minutes) => {
  if (!minutes) return 'No Target';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

export const getWorktimeTargets = async (req, res) => {
  try {
    const { month } = req.query;
    if (!isValidMonth(month)) {
      return res.status(400).json({ ok: false, message: 'month is required in YYYY-MM format' });
    }

    const users = await User.find({ status: 'active' })
      .select('_id name email group role degree avatarUrl')
      .sort({ name: 1 })
      .lean();

    const groupBossByGroup = new Map();
    users.forEach((u) => {
      const normalized = normalizeRole(u.role, u.degree);
      if (normalized === ROLES.GROUP_BOSS && u.group && !groupBossByGroup.has(u.group)) {
        groupBossByGroup.set(u.group, {
          id: u._id,
          name: u.name,
          email: u.email || '',
          avatarUrl: u.avatarUrl || '',
        });
      }
    });

    const targetUsers = users.filter((u) =>
      TARGET_ELIGIBLE_ROLES.has(normalizeRole(u.role, u.degree))
    );

    const targets = await WorktimeTarget.find({
      month,
      userId: { $in: targetUsers.map((u) => u._id) },
    })
      .select('userId targetMinutes month')
      .lean();

    const byUserId = new Map(targets.map((t) => [String(t.userId), t]));

    const data = targetUsers.map((u) => {
      const existing = byUserId.get(String(u._id));
      const targetMinutes = existing?.targetMinutes ?? DEFAULT_TARGET_MINUTES;
      const boss = u.group ? groupBossByGroup.get(u.group) : null;
      return {
        userId: u._id,
        name: u.name,
        email: u.email,
        group: u.group || null,
        avatarUrl: u.avatarUrl || '',
        month,
        targetMinutes,
        targetLabel: formatTarget(targetMinutes),
        isCustom: !!existing,
        groupBoss: boss || null,
      };
    });

    const customPresets = await WorktimeTargetPreset.find({ active: true })
      .sort({ createdAt: 1 })
      .select('key title label description color minutes')
      .lean();

    return res.json({
      ok: true,
      data: {
        month,
        defaultTargetMinutes: DEFAULT_TARGET_MINUTES,
        presets: [...STATIC_TARGET_PRESETS, ...customPresets],
        users: data,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

export const upsertWorktimeTarget = async (req, res) => {
  try {
    const { userId, month, targetMinutes } = req.body;
    if (!userId) return res.status(400).json({ ok: false, message: 'userId is required' });
    if (!isValidMonth(month)) {
      return res.status(400).json({ ok: false, message: 'month is required in YYYY-MM format' });
    }
    if (typeof targetMinutes !== 'number' || targetMinutes < 0 || targetMinutes > 24 * 60) {
      return res
        .status(400)
        .json({ ok: false, message: 'targetMinutes must be a number between 0 and 1440' });
    }

    const user = await User.findById(userId).select('_id role degree status').lean();
    if (!user || user.status !== 'active') {
      return res.status(404).json({ ok: false, message: 'Active user not found' });
    }
    if (!TARGET_ELIGIBLE_ROLES.has(normalizeRole(user.role, user.degree))) {
      return res.status(400).json({ ok: false, message: 'Only group members and group bosses can have targets' });
    }

    const doc = await WorktimeTarget.findOneAndUpdate(
      { userId, month },
      {
        $set: {
          targetMinutes,
          updatedBy: req.user?.id || null,
        },
        $setOnInsert: {
          createdBy: req.user?.id || null,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    return res.json({
      ok: true,
      data: {
        userId: doc.userId,
        month: doc.month,
        targetMinutes: doc.targetMinutes,
        targetLabel: formatTarget(doc.targetMinutes),
      },
      message: 'Target updated successfully',
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

export const deleteWorktimeTarget = async (req, res) => {
  try {
    const { userId, month } = req.params;
    if (!userId) return res.status(400).json({ ok: false, message: 'userId is required' });
    if (!isValidMonth(month)) {
      return res.status(400).json({ ok: false, message: 'month is required in YYYY-MM format' });
    }

    await WorktimeTarget.findOneAndDelete({ userId, month });
    return res.json({ ok: true, message: 'Target removed (fallbacks to default)' });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

const makePresetKey = () =>
  `CUSTOM_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`.toUpperCase();

export const createWorktimeTargetPreset = async (req, res) => {
  try {
    const { title, label, description = '', color = '#8b5cf6', minutes } = req.body;
    if (!title || !label) {
      return res.status(400).json({ ok: false, message: 'title and label are required' });
    }
    if (typeof minutes !== 'number' || minutes < 0 || minutes > 24 * 60) {
      return res
        .status(400)
        .json({ ok: false, message: 'minutes must be a number between 0 and 1440' });
    }
    if (!/^#([A-Fa-f0-9]{6})$/.test(color)) {
      return res.status(400).json({ ok: false, message: 'color must be a hex code like #8b5cf6' });
    }

    const preset = await WorktimeTargetPreset.create({
      key: makePresetKey(),
      title: String(title).trim(),
      label: String(label).trim(),
      description: String(description).trim(),
      color,
      minutes,
      createdBy: req.user?.id || null,
      updatedBy: req.user?.id || null,
    });

    return res.json({ ok: true, data: preset, message: 'Preset created' });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

export const updateWorktimeTargetPreset = async (req, res) => {
  try {
    const { presetId } = req.params;
    const { title, label, description = '', color, minutes } = req.body;
    if (!presetId) return res.status(400).json({ ok: false, message: 'presetId is required' });
    if (!title || !label) {
      return res.status(400).json({ ok: false, message: 'title and label are required' });
    }
    if (typeof minutes !== 'number' || minutes < 0 || minutes > 24 * 60) {
      return res
        .status(400)
        .json({ ok: false, message: 'minutes must be a number between 0 and 1440' });
    }
    if (!/^#([A-Fa-f0-9]{6})$/.test(color || '')) {
      return res.status(400).json({ ok: false, message: 'color must be a hex code like #8b5cf6' });
    }

    const updated = await WorktimeTargetPreset.findByIdAndUpdate(
      presetId,
      {
        $set: {
          title: String(title).trim(),
          label: String(label).trim(),
          description: String(description).trim(),
          color,
          minutes,
          updatedBy: req.user?.id || null,
        },
      },
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ ok: false, message: 'Preset not found' });
    return res.json({ ok: true, data: updated, message: 'Preset updated' });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

export const deleteWorktimeTargetPreset = async (req, res) => {
  try {
    const { presetId } = req.params;
    if (!presetId) return res.status(400).json({ ok: false, message: 'presetId is required' });
    const existing = await WorktimeTargetPreset.findById(presetId).lean();
    if (!existing) return res.status(404).json({ ok: false, message: 'Preset not found' });
    await WorktimeTargetPreset.findByIdAndDelete(presetId);
    return res.json({ ok: true, message: 'Preset removed' });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

export const getWorktimeHubstaffUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .select('_id name email group role degree status avatarUrl hubstaff_id')
      .sort({ name: 1 })
      .lean();

    const data = users
      .map((u) => ({
        userId: u._id,
        name: u.name,
        email: u.email || '',
        group: u.group || null,
        status: u.status || 'pending',
        avatarUrl: u.avatarUrl || '',
        role: normalizeRole(u.role, u.degree),
        hubstaffId: u.hubstaff_id || '',
        hasHubstaffId: !!u.hubstaff_id,
      }))
      .filter((u) => !isNonMemberRole(u.role))
      .sort((a, b) => {
        const g1 = a.group || 'No Group';
        const g2 = b.group || 'No Group';
        if (g1 !== g2) return g1.localeCompare(g2);
        return a.name.localeCompare(b.name);
      });

    return res.json({ ok: true, data: { users: data } });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

export const upsertWorktimeHubstaffId = async (req, res) => {
  try {
    const { userId, hubstaffId } = req.body;
    if (!userId) return res.status(400).json({ ok: false, message: 'userId is required' });

    const normalized = String(hubstaffId || '').trim();
    if (normalized && !/^\d+$/.test(normalized)) {
      return res.status(400).json({ ok: false, message: 'hubstaffId must contain digits only' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
    if (isNonMemberRole(user.role, user.degree)) {
      return res.status(400).json({ ok: false, message: 'Cannot set Hubstaff ID for super admin, admin or finance manager' });
    }

    user.hubstaff_id = normalized || null;
    await user.save();

    return res.json({
      ok: true,
      data: {
        userId: user._id,
        hubstaffId: user.hubstaff_id || '',
        hasHubstaffId: !!user.hubstaff_id,
      },
      message: 'Hubstaff ID updated',
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

const isValidISODate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
/** Today on the EST clock, the calendar this system runs on. */
const toTodayISO = () => getESTDateKey();

const MAX_DETAIL_RANGE_DAYS = 62;

/**
 * GET /api/workflow/manual-time-detail
 * Read: any authenticated user (same as chart visibility). Writes: Super Admin only (PATCH/DELETE).
 * (?userId & date_from & date_to, date_to exclusive like chart API)
 */
export const getManualTimeDetail = async (req, res) => {
  try {
    const { userId, date_from, date_to } = req.query;

    if (!userId || !isValidISODate(date_from) || !isValidISODate(date_to)) {
      return res.status(400).json({
        ok: false,
        message: 'userId, date_from, and date_to (YYYY-MM-DD) are required',
      });
    }
    if (!(date_from < date_to)) {
      return res.status(400).json({ ok: false, message: 'date_to must be after date_from' });
    }

    let span = 0;
    for (let dk = date_from; dk < date_to; dk = addUtcDays(dk, 1)) {
      span += 1;
      if (span > MAX_DETAIL_RANGE_DAYS) {
        return res.status(400).json({
          ok: false,
          message: `Range too large (max ${MAX_DETAIL_RANGE_DAYS} days)`,
        });
      }
    }

    const user = await User.findById(userId)
      .select('name email group hubstaff_id avatarUrl status')
      .lean();
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

    if (user.status !== 'active') {
      return res.status(400).json({ ok: false, message: 'User is not active' });
    }
    if (!user.hubstaff_id) {
      return res.status(400).json({ ok: false, message: 'User has no Hubstaff ID' });
    }

    const hub = String(user.hubstaff_id);
    const logs = await Worklog.find({
      member: hub,
      date: { $gte: date_from, $lt: date_to },
    })
      .select('date real_time add_time note manualAdjustments')
      .lean();

    const byDate = new Map(logs.map((w) => [String(w.date), w]));

    const days = [];
    let rangeTracked = 0;
    let rangeAdded = 0;
    let rangePending = 0;

    for (let dk = date_from; dk < date_to; dk = addUtcDays(dk, 1)) {
      const row = byDate.get(dk) || null;
      const tracked = row ? Math.max(0, Math.floor(Number(row.real_time) || 0)) : 0;
      const adjustments = adjustmentsForDayResponseFromWorklog(row);
      const added = adjustments.length
        ? sumManualAdjustmentSeconds(adjustments)
        : row
          ? Math.max(0, Math.floor(Number(row.add_time) || 0))
          : 0;
      const pending = sumPendingAdjustmentSeconds(adjustments);
      rangeTracked += tracked;
      rangeAdded += added;
      rangePending += pending;
      days.push({
        date: dk,
        worklogId: row?._id ? String(row._id) : null,
        trackedSeconds: tracked,
        addedSeconds: added,
        pendingSeconds: pending,
        adjustments,
      });
    }

    return res.json({
      ok: true,
      data: {
        userId: String(userId),
        name: user.name || '',
        email: user.email || '',
        group: user.group || '',
        hubstaffId: hub,
        avatarUrl: user.avatarUrl || '',
        dateFrom: date_from,
        dateTo: date_to,
        rangeTrackedSeconds: rangeTracked,
        rangeAddedSeconds: rangeAdded,
        rangePendingSeconds: rangePending,
        days,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

/**
 * PATCH /api/workflow/manual-time-entry
 * Body: { worklogId | (userId + date), entryId, seconds, description, shortReason? }
 */
export const patchManualAdjustment = async (req, res) => {
  try {
    const { worklogId, userId, date, entryId, seconds, description, shortReason } = req.body;

    if (!entryId) {
      return res.status(400).json({ ok: false, message: 'entryId is required' });
    }
    const nextSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    const nextDesc = String(description ?? '').trim().slice(0, 4000);
    // Only update shortReason when the field is sent; preserve it otherwise.
    const hasShortReason = shortReason !== undefined;
    const nextShortReason = String(shortReason ?? '').trim().slice(0, 120);

    let worklog = null;
    if (worklogId && mongoose.Types.ObjectId.isValid(String(worklogId))) {
      worklog = await Worklog.findById(worklogId);
    } else if (userId && isValidISODate(date)) {
      const user = await User.findById(userId).select('hubstaff_id').lean();
      if (!user?.hubstaff_id) {
        return res.status(400).json({ ok: false, message: 'User not found or missing Hubstaff ID' });
      }
      worklog = await Worklog.findOne({ member: String(user.hubstaff_id), date });
    }

    if (!worklog) {
      return res.status(404).json({ ok: false, message: 'Worklog not found' });
    }

    if (String(entryId) === LEGACY_MANUAL_ADJUSTMENT_ID) {
      worklog.manualAdjustments = [{ seconds: nextSeconds, description: nextDesc, shortReason: nextShortReason }];
      syncManualTotalsIntoWorklog(worklog);
      if (nextDesc) worklog.note = nextDesc;
      await worklog.save();
      return res.json({
        ok: true,
        data: { worklogId: String(worklog._id), adjustments: adjustmentsForDayResponseFromWorklog(worklog) },
      });
    }

    const sub = worklog.manualAdjustments.id(String(entryId));
    if (!sub) {
      return res.status(404).json({ ok: false, message: 'Adjustment entry not found' });
    }
    sub.seconds = nextSeconds;
    // A ranged entry keeps its start; the end follows the new length (cleared past 24:00).
    if (sub.startTime) {
      const startRange = validateTimeRange(sub.startTime, '24:00');
      const endMin = startRange.ok ? startRange.startMin + Math.round(nextSeconds / 60) : null;
      if (endMin !== null && endMin <= 24 * 60 && endMin > startRange.startMin) {
        sub.endTime = formatTimeOfDay(endMin);
      } else {
        sub.startTime = '';
        sub.endTime = '';
      }
    }
    sub.description = nextDesc;
    if (hasShortReason) sub.shortReason = nextShortReason;
    syncManualTotalsIntoWorklog(worklog);
    if (nextDesc) worklog.note = nextDesc;
    await worklog.save();

    return res.json({
      ok: true,
      data: { worklogId: String(worklog._id), adjustments: adjustmentsForDayResponseFromWorklog(worklog) },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

/**
 * DELETE /api/workflow/manual-time-entry
 * Body: { worklogId | (userId + date), entryId }
 */
export const deleteManualAdjustment = async (req, res) => {
  try {
    const { worklogId, userId, date, entryId } = req.body;

    if (!entryId) {
      return res.status(400).json({ ok: false, message: 'entryId is required' });
    }

    let worklog = null;
    if (worklogId && mongoose.Types.ObjectId.isValid(String(worklogId))) {
      worklog = await Worklog.findById(worklogId);
    } else if (userId && isValidISODate(date)) {
      const user = await User.findById(userId).select('hubstaff_id').lean();
      if (!user?.hubstaff_id) {
        return res.status(400).json({ ok: false, message: 'User not found or missing Hubstaff ID' });
      }
      worklog = await Worklog.findOne({ member: String(user.hubstaff_id), date });
    }

    if (!worklog) {
      return res.status(404).json({ ok: false, message: 'Worklog not found' });
    }

    if (String(entryId) === LEGACY_MANUAL_ADJUSTMENT_ID) {
      worklog.manualAdjustments = [];
      syncManualTotalsIntoWorklog(worklog);
      worklog.note = '';
      await worklog.save();
      return res.json({ ok: true, data: { worklogId: String(worklog._id) } });
    }

    if (!mongoose.Types.ObjectId.isValid(String(entryId))) {
      return res.status(400).json({ ok: false, message: 'Invalid entry id' });
    }
    const beforeLen = worklog.manualAdjustments.length;
    worklog.manualAdjustments.pull({ _id: new mongoose.Types.ObjectId(String(entryId)) });
    if (worklog.manualAdjustments.length === beforeLen) {
      return res.status(404).json({ ok: false, message: 'Adjustment entry not found' });
    }
    syncManualTotalsIntoWorklog(worklog);
    if (!worklog.manualAdjustments.length) worklog.note = '';
    await worklog.save();

    return res.json({ ok: true, data: { worklogId: String(worklog._id) } });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

/**
 * GET /api/workflow/manual-time/pending   (super admin / admin)
 * Added time that group bosses submitted and that is waiting for approval.
 */
export const listPendingManualTime = async (req, res) => {
  try {
    const logs = await Worklog.find({ 'manualAdjustments.status': ADJ_STATUS.PENDING })
      .select('member date manualAdjustments')
      .sort({ date: 1 })
      .limit(1000)
      .lean();

    const members = [...new Set(logs.map((w) => String(w.member)))];
    const users = members.length
      ? await User.find({ hubstaff_id: { $in: members } }).select('name group hubstaff_id avatarUrl').lean()
      : [];
    const userByHub = new Map(users.map((u) => [String(u.hubstaff_id), u]));

    const items = [];
    for (const w of logs) {
      const u = userByHub.get(String(w.member)) || null;
      for (const adj of w.manualAdjustments || []) {
        if (adjustmentStatusOf(adj) !== ADJ_STATUS.PENDING) continue;
        items.push({
          worklogId: String(w._id),
          entryId: String(adj._id),
          date: w.date,
          seconds: adjustmentSeconds(adj),
          shortReason: adj.shortReason || '',
          description: adj.description || '',
          userId: u?._id ? String(u._id) : null,
          userName: u?.name || `Hubstaff ${w.member}`,
          group: u?.group || '',
          avatarUrl: u?.avatarUrl || '',
          addedByName: adj.addedByName || '',
          addedAt: adj.createdAt || null,
          startTime: adj.startTime || '',
          endTime: adj.endTime || '',
          screenshotUrl: adj.screenshotUrl || '',
          hubstaffId: String(w.member || ''),
        });
      }
    }
    items.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.userName).localeCompare(String(b.userName)));
    return res.json({ ok: true, data: { items, count: items.length } });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

/**
 * POST /api/workflow/manual-time/review   (super admin / admin)
 * Body: { worklogId, entryId, action: 'approve' | 'reject', reason? }
 * Only a pending entry can be reviewed; the status flip is atomic, so two
 * reviewers cannot both act on the same entry.
 */
export const reviewManualTime = async (req, res) => {
  try {
    const { worklogId, entryId, action } = req.body || {};
    const reason = String(req.body?.reason ?? '').trim().slice(0, 500);
    if (!mongoose.Types.ObjectId.isValid(String(worklogId)) || !mongoose.Types.ObjectId.isValid(String(entryId))) {
      return res.status(400).json({ ok: false, message: 'worklogId and entryId are required' });
    }
    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ ok: false, message: "action must be 'approve' or 'reject'" });
    }
    const nextStatus = action === 'approve' ? ADJ_STATUS.APPROVED : ADJ_STATUS.REJECTED;
    const entryOid = new mongoose.Types.ObjectId(String(entryId));

    const updated = await Worklog.findOneAndUpdate(
      {
        _id: worklogId,
        manualAdjustments: { $elemMatch: { _id: entryOid, status: ADJ_STATUS.PENDING } },
      },
      {
        $set: {
          'manualAdjustments.$.status': nextStatus,
          'manualAdjustments.$.reviewedByUserId': req.user?._id,
          'manualAdjustments.$.reviewedByName': String(req.user?.name || ''),
          'manualAdjustments.$.reviewedAt': new Date(),
          'manualAdjustments.$.rejectReason': nextStatus === ADJ_STATUS.REJECTED ? reason : '',
        },
      },
      { new: true }
    );

    if (!updated) {
      const exists = await Worklog.exists({ _id: worklogId, 'manualAdjustments._id': entryOid });
      return exists
        ? res.status(409).json({ ok: false, message: 'This entry has already been reviewed' })
        : res.status(404).json({ ok: false, message: 'Entry not found' });
    }

    // Recount add_time / total_time from the approved entries inside the
    // database, so two reviews of the same day can never leave a stale total.
    const sub = updated.manualAdjustments.id(entryOid);
    const approvedSum = {
      $sum: {
        $map: {
          input: {
            $filter: {
              input: { $ifNull: ['$manualAdjustments', []] },
              cond: { $eq: [{ $ifNull: ['$$this.status', ADJ_STATUS.APPROVED] }, ADJ_STATUS.APPROVED] },
            },
          },
          in: { $max: [0, { $floor: { $ifNull: ['$$this.seconds', 0] } }] },
        },
      },
    };
    const recount = {
      add_time: { $toString: approvedSum },
      total_time: { $max: [0, { $add: [{ $ifNull: ['$real_time', 0] }, approvedSum] }] },
    };
    if (nextStatus === ADJ_STATUS.APPROVED && sub?.description) {
      recount.note = { $literal: String(sub.description) };
    }
    await Worklog.updateOne({ _id: updated._id }, [{ $set: recount }]);

    const hrs = Math.floor((sub?.seconds || 0) / 3600);
    const mins = Math.floor(((sub?.seconds || 0) % 3600) / 60);
    return res.json({
      ok: true,
      data: { worklogId: String(updated._id), entryId: String(entryOid), status: nextStatus },
      message: nextStatus === ADJ_STATUS.APPROVED
        ? `Approved ${hrs}h ${mins}m on ${updated.date}`
        : `Rejected ${hrs}h ${mins}m on ${updated.date}`,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

/** The Hubstaff organization ID and its two-weekly reminder state. */
const hubstaffOrgPayload = (doc) => {
  const { currentDue, nextDue } = orgIdDueDates();
  return {
    organizationId: doc?.organizationId || '',
    updatedAt: doc?.organizationIdUpdatedAt || null,
    updatedByName: doc?.organizationIdUpdatedByName || '',
    currentDue,
    nextDue,
    needsUpdate: orgIdNeedsUpdate(doc),
  };
};

/** GET /api/workflow/hubstaff-org  (any signed-in user: the ID builds the Hubstaff links) */
export const getHubstaffOrg = async (req, res) => {
  try {
    const doc = await HubstaffSettings.getSingleton();
    return res.json({ ok: true, data: hubstaffOrgPayload(doc) });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

/** PUT /api/workflow/hubstaff-org  { organizationId }  (super admin / admin) */
export const updateHubstaffOrg = async (req, res) => {
  try {
    const organizationId = String(req.body?.organizationId ?? '').trim();
    if (!/^\d{1,15}$/.test(organizationId)) {
      return res.status(400).json({ ok: false, message: 'The organization ID is the number in the Hubstaff link (e.g. 795932)' });
    }
    const doc = await HubstaffSettings.getSingleton();
    doc.organizationId = organizationId;
    doc.organizationIdUpdatedAt = new Date();
    doc.organizationIdUpdatedBy = req.user?._id || null;
    doc.organizationIdUpdatedByName = String(req.user?.name || '');
    await doc.save();
    return res.json({ ok: true, data: hubstaffOrgPayload(doc), message: 'Hubstaff organization ID updated' });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

export const getFinalSyncStatus = async (req, res) => {
  try {
    const { date } = req.query;
    if (!isValidISODate(date)) {
      return res.status(400).json({ ok: false, message: 'date is required in YYYY-MM-DD format' });
    }
    const doc = await WorktimeFinalSync.findOne({ date }).lean();
    return res.json({
      ok: true,
      data: {
        date,
        confirmed: !!doc?.confirmed,
        syncedAt: doc?.syncedAt || null,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

/** The Hubstaff hub's sync route when HUB_SYNC_API_URL is not set: `flask run` (5000), then `python app.py` (5001). */
const DEFAULT_HUB_SYNC_URLS = ['http://127.0.0.1:5000/sync-date', 'http://127.0.0.1:5001/sync-date'];

export const triggerFinalSync = async (req, res) => {
  try {
    const { date } = req.body;
    if (!isValidISODate(date)) {
      return res.status(400).json({ ok: false, message: 'date is required in YYYY-MM-DD format' });
    }
    if (date === toTodayISO()) {
      return res.status(400).json({ ok: false, message: 'Final update is not available for today' });
    }

    // Where the Hubstaff hub listens. HUB_SYNC_API_URL in server/.env wins; without
    // it, try the hub's usual addresses: `flask run` / Docker use port 5000,
    // `python app.py` uses 5001 (server/.env is not in git, so a fresh copy has no setting).
    const configured = String(process.env.HUB_SYNC_API_URL || '').trim();
    const candidates = configured ? [configured] : DEFAULT_HUB_SYNC_URLS;
    const timeoutMs = Number(process.env.HUB_SYNC_TIMEOUT_MS || 120000);

    let synced = false;
    let lastProblem = '';
    for (const hubSyncApiUrl of candidates) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const endpoint = `${hubSyncApiUrl}${hubSyncApiUrl.includes('?') ? '&' : '?'}date=${encodeURIComponent(date)}`;
        const response = await fetch(endpoint, { method: 'POST', signal: controller.signal });
        if (response.ok) {
          synced = true;
          break;
        }
        // Something answered but it is not the hub's sync route (e.g. another app on that port): try the next.
        lastProblem = `${hubSyncApiUrl} answered with status ${response.status}`;
        if (configured) break;
      } catch (err) {
        if (err.name === 'AbortError') {
          // The hub was reached but the Hubstaff sync took too long; trying another port would not help.
          return res.status(504).json({ ok: false, message: 'Hub sync timed out' });
        }
        lastProblem = `${hubSyncApiUrl} did not answer (${err.cause?.code || err.message})`;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (!synced) {
      return res.status(502).json({
        ok: false,
        message: configured
          ? `Could not run the Hubstaff hub sync: ${lastProblem}. Check that the hub is running at that address (HUB_SYNC_API_URL in server/.env).`
          : `Could not reach the Hubstaff hub on port 5000 or 5001 (${lastProblem}). Start the hub ("flask run" in the hub folder), or set HUB_SYNC_API_URL in server/.env to its address and restart the server.`,
      });
    }

    await WorktimeFinalSync.findOneAndUpdate(
      { date },
      {
        $set: {
          confirmed: true,
          source: 'hub',
          syncedAt: new Date(),
          syncedBy: req.user?.id || null,
        },
      },
      { upsert: true, new: true }
    );

    return res.json({
      ok: true,
      message: 'Final update completed successfully',
      data: { date, confirmed: true },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};