import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

import Profile from '../models/Profile.js';
import User from '../models/User.js';
import FileMeta from '../models/FileMeta.js';
import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';
import { log as auditLog, getRequestMeta } from '../utils/audit.js';
import { profilePermissions } from '../utils/permissions/entityPermissions.js';
import { createModuleUpload } from '../middleware/upload.middleware.js';
import { encrypt as rawEncrypt, decrypt as rawDecrypt } from '../utils/encryption.js';
import {
  PROFILE_STATUSES,
  PROFILE_SEX_VALUES,
  PROFILE_WORK_ROLE_VALUES,
  WORKING_ROLE_VALUES,
  CONTACT_HANDLE_PLATFORMS,
  PLATFORM_CREDENTIAL_STATUSES,
  DEFAULT_PLATFORM_CREDENTIAL_STATUS,
  WORKING_ROLES,
  REMOTE_TOOLS,
  BUYER_TYPES,
  CURRENCY_CODES,
  DEFAULT_CURRENCY,
  REVEALABLE_SECTIONS,
} from '../constants/profiles.js';

const UPLOAD_MODULE = 'profiles';

/* ============================================================
   ENCRYPTION
============================================================ */

const requireEncryptionKey = () => {
  if (!process.env.ENCRYPTION_KEY) {
    const err = new Error('ENCRYPTION_KEY is not configured.');
    err.code = 'CONFIG_ERROR';
    err.statusCode = 500;
    throw err;
  }
};

const enc = (plain) => {
  if (plain === undefined || plain === null) return '';
  const s = String(plain);
  if (!s) return '';
  requireEncryptionKey();
  return rawEncrypt(s);
};

const dec = (cipher) => {
  if (!cipher) return '';
  requireEncryptionKey();
  try { return rawDecrypt(cipher); } catch { return ''; }
};

/* ============================================================
   VALIDATION
============================================================ */

const URL_RE = /^https?:\/\/.+/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inRange = (n, lo, hi) => Number.isFinite(n) && n >= lo && n <= hi;

/**
 * Validate an incoming `ownerUserId`. Ownership of a client profile can only sit
 * with a hunting-profile member — that's the role responsible for the record —
 * so the target user must carry `hunting_profile` in their workingRoles and be
 * an active account. Returns `{ error }` or `{ ownerUserId }`.
 */
const resolveOwnerUserId = async (rawId) => {
  if (!mongoose.isValidObjectId(rawId)) {
    return { error: 'ownerUserId must be a valid user id' };
  }
  const target = await User.findById(rawId).select('workingRoles status name').lean();
  if (!target) return { error: 'Owner user not found' };
  if (target.status === 'disabled') return { error: 'Owner user is disabled' };
  const roles = Array.isArray(target.workingRoles) ? target.workingRoles : [];
  if (!roles.includes(WORKING_ROLES.HUNTING_PROFILE)) {
    return { error: 'Profile owner must be a member with the Hunting Profile working role' };
  }
  return { ownerUserId: target._id };
};

const validateProfile = (data, { isUpdate = false } = {}) => {
  const errs = [];

  if (!isUpdate) {
    if (!data.name || !String(data.name).trim()) errs.push('Name is required');
  }

  if (data.name !== undefined && String(data.name).length > 200) errs.push('Name must be 200 chars or fewer');
  if (data.status !== undefined && !PROFILE_STATUSES.includes(data.status)) errs.push(`Invalid status`);
  if (data.sex !== undefined && !PROFILE_SEX_VALUES.includes(data.sex)) errs.push('Invalid sex');
  if (data.countryCode !== undefined && data.countryCode && !/^[A-Za-z]{2}$/.test(data.countryCode)) {
    errs.push('countryCode must be ISO 3166-1 alpha-2');
  }
  if (data.age !== undefined && data.age !== null && data.age !== '') {
    const n = Number(data.age);
    if (!inRange(n, 0, 150)) errs.push('Age must be 0–150');
  }
  if (data.statusScore !== undefined && data.statusScore !== null && data.statusScore !== '') {
    const n = Number(data.statusScore);
    if (!inRange(n, 0, 5)) errs.push('Status score must be 0–5');
  }
  for (const p of ['clientSharePercent', 'internalHiringSharePercent']) {
    if (data[p] !== undefined && data[p] !== null && data[p] !== '') {
      const n = Number(data[p]);
      if (!inRange(n, 0, 100)) errs.push(`${p} must be 0–100`);
    }
  }
  if (data.email && !EMAIL_RE.test(String(data.email).trim())) errs.push('Invalid email');
  if (data.currency !== undefined && data.currency && !CURRENCY_CODES.includes(data.currency)) {
    errs.push('Invalid currency');
  }
  for (const f of ['linkedinUrl', 'githubUrl', 'websiteUrl']) {
    if (data[f] && !URL_RE.test(String(data[f]).trim())) errs.push(`Invalid URL for ${f}`);
  }
  if (Array.isArray(data.workingRoles)) {
    for (const c of data.workingRoles) {
      if (!PROFILE_WORK_ROLE_VALUES.includes(c)) { errs.push(`Unknown working role: ${c}`); break; }
    }
  }
  if (data.callerUserId && !mongoose.isValidObjectId(data.callerUserId)) {
    errs.push('callerUserId must be a valid user id');
  }
  if (data.ownerUserId !== undefined && data.ownerUserId !== null && data.ownerUserId !== '') {
    if (!mongoose.isValidObjectId(data.ownerUserId)) errs.push('ownerUserId must be a valid user id');
  }
  if (Array.isArray(data.contactHandles)) {
    for (const h of data.contactHandles) {
      if (h && h.platform && !CONTACT_HANDLE_PLATFORMS.includes(h.platform)) {
        errs.push(`Unknown contact platform: ${h.platform}`); break;
      }
    }
  }
  if (Array.isArray(data.workingRoleTabs)) {
    for (const t of data.workingRoleTabs) {
      if (!t || !PROFILE_WORK_ROLE_VALUES.includes(t.role)) {
        errs.push('Each working-role tab must have a valid `role`'); break;
      }
      if (Array.isArray(t.devices)) {
        for (const d of t.devices) {
          if (d.buyerType && !BUYER_TYPES.includes(d.buyerType)) { errs.push(`Invalid device buyerType`); break; }
          if (d.buyerUserId && !mongoose.isValidObjectId(d.buyerUserId)) { errs.push('Invalid buyerUserId'); break; }
          if (d.remoteTool && d.remoteTool !== '' && !REMOTE_TOOLS.includes(d.remoteTool)) {
            errs.push(`Invalid remoteTool: ${d.remoteTool}`); break;
          }
          if (d.currency && !CURRENCY_CODES.includes(d.currency)) { errs.push(`Invalid device currency`); break; }
        }
      }
      if (Array.isArray(t.platformCredentials)) {
        for (const c of t.platformCredentials) {
          if (c && c.status !== undefined && !PLATFORM_CREDENTIAL_STATUSES.includes(c.status)) {
            errs.push(`Invalid platform credential status: ${c.status}`); break;
          }
        }
      }
      if (Array.isArray(t.managers)) {
        for (const m of t.managers) {
          if (!m || !m.userId || !mongoose.isValidObjectId(m.userId)) {
            errs.push('Each tab manager must include a valid userId'); break;
          }
        }
      }
    }
  }
  return errs;
};

/* ============================================================
   NORMALIZATION — encrypt secrets, dedupe, merge
============================================================ */

const mergeEncryptedField = (incoming, existing, key) => {
  if (incoming[key] === undefined) return existing[key] || '';
  const v = incoming[key];
  // Distinguish: explicit null = clear; empty string = preserve (form's stored placeholder).
  if (v === null) return '';
  if (v === '') return existing[key] || '';
  return enc(String(v));
};

const normalizeDevice = (incoming = {}, existing = {}) => ({
  ...(incoming._id ? { _id: incoming._id } : {}),
  detail: String(incoming.detail || '').trim(),
  price: Number(incoming.price) || 0,
  currency: CURRENCY_CODES.includes(incoming.currency) ? incoming.currency : DEFAULT_CURRENCY,
  buyerType: BUYER_TYPES.includes(incoming.buyerType) ? incoming.buyerType : 'client',
  buyerUserId: incoming.buyerType === 'user' && mongoose.isValidObjectId(incoming.buyerUserId)
    ? incoming.buyerUserId
    : null,
  remoteEnabled: !!incoming.remoteEnabled,
  remoteTool: (incoming.remoteTool && REMOTE_TOOLS.includes(incoming.remoteTool)) ? incoming.remoteTool : '',
  remoteToolCustomName: String(incoming.remoteToolCustomName || '').trim(),
  remoteId: mergeEncryptedField(incoming, existing, 'remoteId'),
  remotePassword: mergeEncryptedField(incoming, existing, 'remotePassword'),
  notes: String(incoming.notes || ''),
});

const normalizeTab = (incoming = {}, existing = {}) => {
  const existingDevices = (existing.devices || []).reduce((m, d) => {
    m[String(d._id)] = (d.toObject ? d.toObject() : d);
    return m;
  }, {});
  const devices = Array.isArray(incoming.devices)
    ? incoming.devices.map((d) => normalizeDevice(d, (d._id && existingDevices[String(d._id)]) || {}))
    : (existing.devices || []);

  // Platform credentials — merge encrypted fields against existing.
  const existingCreds = (existing.platformCredentials || []).reduce((m, c) => {
    m[String(c._id)] = (c.toObject ? c.toObject() : c);
    return m;
  }, {});
  const platformCredentials = Array.isArray(incoming.platformCredentials)
    ? incoming.platformCredentials.map((c) => normalizePlatformCredential(
        c, (c._id && existingCreds[String(c._id)]) || {}
      ))
    : (existing.platformCredentials || []);

  // Dedup managers by userId; default isActive true.
  const seen = new Map();
  for (const m of (incoming.managers || [])) {
    if (!m || !m.userId || !mongoose.isValidObjectId(m.userId)) continue;
    const k = String(m.userId);
    if (!seen.has(k)) seen.set(k, { userId: m.userId, isActive: m.isActive !== false });
  }
  return {
    ...(incoming._id ? { _id: incoming._id } : {}),
    role: incoming.role,
    startedAt: incoming.startedAt !== undefined
      ? String(incoming.startedAt || '').trim()
      : (existing.startedAt || ''),
    devices,
    platformCredentials,
    managers: [...seen.values()],
    notes: incoming.notes !== undefined ? String(incoming.notes || '') : (existing.notes || ''),
  };
};

const normalizePlatformCredential = (incoming = {}, existing = {}) => {
  // Dedup ACL by userId; preserve isActive (default true for new entries).
  const seen = new Map();
  for (const m of (incoming.allowedMembers || [])) {
    if (!m || !m.userId || !mongoose.isValidObjectId(m.userId)) continue;
    const k = String(m.userId);
    if (!seen.has(k)) seen.set(k, { userId: m.userId, isActive: m.isActive !== false });
  }
  return {
    ...(incoming._id ? { _id: incoming._id } : {}),
    platform: String(incoming.platform || '').trim(),
    status: PLATFORM_CREDENTIAL_STATUSES.includes(incoming.status)
      ? incoming.status
      : (existing.status || DEFAULT_PLATFORM_CREDENTIAL_STATUS),
    hint: String(incoming.hint || '').trim(),
    gmail: mergeEncryptedField(incoming, existing, 'gmail'),
    password: mergeEncryptedField(incoming, existing, 'password'),
    notes: String(incoming.notes || ''),
    allowedMembers: [...seen.values()],
  };
};

/**
 * Merge incoming workingRoleTabs against existing. Match by role. Preserve
 * tabs whose role no longer appears in `profile.workingRoles` (so a re-check
 * of the role doesn't lose stored data).
 */
const normalizeWorkingRoleTabs = (incoming = [], existing = []) => {
  const existingByRole = new Map();
  for (const t of existing) {
    const o = t.toObject ? t.toObject() : t;
    existingByRole.set(String(o.role), o);
  }
  const result = [];
  const seenRoles = new Set();
  for (const t of incoming) {
    if (!t || !PROFILE_WORK_ROLE_VALUES.includes(t.role)) continue;
    if (seenRoles.has(t.role)) continue;
    seenRoles.add(t.role);
    result.push(normalizeTab(t, existingByRole.get(String(t.role)) || {}));
  }
  // Append existing tabs we haven't seen in the payload — preserve stored data.
  for (const [role, t] of existingByRole) {
    if (!seenRoles.has(role)) {
      result.push(t);
    }
  }
  return result;
};

/* ============================================================
   SANITIZATION — apply per-user view permissions
============================================================ */

const maskDevice = (d = {}) => ({
  _id: d._id,
  detail: d.detail || '',
  price: Number(d.price) || 0,
  currency: d.currency || DEFAULT_CURRENCY,
  buyerType: d.buyerType || 'client',
  buyerUserId: d.buyerUserId || null,
  remoteEnabled: !!d.remoteEnabled,
  remoteTool: d.remoteTool || '',
  remoteToolCustomName: d.remoteToolCustomName || '',
  hasRemoteId: !!d.remoteId,
  hasRemotePassword: !!d.remotePassword,
  notes: d.notes || '',
});

const maskPlatformCredential = (c = {}, viewerIsTabEditor, viewerUserId) => {
  // `allowedMembers` is exposed only to tab editors (privacy: regular users
  // shouldn't see who else has access). Each viewer also learns whether they
  // themselves are active for this credential — drives the reveal button.
  const allowedMembers = viewerIsTabEditor
    ? (c.allowedMembers || []).map((m) => ({
        _id: m._id,
        userId: m.userId,
        isActive: !!m.isActive,
      }))
    : [];
  const isViewerActive = (c.allowedMembers || []).some((m) => {
    if (!m) return false;
    const mid = (m.userId && m.userId._id) ? String(m.userId._id) : String(m.userId || '');
    return mid === String(viewerUserId || '') && !!m.isActive;
  });
  return {
    _id: c._id,
    platform: c.platform || '',
    status: c.status || DEFAULT_PLATFORM_CREDENTIAL_STATUS,
    hint: c.hint || '',
    notes: c.notes || '',
    hasGmail: !!c.gmail,
    hasPassword: !!c.password,
    allowedMembers,
    viewerCanReveal: viewerIsTabEditor || isViewerActive,
  };
};

const maskTab = (t = {}, profileClientShare = 0, perms = {}, viewerUserId = null) => {
  const transactions = (t.transactions || []).map((tx) => {
    const income = Number(tx.income) || 0;
    const given = +(income * (profileClientShare / 100)).toFixed(2);
    return {
      _id: tx._id,
      income,
      given,
      profit: +(income - given).toFixed(2),
      description: tx.description || '',
      date: tx.date || '',
      currency: tx.currency || DEFAULT_CURRENCY,
      createdByUserId: tx.createdByUserId || null,
      createdAt: tx.createdAt,
    };
  });
  const subtotalIncoming = transactions.reduce((s, x) => s + x.income, 0);
  const subtotalGiven = +(subtotalIncoming * (profileClientShare / 100)).toFixed(2);
  const subtotalProfit = +(subtotalIncoming - subtotalGiven).toFixed(2);
  const viewerIsTabEditor = !!(perms && perms.canEdit);
  return {
    _id: t._id,
    role: t.role,
    startedAt: t.startedAt || '',
    notes: t.notes || '',
    devices: (t.devices || []).map(maskDevice),
    platformCredentials: (t.platformCredentials || []).map(
      (c) => maskPlatformCredential(c, viewerIsTabEditor, viewerUserId)
    ),
    managers: (t.managers || []).map((m) => ({
      _id: m._id,
      userId: m.userId,
      isActive: !!m.isActive,
    })),
    transactions,
    subtotals: {
      incoming: +subtotalIncoming.toFixed(2),
      given: subtotalGiven,
      profit: subtotalProfit,
    },
  };
};

/**
 * Build the response object, applying section/tab permissions. Non-viewable
 * sections are omitted entirely so a normal user can't even infer them.
 */
const buildResponseProfile = (profile, user) => {
  if (!profile) return profile;
  const p = profile.toObject ? profile.toObject() : profile;
  const perms = profilePermissions.getPermissions(user, p);

  // Compute totals from per-tab transactions (server-side source of truth).
  const clientShare = Math.max(0, Math.min(100, Number(p.clientSharePercent) || 0));
  let totalIncoming = 0;
  for (const tab of (p.workingRoleTabs || [])) {
    for (const tx of (tab.transactions || [])) {
      totalIncoming += Number(tx.income) || 0;
    }
  }
  const totalGiven = +(totalIncoming * (clientShare / 100)).toFixed(2);
  const totalProfit = +(totalIncoming - totalGiven).toFixed(2);

  const base = {
    _id: p._id,
    ownerUserId: p.ownerUserId,
    huntingOwnerId: p.huntingOwnerId,
    status: p.status,
    group: p.group || '',
    // Base info — always visible
    name: p.name,
    countryCode: p.countryCode || '',
    address: p.address || '',
    age: p.age ?? null,
    sex: p.sex || '',
    statusScore: typeof p.statusScore === 'number' ? p.statusScore : 0,
    workingRoles: p.workingRoles || [],
    currency: p.currency || DEFAULT_CURRENCY,
    // Derived totals (always visible) — read-only on the form.
    totalIncomingFund: +totalIncoming.toFixed(2),
    totalGivenFund: totalGiven,
    totalProfitFund: totalProfit,
    callSupportEnabled: !!p.callSupportEnabled,
    callerUserId: p.callerUserId || null,
    comment: p.comment || '',
    pictureFileId: p.pictureFileId || null,
    tags: p.tags || [],
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };

  if (perms.canViewContact) {
    base.email = p.email || '';
    base.phone = p.phone || '';
    base.contactHandles = p.contactHandles || [];
    base.linkedinUrl = p.linkedinUrl || '';
    base.githubUrl = p.githubUrl || '';
    base.websiteUrl = p.websiteUrl || '';
  }

  if (perms.canViewContract) {
    base.clientSharePercent = Number(p.clientSharePercent) || 0;
    base.internalHiringSharePercent = Number(p.internalHiringSharePercent) || 0;
  }

  // Only include tabs the requester can view
  base.workingRoleTabs = (p.workingRoleTabs || [])
    .filter((t) => perms.tabs[t.role] && perms.tabs[t.role].canView)
    .map((t) => maskTab(t, clientShare, perms.tabs[t.role], user && user._id));

  return { profile: base, permissions: perms };
};

/* ============================================================
   ASSIGNMENT — apply incoming body, gated per section/tab
============================================================ */

const assignFields = (profile, body, user, { isCreate }) => {
  /**
   * On create, the hunting owner is always the requester. Seed it into the
   * synthetic profile passed to the perm resolver so a `hunting_profile`
   * user's ownership check (`isHuntingOwnerOf`) succeeds for the about-to-be
   * created record — otherwise `canEditBase` returns false, `body.name` is
   * silently dropped, and Mongoose throws "Path `name` is required."
   */
  const permProfile = isCreate
    ? { workingRoles: body.workingRoles || [], huntingOwnerId: user._id }
    : profile;
  const perms = profilePermissions.getPermissions(user, permProfile);

  if (isCreate) {
    // ownerUserId is set (and role-validated) by createProfile before this runs.
    profile.huntingOwnerId = user._id;          // immutable thereafter
    profile.status = 'active';
  }

  /* -------- Base info (triad) -------- */
  if (perms.canEditBase) {
    if (body.name !== undefined) profile.name = String(body.name).trim();
    if (body.status !== undefined) profile.status = body.status;
    if (body.group !== undefined) profile.group = body.group || '';
    if (body.countryCode !== undefined) profile.countryCode = String(body.countryCode || '').toUpperCase();
    if (body.address !== undefined) profile.address = body.address || '';
    if (body.age !== undefined) profile.age = body.age === '' || body.age === null ? undefined : Number(body.age);
    if (body.sex !== undefined) profile.sex = body.sex || '';
    if (body.statusScore !== undefined) {
      const n = Number(body.statusScore);
      profile.statusScore = Number.isFinite(n) ? Math.max(0, Math.min(5, n)) : 0;
    }
    if (Array.isArray(body.workingRoles)) {
      profile.workingRoles = Array.from(new Set(
        body.workingRoles.filter((c) => PROFILE_WORK_ROLE_VALUES.includes(c))
      ));
    }
    if (body.currency !== undefined) {
      profile.currency = CURRENCY_CODES.includes(body.currency) ? body.currency : DEFAULT_CURRENCY;
    }
    // totalIncomingFund / totalGivenFund / totalProfitFund are NOT inputs — derived from transactions on read.
    if (body.callSupportEnabled !== undefined) {
      profile.callSupportEnabled = !!body.callSupportEnabled;
      if (!profile.callSupportEnabled) profile.callerUserId = null;
    }
    if (body.callerUserId !== undefined) {
      const id = body.callerUserId;
      profile.callerUserId = (id && mongoose.isValidObjectId(id)) ? id : null;
    }
    if (body.comment !== undefined) profile.comment = body.comment || '';
    if (Array.isArray(body.tags)) {
      profile.tags = body.tags.map((t) => String(t || '').trim()).filter(Boolean);
    }
  }

  /* -------- Contact info (triad) -------- */
  if (perms.canEditContact) {
    if (body.email !== undefined) profile.email = String(body.email || '').trim();
    if (body.phone !== undefined) profile.phone = body.phone || '';
    if (body.linkedinUrl !== undefined) profile.linkedinUrl = body.linkedinUrl || '';
    if (body.githubUrl !== undefined) profile.githubUrl = body.githubUrl || '';
    if (body.websiteUrl !== undefined) profile.websiteUrl = body.websiteUrl || '';
    if (Array.isArray(body.contactHandles)) {
      profile.contactHandles = body.contactHandles.map((h) => ({
        platform: CONTACT_HANDLE_PLATFORMS.includes(h.platform) ? h.platform : 'custom',
        customLabel: String(h.customLabel || '').trim(),
        handle: String(h.handle || '').trim(),
      }));
    }
  }

  /* -------- Contract info (triad) -------- */
  if (perms.canEditContract) {
    for (const f of ['clientSharePercent', 'internalHiringSharePercent']) {
      if (body[f] !== undefined) {
        const n = Number(body[f]);
        profile[f] = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
      }
    }
  }

  /* -------- Working-role tabs (per-tab gating) -------- */
  if (Array.isArray(body.workingRoleTabs)) {
    // Pre-build existing-by-role map so we can selectively merge.
    const existingByRole = new Map();
    for (const t of (profile.workingRoleTabs || [])) {
      const o = t.toObject ? t.toObject() : t;
      existingByRole.set(String(o.role), o);
    }

    // Start from a copy of existing tabs
    const next = [...existingByRole.values()];
    for (const incomingTab of body.workingRoleTabs) {
      if (!incomingTab || !PROFILE_WORK_ROLE_VALUES.includes(incomingTab.role)) continue;
      if (!profilePermissions.canEditTab(user, profile, incomingTab.role)) continue;
      const existing = existingByRole.get(String(incomingTab.role)) || {};
      const merged = normalizeTab(incomingTab, existing);
      const idx = next.findIndex((t) => String(t.role) === String(incomingTab.role));
      if (idx >= 0) next[idx] = { ...next[idx], ...merged, _id: next[idx]._id || merged._id };
      else next.push(merged);
    }
    profile.workingRoleTabs = next;
  }

  /**
   * Prune tabs whose role is no longer in `workingRoles`. The chip picker in
   * Base Info is the source of truth — deselecting a role removes its tab.
   * Only an editor of base info can have triggered this change; non-admin
   * users can't toggle workingRoles, so their tabs survive untouched.
   */
  if (perms.canEditBase && Array.isArray(profile.workingRoles)) {
    const activeRoles = new Set(profile.workingRoles);
    profile.workingRoleTabs = (profile.workingRoleTabs || []).filter((t) => activeRoles.has(t.role));
  }
};

/* ============================================================
   CRUD
============================================================ */

const populateProfile = (q) => q
  .populate('ownerUserId', 'email name avatarUrl')
  .populate('huntingOwnerId', 'email name avatarUrl')
  .populate('callerUserId', 'email name avatarUrl')
  .populate('pictureFileId')
  .populate('workingRoleTabs.managers.userId', 'name email avatarUrl workingRole')
  .populate('workingRoleTabs.devices.buyerUserId', 'name email avatarUrl');

export const listProfiles = async (req, res, next) => {
  try {
    const {
      status, group, country, workingRole, manager,
      search, page = '1', limit = '20',
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (group) query.group = group;
    if (country) query.countryCode = String(country).toUpperCase();
    if (workingRole) {
      if (!PROFILE_WORK_ROLE_VALUES.includes(workingRole)) {
        return res.status(400).json(createErrorResponse(
          'INVALID_WORKING_ROLE', `Invalid working role`, 400
        ));
      }
      query.workingRoles = workingRole;
    }
    if (manager && mongoose.isValidObjectId(manager)) {
      query['workingRoleTabs.managers.userId'] = manager;
    }
    if (search) {
      const s = String(search).trim();
      if (s) {
        query.$or = [
          { name: { $regex: s, $options: 'i' } },
          { tags: { $regex: s, $options: 'i' } },
          { comment: { $regex: s, $options: 'i' } },
        ];
      }
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    // Restrict hunting-profile users to profiles they own (or where they are
    // an active tab manager via a secondary role). Admins see everything.
    const visFilter = profilePermissions.listVisibilityFilter(req.user);
    const finalQuery = (visFilter && Object.keys(visFilter).length)
      ? { $and: [query, visFilter] }
      : query;

    const [profiles, total] = await Promise.all([
      populateProfile(
        Profile.find(finalQuery).sort({ createdAt: -1 }).skip(skip).limit(limitNum)
      ),
      Profile.countDocuments(finalQuery),
    ]);

    res.json(createSuccessResponse({
      profiles: profiles.map((p) => buildResponseProfile(p, req.user).profile),
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
      permissions: { canCreate: profilePermissions.canCreate(req.user) },
    }));
  } catch (err) { next(err); }
};

export const getProfile = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json(createErrorResponse('INVALID_ID', 'Invalid profile id', 400));
    }
    const profile = await populateProfile(Profile.findById(req.params.id));
    if (!profile) return res.status(404).json(createErrorResponse('NOT_FOUND', 'Profile not found', 404));
    // Block direct URL access for hunting-profile users on profiles they don't
    // own (and aren't actively managing). Return 404 — not 403 — so the
    // existence of other profiles isn't leaked.
    if (!profilePermissions.canView(req.user, profile)) {
      return res.status(404).json(createErrorResponse('NOT_FOUND', 'Profile not found', 404));
    }
    const built = buildResponseProfile(profile, req.user);
    res.json(createSuccessResponse(built));
  } catch (err) { next(err); }
};

export const createProfile = async (req, res, next) => {
  try {
    if (!profilePermissions.canCreate(req.user)) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED', 'You do not have permission to create profiles', 403
      ));
    }
    const errs = validateProfile(req.body, { isUpdate: false });
    if (errs.length) return res.status(400).json(createErrorResponse('VALIDATION_ERROR', errs[0], 400));

    // An explicit owner must be a hunting-profile member; otherwise the creator owns it.
    let ownerUserId = req.user._id;
    if (req.body.ownerUserId) {
      const resolved = await resolveOwnerUserId(req.body.ownerUserId);
      if (resolved.error) {
        return res.status(400).json(createErrorResponse('VALIDATION_ERROR', resolved.error, 400));
      }
      ownerUserId = resolved.ownerUserId;
    }

    const profile = new Profile({
      ownerUserId,
      huntingOwnerId: req.user._id,
      status: 'active',
    });
    assignFields(profile, req.body, req.user, { isCreate: true });
    await profile.save();

    const populated = await populateProfile(Profile.findById(profile._id));
    await auditLog(req, 'PROFILE_CREATE', 'PROFILE', profile._id.toString(), {
      ...getRequestMeta(req),
      profile: { name: profile.name, status: profile.status },
    });

    res.status(201).json(createSuccessResponse(buildResponseProfile(populated, req.user), 'Profile created successfully'));
  } catch (err) { next(err); }
};

export const updateProfile = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json(createErrorResponse('INVALID_ID', 'Invalid profile id', 400));
    }
    const profile = await Profile.findById(req.params.id);
    if (!profile) return res.status(404).json(createErrorResponse('NOT_FOUND', 'Profile not found', 404));

    const editPerm = profilePermissions.canEdit(req.user, profile);
    if (!editPerm.canEdit) {
      return res.status(403).json(createErrorResponse('ACCESS_DENIED', editPerm.reason, 403));
    }
    const errs = validateProfile(req.body, { isUpdate: true });
    if (errs.length) return res.status(400).json(createErrorResponse('VALIDATION_ERROR', errs[0], 400));

    const oldValues = {
      name: profile.name,
      status: profile.status,
      statusScore: profile.statusScore,
      workingRoles: [...(profile.workingRoles || [])],
      ownerUserId: String(profile.ownerUserId || ''),
    };

    assignFields(profile, req.body, req.user, { isCreate: false });

    /**
     * Owner reassignment. Only a base-info editor may hand a profile to another
     * hunting-profile member. Applied AFTER assignFields: that call re-derives
     * permissions from the profile object, so mutating the owner first would
     * make the editor fail their own canEditBase check and silently drop every
     * other field in this request. `assignFields` never touches ownerUserId, so
     * the check below still sees the pre-change owner.
     */
    if (req.body.ownerUserId !== undefined && req.body.ownerUserId !== null && req.body.ownerUserId !== '') {
      const nextOwner = String(req.body.ownerUserId);
      if (nextOwner !== String(profile.ownerUserId || '')) {
        if (!profilePermissions.canEditBase(req.user, profile)) {
          return res.status(403).json(createErrorResponse(
            'ACCESS_DENIED', 'You do not have permission to change the profile owner', 403
          ));
        }
        const resolved = await resolveOwnerUserId(nextOwner);
        if (resolved.error) {
          return res.status(400).json(createErrorResponse('VALIDATION_ERROR', resolved.error, 400));
        }
        profile.ownerUserId = resolved.ownerUserId;
      }
    }

    await profile.save();
    const populated = await populateProfile(Profile.findById(profile._id));

    await auditLog(req, 'PROFILE_UPDATE', 'PROFILE', profile._id.toString(), {
      ...getRequestMeta(req),
      oldValues,
      newValues: {
        name: profile.name,
        status: profile.status,
        statusScore: profile.statusScore,
        workingRoles: [...(profile.workingRoles || [])],
        ownerUserId: String(profile.ownerUserId || ''),
      },
    });

    res.json(createSuccessResponse(buildResponseProfile(populated, req.user), 'Profile updated successfully'));
  } catch (err) { next(err); }
};

export const deleteProfile = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json(createErrorResponse('INVALID_ID', 'Invalid profile id', 400));
    }
    const profile = await Profile.findById(req.params.id);
    if (!profile) return res.status(404).json(createErrorResponse('NOT_FOUND', 'Profile not found', 404));
    if (!profilePermissions.canDelete(req.user)) {
      return res.status(403).json(createErrorResponse('ACCESS_DENIED', 'No permission to delete', 403));
    }

    // Best-effort cleanup: the profile's avatar (the only profile-owned file in this schema).
    if (profile.pictureFileId) {
      const meta = await FileMeta.findById(profile.pictureFileId);
      if (meta) {
        try {
          const fp = path.isAbsolute(meta.storagePath) ? meta.storagePath : path.join(process.cwd(), meta.storagePath);
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
        } catch {}
        try { await meta.deleteOne(); } catch {}
      }
    }

    await profile.deleteOne();
    await auditLog(req, 'PROFILE_DELETE', 'PROFILE', profile._id.toString(), {
      ...getRequestMeta(req),
      profile: { name: profile.name },
    });
    res.json(createSuccessResponse(null, 'Profile deleted successfully'));
  } catch (err) { next(err); }
};

/* ============================================================
   REVEAL — decrypt the remote credentials inside one tab.
============================================================ */

const decryptDevice = (d = {}) => ({
  _id: d._id,
  remoteId: dec(d.remoteId),
  remotePassword: dec(d.remotePassword),
});

const decryptPlatformCredential = (c = {}) => ({
  _id: c._id,
  gmail: dec(c.gmail),
  password: dec(c.password),
});

export const revealTabDevices = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json(createErrorResponse('INVALID_ID', 'Invalid profile id', 400));
    }
    const role = String(req.params.role || '').trim();
    if (!PROFILE_WORK_ROLE_VALUES.includes(role)) {
      return res.status(400).json(createErrorResponse('INVALID_ROLE', 'Invalid working role', 400));
    }
    const profile = await Profile.findById(req.params.id).lean();
    if (!profile) return res.status(404).json(createErrorResponse('NOT_FOUND', 'Profile not found', 404));

    if (!profilePermissions.canRevealTab(req.user, profile, role)) {
      return res.status(403).json(createErrorResponse('ACCESS_DENIED', 'No permission to reveal', 403));
    }

    const tab = (profile.workingRoleTabs || []).find((t) => t.role === role);
    if (!tab) return res.status(404).json(createErrorResponse('NOT_FOUND', `No tab for role ${role}`, 404));

    const devices = (tab.devices || []).map(decryptDevice);
    // Tab editors (super admin / group boss of role) also see all platform credentials
    // here, so the form can pre-populate gmail+password inputs in one round trip.
    const platformCredentials = (tab.platformCredentials || []).map(decryptPlatformCredential);

    await auditLog(req, 'PROFILE_TAB_REVEAL', 'PROFILE', profile._id.toString(), {
      ...getRequestMeta(req),
      role,
    });

    res.json(createSuccessResponse({ role, devices, platformCredentials }));
  } catch (err) { next(err); }
};

/**
 * Reveal the gmail + password of a single platform credential. Allowed for
 * tab editors (super admin / group-boss of role) OR a regular user listed as
 * an ACTIVE member of this specific credential.
 */
export const revealPlatformCredential = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json(createErrorResponse('INVALID_ID', 'Invalid profile id', 400));
    }
    const role = String(req.params.role || '').trim();
    const credentialId = String(req.params.credentialId || '').trim();
    if (!PROFILE_WORK_ROLE_VALUES.includes(role)) {
      return res.status(400).json(createErrorResponse('INVALID_ROLE', 'Invalid working role', 400));
    }
    if (!mongoose.isValidObjectId(credentialId)) {
      return res.status(400).json(createErrorResponse('INVALID_ID', 'Invalid credential id', 400));
    }
    const profile = await Profile.findById(req.params.id).lean();
    if (!profile) return res.status(404).json(createErrorResponse('NOT_FOUND', 'Profile not found', 404));

    if (!profilePermissions.canRevealPlatformCredential(req.user, profile, role, credentialId)) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You are not listed as an active member of this credential',
        403
      ));
    }

    const tab = (profile.workingRoleTabs || []).find((t) => t.role === role);
    if (!tab) return res.status(404).json(createErrorResponse('NOT_FOUND', `No tab for role ${role}`, 404));
    const cred = (tab.platformCredentials || []).find((c) => String(c._id) === credentialId);
    if (!cred) return res.status(404).json(createErrorResponse('NOT_FOUND', 'Credential not found', 404));

    await auditLog(req, 'PROFILE_PLATFORM_CREDENTIAL_REVEAL', 'PROFILE', profile._id.toString(), {
      ...getRequestMeta(req),
      role,
      credentialId,
      platform: cred.platform || '',
    });

    res.json(createSuccessResponse({
      _id: cred._id,
      platform: cred.platform || '',
      gmail: dec(cred.gmail),
      password: dec(cred.password),
    }));
  } catch (err) { next(err); }
};

/* ============================================================
   AVATAR UPLOAD
============================================================ */

export const uploadPicture = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json(createErrorResponse('INVALID_ID', 'Invalid profile id', 400));
    }
    const profile = await Profile.findById(req.params.id);
    if (!profile) return res.status(404).json(createErrorResponse('NOT_FOUND', 'Profile not found', 404));
    if (!profilePermissions.canEditBase(req.user, profile)) {
      return res.status(403).json(createErrorResponse('ACCESS_DENIED', 'No permission', 403));
    }

    const upload = createModuleUpload(UPLOAD_MODULE).single('picture');
    upload(req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json(createErrorResponse('FILE_TOO_LARGE', 'File exceeds 10MB limit', 400));
        if (err.message && err.message.includes('Invalid file type')) return res.status(400).json(createErrorResponse('INVALID_FILE_TYPE', err.message, 400));
        return next(err);
      }
      if (!req.file) return res.status(400).json(createErrorResponse('NO_FILE', 'No file uploaded', 400));
      if (!req.file.mimetype.startsWith('image/')) {
        try { fs.unlinkSync(req.file.path); } catch {}
        return res.status(400).json(createErrorResponse('INVALID_FILE_TYPE', 'Only image files are allowed', 400));
      }
      try {
        const fileMeta = await FileMeta.create({
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          storagePath: req.file.path,
          uploadedByUserId: req.user._id,
          module: UPLOAD_MODULE,
          entityId: profile._id.toString(),
          entityType: 'PROFILE',
        });
        if (profile.pictureFileId) {
          const old = await FileMeta.findById(profile.pictureFileId);
          if (old) {
            try {
              const fp = path.isAbsolute(old.storagePath) ? old.storagePath : path.join(process.cwd(), old.storagePath);
              if (fs.existsSync(fp)) fs.unlinkSync(fp);
            } catch {}
            await old.deleteOne();
          }
        }
        profile.pictureFileId = fileMeta._id;
        await profile.save();
        const populated = await populateProfile(Profile.findById(profile._id));
        await auditLog(req, 'PROFILE_PICTURE_UPLOAD', 'PROFILE', profile._id.toString(), {
          ...getRequestMeta(req),
          fileName: fileMeta.originalName,
        });
        res.json(createSuccessResponse(buildResponseProfile(populated, req.user)));
      } catch (e) { next(e); }
    });
  } catch (err) { next(err); }
};

/* ============================================================
   TRANSACTIONS — per-tab (GROUP_BOSS or SUPER_ADMIN only)
============================================================ */

export const addTabTransaction = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json(createErrorResponse('INVALID_ID', 'Invalid profile id', 400));
    }
    const role = String(req.params.role || '').trim();
    if (!PROFILE_WORK_ROLE_VALUES.includes(role)) {
      return res.status(400).json(createErrorResponse('INVALID_ROLE', 'Invalid working role', 400));
    }
    const incomeNum = Number(req.body?.income);
    if (!Number.isFinite(incomeNum) || incomeNum < 0) {
      return res.status(400).json(createErrorResponse('INVALID_INCOME', 'Income must be a non-negative number', 400));
    }
    const profile = await Profile.findById(req.params.id);
    if (!profile) return res.status(404).json(createErrorResponse('NOT_FOUND', 'Profile not found', 404));

    if (!profilePermissions.canManageTransactions(req.user, profile, role)) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'Only Super Admin or the Group Boss of this working role can record transactions',
        403
      ));
    }

    const tab = (profile.workingRoleTabs || []).find((t) => t.role === role);
    if (!tab) {
      return res.status(404).json(createErrorResponse(
        'TAB_NOT_FOUND',
        `Profile has no ${role} working-role tab. Activate it in Base Information first.`,
        404
      ));
    }

    const currency = CURRENCY_CODES.includes(req.body?.currency) ? req.body.currency : (profile.currency || DEFAULT_CURRENCY);
    tab.transactions.push({
      income: incomeNum,
      description: String(req.body?.description || '').trim(),
      date: String(req.body?.date || '').trim(),
      currency,
      createdByUserId: req.user._id,
      createdAt: new Date(),
    });

    await profile.save();
    const populated = await populateProfile(Profile.findById(profile._id));

    await auditLog(req, 'PROFILE_TRANSACTION_ADD', 'PROFILE', profile._id.toString(), {
      ...getRequestMeta(req),
      role,
      income: incomeNum,
    });

    res.status(201).json(createSuccessResponse(buildResponseProfile(populated, req.user), 'Transaction recorded'));
  } catch (err) { next(err); }
};

export const deleteTabTransaction = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json(createErrorResponse('INVALID_ID', 'Invalid profile id', 400));
    }
    const role = String(req.params.role || '').trim();
    if (!PROFILE_WORK_ROLE_VALUES.includes(role)) {
      return res.status(400).json(createErrorResponse('INVALID_ROLE', 'Invalid working role', 400));
    }
    const profile = await Profile.findById(req.params.id);
    if (!profile) return res.status(404).json(createErrorResponse('NOT_FOUND', 'Profile not found', 404));

    if (!profilePermissions.canManageTransactions(req.user, profile, role)) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'Only Super Admin or the Group Boss of this working role can delete transactions',
        403
      ));
    }

    const tab = (profile.workingRoleTabs || []).find((t) => t.role === role);
    if (!tab) return res.status(404).json(createErrorResponse('TAB_NOT_FOUND', 'No such tab', 404));

    const idx = (tab.transactions || []).findIndex((tx) => String(tx._id) === String(req.params.transactionId));
    if (idx === -1) return res.status(404).json(createErrorResponse('NOT_FOUND', 'Transaction not found', 404));

    const removed = tab.transactions[idx];
    tab.transactions.splice(idx, 1);
    await profile.save();
    const populated = await populateProfile(Profile.findById(profile._id));

    await auditLog(req, 'PROFILE_TRANSACTION_DELETE', 'PROFILE', profile._id.toString(), {
      ...getRequestMeta(req),
      role,
      income: removed.income,
    });

    res.json(createSuccessResponse(buildResponseProfile(populated, req.user), 'Transaction deleted'));
  } catch (err) { next(err); }
};

/* ============================================================
   METADATA + SUMMARY
============================================================ */

export const getMetadata = async (_req, res) => {
  res.json(createSuccessResponse({
    statuses: PROFILE_STATUSES,
    sexValues: PROFILE_SEX_VALUES,
    workingRoles: PROFILE_WORK_ROLE_VALUES,
    userWorkingRoles: WORKING_ROLE_VALUES,
    contactHandlePlatforms: CONTACT_HANDLE_PLATFORMS,
    remoteTools: REMOTE_TOOLS,
    buyerTypes: BUYER_TYPES,
    currencies: CURRENCY_CODES,
    defaultCurrency: DEFAULT_CURRENCY,
    revealableSections: REVEALABLE_SECTIONS,
  }));
};

const TOP_COUNTRIES_LIMIT = 8;
const RECENT_LIMIT = 8;

export const getSummary = async (_req, res, next) => {
  try {
    /**
     * Totals are now derived from per-tab transactions, with `given` applied via
     * the profile's `clientSharePercent`. Compute via two-stage aggregation.
     */
    const [byStatus, byWorkingRole, byCountry, recent, total, fundAgg] = await Promise.all([
      Profile.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Profile.aggregate([
        { $match: { workingRoles: { $exists: true, $ne: [] } } },
        { $unwind: '$workingRoles' },
        { $group: { _id: '$workingRoles', count: { $sum: 1 } } },
      ]),
      Profile.aggregate([
        { $match: { countryCode: { $exists: true, $ne: '' } } },
        { $group: { _id: '$countryCode', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: TOP_COUNTRIES_LIMIT },
      ]),
      Profile.find({})
        .sort({ updatedAt: -1 })
        .limit(RECENT_LIMIT)
        .populate('huntingOwnerId', 'name email avatarUrl')
        .populate('callerUserId', 'name email avatarUrl')
        .populate('workingRoleTabs.managers.userId', 'name email avatarUrl')
        .populate('workingRoleTabs.platformCredentials.allowedMembers.userId', 'name email avatarUrl')
        .populate('pictureFileId')
        .select('name status countryCode workingRoles statusScore workingRoleTabs clientSharePercent callSupportEnabled callerUserId updatedAt huntingOwnerId pictureFileId')
        .lean(),
      Profile.countDocuments({}),
      Profile.aggregate([
        { $unwind: { path: '$workingRoleTabs', preserveNullAndEmptyArrays: false } },
        { $unwind: { path: '$workingRoleTabs.transactions', preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: '$_id',
            clientSharePercent: { $first: { $ifNull: ['$clientSharePercent', 0] } },
            incoming: { $sum: { $ifNull: ['$workingRoleTabs.transactions.income', 0] } },
          },
        },
        {
          $project: {
            incoming: 1,
            given: { $multiply: ['$incoming', { $divide: ['$clientSharePercent', 100] }] },
            profit: {
              $multiply: ['$incoming', { $divide: [{ $subtract: [100, '$clientSharePercent'] }, 100] }],
            },
          },
        },
        {
          $group: {
            _id: null,
            incoming: { $sum: '$incoming' },
            given: { $sum: '$given' },
            profit: { $sum: '$profit' },
          },
        },
      ]),
    ]);

    const sumMap = (rows) => {
      const m = {};
      for (const r of rows) m[r._id || ''] = r.count;
      return m;
    };
    const statusMap = sumMap(byStatus);
    const roleMap = sumMap(byWorkingRole);
    const funds = fundAgg[0] || {};

    const computeRecentProfit = (p) => {
      const share = Math.max(0, Math.min(100, Number(p.clientSharePercent) || 0));
      let inc = 0;
      for (const tab of (p.workingRoleTabs || [])) {
        for (const tx of (tab.transactions || [])) inc += Number(tx.income) || 0;
      }
      return +(inc * (1 - share / 100)).toFixed(2);
    };

    const userBrief = (u) => (u && u._id ? {
      _id: u._id,
      name: u.name || '',
      email: u.email || '',
      avatarUrl: u.avatarUrl || '',
    } : null);

    const extractTabs = (p) => {
      const out = [];
      const seenRoles = new Set();
      for (const tab of (p.workingRoleTabs || [])) {
        if (!tab || !tab.role) continue;
        seenRoles.add(tab.role);
        const members = [];
        const seen = new Set();
        for (const m of (tab.managers || [])) {
          if (!m || !m.isActive || !m.userId) continue;
          const u = m.userId;
          const key = String(u._id || u);
          if (seen.has(key)) continue;
          seen.add(key);
          members.push({
            _id: u._id || u,
            name: u.name || '',
            email: u.email || '',
            avatarUrl: u.avatarUrl || '',
          });
        }
        const platforms = [];
        for (const c of (tab.platformCredentials || [])) {
          if (!c || !c.platform) continue;
          const allowed = [];
          const allowedSeen = new Set();
          for (const a of (c.allowedMembers || [])) {
            if (!a || !a.isActive || !a.userId) continue;
            const u = a.userId;
            const key = String(u._id || u);
            if (allowedSeen.has(key)) continue;
            allowedSeen.add(key);
            allowed.push({
              _id: u._id || u,
              name: u.name || '',
              email: u.email || '',
              avatarUrl: u.avatarUrl || '',
            });
          }
          platforms.push({ platform: c.platform, allowed });
        }
        out.push({ role: tab.role, platforms, members });
      }
      // Synthesize empty groups for any working role the profile carries
      // that doesn't yet have a workingRoleTabs entry — so the diagram
      // still reflects the tagged roles.
      for (const role of (p.workingRoles || [])) {
        if (!role || seenRoles.has(role)) continue;
        out.push({ role, platforms: [], members: [] });
      }
      return out;
    };

    res.json(createSuccessResponse({
      total,
      byStatus: {
        active: statusMap.active || 0,
        archived: statusMap.archived || 0,
      },
      byWorkingRole: PROFILE_WORK_ROLE_VALUES.map((role) => ({ role, count: roleMap[role] || 0 })),
      topCountries: byCountry.map((c) => ({ code: c._id, count: c.count })),
      funds: {
        incoming: +(Number(funds.incoming) || 0).toFixed(2),
        given: +(Number(funds.given) || 0).toFixed(2),
        profit: +(Number(funds.profit) || 0).toFixed(2),
      },
      recent: recent.map((p) => ({
        _id: p._id,
        name: p.name,
        status: p.status,
        countryCode: p.countryCode || '',
        workingRoles: p.workingRoles || [],
        statusScore: typeof p.statusScore === 'number' ? p.statusScore : 0,
        totalProfitFund: computeRecentProfit(p),
        updatedAt: p.updatedAt,
        pictureFileId: p.pictureFileId || null,
        owner: userBrief(p.huntingOwnerId),
        callSupportEnabled: !!p.callSupportEnabled,
        caller: userBrief(p.callerUserId),
        tabs: extractTabs(p),
      })),
    }));
  } catch (err) { next(err); }
};
