import mongoose from 'mongoose';
import { z } from 'zod';
import CitizenProfile from '../models/CitizenProfile.js';
import User from '../models/User.js';
import { AppError, createSuccessResponse } from '../utils/errors.js';
import { log as auditLog, getRequestMeta } from '../utils/audit.js';
import { normalizeRole, ROLES, isFullAdminRole, isNonMemberRole } from '../constants/roles.js';
import {
  PROFILE_ACCOUNT_KEYS,
  PROFILE_ACCOUNT_SIZES,
  PROFILE_STATUSES,
  REVIEW_PLATFORM_KEYS,
} from '../constants/profiles.js';

/**
 * Citizen profiles: the clients a team member works under, with the platform
 * accounts each one holds. Every account names the members who manage it and
 * keeps its own screenshots and comment, shown on the profile's detail page.
 *
 * Everyone signed in may read every profile in full. Only a super admin or a
 * group boss creates one and picks its owner; from there the owner may edit
 * their own profiles — details, account state, comments and screenshots —
 * while other members only read. Reassigning and deleting stay with the admins.
 */

// Super admin or admin
const isSuperAdmin = (user) => isFullAdminRole(user?.role, user?.degree);
const isGroupBoss = (user) => normalizeRole(user?.role, user?.degree) === ROLES.GROUP_BOSS;

/** Who may create a profile at all, and so pick its owner. */
const canCreate = (user) => isSuperAdmin(user) || isGroupBoss(user);

/** Super admin / admin anywhere, a group boss inside their own group. */
const isAdminFor = (user, profile) => {
  if (isSuperAdmin(user)) return true;
  return isGroupBoss(user) && !!user.group && String(profile.group) === String(user.group);
};

const isOwner = (user, profile) => {
  const owner = profile.ownerUserId?._id || profile.ownerUserId;
  return !!owner && String(owner) === String(user?._id);
};

/** Who may edit this profile: the admins above, plus the member who owns it. */
const canWrite = (user, profile) => isAdminFor(user, profile) || isOwner(user, profile);

/** Reassigning the owner and deleting stay with the admins. */
const canAdminister = (user, profile) => isAdminFor(user, profile);

const objectId = (label) =>
  z.string().refine((v) => mongoose.isValidObjectId(v), `Invalid ${label}`);

const accountImageSchema = z.object({
  _id: z.string().optional(),
  fileId: objectId('fileId'),
  caption: z.string().max(300).optional(),
});

const accountSchema = z.object({
  platform: z.enum(PROFILE_ACCOUNT_KEYS),
  size: z.enum(PROFILE_ACCOUNT_SIZES).optional(),
  reviewCount: z.number().int().min(0).nullable().optional(),
  managerUserIds: z.array(objectId('managerUserId')).max(20).optional(),
  comment: z.string().max(4000).optional(),
  images: z.array(accountImageSchema).max(30).optional(),
  note: z.string().max(300).optional(),
});

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  photoFileId: objectId('photoFileId').nullable().optional(),
  countryCode: z.string().trim().max(2).optional(),
  sharePercent: z.number().min(0).max(100).optional(),
  ownerUserId: objectId('ownerUserId'),
  status: z.enum(PROFILE_STATUSES).optional(),
  accounts: z.array(accountSchema).max(PROFILE_ACCOUNT_KEYS.length).optional(),
  note: z.string().max(2000).optional(),
});

const updateProfileSchema = profileSchema.partial();

/** One account panel's own fields; the platform comes from the URL. */
const accountPatchSchema = z.object({
  size: z.enum(PROFILE_ACCOUNT_SIZES).optional(),
  reviewCount: z.number().int().min(0).nullable().optional(),
  managerUserIds: z.array(objectId('managerUserId')).max(20).optional(),
  comment: z.string().max(4000).optional(),
  images: z.array(accountImageSchema).max(30).optional(),
  note: z.string().max(300).optional(),
});

const POPULATE = [
  { path: 'ownerUserId', select: 'name email group avatarUrl workingRole role degree' },
  { path: 'accounts.managerUserIds', select: 'name email group avatarUrl' },
];

/**
 * One account per platform, with a review count only where it belongs. Images
 * and comments already on the record survive an edit from the profile dialog,
 * which does not send them.
 */
const cleanAccounts = (accounts = [], existing = []) => {
  const previous = new Map(existing.map((a) => [a.platform, a]));
  const byPlatform = new Map();
  for (const account of accounts) {
    const before = previous.get(account.platform);
    byPlatform.set(account.platform, {
      platform: account.platform,
      size: account.size || 'new',
      reviewCount: REVIEW_PLATFORM_KEYS.includes(account.platform) ? account.reviewCount ?? null : null,
      managerUserIds: account.managerUserIds !== undefined ? dedupeIds(account.managerUserIds) : before?.managerUserIds || [],
      comment: account.comment !== undefined ? account.comment : before?.comment || '',
      images: account.images !== undefined ? cleanImages(account.images, before?.images) : before?.images || [],
      note: account.note !== undefined ? account.note : before?.note || '',
    });
  }
  return [...byPlatform.values()];
};

/** One member may be listed once per account. */
const dedupeIds = (ids = []) => [...new Set(ids.map((id) => String(id)))];

/** Keeps who uploaded what: existing images stay as they are, new ones get stamped. */
const cleanImages = (images = [], existing = [], userId = null) => {
  const previous = new Map((existing || []).map((img) => [String(img.fileId), img]));
  return images.map((img) => {
    const before = previous.get(String(img.fileId));
    return {
      fileId: img.fileId,
      caption: img.caption ?? before?.caption ?? '',
      uploadedBy: before?.uploadedBy ?? userId,
      uploadedAt: before?.uploadedAt ?? new Date(),
    };
  });
};

const ownerOf = async (ownerUserId) => {
  const owner = await User.findById(ownerUserId).select('_id name email group role degree workingRole').lean();
  if (!owner) throw new AppError('NOT_FOUND', 'Owner not found', 404);
  if (isNonMemberRole(owner.role, owner.degree)) {
    throw new AppError('INVALID_OWNER', 'A super admin, admin or finance manager cannot own a citizen profile', 400);
  }
  return owner;
};

const withPermissions = (profile, user) => ({
  ...(profile.toObject ? profile.toObject() : profile),
  canWrite: canWrite(user, profile),
  canAdminister: canAdminister(user, profile),
});

/**
 * GET /citizen-profiles?[ownerUserId=][&group=][&status=][&search=]
 * Every signed-in user sees all profiles.
 */
export const listCitizenProfiles = async (req, res, next) => {
  try {
    const { ownerUserId, group, status, search } = req.query;
    const query = {};
    if (ownerUserId && mongoose.isValidObjectId(ownerUserId)) query.ownerUserId = ownerUserId;
    if (group && group !== 'all') query.group = group;
    if (status && status !== 'all') query.status = status;
    else if (!status) query.status = 'active';
    if (search) query.name = { $regex: String(search).trim(), $options: 'i' };

    const rows = await CitizenProfile.find(query).populate(POPULATE).sort({ name: 1 }).lean();
    const profiles = rows.map((profile) => withPermissions(profile, req.user));

    res.json(
      createSuccessResponse({
        profiles,
        canCreate: canCreate(req.user),
      }),
    );
  } catch (err) {
    next(err);
  }
};

/** GET /citizen-profiles/:id — the detail page's profile, accounts and all. */
export const getCitizenProfile = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new AppError('NOT_FOUND', 'Citizen profile not found', 404);
    }
    const profile = await CitizenProfile.findById(req.params.id).populate(POPULATE).lean();
    if (!profile) throw new AppError('NOT_FOUND', 'Citizen profile not found', 404);

    res.json(createSuccessResponse({ profile: withPermissions(profile, req.user) }));
  } catch (err) {
    next(err);
  }
};

/** POST /citizen-profiles */
export const createCitizenProfile = async (req, res, next) => {
  try {
    if (!canCreate(req.user)) {
      throw new AppError('ACCESS_DENIED', 'You may not create citizen profiles', 403);
    }
    const data = profileSchema.parse(req.body);
    const owner = await ownerOf(data.ownerUserId);

    if (!isSuperAdmin(req.user) && owner.group !== req.user.group) {
      throw new AppError('ACCESS_DENIED', 'You may only add profiles for your own group', 403);
    }

    const profile = await CitizenProfile.create({
      name: data.name,
      photoFileId: data.photoFileId || null,
      countryCode: (data.countryCode || '').toUpperCase(),
      sharePercent: data.sharePercent ?? 0,
      ownerUserId: owner._id,
      group: owner.group || '',
      status: data.status || 'active',
      accounts: cleanAccounts(data.accounts),
      note: data.note || '',
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await auditLog(req, 'CITIZEN_PROFILE_CREATE', 'CITIZEN_PROFILE', profile._id.toString(), {
      ...getRequestMeta(req),
      profile: { name: profile.name, owner: owner.name, accounts: profile.accounts.length },
    });

    res.status(201).json(createSuccessResponse({ profile }, 'Citizen profile created'));
  } catch (err) {
    next(err);
  }
};

/** PUT /citizen-profiles/:id */
export const updateCitizenProfile = async (req, res, next) => {
  try {
    const profile = await CitizenProfile.findById(req.params.id);
    if (!profile) throw new AppError('NOT_FOUND', 'Citizen profile not found', 404);
    if (!canWrite(req.user, profile)) {
      throw new AppError('ACCESS_DENIED', 'You may not edit this citizen profile', 403);
    }

    const data = updateProfileSchema.parse(req.body);
    const before = { name: profile.name, sharePercent: profile.sharePercent, accounts: profile.accounts.length };

    if (data.ownerUserId !== undefined && String(data.ownerUserId) !== String(profile.ownerUserId)) {
      if (!canAdminister(req.user, profile)) {
        throw new AppError('ACCESS_DENIED', 'Only an admin may hand this profile to another member', 403);
      }
      const owner = await ownerOf(data.ownerUserId);
      if (!isSuperAdmin(req.user) && owner.group !== req.user.group) {
        throw new AppError('ACCESS_DENIED', 'You may only assign profiles inside your own group', 403);
      }
      profile.ownerUserId = owner._id;
      profile.group = owner.group || '';
    }
    if (data.name !== undefined) profile.name = data.name;
    if (data.photoFileId !== undefined) profile.photoFileId = data.photoFileId || null;
    if (data.countryCode !== undefined) profile.countryCode = (data.countryCode || '').toUpperCase();
    if (data.sharePercent !== undefined) profile.sharePercent = data.sharePercent;
    if (data.status !== undefined) profile.status = data.status;
    if (data.accounts !== undefined) {
      profile.accounts = cleanAccounts(data.accounts, profile.accounts.map((a) => a.toObject()));
    }
    if (data.note !== undefined) profile.note = data.note;
    profile.updatedBy = req.user._id;

    await profile.save();

    await auditLog(req, 'CITIZEN_PROFILE_UPDATE', 'CITIZEN_PROFILE', profile._id.toString(), {
      ...getRequestMeta(req),
      before,
      after: { name: profile.name, sharePercent: profile.sharePercent, accounts: profile.accounts.length },
    });

    await profile.populate(POPULATE);
    res.json(createSuccessResponse({ profile: withPermissions(profile, req.user) }, 'Citizen profile updated'));
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /citizen-profiles/:id/accounts/:platform
 * The detail page saves one account panel at a time: its state, manager,
 * comment and screenshots.
 */
export const updateCitizenAccount = async (req, res, next) => {
  try {
    const { platform } = req.params;
    if (!PROFILE_ACCOUNT_KEYS.includes(platform)) {
      throw new AppError('INVALID_PLATFORM', 'Unknown account platform', 400);
    }

    const profile = await CitizenProfile.findById(req.params.id);
    if (!profile) throw new AppError('NOT_FOUND', 'Citizen profile not found', 404);
    if (!canWrite(req.user, profile)) {
      throw new AppError('ACCESS_DENIED', 'You may not edit this citizen profile', 403);
    }

    const data = accountPatchSchema.parse(req.body);
    let account = profile.accounts.find((a) => a.platform === platform);
    if (!account) {
      profile.accounts.push({ platform });
      account = profile.accounts[profile.accounts.length - 1];
    }

    if (data.size !== undefined) account.size = data.size;
    if (data.reviewCount !== undefined) {
      account.reviewCount = REVIEW_PLATFORM_KEYS.includes(platform) ? data.reviewCount : null;
    }
    if (data.managerUserIds !== undefined) account.managerUserIds = dedupeIds(data.managerUserIds);
    if (data.comment !== undefined) account.comment = data.comment;
    if (data.note !== undefined) account.note = data.note;
    if (data.images !== undefined) {
      account.images = cleanImages(
        data.images,
        account.images.map((img) => (img.toObject ? img.toObject() : img)),
        req.user._id,
      );
    }
    profile.updatedBy = req.user._id;

    await profile.save();
    await profile.populate(POPULATE);

    await auditLog(req, 'CITIZEN_PROFILE_ACCOUNT_UPDATE', 'CITIZEN_PROFILE', profile._id.toString(), {
      ...getRequestMeta(req),
      account: { platform, images: account.images.length },
    });

    res.json(createSuccessResponse({ profile: withPermissions(profile, req.user) }, 'Account updated'));
  } catch (err) {
    next(err);
  }
};

/** DELETE /citizen-profiles/:id */
export const deleteCitizenProfile = async (req, res, next) => {
  try {
    const profile = await CitizenProfile.findById(req.params.id);
    if (!profile) throw new AppError('NOT_FOUND', 'Citizen profile not found', 404);
    if (!canAdminister(req.user, profile)) {
      throw new AppError('ACCESS_DENIED', 'You may not delete this citizen profile', 403);
    }

    await profile.deleteOne();
    await auditLog(req, 'CITIZEN_PROFILE_DELETE', 'CITIZEN_PROFILE', String(req.params.id), {
      ...getRequestMeta(req),
      profile: { name: profile.name },
    });

    res.json(createSuccessResponse({ id: String(req.params.id) }, 'Citizen profile deleted'));
  } catch (err) {
    next(err);
  }
};
