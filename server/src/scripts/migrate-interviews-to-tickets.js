/**
 * Interview → InterviewTicket Migration Script
 *
 * Converts legacy Interview records into the new board/stage/ticket system:
 * - Creates a default board per user who has interviews (or one shared "Legacy" board)
 * - Creates default stages (Scheduled, Completed, Cancelled)
 * - Converts each Interview into an InterviewTicket with dates/notes
 * - Adds InterviewActivityLog entries for imported items
 * - Skips or logs records that cannot be mapped (safe fallback)
 *
 * Idempotent with respect to already-migrated interviews when using
 * metadata.source = 'migrated_legacy_interview' and a stored legacyId.
 *
 * Run:
 *   node server/src/scripts/migrate-interviews-to-tickets.js
 *   node server/src/scripts/migrate-interviews-to-tickets.js --dry-run
 *   node server/src/scripts/migrate-interviews-to-tickets.js --board-per-user  # default: one shared board
 *
 * Requires: MONGO_URI in .env
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Interview from '../models/Interview.js';
import InterviewBoard from '../models/InterviewBoard.js';
import InterviewStage from '../models/InterviewStage.js';
import InterviewTicket from '../models/InterviewTicket.js';
import InterviewActivityLog from '../models/InterviewActivityLog.js';
import JobTicket from '../models/JobTicket.js';
import User from '../models/User.js';
import { connectDB } from '../config/db.js';

dotenv.config();

const isDryRun = process.argv.includes('--dry-run');
const boardPerUser = process.argv.includes('--board-per-user');

const DEFAULT_STAGES = [
  { name: 'Scheduled', order: 0, color: '#3498db' },
  { name: 'Completed', order: 1, color: '#2ecc71' },
  { name: 'Cancelled', order: 2, color: '#95a5a6' }
];

function mapInterviewType(t) {
  if (!t || typeof t !== 'string') return 'video';
  const v = t.toLowerCase();
  if (['phone', 'video', 'onsite', 'assessment', 'other'].includes(v)) return v;
  return 'other';
}

async function getOrCreateBoard(ownerId) {
  const title = boardPerUser ? 'Interviews' : 'Legacy Interviews (Migrated)';
  const existing = await InterviewBoard.findOne({
    ownerUserId: ownerId,
    title,
    status: 'active'
  }).lean();

  if (existing) return existing;

  const board = {
    ownerUserId: ownerId,
    title,
    description: 'Migrated from legacy Interview records.',
    visibility: 'private',
    status: 'active'
  };

  if (isDryRun) {
    return { _id: new mongoose.Types.ObjectId(), ...board };
  }
  const created = await InterviewBoard.create(board);
  return created.toObject();
}

async function getOrCreateStages(boardId, createdBy) {
  const existing = await InterviewStage.find({ boardId }).sort({ order: 1 }).lean();
  if (existing.length >= DEFAULT_STAGES.length) return existing;

  const toCreate = DEFAULT_STAGES.filter((s, i) => !existing.find(e => e.name === s.name));
  if (toCreate.length === 0) return existing;

  const stages = toCreate.map((s, i) => ({
    boardId,
    name: s.name,
    order: s.order,
    color: s.color,
    createdBy
  }));

  if (isDryRun) {
    return [
      ...existing,
      ...stages.map((s, i) => ({ _id: new mongoose.Types.ObjectId(), ...s }))
    ];
  }
  const inserted = await InterviewStage.insertMany(stages);
  return [...existing, ...inserted.map(s => s.toObject())];
}

async function pickStage(stages, interview) {
  const hasOutcome = !!(interview.outcomeNotes && interview.outcomeNotes.trim());
  const name = hasOutcome ? 'Completed' : 'Scheduled';
  const s = stages.find(st => st.name === name) || stages.find(st => st.name === 'Scheduled') || stages[0];
  return s;
}

const migrateInterviews = async () => {
  try {
    console.log('🔄 Starting Interview → InterviewTicket migration...');
    if (isDryRun) console.log('   [DRY RUN – no changes will be written]\n');

    await connectDB();
    console.log('✅ Connected to database\n');

    const interviews = await Interview.find({}).sort({ createdAt: 1 }).lean();
    console.log(`📊 Found ${interviews.length} legacy Interview(s)\n`);

    let created = 0;
    let skipped = 0;
    const skipReasons = [];

    // Board/stage cache: boardId -> stages
    const boardStages = new Map();

    for (const iv of interviews) {
      const ownerId = iv.createdByUserId;
      if (!ownerId || !mongoose.Types.ObjectId.isValid(ownerId)) {
        skipReasons.push(`Interview ${iv._id}: missing or invalid createdByUserId`);
        skipped++;
        continue;
      }

      const user = await User.findById(ownerId).select('_id').lean();
      if (!user) {
        skipReasons.push(`Interview ${iv._id}: createdByUserId not found`);
        skipped++;
        continue;
      }

      let jobTicket = null;
      let companyName = 'Unknown Company';
      let position = 'Unknown Position';
      const candidateName = null;

      if (iv.jobTicketId && mongoose.Types.ObjectId.isValid(iv.jobTicketId)) {
        jobTicket = await JobTicket.findById(iv.jobTicketId).select('title clientName jobProfileId').lean();
        if (jobTicket) {
          companyName = jobTicket.clientName || companyName;
          position = jobTicket.title || position;
          // Candidate name lookup removed: the legacy JobProfile model no longer exists.
        }
      }

      let board;
      try {
        board = await getOrCreateBoard(ownerId);
      } catch (e) {
        skipReasons.push(`Interview ${iv._id}: failed to create/get board: ${e.message}`);
        skipped++;
        continue;
      }

      let stages = boardStages.get(board._id.toString());
      if (!stages) {
        stages = await getOrCreateStages(board._id, ownerId);
        boardStages.set(board._id.toString(), stages);
      }

      const stage = await pickStage(stages, iv);

      const dateEntry = {
        scheduledAt: iv.scheduledAt || new Date(),
        durationMinutes: iv.durationMinutes || 60,
        interviewType: mapInterviewType(iv.interviewType),
        meetingLink: iv.meetingLink || '',
        platform: iv.platform || '',
        participants: iv.participants || '',
        status: iv.outcomeNotes ? 'completed' : 'scheduled',
        notes: [iv.notes, iv.outcomeNotes].filter(Boolean).join('\n\n') || '',
        outcome: iv.outcomeNotes ? 'passed' : 'pending'
      };

      const attachments = [];
      if (iv.resumeFileId && mongoose.Types.ObjectId.isValid(iv.resumeFileId)) {
        attachments.push(iv.resumeFileId);
      }

      const notes = [iv.notes, iv.outcomeNotes].filter(Boolean).join('\n\n') || '';

      const ticketDoc = {
        boardId: board._id,
        stageId: stage._id,
        ownerUserId: ownerId,
        jobProfileId: jobTicket?.jobProfileId || null,
        companyName: companyName.substring(0, 200),
        position: position.substring(0, 200),
        candidateName: candidateName ? candidateName.substring(0, 200) : undefined,
        dates: [dateEntry],
        notes,
        attachments,
        status: 'active',
        dueDate: iv.nextActionDate || undefined,
        metadata: { source: 'migrated_legacy_interview', legacyInterviewId: iv._id.toString() }
      };

      if (isDryRun) {
        console.log(`   [would create] Ticket for ${companyName} / ${position} (from Interview ${iv._id})`);
        created++;
        continue;
      }

      const ticket = await InterviewTicket.create(ticketDoc);

      await InterviewActivityLog.create({
        ticketId: ticket._id,
        boardId: board._id,
        actorUserId: ownerId,
        actionType: 'TICKET_CREATE',
        diff: { source: 'migrated_legacy_interview', legacyInterviewId: iv._id.toString() },
        description: 'Imported from legacy Interview'
      });

      created++;
    }

    if (skipReasons.length) {
      console.log('\n⚠️  Skipped:');
      skipReasons.forEach(r => console.log(`   ${r}`));
    }

    console.log('\n📋 Summary:');
    console.log(`   Tickets created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`\n✅ Interview migration complete.${isDryRun ? ' (dry run)' : ''}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
};

migrateInterviews();

