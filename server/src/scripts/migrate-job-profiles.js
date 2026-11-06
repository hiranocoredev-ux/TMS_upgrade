/**
 * JobProfile Migration Script
 *
 * - Ensures ownerUserId is set (falls back to assignedUserId when possible)
 * - Initializes attachments to [] if missing/undefined
 * - Converts legacy resumeFileId into attachments if present (e.g. from older schema)
 *
 * Idempotent: safe to run multiple times.
 *
 * Run:
 *   node server/src/scripts/migrate-job-profiles.js
 *   node server/src/scripts/migrate-job-profiles.js --dry-run
 *
 * Requires: MONGO_URI in .env
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import JobProfile from '../models/JobProfile.js';
import { connectDB } from '../config/db.js';

dotenv.config();

const isDryRun = process.argv.includes('--dry-run');

const migrateJobProfiles = async () => {
  try {
    console.log('🔄 Starting JobProfile migration...');
    if (isDryRun) console.log('   [DRY RUN – no changes will be written]\n');

    await connectDB();
    console.log('✅ Connected to database\n');

    let fixedOwner = 0;
    let fixedAttachments = 0;
    let fixedResume = 0;
    let skipped = 0;

    // 1) Profiles missing ownerUserId: try assignedUserId, else skip
    const missingOwner = await JobProfile.find({
      $or: [{ ownerUserId: { $exists: false } }, { ownerUserId: null }]
    }).lean();

    for (const p of missingOwner) {
      const fallback = p.assignedUserId || null;
      if (fallback) {
        console.log(`   [ownerUserId] ${p.name} (${p._id}): set from assignedUserId`);
        if (!isDryRun) {
          await JobProfile.updateOne({ _id: p._id }, { $set: { ownerUserId: fallback } });
        }
        fixedOwner++;
      } else {
        console.log(`   [ownerUserId] SKIP ${p.name} (${p._id}): no ownerUserId or assignedUserId`);
        skipped++;
      }
    }

    // 2) Ensure attachments is an array
    const badAttachments = await JobProfile.find({
      $or: [
        { attachments: { $exists: false } },
        { attachments: null },
        { attachments: { $not: { $type: 'array' } } }
      ]
    }).lean();

    for (const p of badAttachments) {
      console.log(`   [attachments] ${p.name} (${p._id}): init to []`);
      if (!isDryRun) {
        await JobProfile.updateOne({ _id: p._id }, { $set: { attachments: [] } });
      }
      fixedAttachments++;
    }

    // 3) Legacy resumeFileId → push into attachments (raw check; schema may not define it)
    const withResume = await JobProfile.collection.find({
      resumeFileId: { $exists: true, $ne: null }
    }).toArray();

    for (const p of withResume) {
      const profile = await JobProfile.findById(p._id).select('attachments resumeFileId').lean();
      const att = Array.isArray(profile?.attachments) ? profile.attachments : [];
      const rid = profile?.resumeFileId || p.resumeFileId;
      if (rid && mongoose.Types.ObjectId.isValid(rid) && !att.some(id => id && id.toString() === (rid._id || rid).toString())) {
        console.log(`   [resumeFileId] ${p.name} (${p._id}): add resume to attachments`);
        if (!isDryRun) {
          await JobProfile.updateOne(
            { _id: p._id },
            {
              $push: { attachments: new mongoose.Types.ObjectId(rid.toString()) },
              $unset: { resumeFileId: 1 }
            }
          );
        }
        fixedResume++;
      }
    }

    console.log('\n📋 Summary:');
    console.log(`   ownerUserId fixed: ${fixedOwner}`);
    console.log(`   attachments inited: ${fixedAttachments}`);
    console.log(`   resumeFileId → attachments: ${fixedResume}`);
    console.log(`   skipped (no owner): ${skipped}`);
    console.log(`\n✅ JobProfile migration complete.${isDryRun ? ' (dry run)' : ''}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
};

migrateJobProfiles();

