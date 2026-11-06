/**
 * Smoke tests: permissions, finance summary/goals, interview move-stage + activity logs.
 * Supplements security.test.js. Run: npm run test -- server/src/__tests__/smoke.test.js
 */

import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import app from '../app.js';
import User from '../models/User.js';
import FinanceTransaction from '../models/FinanceTransaction.js';
import FinanceGoal from '../models/FinanceGoal.js';
import InterviewBoard from '../models/InterviewBoard.js';
import InterviewStage from '../models/InterviewStage.js';
import InterviewTicket from '../models/InterviewTicket.js';
import InterviewActivityLog from '../models/InterviewActivityLog.js';
import AuditLog from '../models/AuditLog.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI_TEST || process.env.MONGO_URI || 'mongodb://localhost:27017/teammanagement_test';
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

beforeAll(async () => {
  await mongoose.connect(MONGO_URI);
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Smoke: Permissions and limited admin views', () => {
  let memberUser, adminUser, memberToken, adminToken;

  beforeAll(async () => {
    await User.deleteMany({});
    const hash = await bcrypt.hash('password123', 10);
    memberUser = await User.create({
      email: 'member@smoke.com',
      passwordHash: hash,
      name: 'Member',
      role: 'MEMBER',
      status: 'active'
    });
    adminUser = await User.create({
      email: 'admin@smoke.com',
      passwordHash: hash,
      name: 'Admin',
      role: 'ADMIN',
      status: 'active'
    });
    memberToken = jwt.sign(
      { userId: memberUser._id.toString(), email: memberUser.email, role: memberUser.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    adminToken = jwt.sign(
      { userId: adminUser._id.toString(), email: adminUser.email, role: adminUser.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  test('Finance team-summary is admin-only', async () => {
    const r = await request(app)
      .get('/api/finance/team-summary?month=2024-01')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(r.status).toBe(403);

    const r2 = await request(app)
      .get('/api/finance/team-summary?month=2024-01')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 400]).toContain(r2.status);
  });
});

describe('Smoke: Finance summary and goals', () => {
  let user, token;

  beforeAll(async () => {
    await User.deleteMany({});
    await FinanceTransaction.deleteMany({});
    await FinanceGoal.deleteMany({});

    const hash = await bcrypt.hash('password123', 10);
    user = await User.create({
      email: 'finance@smoke.com',
      passwordHash: hash,
      name: 'Finance User',
      role: 'MEMBER',
      status: 'active'
    });
    token = jwt.sign(
      { userId: user._id.toString(), email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const [y, m] = [2024, 6];
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59, 999);

    await FinanceTransaction.create([
      { type: 'income', userId: user._id, date: start, amount: 100, currency: 'USD', approvalStatus: 'approved' },
      { type: 'income', userId: user._id, date: start, amount: 50, currency: 'USD', approvalStatus: 'approved' },
      { type: 'outcome', userId: user._id, date: start, amount: 30, currency: 'USD', approvalStatus: 'approved' },
      { type: 'outcome', userId: user._id, date: start, amount: 20, currency: 'USD', approvalStatus: 'approved' }
    ]);
    await FinanceGoal.findOneAndUpdate(
      { userId: user._id, month: '2024-06' },
      { userId: user._id, month: '2024-06', incomeGoal: 200, expenseLimit: 100 },
      { upsert: true, new: true }
    );
  });

  test('Summary totals match transactions for month', async () => {
    const r = await request(app)
      .get('/api/finance/summary?month=2024-06')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(r.body.ok).toBe(true);
    const t = r.body.data.totals;
    expect(t.totalIncome).toBe(150);
    expect(t.totalOutcome).toBe(50);
    expect(t.net).toBe(100);
  });

  test('Goal progress matches goal and transactions', async () => {
    const r = await request(app)
      .get('/api/finance/summary?month=2024-06')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const g = r.body.data.goalProgress;
    expect(g).toBeDefined();
    expect(g.incomeGoal).toBe(200);
    expect(g.incomeAchieved).toBe(150);
    expect(g.incomeProgress).toBe(75);
    expect(g.expenseLimit).toBe(100);
    expect(g.expenseUsed).toBe(50);
    expect(g.expenseProgress).toBe(50);
    expect(g.isOverExpenseLimit).toBe(false);
  });
});

describe('Smoke: Interview board move-stage and activity logs', () => {
  let user, token, board, stage1, stage2, ticket;

  beforeAll(async () => {
    await User.deleteMany({});
    await InterviewBoard.deleteMany({});
    await InterviewStage.deleteMany({});
    await InterviewTicket.deleteMany({});
    await InterviewActivityLog.deleteMany({});
    await AuditLog.deleteMany({});

    const hash = await bcrypt.hash('password123', 10);
    user = await User.create({
      email: 'board@smoke.com',
      passwordHash: hash,
      name: 'Board User',
      role: 'MEMBER',
      status: 'active'
    });
    token = jwt.sign(
      { userId: user._id.toString(), email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    board = await InterviewBoard.create({
      ownerUserId: user._id,
      title: 'Smoke Board',
      visibility: 'private',
      status: 'active'
    });
    stage1 = await InterviewStage.create({ boardId: board._id, name: 'S1', order: 0, createdBy: user._id });
    stage2 = await InterviewStage.create({ boardId: board._id, name: 'S2', order: 1, createdBy: user._id });
    ticket = await InterviewTicket.create({
      boardId: board._id,
      stageId: stage1._id,
      ownerUserId: user._id,
      companyName: 'Co',
      position: 'Dev',
      status: 'active'
    });
  });

  test('PATCH move-stage updates ticket and creates InterviewActivityLog + AuditLog', async () => {
    const r = await request(app)
      .patch(`/api/interview-boards/${board._id}/tickets/${ticket._id}/move-stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stageId: stage2._id.toString() })
      .expect(200);

    expect(r.body.ok).toBe(true);
    const sid = r.body.data.ticket.stageId?._id || r.body.data.ticket.stageId;
    expect(String(sid)).toBe(stage2._id.toString());

    const activity = await InterviewActivityLog.findOne({
      ticketId: ticket._id,
      actionType: 'STAGE_MOVE'
    });
    expect(activity).toBeDefined();
    expect(activity.diff?.stageId?.old).toBe(stage1._id.toString());
    expect(activity.diff?.stageId?.new).toBe(stage2._id.toString());

    const audit = await AuditLog.findOne({
      action: 'INTERVIEW_TICKET_STAGE_MOVE',
      entityType: 'INTERVIEW_TICKET',
      entityId: ticket._id.toString()
    });
    expect(audit).toBeDefined();
    expect(audit.meta?.newStageId).toBe(stage2._id.toString());
  });
});

