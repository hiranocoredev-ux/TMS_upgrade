import FreelancerAccount from '../models/FreelancerAccount.js';
import FileMeta from '../models/FileMeta.js';
import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';
import { DEFAULT_ENTITY_GROUP, ENTITY_GROUP_VALUES } from '../constants/groups.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { log as auditLog, getRequestMeta } from '../utils/audit.js';
import { normalizeRole, ROLES } from '../utils/roleMapper.js';
import { freelancerAccountPermissions } from '../utils/permissions/entityPermissions.js';
import { sanitizeFreelancerAccount } from '../utils/sanitizer.js';
import { createModuleUpload } from '../middleware/upload.middleware.js';
import fs from 'fs';
import path from 'path';

/**
 * Validate freelancer account data
 */
const validateFreelancerAccount = (data, isUpdate = false) => {
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
  if (data.group && !ENTITY_GROUP_VALUES.includes(data.group)) {
    errors.push(`Group must be one of: ${ENTITY_GROUP_VALUES.join(', ')}`);
  }
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

export const listFreelancerAccounts = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const role = normalizeRole(req.user.role);

    if (![ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.BOSS].includes(role)) {
      return res.status(403).json(createErrorResponse('ACCESS_DENIED', 'No permission', 403));
    }

    const query = {};

    if (status) query.status = status;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const [accounts, total] = await Promise.all([
      FreelancerAccount.find(query)
        .populate('ownerUserId', 'name email')
        .populate('pictureFileId')
        .populate('attachments')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      FreelancerAccount.countDocuments(query)
    ]);

    res.json(createSuccessResponse({
      profiles: accounts.map(a => sanitizeFreelancerAccount(req.user, a)),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    }));
  } catch (err) {
    next(err);
  }
};

/**
 * Get single freelancer account
 * View: OWNER + ADMIN + BOSS
 */
export const getFreelancerAccount = async (req, res, next) => {
  try {
    const account = await FreelancerAccount.findById(req.params.id)
      .populate('ownerUserId', 'name email')
      .populate('pictureFileId')
      .populate('attachments');

    if (!account) {
      return res.status(404).json(createErrorResponse('NOT_FOUND', 'Account not found', 404));
    }

    if (!freelancerAccountPermissions.canView(req.user, account)) {
      return res.status(403).json(createErrorResponse('ACCESS_DENIED', 'No permission', 403));
    }

    res.json(createSuccessResponse({
      profile: sanitizeFreelancerAccount(req.user, account.toObject())
    }));
  } catch (err) {
    next(err);
  }
};

/**
 * Create freelancer account
 */
export const createFreelancerAccount = async (req, res, next) => {
  try {
    if (!freelancerAccountPermissions.canCreate(req.user)) {
      return res.status(403).json(createErrorResponse('ACCESS_DENIED', 'No permission', 403));
    }

    const errors = validateFreelancerAccount(req.body);
    if (errors.length) {
      return res.status(400).json(createErrorResponse('VALIDATION_ERROR', errors[0], 400));
    }

    const account = new FreelancerAccount({
      name: req.body.name,
      ownerUserId: req.user._id,
      status: req.body.status || 'active',
      group: req.body.group || DEFAULT_ENTITY_GROUP,
      email: req.body.email || '',
      anydeskId: req.body.anydeskId || '',
      accessNotes: req.body.accessNotes || '',
      attachments: []
    });

    await account.save();
    await account.populate(['ownerUserId', 'pictureFileId', 'attachments']);

    await auditLog(req, 'FREELANCER_ACCOUNT_CREATE', 'FREELANCER_ACCOUNT', account._id.toString(), {
      ...getRequestMeta(req),
      name: account.name
    });

    res.status(201).json(createSuccessResponse({
      profile: sanitizeFreelancerAccount(req.user, account.toObject())
    }));
  } catch (err) {
    next(err);
  }
};

/**
 * Update freelancer account
 * Edit: OWNER + ADMIN
 */
export const updateFreelancerAccount = async (req, res, next) => {
  try {
    const account = await FreelancerAccount.findById(req.params.id);

    if (!account) {
      return res.status(404).json(createErrorResponse('NOT_FOUND', 'Account not found', 404));
    }

    const editPermission = freelancerAccountPermissions.canEdit(req.user, account);
    if (!editPermission.canEdit) {
      return res.status(403).json(createErrorResponse('ACCESS_DENIED', editPermission.reason, 403));
    }

    const errors = validateFreelancerAccount(req.body, true);
    if (errors.length) {
      return res.status(400).json(createErrorResponse('VALIDATION_ERROR', errors[0], 400));
    }

    Object.assign(account, {
      name: req.body.name ?? account.name,
      status: req.body.status ?? account.status,
      group: req.body.group ?? account.group,
      email: req.body.email ?? account.email,
      anydeskId: req.body.anydeskId ?? account.anydeskId,
      accessNotes: req.body.accessNotes ?? account.accessNotes
    });

    await account.save();
    await account.populate(['ownerUserId', 'pictureFileId', 'attachments']);

    await auditLog(req, 'FREELANCER_ACCOUNT_UPDATE', 'FREELANCER_ACCOUNT', account._id.toString(), {
      ...getRequestMeta(req),
      name: account.name
    });

    res.json(createSuccessResponse({
      profile: sanitizeFreelancerAccount(req.user, account.toObject())
    }));
  } catch (err) {
    next(err);
  }
};
export const uploadFreelancerProfilePicture = async (req, res, next) => {
  try {
    const profile = await FreelancerAccount.findById(req.params.id);

    if (!profile) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Freelancer profile not found',
        404
      ));
    }

    const editPermission = freelancerAccountPermissions.canEdit(req.user, profile);
    if (!editPermission.canEdit) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to upload pictures for this profile',
        403
      ));
    }

    const upload = createModuleUpload('freelancer_accounts');
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
          module: 'freelancer_accounts',
          entityId: profile._id.toString(),
          entityType: 'FREELANCER_ACCOUNT'
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

        await auditLog(req, 'FREELANCER_PROFILE_PICTURE_UPLOAD', 'FREELANCER_PROFILE', profile._id.toString(), {
          ...getRequestMeta(req),
          fileName: fileMeta.originalName
        });

        const sanitized = sanitizeFreelancerAccount(req.user, profile.toObject ? profile.toObject() : profile);

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
 * Delete freelancer account
 */
export const deleteFreelancerAccount = async (req, res, next) => {
  try {
    const account = await FreelancerAccount.findById(req.params.id);

    if (!account) {
      return res.status(404).json(createErrorResponse('NOT_FOUND', 'Account not found', 404));
    }

    if (!freelancerAccountPermissions.canDelete(req.user, account)) {
      return res.status(403).json(createErrorResponse('ACCESS_DENIED', 'No permission', 403));
    }

    await account.deleteOne();

    await auditLog(req, 'FREELANCER_ACCOUNT_DELETE', 'FREELANCER_ACCOUNT', account._id.toString(), {
      ...getRequestMeta(req),
      name: account.name
    });

    res.json(createSuccessResponse(null, 'Account deleted'));
  } catch (err) {
    next(err);
  }
};


////////////////////////////
export const uploadAttachment = async (req, res, next) => {
  try {
    const profile = await FreelancerAccount.findById(req.params.id);

    if (!profile) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Freelancer profile not found',
        404
      ));
    }

    const editPermission = freelancerAccountPermissions.canEdit(req.user, profile);
    if (!editPermission.canEdit) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to upload attachments for this profile',
        403
      ));
    }

    const upload = createModuleUpload('freelancer_accounts');
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
          module: 'freelancer_accounts',
          entityId: profile._id.toString(),
          entityType: 'FREELANCER_ACCOUNT'
        });

        await fileMeta.save();

        if (!profile.attachments) {
          profile.attachments = [];
        }
        profile.attachments.push(fileMeta._id);
        await profile.save();
        await profile.populate('attachments');

        await auditLog(req, 'FREELANCER_ACCOUNT_ATTACHMENT_UPLOAD', 'FREELANCER_ACCOUNT', profile._id.toString(), {
          ...getRequestMeta(req),
          fileName: fileMeta.originalName
        });

        const sanitized = sanitizeFreelancerAccount(req.user, profile.toObject ? profile.toObject() : profile);

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
// export const uploadAttachments = async (req, res, next) => {
//   try {
//     const account = await FreelancerAccount.findById(req.params.id);
//     if (!account) {
//       return res.status(404).json(createErrorResponse('NOT_FOUND', 'Account not found', 404));
//     }

//     if (!freelancerAccountPermissions.canEdit(req.user, account).canEdit) {
//       return res.status(403).json(createErrorResponse('ACCESS_DENIED', 'No permission', 403));
//     }

//     const upload = createModuleUpload('freelancer_accounts');
//     upload.array('files', 10)(req, res, async err => {
//       if (err) {
//         if (err.code === 'LIMIT_FILE_SIZE') {
//           return res.status(400).json(createErrorResponse(
//             'FILE_TOO_LARGE',
//             'File size exceeds 10MB limit',
//             400
//           ));
//         }
//         if (err.code === 'LIMIT_FILE_COUNT') {
//           return res.status(400).json(createErrorResponse(
//             'TOO_MANY_FILES',
//             'Maximum 10 files allowed per upload',
//             400
//           ));
//         }
//         return next(err);
//       }
//       if (!req.files?.length) {
//         return res.status(400).json(createErrorResponse('NO_FILES', 'No files uploaded', 400));
//       }

//       for (const file of req.files) {
//         const meta = new FileMeta({
//           originalName: file.originalname,
//           mimeType: file.mimetype,
//           size: file.size,
//           storagePath: file.path,
//           uploadedByUserId: req.user._id,
//           module: 'freelancer_accounts',
//           entityId: account._id.toString(),
//           entityType: 'FREELANCER_ACCOUNT'
//         });

//         await meta.save();
//         account.attachments.push(meta._id);
//       }

//       await account.save();
//       await account.populate('attachments');

//       res.json(createSuccessResponse({
//         profile: sanitizeFreelancerAccount(req.user, account.toObject())
//       }));
//     });
//   } catch (err) {
//     next(err);
//   }
// };
export const uploadAttachments = async (req, res, next) => {
  try {
    const profile = await FreelancerAccount.findById(req.params.id);

    if (!profile) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Freelancer profile not found',
        404
      ));
    }

    const editPermission = freelancerAccountPermissions.canEdit(req.user, profile);
    if (!editPermission.canEdit) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to upload attachments for this profile',
        403
      ));
    }

    const upload = createModuleUpload('freelancer_accounts');
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
            module: 'freelancer_accounts',
            entityId: profile._id.toString(),
            entityType: 'FREELANCER_ACCOUNT'
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

        await auditLog(req, 'FREELANCER_ACCOUNT_ATTACHMENTS_UPLOAD', 'FREELANCER_ACCOUNT', profile._id.toString(), {
          ...getRequestMeta(req),
          fileCount: req.files.length,
          fileNames: req.files.map(f => f.originalname)
        });

        const sanitized = sanitizeFreelancerAccount(req.user, profile.toObject ? profile.toObject() : profile);

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
export const deleteAttachment = async (req, res, next) => {
  try {
    const account = await FreelancerAccount.findById(req.params.id);
    if (!account) {
      return res.status(404).json(createErrorResponse('NOT_FOUND', 'Account not found', 404));
    }

    if (!freelancerAccountPermissions.canEdit(req.user, account).canEdit) {
      return res.status(403).json(createErrorResponse('ACCESS_DENIED', 'No permission', 403));
    }

    const fileMeta = await FileMeta.findById(req.params.fileId);
    if (!fileMeta) {
      return res.status(404).json(createErrorResponse('NOT_FOUND', 'File not found', 404));
    }

    if (fs.existsSync(fileMeta.storagePath)) {
      fs.unlinkSync(fileMeta.storagePath);
    }

    account.attachments = account.attachments.filter(
      id => id.toString() !== fileMeta._id.toString()
    );

    await account.save();
    await fileMeta.deleteOne();
    await account.populate([{ path: 'attachments' },
    { path: 'pictureFileId' },
    { path: 'ownerUserId', select: 'name email' }]);

    res.json(createSuccessResponse({
      profile: sanitizeFreelancerAccount(req.user, account.toObject())
    }));
  } catch (err) {
    next(err);
  }
};