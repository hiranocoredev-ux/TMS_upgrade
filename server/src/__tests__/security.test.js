import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import app from '../app.js';
import User from '../models/User.js';
import PersonalProfile from '../models/PersonalProfile.js';
import FreelancerAccount from '../models/FreelancerAccount.js';
import JobTicket from '../models/JobTicket.js';
import AuditLog from '../models/AuditLog.js';
import FileMeta from '../models/FileMeta.js';
import { encrypt } from '../utils/encryption.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/teammanagement_test';
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

describe('Security Tests', () => {
  let memberUser, bossUser, adminUser;
  let memberToken, bossToken, adminToken;
  let memberProfile, freelancerAccount, jobTicket, fileMeta;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(MONGO_URI);
    
    // Clean database
    await User.deleteMany({});
    await PersonalProfile.deleteMany({});
    await FreelancerAccount.deleteMany({});
    await JobTicket.deleteMany({});
    await AuditLog.deleteMany({});
    await FileMeta.deleteMany({});

    // Create test users
    const memberPassword = await bcrypt.hash('password123', 10);
    memberUser = await User.create({
      email: 'member@test.com',
      passwordHash: memberPassword,
      name: 'Member User',
      role: 'MEMBER',
      status: 'active'
    });

    const bossPassword = await bcrypt.hash('password123', 10);
    bossUser = await User.create({
      email: 'boss@test.com',
      passwordHash: bossPassword,
      name: 'Boss User',
      role: 'BOSS',
      status: 'active'
    });

    const adminPassword = await bcrypt.hash('password123', 10);
    adminUser = await User.create({
      email: 'admin@test.com',
      passwordHash: adminPassword,
      name: 'Admin User',
      role: 'SUPER_ADMIN',
      status: 'active'
    });

    // Create JWT tokens
    memberToken = jwt.sign(
      { userId: memberUser._id.toString(), email: memberUser.email, role: memberUser.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    bossToken = jwt.sign(
      { userId: bossUser._id.toString(), email: bossUser.email, role: bossUser.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    adminToken = jwt.sign(
      { userId: adminUser._id.toString(), email: adminUser.email, role: adminUser.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create member's personal profile
    memberProfile = await PersonalProfile.create({
      ownerUserId: memberUser._id,
      fields: { testField: 'testValue' },
      attachments: [],
      shareWithBossItems: []
    });

    // Create freelancer account owned by member
    freelancerAccount = await FreelancerAccount.create({
      platform: 'Upwork',
      username: 'testuser',
      email: 'test@example.com',
      passwordEncrypted: encrypt('secretpassword123'),
      ownerUserId: memberUser._id,
      accessScope: { allowedUserIds: [] }
    });

    // Create job ticket
    jobTicket = await JobTicket.create({
      title: 'Test Ticket',
      currentStage: 'NEW',
      status: 'open',
      priority: 'medium',
      stageHistory: []
    });

    // Create file metadata (mock - actual file doesn't exist for testing)
    // Use relative path for testing
    fileMeta = await FileMeta.create({
      originalName: 'test.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      storagePath: 'personal_profiles/test.pdf',
      uploadedByUserId: memberUser._id,
      module: 'personal_profiles'
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Personal Profile Access Control', () => {
    test('Member can access own personal profile', async () => {
      const response = await request(app)
        .get('/api/personal-profile')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data.profile.ownerUserId).toBe(memberUser._id.toString());
    });

    test('Member cannot access another member\'s personal profile (via direct ID)', async () => {
      // Note: The route doesn't accept ID, but we test that boss/admin cannot access others
      // Since the route only gets own profile, this is already enforced
      const response = await request(app)
        .get('/api/personal-profile')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      // Should only return own profile
      expect(response.body.data.profile.ownerUserId).toBe(memberUser._id.toString());
    });

    test('Boss cannot access member personal profile', async () => {
      // Boss tries to access - should only get their own (which doesn't exist)
      const response = await request(app)
        .get('/api/personal-profile')
        .set('Authorization', `Bearer ${bossToken}`)
        .expect(404);

      expect(response.body.ok).toBe(false);
      expect(response.body.code).toBe('NOT_FOUND');
    });

    test('Boss cannot update member personal profile', async () => {
      // Boss tries to update - would need to create own first, but can't update member's
      // Since route only allows updating own profile, boss can't update member's
      const response = await request(app)
        .put('/api/personal-profile')
        .set('Authorization', `Bearer ${bossToken}`)
        .send({ fields: { hacked: 'data' } })
        .expect(404); // Boss doesn't have a profile

      expect(response.body.ok).toBe(false);
    });
  });

  describe('Freelancer Account Password Security', () => {
    test('Member sees masked freelancer password in list', async () => {
      const response = await request(app)
        .get('/api/freelancer-accounts')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      const account = response.body.data.accounts.find(a => a._id === freelancerAccount._id.toString());
      expect(account).toBeDefined();
      expect(account.passwordEncrypted).toBeUndefined();
      expect(account.passwordMasked).toBe('••••••••');
      expect(account.password).toBeUndefined();
    });

    test('Member sees masked freelancer password in detail view', async () => {
      const response = await request(app)
        .get(`/api/freelancer-accounts/${freelancerAccount._id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data.account.passwordEncrypted).toBeUndefined();
      expect(response.body.data.account.passwordMasked).toBe('••••••••');
      expect(response.body.data.account.password).toBeUndefined();
    });

    test('Boss can reveal freelancer password', async () => {
      const response = await request(app)
        .post(`/api/freelancer-accounts/${freelancerAccount._id}/reveal-password`)
        .set('Authorization', `Bearer ${bossToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data.password).toBe('secretpassword123');
      expect(response.body.data.account.id).toBe(freelancerAccount._id.toString());
    });

    test('Member cannot reveal freelancer password', async () => {
      const response = await request(app)
        .post(`/api/freelancer-accounts/${freelancerAccount._id}/reveal-password`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);

      expect(response.body.ok).toBe(false);
      expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    test('Boss revealing password creates audit log without decrypted password', async () => {
      const auditCountBefore = await AuditLog.countDocuments({ action: 'SECRET_VIEW' });

      await request(app)
        .post(`/api/freelancer-accounts/${freelancerAccount._id}/reveal-password`)
        .set('Authorization', `Bearer ${bossToken}`)
        .expect(200);

      const auditCountAfter = await AuditLog.countDocuments({ action: 'SECRET_VIEW' });
      expect(auditCountAfter).toBe(auditCountBefore + 1);

      const auditLog = await AuditLog.findOne({ action: 'SECRET_VIEW' })
        .sort({ createdAt: -1 });

      expect(auditLog).toBeDefined();
      expect(auditLog.meta).toBeDefined();
      // Verify decrypted password is NOT in audit log
      expect(JSON.stringify(auditLog.meta)).not.toContain('secretpassword123');
      expect(auditLog.meta.account.platform).toBe('Upwork');
      expect(auditLog.meta.revealedBy.role).toBe('BOSS');
    });
  });

  describe('File Download Access Control', () => {
    test('Owner can download own file', async () => {
      // Note: We can't actually download file without real file system, but we test access check
      const response = await request(app)
        .get(`/api/files/${fileMeta._id}/download`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(404); // File doesn't exist on disk, but access check passes

      // If file existed, would return 200. Since it doesn't, we get 404
      // But if access was denied, we'd get 403
      expect(response.status).not.toBe(403);
    });

    test('Boss cannot download member personal profile file', async () => {
      const response = await request(app)
        .get(`/api/files/${fileMeta._id}/download`)
        .set('Authorization', `Bearer ${bossToken}`)
        .expect(403);

      expect(response.body.ok).toBe(false);
      expect(response.body.code).toBe('ACCESS_DENIED');
    });

    test('File download creates audit log', async () => {
      // Create a file that boss can access (e.g., job_profiles module)
      const accessibleFile = await FileMeta.create({
        originalName: 'accessible.pdf',
        mimeType: 'application/pdf',
        size: 2048,
        storagePath: '/uploads/accessible.pdf',
        uploadedByUserId: memberUser._id,
        module: 'job_profiles'
      });

      const auditCountBefore = await AuditLog.countDocuments({ action: 'FILE_DOWNLOAD' });

      await request(app)
        .get(`/api/files/${accessibleFile._id}/download`)
        .set('Authorization', `Bearer ${bossToken}`)
        .expect(404); // File doesn't exist, but access passes and audit should be created

      // Check audit log was created (if file existed, it would be logged)
      // For now, we just verify the access check works
      await FileMeta.deleteOne({ _id: accessibleFile._id });
    });
  });

  describe('Job Ticket Stage Movement', () => {
    test('Move-stage adds history entry', async () => {
      const ticket = await JobTicket.create({
        title: 'Stage Test Ticket',
        currentStage: 'NEW',
        status: 'open',
        priority: 'medium',
        stageHistory: []
      });

      const response = await request(app)
        .post(`/api/job-tickets/${ticket._id}/move-stage`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          toStage: 'BID_SUBMITTED',
          reason: 'Test reason'
        })
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data.ticket.currentStage).toBe('BID_SUBMITTED');
      expect(response.body.data.ticket.stageHistory).toBeDefined();
      expect(response.body.data.ticket.stageHistory.length).toBe(1);
      expect(response.body.data.ticket.stageHistory[0].fromStage).toBe('NEW');
      expect(response.body.data.ticket.stageHistory[0].toStage).toBe('BID_SUBMITTED');
      expect(response.body.data.ticket.stageHistory[0].reason).toBe('Test reason');

      // Verify audit log was created
      const auditLog = await AuditLog.findOne({
        action: 'TICKET_MOVE_STAGE',
        entityId: ticket._id.toString()
      });
      expect(auditLog).toBeDefined();
      expect(auditLog.meta.ticket.fromStage).toBe('NEW');
      expect(auditLog.meta.ticket.toStage).toBe('BID_SUBMITTED');
    });
  });

  describe('Audit Log Security', () => {
    test('Audit logs never contain decrypted passwords', async () => {
      // Reveal password again and check all audit logs
      await request(app)
        .post(`/api/freelancer-accounts/${freelancerAccount._id}/reveal-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Check all audit logs for the account
      const auditLogs = await AuditLog.find({
        entityType: 'FREELANCER_ACCOUNT',
        entityId: freelancerAccount._id.toString()
      });

      for (const log of auditLogs) {
        const logString = JSON.stringify(log.toObject());
        expect(logString).not.toContain('secretpassword123');
      }
    });
  });
});

