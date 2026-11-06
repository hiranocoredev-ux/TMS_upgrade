import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

if (!ENCRYPTION_KEY) {
  console.warn('⚠️  ENCRYPTION_KEY not set. Encryption will not work properly.');
}

/**
 * Encrypt data using AES-256-GCM
 * @param {string} text - Plain text to encrypt
 * @returns {string} Encrypted string (base64 encoded: iv:authTag:encryptedData)
 */
export const encrypt = (text) => {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY not configured');
  }

  if (!text) {
    return text;
  }

  // Ensure key is exactly 32 bytes (256 bits)
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, '0'), 'utf8');
  
  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  // Encrypt
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  // Get authentication tag
  const authTag = cipher.getAuthTag();
  
  // Combine iv:authTag:encryptedData (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
};

/**
 * Decrypt data using AES-256-GCM
 * @param {string} encryptedData - Encrypted string (base64 encoded: iv:authTag:encryptedData)
 * @returns {string} Decrypted plain text
 */
export const decrypt = (encryptedData) => {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY not configured');
  }

  if (!encryptedData) {
    return encryptedData;
  }

  // Ensure key is exactly 32 bytes (256 bits)
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, '0'), 'utf8');
  
  // Split the encrypted data
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const [ivBase64, authTagBase64, encrypted] = parts;
  
  // Convert from base64
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  
  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  // Decrypt
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

