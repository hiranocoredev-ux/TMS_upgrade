import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Allowed file types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'image/jpeg',
  'image/jpg',
  'image/png'
];

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.jpg', '.jpeg', '.png'];

// Valid modules
export const VALID_MODULES = [
  'profiles',
  'citizen_profiles',
  'job_profiles',
  'freelancer_accounts',
  'personal_profiles',
  'job_tickets',
  'projects',
  'finance',
  'avatars'
];

/**
 * Get storage directory for a module
 */
export const getModuleStoragePath = (module) => {
  if (!VALID_MODULES.includes(module)) {
    throw new Error(`Invalid module: ${module}`);
  }
  return path.join(UPLOAD_DIR, module);
};

/**
 * Ensure directory exists
 */
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Create multer storage for a specific module
 */
export const createModuleStorage = (module) => {
  const modulePath = getModuleStoragePath(module);
  ensureDirectoryExists(modulePath);

  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, modulePath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, ext);
      // Sanitize filename
      const sanitizedName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
      cb(null, `${sanitizedName}-${uniqueSuffix}${ext}`);
    }
  });
};

/**
 * File filter for allowed types
 */
export const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isValidExt = ALLOWED_EXTENSIONS.includes(ext);
  const isValidMime = ALLOWED_MIME_TYPES.includes(file.mimetype);

  if (isValidExt && isValidMime) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
  }
};

/**
 * Create multer instance for a specific module
 */
export const createModuleUpload = (module) => {
  return multer({
    storage: createModuleStorage(module),
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: fileFilter
  });
};

// Ensure base upload directory exists
ensureDirectoryExists(UPLOAD_DIR);
VALID_MODULES.forEach(module => {
  ensureDirectoryExists(getModuleStoragePath(module));
});
