/**
 * Sanitizer Tests
 * 
 * Tests for sensitive field masking based on ownership and role
 */

import {
  maskString,
  maskEmail,
  maskPhone,
  maskBankAccount,
  maskIdNumber,
  shouldShowUnmasked,
  sanitizeJobProfile,
  sanitizeFreelancerAccount,
  sanitizeForRequester
} from '../utils/sanitizer.js';
import { ROLES } from '../constants/roles.js';

describe('Sanitizer Utilities', () => {
  describe('maskString', () => {
    it('should mask middle of string', () => {
      expect(maskString('test1234', 2, 2)).toBe('te***34');
    });

    it('should return *** for short strings', () => {
      expect(maskString('ab', 2, 2)).toBe('***');
    });

    it('should handle empty string', () => {
      expect(maskString('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(maskString(null)).toBe(null);
      expect(maskString(undefined)).toBe(undefined);
    });
  });

  describe('maskEmail', () => {
    it('should mask username but preserve domain', () => {
      expect(maskEmail('john.doe@example.com')).toBe('j***e@example.com');
    });

    it('should handle short username', () => {
      expect(maskEmail('ab@example.com')).toBe('***@example.com');
    });

    it('should fallback to string masking if no @', () => {
      const result = maskEmail('notanemail');
      expect(result).toContain('***');
    });
  });

  describe('maskPhone', () => {
    it('should mask phone with country code', () => {
      expect(maskPhone('+1234567890')).toMatch(/^\+12.*89$/);
    });

    it('should mask phone without country code', () => {
      expect(maskPhone('1234567890')).toMatch(/.*90$/);
    });

    it('should return *** for short phone', () => {
      expect(maskPhone('123')).toBe('***');
    });
  });

  describe('maskBankAccount', () => {
    it('should show last 4 digits', () => {
      expect(maskBankAccount('1234567890123456')).toBe('****3456');
    });

    it('should return **** for short account', () => {
      expect(maskBankAccount('123')).toBe('****');
    });
  });

  describe('maskIdNumber', () => {
    it('should show first 2 and last 2 chars', () => {
      expect(maskIdNumber('1234567890')).toMatch(/^12.*90$/);
    });

    it('should return **** for short ID', () => {
      expect(maskIdNumber('123')).toBe('****');
    });
  });

  describe('shouldShowUnmasked', () => {
    const ownerUser = {
      _id: 'owner123',
      role: ROLES.GROUP_MEMBER
    };

    const adminUser = {
      _id: 'admin123',
      role: ROLES.ADMIN
    };

    const superAdminUser = {
      _id: 'super123',
      role: ROLES.SUPER_ADMIN
    };

    const otherUser = {
      _id: 'other123',
      role: ROLES.GROUP_MEMBER
    };

    const entity = {
      ownerUserId: { toString: () => 'owner123' },
      _id: 'entity123'
    };

    it('should return true for owner', () => {
      expect(shouldShowUnmasked(ownerUser, entity)).toBe(true);
    });

    it('should return true for SUPER_ADMIN', () => {
      expect(shouldShowUnmasked(superAdminUser, entity)).toBe(true);
    });

    it('should return true for ADMIN', () => {
      expect(shouldShowUnmasked(adminUser, entity)).toBe(true);
    });

    it('should return false for non-owner member', () => {
      expect(shouldShowUnmasked(otherUser, entity)).toBe(false);
    });
  });

  describe('sanitizeJobProfile', () => {
    const ownerUser = {
      _id: 'owner123',
      role: ROLES.GROUP_MEMBER
    };

    const adminUser = {
      _id: 'admin123',
      role: ROLES.ADMIN
    };

    const otherUser = {
      _id: 'other123',
      role: ROLES.GROUP_MEMBER
    };

    const profile = {
      _id: 'profile123',
      name: 'Test Profile',
      ownerUserId: { toString: () => 'owner123' },
      personalInfo: {
        fullName: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        address: '123 Main Street, City, State',
        bankAccount: '1234567890123456',
        idNumber: 'ID123456789',
        driverLicenseNumber: 'DL987654321'
      }
    };

    it('should not mask for owner', () => {
      const sanitized = sanitizeJobProfile(ownerUser, profile);
      expect(sanitized.personalInfo.email).toBe('john.doe@example.com');
      expect(sanitized.personalInfo.phone).toBe('+1234567890');
      expect(sanitized.personalInfo.bankAccount).toBe('1234567890123456');
    });

    it('should not mask for ADMIN', () => {
      const sanitized = sanitizeJobProfile(adminUser, profile);
      expect(sanitized.personalInfo.email).toBe('john.doe@example.com');
      expect(sanitized.personalInfo.phone).toBe('+1234567890');
      expect(sanitized.personalInfo.bankAccount).toBe('1234567890123456');
    });

    it('should mask sensitive fields for non-owner', () => {
      const sanitized = sanitizeJobProfile(otherUser, profile);
      expect(sanitized.personalInfo.email).not.toBe('john.doe@example.com');
      expect(sanitized.personalInfo.email).toContain('@example.com'); // Domain preserved
      expect(sanitized.personalInfo.phone).not.toBe('+1234567890');
      expect(sanitized.personalInfo.bankAccount).toMatch(/^\*\*\*\*/); // Starts with ****
      expect(sanitized.personalInfo.idNumber).toMatch(/^ID.*89$/); // First 2 and last 2 visible
    });

    it('should preserve non-sensitive fields', () => {
      const sanitized = sanitizeJobProfile(otherUser, profile);
      expect(sanitized.name).toBe('Test Profile');
      expect(sanitized.personalInfo.fullName).toBe('John Doe');
    });
  });

  describe('sanitizeFreelancerAccount', () => {
    const ownerUser = {
      _id: 'owner123',
      role: ROLES.GROUP_MEMBER
    };

    const otherUser = {
      _id: 'other123',
      role: ROLES.GROUP_MEMBER
    };

    const account = {
      _id: 'account123',
      platform: 'Upwork',
      ownerUserId: { toString: () => 'owner123' },
      username: 'john_doe',
      email: 'john@example.com',
      passwordEncrypted: 'encrypted123',
      recovery: 'recovery_info'
    };

    it('should always mask password', () => {
      const sanitized = sanitizeFreelancerAccount(ownerUser, account);
      expect(sanitized.passwordEncrypted).toBeUndefined();
      expect(sanitized.passwordMasked).toBe('***');
    });

    it('should not mask username/email for owner', () => {
      const sanitized = sanitizeFreelancerAccount(ownerUser, account);
      expect(sanitized.username).toBe('john_doe');
      expect(sanitized.email).toBe('john@example.com');
    });

    it('should mask username/email for non-owner', () => {
      const sanitized = sanitizeFreelancerAccount(otherUser, account);
      expect(sanitized.username).not.toBe('john_doe');
      expect(sanitized.username).toContain('***');
      expect(sanitized.email).not.toBe('john@example.com');
      expect(sanitized.email).toContain('@example.com'); // Domain preserved
    });
  });

  describe('sanitizeForRequester', () => {
    const user = {
      _id: 'user123',
      role: ROLES.GROUP_MEMBER
    };

    it('should route to correct sanitizer', () => {
      const profile = {
        ownerUserId: { toString: () => 'user123' },
        personalInfo: { email: 'test@example.com' }
      };

      const sanitized = sanitizeForRequester(user, profile, 'JOB_PROFILE');
      expect(sanitized).toBeDefined();
    });

    it('should handle unknown entity type', () => {
      const entity = { test: 'value' };
      const sanitized = sanitizeForRequester(user, entity, 'UNKNOWN');
      expect(sanitized).toEqual(entity); // Should return as-is
    });
  });
});

