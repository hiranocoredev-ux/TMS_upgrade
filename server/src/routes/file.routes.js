import express from 'express';
import path from 'path';
import fs from 'fs';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { createModuleUpload, VALID_MODULES } from '../middleware/upload.middleware.js';
import FileMeta from '../models/FileMeta.js';
import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';
import { log as auditLog, getRequestMeta } from '../utils/audit.js';
import { hasAdminPrivileges, ROLES } from '../utils/roleMapper.js';
import User from '../models/User.js';

const router = express.Router();

// All file routes require authentication

// Upload file
router.post('/upload', requireAuth, async (req, res, next) => {
  try {
    const { module } = req.query;

    if (!module) {
      return res.status(400).json(createErrorResponse(
        'MODULE_REQUIRED',
        'Module parameter is required',
        400
      ));
    }

    if (!VALID_MODULES.includes(module)) {
      return res.status(400).json(createErrorResponse(
        'INVALID_MODULE',
        `Invalid module. Valid modules: ${VALID_MODULES.join(', ')}`,
        400
      ));
    }

    // Create multer instance for this module
    const upload = createModuleUpload(module);
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
        return res.status(400).json(createErrorResponse(
          'UPLOAD_ERROR',
          err.message || 'File upload error',
          400
        ));
      }

      if (!req.file) {
        return res.status(400).json(createErrorResponse(
          'NO_FILE',
          'No file uploaded',
          400
        ));
      }

      try {
        // Create file metadata record
        const fileMeta = new FileMeta({
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          storagePath: req.file.path,
          uploadedByUserId: req.user._id,
          module: module
        });

        await fileMeta.save();

        // Audit log
        await auditLog(req, 'FILE_UPLOAD', 'FILE', fileMeta._id.toString(), {
          ...getRequestMeta(req),
          file: {
            originalName: fileMeta.originalName,
            mimeType: fileMeta.mimeType,
            size: fileMeta.size,
            module: fileMeta.module
          }
        });

        res.status(201).json(createSuccessResponse({
          fileMeta: {
            id: fileMeta._id,
            originalName: fileMeta.originalName,
            mimeType: fileMeta.mimeType,
            size: fileMeta.size,
            module: fileMeta.module,
            uploadedBy: {
              id: req.user._id,
              email: req.user.email,
              name: req.user.name
            },
            createdAt: fileMeta.createdAt
          }
        }, 'File uploaded successfully'));
      } catch (error) {
        // If metadata save fails, delete the uploaded file
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        throw error;
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Check if user has access to download a file
 * This function enforces strict access control based on file module and user role
 */
const checkDownloadAccess = async (req, fileMeta) => {
  const user = req.user;

  // Ensure uploadedByUserId is properly compared (handle both ObjectId and populated)
  const uploadedByUserId = fileMeta.uploadedByUserId?._id 
    ? fileMeta.uploadedByUserId._id.toString() 
    : fileMeta.uploadedByUserId.toString();
  const userId = user._id.toString();

  // Personal profiles: only owner (SUPER_ADMIN can access all)
  if (fileMeta.module === 'personal_profiles') {
    if (user.role === ROLES.SUPER_ADMIN) {
      return true;
    }
    return uploadedByUserId === userId;
  }

      // Freelancer accounts: SUPER_ADMIN/ADMIN only (no owner access for members)
      if (fileMeta.module === 'freelancer_accounts') {
        return user.role === ROLES.SUPER_ADMIN || hasAdminPrivileges(user);
      }

      // Other modules: owner, SUPER_ADMIN, or ADMIN can access
      // TODO: Add module-specific rules for owner/assignee when entities are implemented
      if (fileMeta.module === 'citizen_profiles') {
        return true;
      }

      if (fileMeta.module === 'profiles' ||
          fileMeta.module === 'job_profiles' ||
          fileMeta.module === 'job_tickets' ||
          fileMeta.module === 'projects' ||
          fileMeta.module === 'finance') {
        // Owner can access
        if (uploadedByUserId === userId) {
          return true;
        }
        // SUPER_ADMIN and ADMIN (including legacy BOSS) can access
        if (user.role === ROLES.SUPER_ADMIN || hasAdminPrivileges(user)) {
          return true;
        }
    // TODO: Check assignee/entity ownership when entities are implemented
    return false;
  }

  // Default: deny access
  return false;
};

// Download file - publicly accessible (no auth required)
router.get('/:id/download',async (req, res, next) => {
  try {
    const { id } = req.params;
    const fileMeta = await FileMeta.findById(id);

    if (!fileMeta) {
      return res.status(404).json(createErrorResponse(
        'FILE_NOT_FOUND',
        'File not found',
        404
      ));
    }

    // Construct full file path
    // const filePath = path.isAbsolute(fileMeta.storagePath) 
    //   ? fileMeta.storagePath 
    //   : path.join(UPLOAD_DIR, fileMeta.storagePath);

    const filePath = fileMeta.storagePath;
    console.log('UPLOAD_DIR:', fileMeta.storagePath);
    console.log('Resolved file path:', filePath);

    // Check if file exists on disk
    if (!fs.existsSync(filePath)) {
      return res.status(404).json(createErrorResponse(
        'FILE_NOT_FOUND',
        'File not found on server',
        404
      ));
    }

    // Check if file is an image (for inline display) or other file (for download)
    const isImage = fileMeta.mimeType && fileMeta.mimeType.startsWith('image/');
    
    if (isImage) {
      // For images, use sendFile with inline disposition for browser display
      res.setHeader('Content-Type', fileMeta.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${fileMeta.originalName}"`);
      res.sendFile(path.resolve(filePath), (err) => {
        if (err) {
          if (!res.headersSent) {
            console.error('File send error:', err);
            res.status(500).json(createErrorResponse(
              'DOWNLOAD_ERROR',
              'Error sending file',
              500
            ));
          }
        }
      });
    } else {
      // For other files, use download() to trigger browser download
      res.download(filePath, fileMeta.originalName, (err) => {
        if (err) {
          if (!res.headersSent) {
            console.error('File download error:', err);
            res.status(500).json(createErrorResponse(
              'DOWNLOAD_ERROR',
              'Error downloading file',
              500
            ));
          }
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

// Get file metadata (for authorized users)
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const fileMeta = await FileMeta.findById(id).populate('uploadedByUserId', 'email name role');

    if (!fileMeta) {
      return res.status(404).json(createErrorResponse(
        'FILE_NOT_FOUND',
        'File not found',
        404
      ));
    }

    // Check access permissions (same as download)
    const hasAccess = await checkDownloadAccess(req, fileMeta);
    if (!hasAccess) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to access this file',
        403
      ));
    }

    res.json(createSuccessResponse({
      fileMeta: {
        id: fileMeta._id,
        originalName: fileMeta.originalName,
        mimeType: fileMeta.mimeType,
        size: fileMeta.size,
        module: fileMeta.module,
        entityId: fileMeta.entityId,
        entityType: fileMeta.entityType,
        uploadedBy: fileMeta.uploadedByUserId ? {
          id: fileMeta.uploadedByUserId._id,
          email: fileMeta.uploadedByUserId.email,
          name: fileMeta.uploadedByUserId.name,
          role: fileMeta.uploadedByUserId.role
        } : null,
        createdAt: fileMeta.createdAt
      }
    }));
  } catch (error) {
    next(error);
  }
});

export default router;

