/**
 * Sync the `group` snapshot field on Daily/Weekly/Monthly + TimeEntry records
 * to the user's current `User.group`. Use this once after deploying the fix
 * that migrates `group` on user move — it backfills any previously-moved
 * users whose historical reports/plans/work-time were left behind under the
 * old group and therefore became invisible to the new group's boss and
 * competition leaderboards.
 *
 * Idempotent: safe to run multiple times.
 *
 * Run:
 *   node server/src/scripts/sync-report-groups.js
 *   node server/src/scripts/sync-report-groups.js --dry-run   # Log only
 */

import dotenv from 'dotenv';
import User from '../models/User.js';
import Daily from '../models/Daily.js';
import Weekly from '../models/Weekly.js';
import Monthly from '../models/Monthly.js';
import TimeEntry from '../models/TimeEntry.js';
import { connectDB } from '../config/db.js';

dotenv.config();

const isDryRun = process.argv.includes('--dry-run');

const syncOne = async (user) => {
  const filter = { userId: user._id, group: { $ne: user.group } };
  const update = { $set: { group: user.group } };

  const [dailyCount, weeklyCount, monthlyCount, timeCount] = await Promise.all([
    Daily.countDocuments(filter),
    Weekly.countDocuments(filter),
    Monthly.countDocuments(filter),
    TimeEntry.countDocuments(filter),
  ]);
  const total = dailyCount + weeklyCount + monthlyCount + timeCount;
  if (!total) return { daily: 0, weekly: 0, monthly: 0, timeEntry: 0 };

  if (isDryRun) {
    return { daily: dailyCount, weekly: weeklyCount, monthly: monthlyCount, timeEntry: timeCount };
  }

  const [dailyRes, weeklyRes, monthlyRes, timeRes] = await Promise.all([
    Daily.updateMany(filter, update),
    Weekly.updateMany(filter, update),
    Monthly.updateMany(filter, update),
    TimeEntry.updateMany(filter, update),
  ]);
  return {
    daily: dailyRes.modifiedCount || 0,
    weekly: weeklyRes.modifiedCount || 0,
    monthly: monthlyRes.modifiedCount || 0,
    timeEntry: timeRes.modifiedCount || 0,
  };
};

const run = async () => {
  try {
    console.log('Syncing report/plan `group` snapshot to current User.group');
    if (isDryRun) console.log('  [DRY RUN — no writes]\n');

    await connectDB();
    console.log('Connected to database\n');

    const users = await User.find({ group: { $exists: true, $ne: null } }, { _id: 1, name: 1, email: 1, group: 1 }).lean();
    console.log(`Scanning ${users.length} user(s)...\n`);

    const totals = { daily: 0, weekly: 0, monthly: 0, timeEntry: 0, touched: 0 };
    for (const user of users) {
      const r = await syncOne(user);
      const sum = r.daily + r.weekly + r.monthly + r.timeEntry;
      if (sum > 0) {
        totals.touched += 1;
        totals.daily += r.daily;
        totals.weekly += r.weekly;
        totals.monthly += r.monthly;
        totals.timeEntry += r.timeEntry;
        console.log(`  ${user.email || user.name} → ${user.group}: daily=${r.daily}, weekly=${r.weekly}, monthly=${r.monthly}, timeEntry=${r.timeEntry}`);
      }
    }

    console.log('\nDone.');
    console.log(`  Users touched:     ${totals.touched}`);
    console.log(`  Daily updated:     ${totals.daily}`);
    console.log(`  Weekly updated:    ${totals.weekly}`);
    console.log(`  Monthly updated:   ${totals.monthly}`);
    console.log(`  TimeEntry updated: ${totals.timeEntry}`);

    process.exit(0);
  } catch (err) {
    console.error('Failed:', err);
    process.exit(1);
  }
};

run();
