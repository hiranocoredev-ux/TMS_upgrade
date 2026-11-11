import mongoose from 'mongoose';
import { currentMonthKey } from '../utils/businessMonth.js';
import CompetitionSettings from '../models/CompetitionSettings.js';
import CompetitionRuleDefinition from '../models/CompetitionRuleDefinition.js';
import CompetitionAdjustment from '../models/CompetitionAdjustment.js';
import CompetitionWorktimeDayRule from '../models/CompetitionWorktimeDayRule.js';
import CompetitionWorktimeUserDayRule from '../models/CompetitionWorktimeUserDayRule.js';
import WorktimeTarget from '../models/WorktimeTarget.js';
import User from '../models/User.js';
import { normalizeRole, ROLES, isFullAdminRole, isNonMemberRole, NON_MEMBER_ROLES } from '../constants/roles.js';
import {
  MONTH_RE,
  computeMonthlyLeaderboards,
  buildUserDayBreakdown,
  buildGroupBreakdown,
} from '../services/competitionScoring.js';
import { sendPenaltyAddedNotifications } from '../services/notification.service.js';

// Super admin or admin (competition is not finance)
const isSuperAdmin = (user) => isFullAdminRole(user?.role, user?.degree);

const isGroupBossUser = (user) => normalizeRole(user?.role, user?.degree) === ROLES.GROUP_BOSS;

const adjustmentEventAt = (row) => row?.eventAt || row?.createdAt;

const dateKeyFromAdjustment = (row) => {
  const d = new Date(adjustmentEventAt(row));
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
};

function parseEventAtFromBody(body, month) {
  const { eventAt, eventDate, eventTime } = body || {};
  let d;
  if (eventAt) {
    d = new Date(eventAt);
  } else if (eventDate && DATE_RE.test(String(eventDate))) {
    const t = String(eventTime || '00:00:00').trim() || '00:00:00';
    const parts = t.split(':').map((x) => parseInt(x, 10) || 0);
    const [y, mo, day] = String(eventDate).split('-').map(Number);
    d = new Date(y, mo - 1, day, parts[0] || 0, parts[1] || 0, parts[2] || 0);
  } else {
    d = new Date();
    d.setHours(0, 0, 0, 0);
  }
  if (Number.isNaN(d.getTime())) {
    return { error: 'Invalid event date/time' };
  }
  if (month && MONTH_RE.test(String(month))) {
    const eventMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (eventMonth !== String(month)) {
      return { error: 'Event date must fall within the selected competition month' };
    }
  }
  return { value: d };
}

const sortGroupHistoryEntries = (entries) =>
  entries.sort((a, b) => {
    if (a.sortRank !== b.sortRank) return a.sortRank - b.sortRank;
    if (a.ownerType === 'user' && b.ownerType === 'user') {
      return String(a.targetName || '').localeCompare(String(b.targetName || ''));
    }
    return new Date(b.eventAt) - new Date(a.eventAt);
  });

function mapAdjustmentToHistoryEntry(r, { groupTitle }) {
  const p = Number(r.points) || 0;
  const at = adjustmentEventAt(r);
  const base = {
    _id: r._id,
    kind: r.kind,
    title: r.title,
    description: r.description || '',
    points: p,
    ruleDefinitionId: r.ruleDefinitionId ? String(r.ruleDefinitionId) : '',
    eventAt: at,
    createdAt: at,
  };
  if (r.scope === 'group') {
    return {
      ...base,
      scope: 'group',
      ownerType: 'group',
      ownerLabel: groupTitle || 'Group total',
      userId: '',
      targetName: groupTitle || 'Group total',
      avatarUrl: '',
      isGroupBoss: false,
      sortRank: 0,
    };
  }
  const u = r.userId && typeof r.userId === 'object' ? r.userId : null;
  const boss = u ? isGroupBossUser(u) : false;
  return {
    ...base,
    scope: 'user',
    ownerType: 'user',
    ownerLabel: u?.name || 'Member',
    userId: u?._id ? String(u._id) : String(r.userId || ''),
    targetName: u?.name || '',
    avatarUrl: u?.avatarUrl || '',
    isGroupBoss: boss,
    sortRank: boss ? 1 : 2,
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseMonth(req) {
  const m = (req.query.month || '').trim();
  if (!MONTH_RE.test(m)) return null;
  return m;
}
const DEFAULT_TARGET_MINUTES = 13 * 60 + 30;

export const getSettings = async (req, res) => {
  try {
    const doc = await CompetitionSettings.getSingleton();
    res.json({
      ok: true,
      data: {
        financeWeight: doc.financeWeight,
        worktimeWeight: doc.worktimeWeight,
        updatedAt: doc.updatedAt,
        canEdit: isSuperAdmin(req.user),
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const putSettings = async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Super admin only' });
    }
    const { financeWeight, worktimeWeight } = req.body || {};
    const doc = await CompetitionSettings.getSingleton();
    if (financeWeight !== undefined) doc.financeWeight = Math.max(0, Number(financeWeight) || 0);
    if (worktimeWeight !== undefined) doc.worktimeWeight = Math.max(0, Number(worktimeWeight) || 0);
    doc.updatedBy = req.user._id;
    await doc.save();
    res.json({
      ok: true,
      data: {
        financeWeight: doc.financeWeight,
        worktimeWeight: doc.worktimeWeight,
        updatedAt: doc.updatedAt,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const getWorktimeRules = async (req, res) => {
  try {
    const month = parseMonth(req) || currentMonthKey();
    const [dayRules, userRules, users] = await Promise.all([
      CompetitionWorktimeDayRule.find({ month }).sort({ date: 1 }).lean(),
      CompetitionWorktimeUserDayRule.find({ month })
        .populate('userId', '_id name group role degree avatarUrl')
        .sort({ date: 1, createdAt: 1 })
        .lean(),
      User.find({})
        .select('_id name group role degree avatarUrl')
        .sort({ group: 1, name: 1 })
        .lean(),
    ]);
    const participants = users.filter((u) => !isNonMemberRole(u.role, u.degree));
    res.json({
      ok: true,
      data: {
        month,
        canEdit: isSuperAdmin(req.user),
        dayRules,
        userRules: userRules.map((r) => ({
          ...r,
          user: r.userId
            ? {
                _id: r.userId._id,
                name: r.userId.name,
                group: r.userId.group || '',
                avatarUrl: r.userId.avatarUrl || '',
              }
            : null,
        })),
        users: participants.map((u) => ({
          _id: u._id,
          name: u.name,
          group: u.group || '',
          avatarUrl: u.avatarUrl || '',
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const upsertWorktimeDayRule = async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Super admin only' });
    }
    const { month, date, isHoliday, note = '' } = req.body || {};
    if (!MONTH_RE.test(String(month || '')) || !DATE_RE.test(String(date || ''))) {
      return res.status(400).json({ ok: false, message: 'month/date format invalid' });
    }
    const doc = await CompetitionWorktimeDayRule.findOneAndUpdate(
      { month: String(month), date: String(date) },
      {
        $set: {
          isHoliday: !!isHoliday,
          targetDeltaMinutes: 0,
          reasonType: !!isHoliday ? 'holiday' : '',
          note: String(note || ''),
          updatedBy: req.user._id,
        },
        $setOnInsert: { createdBy: req.user._id },
      },
      { upsert: true, new: true, runValidators: true }
    );
    res.json({ ok: true, data: { rule: doc } });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const deleteWorktimeDayRule = async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Super admin only' });
    }
    const month = String(req.params.month || '');
    const date = String(req.params.date || '');
    if (!MONTH_RE.test(month) || !DATE_RE.test(date)) {
      return res.status(400).json({ ok: false, message: 'month/date format invalid' });
    }
    await CompetitionWorktimeDayRule.findOneAndDelete({ month, date });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const upsertWorktimeUserDayRule = async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Super admin only' });
    }
    const { month, date, userId, targetMinutes, kind, reduceMinutes, note = '' } = req.body || {};
    if (!MONTH_RE.test(String(month || '')) || !DATE_RE.test(String(date || ''))) {
      return res.status(400).json({ ok: false, message: 'month/date format invalid' });
    }
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ ok: false, message: 'valid userId required' });
    }
    const target = await User.findById(userId).select('role degree').lean();
    if (!target || isNonMemberRole(target.role, target.degree)) {
      return res.status(400).json({ ok: false, message: 'invalid competition user' });
    }
    const mode = String(kind || '').trim() || 'reduce';
    if (!['holiday', 'reduce', 'work'].includes(mode)) {
      return res.status(400).json({ ok: false, message: 'kind must be holiday, reduce or work' });
    }
    let minutes = 0;
    let appliedReduce = 0;
    if (mode === 'holiday') {
      minutes = 0;
      appliedReduce = 0;
    } else if (mode === 'work') {
      // A working day on a weekend / holiday: the given target applies as-is.
      const m = Number(targetMinutes);
      if (!Number.isFinite(m) || m <= 0 || m > 1440) {
        return res.status(400).json({ ok: false, message: 'targetMinutes must be 1..1440 for a working day' });
      }
      minutes = m;
      appliedReduce = 0;
    } else if (targetMinutes !== undefined) {
      // Backward compatibility path
      const m = Number(targetMinutes);
      if (!Number.isFinite(m) || m < 0 || m > 1440) {
        return res.status(400).json({ ok: false, message: 'targetMinutes must be 0..1440' });
      }
      minutes = m;
      appliedReduce = Math.max(0, DEFAULT_TARGET_MINUTES - minutes);
    } else {
      const reduce = Number(reduceMinutes);
      if (!Number.isFinite(reduce) || reduce < 0 || reduce > 1440) {
        return res.status(400).json({ ok: false, message: 'reduceMinutes must be 0..1440' });
      }
      const baseTarget = (await WorktimeTarget.findOne({ userId, month }).select('targetMinutes').lean())?.targetMinutes ?? DEFAULT_TARGET_MINUTES;
      appliedReduce = reduce;
      minutes = Math.max(0, Math.min(1440, Number(baseTarget) - reduce));
    }
    const doc = await CompetitionWorktimeUserDayRule.findOneAndUpdate(
      { month: String(month), date: String(date), userId },
      {
        $set: {
          targetMinutes: minutes,
          kind: mode,
          reduceMinutes: appliedReduce,
          note: String(note || ''),
          updatedBy: req.user._id,
        },
        $setOnInsert: { createdBy: req.user._id },
      },
      { upsert: true, new: true, runValidators: true }
    );
    res.json({ ok: true, data: { rule: doc } });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const deleteWorktimeUserDayRule = async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Super admin only' });
    }
    const month = String(req.params.month || '');
    const date = String(req.params.date || '');
    const userId = String(req.params.userId || '');
    if (!MONTH_RE.test(month) || !DATE_RE.test(date) || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ ok: false, message: 'params invalid' });
    }
    await CompetitionWorktimeUserDayRule.findOneAndDelete({ month, date, userId });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const listRuleDefinitions = async (req, res) => {
  try {
    const rules = await CompetitionRuleDefinition.find()
      .sort({ kind: 1, sortOrder: 1, title: 1 })
      .lean();
    res.json({ ok: true, data: { rules, canEdit: isSuperAdmin(req.user) } });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const createRuleDefinition = async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Super admin only' });
    }
    const { kind, title, description, weightPoints, sortOrder, isActive } = req.body || {};
    if (!['penalty', 'bonus'].includes(kind)) {
      return res.status(400).json({ ok: false, message: 'kind must be penalty or bonus' });
    }
    if (!title || !String(title).trim()) {
      return res.status(400).json({ ok: false, message: 'title is required' });
    }
    const mag = Number(weightPoints);
    if (!Number.isFinite(mag) || mag === 0) {
      return res.status(400).json({ ok: false, message: 'weightPoints must be a non-zero number' });
    }
    const rule = await CompetitionRuleDefinition.create({
      kind,
      title: String(title).trim(),
      description: String(description || ''),
      weightPoints: Math.abs(mag),
      sortOrder: sortOrder != null ? Number(sortOrder) : 0,
      isActive: isActive !== false,
      createdBy: req.user._id,
    });
    res.json({ ok: true, data: { rule } });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const updateRuleDefinition = async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Super admin only' });
    }
    const rule = await CompetitionRuleDefinition.findById(req.params.id);
    if (!rule) return res.status(404).json({ ok: false, message: 'Rule not found' });
    const { title, description, weightPoints, sortOrder, isActive, kind } = req.body || {};
    if (kind !== undefined) {
      if (!['penalty', 'bonus'].includes(kind)) {
        return res.status(400).json({ ok: false, message: 'Invalid kind' });
      }
      rule.kind = kind;
    }
    if (title !== undefined) rule.title = String(title).trim();
    if (description !== undefined) rule.description = String(description);
    if (weightPoints !== undefined) rule.weightPoints = Math.abs(Number(weightPoints));
    if (sortOrder !== undefined) rule.sortOrder = Number(sortOrder);
    if (isActive !== undefined) rule.isActive = !!isActive;
    await rule.save();
    res.json({ ok: true, data: { rule } });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const deleteRuleDefinition = async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Super admin only' });
    }
    const r = await CompetitionRuleDefinition.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ ok: false, message: 'Rule not found' });
    res.json({ ok: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const listAdjustments = async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Super admin only' });
    }
    const month = parseMonth(req);
    const q = month ? { month } : {};
    const rows = await CompetitionAdjustment.find(q)
      .sort({ createdAt: -1 })
      .populate('userId', 'name email')
      .populate('createdBy', 'name email')
      .limit(500)
      .lean();
    res.json({ ok: true, data: { adjustments: rows } });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const createAdjustment = async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Super admin only' });
    }
    const {
      month,
      scope,
      userId,
      groupCode,
      kind: kindBody,
      ruleDefinitionId,
      title,
      description,
      points,
    } = req.body || {};
    if (!MONTH_RE.test(String(month || ''))) {
      return res.status(400).json({ ok: false, message: 'month must be YYYY-MM' });
    }
    if (!['user', 'group'].includes(scope)) {
      return res.status(400).json({ ok: false, message: 'scope must be user or group' });
    }
    const parsedEvent = parseEventAtFromBody(req.body, month);
    if (parsedEvent.error) {
      return res.status(400).json({ ok: false, message: parsedEvent.error });
    }
    const eventAt = parsedEvent.value;

    let finalTitle = title ? String(title).trim() : '';
    let pointsVal = Number(points);
    let ruleRef = ruleDefinitionId ? String(ruleDefinitionId) : null;
    let kind = kindBody;

    if (ruleRef) {
      const rule = await CompetitionRuleDefinition.findById(ruleRef);
      if (!rule) return res.status(400).json({ ok: false, message: 'Rule definition not found' });
      kind = rule.kind;
      if (!finalTitle) finalTitle = rule.title;
      const mag = Math.abs(Number(rule.weightPoints));
      const base = kind === 'penalty' ? -mag : mag;
      if (Number.isFinite(pointsVal) && pointsVal !== 0) {
        if (kind === 'penalty' && pointsVal > 0) pointsVal = -Math.abs(pointsVal);
        if (kind === 'bonus' && pointsVal < 0) pointsVal = Math.abs(pointsVal);
      } else {
        pointsVal = base;
      }
    } else {
      if (!kind || !['penalty', 'bonus'].includes(kind)) {
        return res.status(400).json({ ok: false, message: 'kind must be penalty or bonus (or pass ruleDefinitionId)' });
      }
      if (!finalTitle) {
        return res.status(400).json({ ok: false, message: 'title required when no ruleDefinitionId' });
      }
      if (!Number.isFinite(pointsVal)) {
        return res.status(400).json({ ok: false, message: 'points required when no ruleDefinitionId' });
      }
      if (kind === 'penalty' && pointsVal > 0) pointsVal = -Math.abs(pointsVal);
      if (kind === 'bonus' && pointsVal < 0) pointsVal = Math.abs(pointsVal);
    }

    if (scope === 'user') {
      if (!userId || !mongoose.isValidObjectId(userId)) {
        return res.status(400).json({ ok: false, message: 'userId required for user scope' });
      }
      const target = await User.findById(userId).select('role degree').lean();
      if (!target) return res.status(404).json({ ok: false, message: 'User not found' });
      if (isNonMemberRole(target.role, target.degree)) {
        return res.status(400).json({ ok: false, message: 'Cannot adjust competition for super admin, admin or finance manager' });
      }
      const row = await CompetitionAdjustment.create({
        month: String(month).trim(),
        scope: 'user',
        userId,
        kind,
        ruleDefinitionId: ruleRef,
        title: finalTitle,
        description: String(description || ''),
        points: pointsVal,
        eventAt,
        createdBy: req.user._id,
      });
      if (kind === 'penalty') {
        await sendPenaltyAddedNotifications({
          userId,
          penaltyTitle: finalTitle,
          points: pointsVal,
        });
      }
      return res.json({ ok: true, data: { adjustment: row } });
    }

    const g = groupCode !== undefined ? String(groupCode).trim() : '';
    const row = await CompetitionAdjustment.create({
      month: String(month).trim(),
      scope: 'group',
      groupCode: g,
      kind,
      ruleDefinitionId: ruleRef,
      title: finalTitle,
      description: String(description || ''),
      points: pointsVal,
      eventAt,
      createdBy: req.user._id,
    });
    res.json({ ok: true, data: { adjustment: row } });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const updateAdjustment = async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Super admin only' });
    }
    const adj = await CompetitionAdjustment.findById(req.params.id);
    if (!adj) return res.status(404).json({ ok: false, message: 'Not found' });

    const { ruleDefinitionId, description, title, points, eventAt, eventDate, eventTime } = req.body || {};

    if (description !== undefined) {
      adj.description = String(description || '');
    }

    if (eventAt !== undefined || eventDate !== undefined || eventTime !== undefined) {
      const parsedEvent = parseEventAtFromBody(req.body, adj.month);
      if (parsedEvent.error) {
        return res.status(400).json({ ok: false, message: parsedEvent.error });
      }
      adj.eventAt = parsedEvent.value;
    }

    if (ruleDefinitionId !== undefined && ruleDefinitionId !== null && String(ruleDefinitionId).trim() !== '') {
      const rule = await CompetitionRuleDefinition.findById(ruleDefinitionId);
      if (!rule) return res.status(400).json({ ok: false, message: 'Rule definition not found' });
      adj.ruleDefinitionId = rule._id;
      adj.kind = rule.kind;
      if (title === undefined) adj.title = rule.title;
      const mag = Math.abs(Number(rule.weightPoints));
      let pointsVal =
        Number.isFinite(Number(points)) && Number(points) !== 0
          ? Number(points)
          : rule.kind === 'penalty'
            ? -mag
            : mag;
      if (adj.kind === 'penalty' && pointsVal > 0) pointsVal = -Math.abs(pointsVal);
      if (adj.kind === 'bonus' && pointsVal < 0) pointsVal = Math.abs(pointsVal);
      adj.points = pointsVal;
    } else {
      if (title !== undefined) {
        const trimmed = String(title).trim();
        if (!trimmed) return res.status(400).json({ ok: false, message: 'title cannot be empty' });
        adj.title = trimmed;
      }
      if (points !== undefined) {
        let pointsVal = Number(points);
        if (!Number.isFinite(pointsVal) || pointsVal === 0) {
          return res.status(400).json({ ok: false, message: 'points must be a non-zero number' });
        }
        if (adj.kind === 'penalty' && pointsVal > 0) pointsVal = -Math.abs(pointsVal);
        if (adj.kind === 'bonus' && pointsVal < 0) pointsVal = Math.abs(pointsVal);
        adj.points = pointsVal;
      }
    }

    await adj.save();
    res.json({ ok: true, data: { adjustment: adj } });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const deleteAdjustment = async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ ok: false, message: 'Super admin only' });
    }
    const r = await CompetitionAdjustment.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ ok: false, message: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const getDashboard = async (req, res) => {
  try {
    const month = parseMonth(req) || currentMonthKey();
    const settings = await CompetitionSettings.getSingleton();
    const leaderboards = await computeMonthlyLeaderboards(month, settings);
    res.json({
      ok: true,
      data: {
        month,
        settings: {
          financeWeight: settings.financeWeight,
          worktimeWeight: settings.worktimeWeight,
        },
        users: leaderboards.users,
        groups: leaderboards.groups,
        canAdmin: isSuperAdmin(req.user),
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const getUserDetail = async (req, res) => {
  try {
    const month = parseMonth(req) || currentMonthKey();
    const uid = req.query.userId || req.params.userId;
    if (!uid || !mongoose.isValidObjectId(uid)) {
      return res.status(400).json({ ok: false, message: 'userId required' });
    }
    const user = await User.findById(uid)
      .select('name email group hubstaff_id role degree')
      .lean();
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
    if (isNonMemberRole(user.role, user.degree)) {
      return res.status(404).json({ ok: false, message: 'Not found' });
    }

    const settings = await CompetitionSettings.getSingleton();
    const leaderboards = await computeMonthlyLeaderboards(month, settings);
    const summary = leaderboards.users.find((u) => String(u.userId) === String(uid));

    const breakdown = await buildUserDayBreakdown(month, user, settings);

    res.json({
      ok: true,
      data: {
        month,
        user: { _id: user._id, name: user.name, email: user.email, group: user.group || '' },
        summary,
        breakdown,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const getGroupDetail = async (req, res) => {
  try {
    const month = parseMonth(req) || currentMonthKey();
    const groupCode = req.query.groupCode !== undefined ? String(req.query.groupCode) : '';

    const settings = await CompetitionSettings.getSingleton();
    const leaderboards = await computeMonthlyLeaderboards(month, settings);
    const detail = await buildGroupBreakdown(month, groupCode, leaderboards);

    res.json({
      ok: true,
      data: {
        month,
        detail,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const getHistorySummary = async (req, res) => {
  try {
    const month = parseMonth(req) || currentMonthKey();

    const users = await User.find({})
      .select('_id name group avatarUrl role degree')
      .lean();
    const participantUsers = users.filter((u) => !isNonMemberRole(u.role, u.degree));
    const userMap = new Map(participantUsers.map((u) => [String(u._id), u]));

    const rows = await CompetitionAdjustment.find({ month })
      .sort({ createdAt: -1 })
      .populate('userId', '_id name group avatarUrl')
      .lean();

    const byUser = new Map();
    const byGroup = new Map();

    const ensureUser = (u) => {
      const id = String(u._id);
      if (!byUser.has(id)) {
        byUser.set(id, {
          userId: u._id,
          name: u.name,
          group: u.group || '',
          role: u.role || '',
          degree: u.degree || '',
          avatarUrl: u.avatarUrl || '',
          totalPoints: 0,
          penaltyPoints: 0,
          bonusPoints: 0,
          entriesCount: 0,
          lastAt: null,
        });
      }
      return byUser.get(id);
    };
    const ensureGroup = (code) => {
      const key = String(code || '');
      if (!byGroup.has(key)) {
        byGroup.set(key, {
          groupCode: key,
          groupLabel: key || 'Unassigned',
          totalPoints: 0,
          penaltyPoints: 0,
          bonusPoints: 0,
          entriesCount: 0,
          lastAt: null,
        });
      }
      return byGroup.get(key);
    };

    // initialize cards for all users / groups even if no entries
    participantUsers.forEach((u) => {
      ensureUser(u);
      ensureGroup(u.group || '');
    });

    for (const r of rows) {
      const points = Number(r.points) || 0;
      const isPenalty = String(r.kind) === 'penalty';
      if (r.scope === 'user' && r.userId) {
        const uDoc = userMap.get(String(r.userId._id || r.userId)) || r.userId;
        if (!uDoc) continue;
        const uc = ensureUser(uDoc);
        uc.totalPoints += points;
        if (isPenalty) uc.penaltyPoints += points;
        else uc.bonusPoints += points;
        uc.entriesCount += 1;
        if (!uc.lastAt || new Date(adjustmentEventAt(r)) > new Date(uc.lastAt)) {
          uc.lastAt = adjustmentEventAt(r);
        }
      }

      const gCode =
        r.scope === 'group'
          ? String(r.groupCode || '')
          : String((r.userId?.group || userMap.get(String(r.userId?._id || r.userId))?.group || ''));
      const gc = ensureGroup(gCode);
      gc.totalPoints += points;
      if (isPenalty) gc.penaltyPoints += points;
      else gc.bonusPoints += points;
      gc.entriesCount += 1;
      if (!gc.lastAt || new Date(adjustmentEventAt(r)) > new Date(gc.lastAt)) {
        gc.lastAt = adjustmentEventAt(r);
      }
    }

    const groupCards = [...byGroup.values()].sort((a, b) => b.totalPoints - a.totalPoints);
    const userCards = [...byUser.values()].sort((a, b) => b.totalPoints - a.totalPoints);

    res.json({
      ok: true,
      data: {
        month,
        groupCards,
        userCards,
        canAdmin: isSuperAdmin(req.user),
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const getHistoryDetail = async (req, res) => {
  try {
    const month = parseMonth(req) || currentMonthKey();
    const scope = String(req.query.scope || '');
    if (!['group', 'user'].includes(scope)) {
      return res.status(400).json({ ok: false, message: 'scope must be group or user' });
    }

    let rows = [];
    let title = '';
    let groupMembers = [];

    if (scope === 'user') {
      const userId = String(req.query.userId || '');
      if (!mongoose.isValidObjectId(userId)) {
        return res.status(400).json({ ok: false, message: 'Valid userId required' });
      }
      const user = await User.findById(userId).select('_id name group avatarUrl role degree').lean();
      if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
      if (isNonMemberRole(user.role, user.degree)) {
        return res.status(404).json({ ok: false, message: 'Not found' });
      }
      title = `${user.name}`;
      rows = await CompetitionAdjustment.find({ month, scope: 'user', userId })
        .sort({ createdAt: -1 })
        .populate('createdBy', 'name')
        .lean();
    } else {
      const groupCode = String(req.query.groupCode || '');
      title = groupCode || 'Unassigned';
      const members = await User.find({
        status: 'active',
        role: { $nin: NON_MEMBER_ROLES },
        group: groupCode,
      })
        .select('_id name role degree avatarUrl')
        .lean();
      const eligibleMembers = members.filter(
        (u) => !isNonMemberRole(u.role, u.degree)
      );
      groupMembers = eligibleMembers
        .map((u) => ({
          userId: u._id,
          name: u.name,
          avatarUrl: u.avatarUrl || '',
          role: u.role || '',
          degree: u.degree || '',
          isGroupBoss: isGroupBossUser(u),
        }))
        .sort((a, b) => {
          if (a.isGroupBoss !== b.isGroupBoss) return a.isGroupBoss ? -1 : 1;
          return String(a.name || '').localeCompare(String(b.name || ''));
        });
      const userIds = eligibleMembers.map((u) => u._id);
      const [groupRows, memberRows] = await Promise.all([
        CompetitionAdjustment.find({ month, scope: 'group', groupCode })
          .sort({ createdAt: -1 })
          .populate('createdBy', 'name')
          .lean(),
        userIds.length
          ? CompetitionAdjustment.find({ month, scope: 'user', userId: { $in: userIds } })
              .sort({ createdAt: -1 })
              .populate('userId', '_id name avatarUrl role degree')
              .populate('createdBy', 'name')
              .lean()
          : [],
      ]);
      rows = [...groupRows, ...memberRows].sort(
        (a, b) => new Date(adjustmentEventAt(b)) - new Date(adjustmentEventAt(a))
      );
    }

    const byDay = new Map();
    for (const r of rows) {
      const dateKey = dateKeyFromAdjustment(r);
      if (!byDay.has(dateKey)) {
        byDay.set(dateKey, {
          date: dateKey,
          totalPoints: 0,
          penaltyPoints: 0,
          bonusPoints: 0,
          entries: [],
        });
      }
      const day = byDay.get(dateKey);
      const p = Number(r.points) || 0;
      day.totalPoints += p;
      if (String(r.kind) === 'penalty') day.penaltyPoints += p;
      else day.bonusPoints += p;
      day.entries.push(mapAdjustmentToHistoryEntry(r, { groupTitle: title }));
    }

    if (scope === 'group') {
      for (const day of byDay.values()) {
        sortGroupHistoryEntries(day.entries);
      }
    }

    const daily = [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date));
    const summary = daily.reduce(
      (acc, d) => {
        acc.totalPoints += d.totalPoints;
        acc.penaltyPoints += d.penaltyPoints;
        acc.bonusPoints += d.bonusPoints;
        acc.days += 1;
        acc.entries += d.entries.length;
        return acc;
      },
      { totalPoints: 0, penaltyPoints: 0, bonusPoints: 0, days: 0, entries: 0 }
    );

    res.json({
      ok: true,
      data: {
        month,
        scope,
        title,
        summary,
        daily,
        members: groupMembers,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};