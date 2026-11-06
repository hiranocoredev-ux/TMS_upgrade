/**
 * JobProfile File Upload Endpoints Tests
 * 
 * Tests for:
 * - POST /api/job-profiles/:id/picture
 * - POST /api/job-profiles/:id/attachments
 * - DELETE /api/job-profiles/:id/attachments/:fileId
 */

import request from 'supertest';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import app from '../app.js';
import JobProfile from '../models/JobProfile.js';
import FileMeta from '../models/FileMeta.js';
import User from '../models/User.js';
import { ROLES } from '../constants/roles.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

describe('JobProfile File Upload Endpoints', () => {
  let ownerUser;
  let nonOwnerUser;
  let adminUser;
  let ownerToken;
  let nonOwnerToken;
  let adminToken;
  let testProfile;
  let testProfileId;
  let testFilePath;
  let testImagePath;
  let testPdfPath;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test_team_mgmt');
    
    // Create test users
    const ownerPasswordHash = await bcrypt.hash('password123', 10);
    ownerUser = new User({
      email: 'owner@test.com',
      passwordHash: ownerPasswordHash,
      name: 'Owner User',
      role: ROLES.GROUP_MEMBER,
      status: 'active'
    });
    await ownerUser.save();
    ownerToken = jwt.sign({ userId: ownerUser._id }, process.env.JWT_SECRET || 'test-secret');

    const nonOwnerPasswordHash = await bcrypt.hash('password123', 10);
    nonOwnerUser = new User({
      email: 'nonowner@test.com',
      passwordHash: nonOwnerPasswordHash,
      name: 'Non-Owner User',
      role: ROLES.GROUP_MEMBER,
      status: 'active'
    });
    await nonOwnerUser.save();
    nonOwnerToken = jwt.sign({ userId: nonOwnerUser._id }, process.env.JWT_SECRET || 'test-secret');

    const adminPasswordHash = await bcrypt.hash('password123', 10);
    adminUser = new User({
      email: 'admin@test.com',
      passwordHash: adminPasswordHash,
      name: 'Admin User',
      role: ROLES.ADMIN,
      status: 'active'
    });
    await adminUser.save();
    adminToken = jwt.sign({ userId: adminUser._id }, process.env.JWT_SECRET || 'test-secret');

    // Create test profile owned by ownerUser
    testProfile = new JobProfile({
      name: 'Test Client Profile',
      ownerUserId: ownerUser._id,
      email: 'client@example.com',
      status: 'active'
    });
    await testProfile.save();
    testProfileId = testProfile._id.toString();

    // Create test files
    const testDir = path.join(process.cwd(), 'test_files');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create a test image file (mock)
    testImagePath = path.join(testDir, 'test-image.jpg');
    fs.writeFileSync(testImagePath, Buffer.from('fake image data'));

    // Create a test PDF file (mock)
    testPdfPath = path.join(testDir, 'test-document.pdf');
    fs.writeFileSync(testPdfPath, Buffer.from('fake pdf data'));
  });

  afterAll(async () => {
    // Clean up test files
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
    if (fs.existsSync(testPdfPath)) {
      fs.unlinkSync(testPdfPath);
    }

    // Clean up database
    await User.deleteMany({});
    await JobProfile.deleteMany({});
    await FileMeta.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up FileMeta records before each test
    await FileMeta.deleteMany({});
    
    // Reset profile attachments
    testProfile.attachments = [];
    testProfile.pictureFileId = null;
    await testProfile.save();
  });

  describe('POST /api/job-profiles/:id/picture', () => {
    it('should upload profile picture for owner', async () => {
      const response = await request(app)
        .post(`/api/job-profiles/${testProfileId}/picture`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('picture', testImagePath)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data.profile.pictureFileId).toBeDefined();
      expect(response.body.message).toContain('uploaded successfully');

      // Verify FileMeta was created
      const fileMeta = await FileMeta.findOne({ 
        entityId: testProfileId,
        entityType: 'JOB_PROFILE'
      });
      expect(fileMeta).toBeDefined();
      expect(fileMeta.mimeType).toContain('image');
    });

    it('should reject upload from non-owner', async () => {
      const response = await request(app)
        .post(`/api/job-profiles/${testProfileId}/picture`)
        .set('Authorization', `Bearer ${nonOwnerToken}`)
        .attach('picture', testImagePath)
        .expect(403);

      expect(response.body.ok).toBe(false);
      expect(response.body.code).toBe('ACCESS_DENIED');
    });

    it('should allow admin to upload', async () => {
      const response = await request(app)
        .post(`/api/job-profiles/${testProfileId}/picture`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('picture', testImagePath)
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should replace existing picture', async () => {
      // Upload first picture
      await request(app)
        .post(`/api/job-profiles/${testProfileId}/picture`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('picture', testImagePath);

      const profileBefore = await JobProfile.findById(testProfileId);
      const oldPictureId = profileBefore.pictureFileId;

      // Upload second picture
      await request(app)
        .post(`/api/job-profiles/${testProfileId}/picture`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('picture', testImagePath)
        .expect(200);

      const profileAfter = await JobProfile.findById(testProfileId);
      expect(profileAfter.pictureFileId.toString()).not.toBe(oldPictureId.toString());

      // Old FileMeta should be deleted
      const oldFileMeta = await FileMeta.findById(oldPictureId);
      expect(oldFileMeta).toBeNull();
    });

    it('should reject non-image files', async () => {
      const response = await request(app)
        .post(`/api/job-profiles/${testProfileId}/picture`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('picture', testPdfPath)
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.code).toBe('INVALID_FILE_TYPE');
    });

    it('should reject missing file', async () => {
      const response = await request(app)
        .post(`/api/job-profiles/${testProfileId}/picture`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.code).toBe('NO_FILE');
    });
  });

  describe('POST /api/job-profiles/:id/attachments', () => {
    it('should upload attachment for owner', async () => {
      const response = await request(app)
        .post(`/api/job-profiles/${testProfileId}/attachments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('file', testPdfPath)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data.profile.attachments).toHaveLength(1);
      expect(response.body.data.fileMeta).toBeDefined();

      // Verify profile updated
      const profile = await JobProfile.findById(testProfileId).populate('attachments');
      expect(profile.attachments).toHaveLength(1);
    });

    it('should upload multiple attachments', async () => {
      // Upload first attachment
      await request(app)
        .post(`/api/job-profiles/${testProfileId}/attachments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('file', testPdfPath);

      // Upload second attachment
      const response = await request(app)
        .post(`/api/job-profiles/${testProfileId}/attachments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('file', testPdfPath)
        .expect(200);

      expect(response.body.data.profile.attachments).toHaveLength(2);
    });

    it('should reject upload from non-owner', async () => {
      const response = await request(app)
        .post(`/api/job-profiles/${testProfileId}/attachments`)
        .set('Authorization', `Bearer ${nonOwnerToken}`)
        .attach('file', testPdfPath)
        .expect(403);

      expect(response.body.ok).toBe(false);
      expect(response.body.code).toBe('ACCESS_DENIED');
    });

    it('should allow admin to upload', async () => {
      const response = await request(app)
        .post(`/api/job-profiles/${testProfileId}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', testPdfPath)
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should reject missing file', async () => {
      const response = await request(app)
        .post(`/api/job-profiles/${testProfileId}/attachments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.code).toBe('NO_FILE');
    });
  });

  describe('DELETE /api/job-profiles/:id/attachments/:fileId', () => {
    let attachmentFileId;

    beforeEach(async () => {
      // Upload an attachment before each delete test
      const uploadResponse = await request(app)
        .post(`/api/job-profiles/${testProfileId}/attachments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('file', testPdfPath);

      attachmentFileId = uploadResponse.body.data.fileMeta.id;
    });

    it('should delete attachment for owner', async () => {
      const response = await request(app)
        .delete(`/api/job-profiles/${testProfileId}/attachments/${attachmentFileId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data.profile.attachments).toHaveLength(0);

      // Verify FileMeta deleted
      const fileMeta = await FileMeta.findById(attachmentFileId);
      expect(fileMeta).toBeNull();
    });

    it('should reject delete from non-owner', async () => {
      const response = await request(app)
        .delete(`/api/job-profiles/${testProfileId}/attachments/${attachmentFileId}`)
        .set('Authorization', `Bearer ${nonOwnerToken}`)
        .expect(403);

      expect(response.body.ok).toBe(false);
      expect(response.body.code).toBe('ACCESS_DENIED');
    });

    it('should allow admin to delete', async () => {
      const response = await request(app)
        .delete(`/api/job-profiles/${testProfileId}/attachments/${attachmentFileId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should reject deleting non-existent attachment', async () => {
      const fakeFileId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .delete(`/api/job-profiles/${testProfileId}/attachments/${fakeFileId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);

      expect(response.body.ok).toBe(false);
      expect(response.body.code).toBe('NOT_FOUND');
    });

    it('should reject deleting attachment from different profile', async () => {
      // Create another profile with attachment
      const otherProfile = new JobProfile({
        name: 'Other Profile',
        ownerUserId: ownerUser._id,
        status: 'active'
      });
      await otherProfile.save();

      const uploadResponse = await request(app)
        .post(`/api/job-profiles/${otherProfile._id}/attachments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('file', testPdfPath);

      const otherAttachmentId = uploadResponse.body.data.fileMeta.id;

      // Try to delete from test profile using other profile's attachment ID
      const response = await request(app)
        .delete(`/api/job-profiles/${testProfileId}/attachments/${otherAttachmentId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);

      expect(response.body.ok).toBe(false);
      expect(response.body.code).toBe('NOT_FOUND');

      // Clean up
      await otherProfile.deleteOne();
    });
  });

  describe('File Validation', () => {
    it('should reject file larger than 10MB', async () => {
      // Create a large file (mock - in real test, would need actual large file)
      const largeFilePath = path.join(process.cwd(), 'test_files', 'large-file.jpg');
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      fs.writeFileSync(largeFilePath, largeBuffer);

      const response = await request(app)
        .post(`/api/job-profiles/${testProfileId}/picture`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('picture', largeFilePath)
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.code).toBe('FILE_TOO_LARGE');

      // Clean up
      if (fs.existsSync(largeFilePath)) {
        fs.unlinkSync(largeFilePath);
      }
    });
  });
});

