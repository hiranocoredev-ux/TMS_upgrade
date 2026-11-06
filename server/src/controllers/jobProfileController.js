import JobProfile from '../models/JobProfile.js';
import FileMeta from '../models/FileMeta.js';
import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';
import { DEFAULT_ENTITY_GROUP } from '../constants/groups.js';
import { log as auditLog, getRequestMeta } from '../utils/audit.js';
import { normalizeRole, ROLES } from '../utils/roleMapper.js';
import { jobProfilePermissions } from '../utils/permissions/entityPermissions.js';
import { sanitizeJobProfile } from '../utils/sanitizer.js';
import { createModuleUpload } from '../middleware/upload.middleware.js';
import fs from 'fs';
import path from 'path';

/**
 * Validate job profile data (simple validation without Zod)
 */
const validateJobProfile = (data, isUpdate = false) => {
  const errors = [];

  if (!isUpdate && (!data.name || data.name.trim().length === 0)) {
    errors.push('Name is required');
  }
  if (data.name && data.name.length > 200) {
    errors.push('Name must be less than 200 characters');
  }
  if (data.status && !['active', 'archived'].includes(data.status)) {
    errors.push('Status must be active or archived');
  }
  // Group: allow NONE or group codes from DB (validation relaxed for dynamic groups)
  if (data.email && data.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Invalid email format');
  }
  if (data.socialLinks) {
    const urlPattern = /^https?:\/\/.+/;
    if (data.socialLinks.linkedin && data.socialLinks.linkedin.trim() && !urlPattern.test(data.socialLinks.linkedin)) {
      errors.push('Invalid LinkedIn URL');
    }
    if (data.socialLinks.github && data.socialLinks.github.trim() && !urlPattern.test(data.socialLinks.github)) {
      errors.push('Invalid GitHub URL');
    }
    if (data.socialLinks.website && data.socialLinks.website.trim() && !urlPattern.test(data.socialLinks.website)) {
      errors.push('Invalid website URL');
    }
  }

  return errors;
};

/**
 * List job profiles with filters
 */
export const listJobProfiles = async (req, res, next) => {
  try {
    const { status, owner, search, page = '1', limit = '20' } = req.query;
    const user = req.user;

    const query = {};
    const userRole = normalizeRole(user.role, user.degree);

    // Ownership-first: Members can only see their own profiles
    if (userRole === ROLES.GROUP_MEMBER) {
      query.ownerUserId = user._id;
    }

    // All groups can see all profiles (summary/view). Filter by group in query if provided.
    if (req.query.group) {
      query.group = req.query.group;
    }

    // Apply filters
    if (status) {
      query.status = status;
    }

    if (owner && (userRole === ROLES.GROUP_BOSS || userRole === ROLES.SUPER_ADMIN)) {
      query.ownerUserId = owner;
    } else if (owner && userRole === ROLES.GROUP_MEMBER && owner !== user._id.toString()) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You can only view your own profiles',
        403
      ));
    }

    if (search) {
      const searchConditions = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { country: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];

      if (Object.keys(query).length > 0) {
        const existingConditions = { ...query };
        query = {
          $and: [
            existingConditions,
            { $or: searchConditions }
          ]
        };
      } else {
        query.$or = searchConditions;
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [profiles, total] = await Promise.all([
      JobProfile.find(query)
        .populate('ownerUserId', 'email name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      JobProfile.countDocuments(query)
    ]);

    const sanitizedProfiles = profiles.map(profile => sanitizeJobProfile(req.user, profile));

    res.json(createSuccessResponse({
      profiles: sanitizedProfiles,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Get single job profile by ID
 */
export const getJobProfile = async (req, res, next) => {
  try {
    const profile = await JobProfile.findById(req.params.id)
      .populate('ownerUserId', 'email name')
      .populate('pictureFileId')
      .populate('attachments');

    if (!profile) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Job profile not found',
        404
      ));
    }

    if (!jobProfilePermissions.canView(req.user, profile)) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to view this job profile',
        403
      ));
    }

    const sanitized = sanitizeJobProfile(req.user, profile.toObject ? profile.toObject() : profile);

    res.json(createSuccessResponse({ profile: sanitized }));
  } catch (error) {
    next(error);
  }
};

/**
 * Create new job profile
 */
export const createJobProfile = async (req, res, next) => {
  try {
    if (!jobProfilePermissions.canCreate(req.user)) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to create job profiles',
        403
      ));
    }

    const validationErrors = validateJobProfile(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json(createErrorResponse(
        'VALIDATION_ERROR',
        validationErrors[0],
        400
      ));
    }

    const userRole = normalizeRole(req.user.role, req.user.degree);
    let ownerUserId = req.body.ownerUserId || req.user._id;

    if (userRole === ROLES.GROUP_MEMBER) {
      if (req.body.ownerUserId && req.body.ownerUserId !== req.user._id.toString()) {
        return res.status(403).json(createErrorResponse(
          'ACCESS_DENIED',
          'You can only create profiles for yourself',
          403
        ));
      }
      ownerUserId = req.user._id;
    }

    const requestedGroup = req.body.group || DEFAULT_ENTITY_GROUP;
    const userGroup = req.user?.group;
    const isSuperAdmin = userRole === ROLES.SUPER_ADMIN;
    if (!isSuperAdmin && userGroup && !['SUPER_ADMIN', 'ADMIN'].includes(userGroup)) {
      if (requestedGroup !== userGroup) {
        return res.status(403).json(createErrorResponse(
          'ACCESS_DENIED',
          'You can only create profiles for your own group',
          403
        ));
      }
    }

    const profileData = {
      name: req.body.name,
      ownerUserId: ownerUserId,
      status: req.body.status || 'active',
      group: requestedGroup,
      email: req.body.email || '',
      phone: req.body.phone || '',
      country: req.body.country || '',
      address: req.body.address || '',
      socialLinks: req.body.socialLinks || {},
      bankAccount: req.body.bankAccount || '',
      idNumber: req.body.idNumber || '',
      driverLicenseNumber: req.body.driverLicenseNumber || '',
      // pictureFileId: req.body.pictureFileId || null,
      pictureFileId: null,
      experience: req.body.experience || '',
      education: req.body.education || '',
      // attachments: req.body.attachments || [],
      attachments: [],
      tags: req.body.tags || [],
      notes: req.body.notes || ''
    };

    const profile = new JobProfile(profileData);
    await profile.save();
    await profile.populate('ownerUserId', 'email name');
    await profile.populate('pictureFileId');
    await profile.populate('attachments');

    await auditLog(req, 'JOB_PROFILE_CREATE', 'JOB_PROFILE', profile._id.toString(), {
      ...getRequestMeta(req),
      profile: { name: profile.name, status: profile.status, group: profile.group }
    });

    const sanitized = sanitizeJobProfile(req.user, profile.toObject ? profile.toObject() : profile);

    res.status(201).json(createSuccessResponse({ profile: sanitized }, 'Job profile created successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Update job profile
 */
export const updateJobProfile = async (req, res, next) => {
  try {
    const profile = await JobProfile.findById(req.params.id);

    if (!profile) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Job profile not found',
        404
      ));
    }

    if (!jobProfilePermissions.canView(req.user, profile)) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to view this job profile',
        403
      ));
    }

    const editPermission = jobProfilePermissions.canEdit(req.user, profile);
    if (!editPermission.canEdit) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        editPermission.reason || 'You do not have permission to edit this job profile',
        403
      ));
    }

    const userRole = normalizeRole(req.user.role, req.user.degree);
    const userGroup = req.user?.group;
    if (userRole !== ROLES.SUPER_ADMIN && userGroup && !['SUPER_ADMIN', 'ADMIN'].includes(userGroup)) {
      if (profile.group !== userGroup) {
        return res.status(403).json(createErrorResponse(
          'ACCESS_DENIED',
          'You can only edit your own group\'s profiles',
          403
        ));
      }
    }
    if (userRole === ROLES.GROUP_MEMBER && profile.ownerUserId.toString() !== req.user._id.toString()) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You can only update your own profiles',
        403
      ));
    }

    // Validate only provided fields
    const validationErrors = validateJobProfile(req.body, true);
    if (validationErrors.length > 0) {
      return res.status(400).json(createErrorResponse(
        'VALIDATION_ERROR',
        validationErrors[0],
        400
      ));
    }

    if (userRole === ROLES.GROUP_MEMBER && req.body.ownerUserId && req.body.ownerUserId !== profile.ownerUserId.toString()) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You cannot change the owner of a profile',
        403
      ));
    }

    const oldValues = {
      name: profile.name,
      status: profile.status
    };

    // Update only provided fields
    if (req.body.name !== undefined) profile.name = req.body.name;
    if (req.body.status !== undefined) profile.status = req.body.status;
    if (req.body.group !== undefined) profile.group = req.body.group;
    if (req.body.email !== undefined) profile.email = req.body.email || '';
    if (req.body.phone !== undefined) profile.phone = req.body.phone || '';
    if (req.body.country !== undefined) profile.country = req.body.country || '';
    if (req.body.address !== undefined) profile.address = req.body.address || '';
    if (req.body.socialLinks !== undefined) profile.socialLinks = { ...profile.socialLinks, ...req.body.socialLinks };
    if (req.body.bankAccount !== undefined) profile.bankAccount = req.body.bankAccount || '';
    if (req.body.idNumber !== undefined) profile.idNumber = req.body.idNumber || '';
    if (req.body.driverLicenseNumber !== undefined) profile.driverLicenseNumber = req.body.driverLicenseNumber || '';
    if (req.body.pictureFileId !== undefined) profile.pictureFileId = req.body.pictureFileId || null;
    if (req.body.experience !== undefined) profile.experience = req.body.experience || '';
    if (req.body.education !== undefined) profile.education = req.body.education || '';
    if (req.body.attachments !== undefined) profile.attachments = req.body.attachments || [];
    if (req.body.tags !== undefined) profile.tags = req.body.tags || [];
    if (req.body.notes !== undefined) profile.notes = req.body.notes || '';

    await profile.save();
    await profile.populate('ownerUserId', 'email name');
    await profile.populate('pictureFileId');
    await profile.populate('attachments');

    await auditLog(req, 'JOB_PROFILE_UPDATE', 'JOB_PROFILE', profile._id.toString(), {
      ...getRequestMeta(req),
      oldValues,
      newValues: {
        name: profile.name,
        status: profile.status
      }
    });

    const sanitized = sanitizeJobProfile(req.user, profile.toObject ? profile.toObject() : profile);

    res.json(createSuccessResponse({ profile: sanitized }, 'Job profile updated successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Delete job profile
 */
export const deleteJobProfile = async (req, res, next) => {
  try {
    const profile = await JobProfile.findById(req.params.id);

    if (!profile) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Job profile not found',
        404
      ));
    }

    if (!jobProfilePermissions.canDelete(req.user, profile)) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to delete job profiles',
        403
      ));
    }

    const userRole = normalizeRole(req.user.role, req.user.degree);
    const userGroup = req.user?.group;
    if (userRole !== ROLES.SUPER_ADMIN && userGroup && !['SUPER_ADMIN', 'ADMIN'].includes(userGroup)) {
      if (profile.group !== userGroup) {
        return res.status(403).json(createErrorResponse(
          'ACCESS_DENIED',
          'You can only delete your own group\'s profiles',
          403
        ));
      }
    }
    if (userRole === ROLES.GROUP_MEMBER && profile.ownerUserId.toString() !== req.user._id.toString()) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You can only delete your own profiles',
        403
      ));
    }

    await profile.deleteOne();

    await auditLog(req, 'JOB_PROFILE_DELETE', 'JOB_PROFILE', profile._id.toString(), {
      ...getRequestMeta(req),
      profile: { name: profile.name }
    });

    res.json(createSuccessResponse(null, 'Job profile deleted successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Upload profile picture
 */
export const uploadProfilePicture = async (req, res, next) => {
  try {
    const profile = await JobProfile.findById(req.params.id);

    if (!profile) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Job profile not found',
        404
      ));
    }

    const editPermission = jobProfilePermissions.canEdit(req.user, profile);
    if (!editPermission.canEdit) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to upload pictures for this profile',
        403
      ));
    }

    const upload = createModuleUpload('job_profiles');
    const singleUpload = upload.single('picture');

    singleUpload(req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json(createErrorResponse(
            'FILE_TOO_LARGE',
            'File size exceeds 10MB limit',
            400
          ));
        }
        if (err.message && err.message.includes('Invalid file type')) {
          return res.status(400).json(createErrorResponse(
            'INVALID_FILE_TYPE',
            'Only images (JPG, PNG) are allowed for profile pictures',
            400
          ));
        }
        return next(err);
      }

      if (!req.file) {
        return res.status(400).json(createErrorResponse(
          'NO_FILE',
          'No file uploaded',
          400
        ));
      }

      try {
        if (!req.file.mimetype.startsWith('image/')) {
          return res.status(400).json(createErrorResponse(
            'INVALID_FILE_TYPE',
            'Only images are allowed for profile pictures',
            400
          ));
        }

        const fileMeta = new FileMeta({
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          storagePath: req.file.path,
          uploadedByUserId: req.user._id,
          module: 'job_profiles',
          entityId: profile._id.toString(),
          entityType: 'JOB_PROFILE'
        });

        await fileMeta.save();

        // Delete old picture if exists
        if (profile.pictureFileId) {
          try {
            const oldFileMeta = await FileMeta.findById(profile.pictureFileId);
            if (oldFileMeta) {
              const filePath = path.isAbsolute(oldFileMeta.storagePath) 
                ? oldFileMeta.storagePath 
                : path.join(process.cwd(), oldFileMeta.storagePath);
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
              }
              await oldFileMeta.deleteOne();
            }
          } catch (deleteErr) {
            console.error('Error deleting old picture:', deleteErr);
          }
        }

        profile.pictureFileId = fileMeta._id;
        await profile.save();
        await profile.populate('pictureFileId');

        await auditLog(req, 'JOB_PROFILE_PICTURE_UPLOAD', 'JOB_PROFILE', profile._id.toString(), {
          ...getRequestMeta(req),
          fileName: fileMeta.originalName
        });

        const sanitized = sanitizeJobProfile(req.user, profile.toObject ? profile.toObject() : profile);

        res.json(createSuccessResponse({ profile: sanitized }, 'Profile picture uploaded successfully'));
      } catch (error) {
        next(error);
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload single attachment (legacy - kept for backward compatibility)
 */
export const uploadAttachment = async (req, res, next) => {
  try {
    const profile = await JobProfile.findById(req.params.id);

    if (!profile) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Job profile not found',
        404
      ));
    }

    const editPermission = jobProfilePermissions.canEdit(req.user, profile);
    if (!editPermission.canEdit) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to upload attachments for this profile',
        403
      ));
    }

    const upload = createModuleUpload('job_profiles');
    const singleUpload = upload.single('file');

    singleUpload(req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json(createErrorResponse(
            'FILE_TOO_LARGE',
            'File size exceeds 10MB limit',
            400
          ));
        }
        return next(err);
      }

      if (!req.file) {
        return res.status(400).json(createErrorResponse(
          'NO_FILE',
          'No file uploaded',
          400
        ));
      }

      try {
        const fileMeta = new FileMeta({
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          storagePath: req.file.path,
          uploadedByUserId: req.user._id,
          module: 'job_profiles',
          entityId: profile._id.toString(),
          entityType: 'JOB_PROFILE'
        });

        await fileMeta.save();

        if (!profile.attachments) {
          profile.attachments = [];
        }
        profile.attachments.push(fileMeta._id);
        await profile.save();
        await profile.populate('attachments');

        await auditLog(req, 'JOB_PROFILE_ATTACHMENT_UPLOAD', 'JOB_PROFILE', profile._id.toString(), {
          ...getRequestMeta(req),
          fileName: fileMeta.originalName
        });

        const sanitized = sanitizeJobProfile(req.user, profile.toObject ? profile.toObject() : profile);

        res.json(createSuccessResponse({ 
          profile: sanitized,
          fileMeta 
        }, 'Attachment uploaded successfully'));
      } catch (error) {
        next(error);
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload multiple attachments
 */
export const uploadAttachments = async (req, res, next) => {
  try {
    const profile = await JobProfile.findById(req.params.id);

    if (!profile) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Job profile not found',
        404
      ));
    }

    const editPermission = jobProfilePermissions.canEdit(req.user, profile);
    if (!editPermission.canEdit) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to upload attachments for this profile',
        403
      ));
    }

    const upload = createModuleUpload('job_profiles');
    const multipleUpload = upload.array('files', 10); // Max 10 files

    multipleUpload(req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json(createErrorResponse(
            'FILE_TOO_LARGE',
            'File size exceeds 10MB limit',
            400
          ));
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json(createErrorResponse(
            'TOO_MANY_FILES',
            'Maximum 10 files allowed per upload',
            400
          ));
        }
        return next(err);
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json(createErrorResponse(
          'NO_FILES',
          'No files uploaded',
          400
        ));
      }

      try {
        const fileMetas = [];

        for (const file of req.files) {
          const fileMeta = new FileMeta({
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            storagePath: file.path,
            uploadedByUserId: req.user._id,
            module: 'job_profiles',
            entityId: profile._id.toString(),
            entityType: 'JOB_PROFILE'
          });

          await fileMeta.save();
          fileMetas.push(fileMeta);

          if (!profile.attachments) {
            profile.attachments = [];
          }
          profile.attachments.push(fileMeta._id);
        }

        await profile.save();
        await profile.populate('attachments');

        await auditLog(req, 'JOB_PROFILE_ATTACHMENTS_UPLOAD', 'JOB_PROFILE', profile._id.toString(), {
          ...getRequestMeta(req),
          fileCount: req.files.length,
          fileNames: req.files.map(f => f.originalname)
        });

        const sanitized = sanitizeJobProfile(req.user, profile.toObject ? profile.toObject() : profile);

        res.json(createSuccessResponse({ 
          profile: sanitized,
          files: fileMetas.map(fm => ({
            id: fm._id,
            originalName: fm.originalName,
            mimeType: fm.mimeType,
            size: fm.size
          }))
        }, `${req.files.length} attachment(s) uploaded successfully`));
      } catch (error) {
        next(error);
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete attachment
 */
// export const deleteAttachment = async (req, res, next) => {
//   try {
//     const profile = await JobProfile.findById(req.params.id);

//     if (!profile) {
//       return res.status(404).json(createErrorResponse(
//         'NOT_FOUND',
//         'Job profile not found',
//         404
//       ));
//     }

//     const editPermission = jobProfilePermissions.canEdit(req.user, profile);
//     if (!editPermission.canEdit) {
//       return res.status(403).json(createErrorResponse(
//         'ACCESS_DENIED',
//         'You do not have permission to delete attachments for this profile',
//         403
//       ));
//     }

//     const fileId = req.params.fileId;

//     // if (!profile.attachments || !profile.attachments.includes(fileId)) {
//     //   return res.status(404).json(createErrorResponse(
//     //     'NOT_FOUND',
//     //     'Attachment not found in this profile',
//     //     404
//     //   ));
//     // }

//     const fileMeta = await FileMeta.findById(fileId);
//     if (!fileMeta) {
//       return res.status(404).json(createErrorResponse(
//         'NOT_FOUND',
//         'File not found',
//         404
//       ));
//     }

//     // Delete file from disk
//     try {
//       const filePath = path.isAbsolute(fileMeta.storagePath) 
//         ? fileMeta.storagePath 
//         : path.join(process.cwd(), fileMeta.storagePath);
//       if (fs.existsSync(filePath)) {
//         fs.unlinkSync(filePath);
//       }
//     } catch (deleteErr) {
//       console.error('Error deleting file from disk:', deleteErr);
//     }

//     // Remove from profile attachments
//     profile.attachments = profile.attachments.filter(id => id.toString() !== fileId);
//     await profile.save();

//     // Delete FileMeta record
//     await fileMeta.deleteOne();

//     await auditLog(req, 'JOB_PROFILE_ATTACHMENT_DELETE', 'JOB_PROFILE', profile._id.toString(), {
//       ...getRequestMeta(req),
//       fileName: fileMeta.originalName
//     });

//     const sanitized = sanitizeJobProfile(req.user, profile.toObject ? profile.toObject() : profile);

//     res.json(createSuccessResponse({ profile: sanitized }, 'Attachment deleted successfully'));
//   } catch (error) {
//     next(error);
//   }
// };
export const deleteAttachment = async (req, res, next) => {
  try {
    const profile = await JobProfile.findById(req.params.id);
    if (!profile) {
      return res.status(404).json(createErrorResponse('NOT_FOUND', 'Profile not found', 404));
    }

    if (!jobProfilePermissions.canEdit(req.user, profile).canEdit) {
      return res.status(403).json(createErrorResponse('ACCESS_DENIED', 'No permission', 403));
    }

    const fileMeta = await FileMeta.findById(req.params.fileId);
    if (!fileMeta) {
      return res.status(404).json(createErrorResponse('NOT_FOUND', 'File not found', 404));
    }

    if (fs.existsSync(fileMeta.storagePath)) {
      fs.unlinkSync(fileMeta.storagePath);
    }

    profile.attachments = profile.attachments.filter(id => id.toString() !== fileMeta._id.toString());
    await profile.save();
    await fileMeta.deleteOne();
    await profile.populate([
      { path: 'attachments' },
      { path: 'pictureFileId' },
      { path: 'ownerUserId', select: 'name email' }
    ]);

    res.json(createSuccessResponse({
      profile: sanitizeJobProfile(req.user, profile.toObject())
    }));
  } catch (err) {
    next(err);
  }
};