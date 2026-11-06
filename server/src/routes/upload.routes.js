import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { createModuleUpload, VALID_MODULES } from '../middleware/upload.middleware.js';
import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';

const router = express.Router();

// All upload routes require authentication
router.use(requireAuth);

// Legacy route for single file upload (protected)
// Note: Use /api/files/upload?module=<module> for new uploads
router.post('/single', (req, res, next) => {
  // Default to a generic module for legacy compatibility
  const module = req.query.module || 'job_profiles';
  
  if (!VALID_MODULES.includes(module)) {
    return res.status(400).json(createErrorResponse(
      'INVALID_MODULE',
      `Invalid module. Valid modules: ${VALID_MODULES.join(', ')}`,
      400
    ));
  }

  const upload = createModuleUpload(module);
  const singleUpload = upload.single('file');

  singleUpload(req, res, (err) => {
    if (err) {
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
    
    res.json(createSuccessResponse({
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        path: req.file.path
      }
    }, 'File uploaded successfully'));
  });
});

// Legacy route for multiple file upload (protected)
// Note: Use /api/files/upload?module=<module> for new uploads
router.post('/multiple', (req, res, next) => {
  // Default to a generic module for legacy compatibility
  const module = req.query.module || 'job_profiles';
  
  if (!VALID_MODULES.includes(module)) {
    return res.status(400).json(createErrorResponse(
      'INVALID_MODULE',
      `Invalid module. Valid modules: ${VALID_MODULES.join(', ')}`,
      400
    ));
  }

  const upload = createModuleUpload(module);
  const multipleUpload = upload.array('files', 10); // Max 10 files

  multipleUpload(req, res, (err) => {
    if (err) {
      return res.status(400).json(createErrorResponse(
        'UPLOAD_ERROR',
        err.message || 'File upload error',
        400
      ));
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json(createErrorResponse(
        'NO_FILES',
        'No files uploaded',
        400
      ));
    }
    
    const files = req.files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      size: file.size,
      path: file.path
    }));
    
    res.json(createSuccessResponse({
      count: files.length,
      files
    }, 'Files uploaded successfully'));
  });
});

export default router;

