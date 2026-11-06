/**
 * Role Migration Script
 *
 * Converts legacy role strings to SUPER_ADMIN / GROUP_BOSS / GROUP_MEMBER.
 * Idempotent: safe to run multiple times.
 *
 * Run:
 *   node server/src/scripts/migrate-roles.js
 *   node server/src/scripts/migrate-roles.js --dry-run   # Log only, no writes
 */

import dotenv from 'dotenv';
import User from '../models/User.js';
import { connectDB } from '../config/db.js';
import { LEGACY_ROLES, ROLES } from '../constants/roles.js';

dotenv.config();

const ROLE_MAPPINGS = [
  { from: LEGACY_ROLES.BOSS, to: ROLES.GROUP_BOSS },
  { from: LEGACY_ROLES.ADMIN, to: ROLES.GROUP_BOSS },
  { from: LEGACY_ROLES.MEMBER, to: ROLES.GROUP_MEMBER },
  { from: LEGACY_ROLES.GUEST, to: ROLES.GROUP_MEMBER },
];

const isDryRun = process.argv.includes('--dry-run');

const migrateRoles = async () => {
  try {
    console.log('🔄 Starting role migration...');
    if (isDryRun) console.log('   [DRY RUN – no changes will be written]\n');

    await connectDB();
    console.log('✅ Connected to database\n');

    let totalMigrated = 0;

    for (const { from: fromRole, to: toRole } of ROLE_MAPPINGS) {
      const users = await User.find({ role: fromRole }).lean();
      console.log(`📊 ${fromRole} → ${toRole}: found ${users.length} user(s)`);

      if (users.length === 0) continue;

      for (const u of users) {
        console.log(`   • ${u.email} (${u.name}) [${u._id}]`);
        if (!isDryRun) {
          await User.updateOne({ _id: u._id }, { $set: { role: toRole } });
        }
        totalMigrated++;
      }
      console.log(`   → ${isDryRun ? 'Would migrate' : 'Migrated'} ${users.length} user(s)\n`);
    }

    console.log(`✅ Role migration complete. ${totalMigrated} user(s) ${isDryRun ? 'would be ' : ''}migrated.\n`);

    // Verification
    for (const { from: fromRole } of ROLE_MAPPINGS) {
      const remaining = await User.countDocuments({ role: fromRole });
      if (remaining === 0) {
        console.log(`✅ Verification: no users left with role "${fromRole}"`);
      } else {
        console.log(`⚠️  Warning: ${remaining} user(s) still have role "${fromRole}"`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
};

migrateRoles();
