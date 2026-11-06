/**
 * One-off helper: add a fixed amount of MANUAL working time to a single user's
 * worklog for a single day. This writes a `manualAdjustments` line-item (the
 * same mechanism as the "＋ Add Time" admin action), so it is persistent and is
 * NOT overwritten by the external (Hubstaff) sync — that sync only replaces
 * `real_time` (tracked), while this adds to `add_time` (manual).
 *
 * The graph then shows this member's total for the day as +30 minutes.
 *
 * Idempotent: re-running does nothing if the marked adjustment already exists.
 *
 * Usage:
 *   node src/scripts/add-manual-time.js [email] [YYYY-MM-DD] [minutes]
 * Defaults:
 *   email=8klancer@gmail.com  date=2026-07-02  minutes=30
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Worklog from '../models/Worklog.js';

dotenv.config();

const EMAIL = process.argv[2] || '8klancer@gmail.com';
const DATE = process.argv[3] || '2026-07-02';
const MINUTES = Number(process.argv[4] || 30);

// Stable sentinel so re-runs don't double-add the same manual time.
const MARKER = `[seed:add-manual-time ${EMAIL} ${DATE} ${MINUTES}m]`;

const sumSeconds = (adjustments = []) =>
  adjustments.reduce((s, a) => s + Math.max(0, Math.floor(Number(a?.seconds) || 0)), 0);

const run = async () => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE)) throw new Error(`Bad date: ${DATE} (use YYYY-MM-DD)`);
  if (!Number.isFinite(MINUTES) || MINUTES <= 0) throw new Error(`Bad minutes: ${MINUTES}`);

  await mongoose.connect(process.env.MONGO_URI);

  const user = await User.findOne({ email: new RegExp(`^${EMAIL}$`, 'i') })
    .select('name email hubstaff_id')
    .lean();
  if (!user) {
    console.log(`⚠️  No user found with email "${EMAIL}". Nothing changed.`);
    return;
  }
  if (!user.hubstaff_id) {
    console.log(`⚠️  User "${user.email}" has no hubstaff_id; cannot key a worklog. Nothing changed.`);
    return;
  }

  const member = String(user.hubstaff_id);
  const addSeconds = Math.round(MINUTES * 60);

  let worklog = await Worklog.findOne({ member, date: DATE });
  if (!worklog) {
    worklog = new Worklog({
      member,
      date: DATE,
      real_time: 0,
      add_time: '0',
      total_time: 0,
      efficiency: 0,
      manualAdjustments: [],
    });
  }
  if (!Array.isArray(worklog.manualAdjustments)) worklog.manualAdjustments = [];

  const real = Number(worklog.real_time) || 0;
  const beforeAdd = sumSeconds(worklog.manualAdjustments);
  console.log('\n=== BEFORE ===');
  console.log(`  user:      ${user.name} <${user.email}>  (hubstaff_id=${member})`);
  console.log(`  date:      ${DATE}`);
  console.log(`  tracked:   ${(real / 60).toFixed(0)}m (real_time — unchanged)`);
  console.log(`  manual:    ${(beforeAdd / 60).toFixed(0)}m (add_time)`);

  // Idempotency guard.
  if (worklog.manualAdjustments.some((a) => String(a?.description || '').includes(MARKER))) {
    console.log(`\n✅ Already applied (marker present). Nothing changed.`);
    return;
  }

  // Migrate any legacy aggregate-only add_time into a line item first (matches app).
  if (worklog.manualAdjustments.length === 0) {
    const legacy = Math.max(0, Math.floor(Number(worklog.add_time) || 0));
    if (legacy > 0) {
      worklog.manualAdjustments.push({
        seconds: legacy,
        description: String(worklog.note || '').trim() || 'Earlier manual total (before line-item breakdown)',
      });
    }
  }

  worklog.manualAdjustments.push({
    seconds: addSeconds,
    description: `Manual working time ${MARKER}`,
    shortReason: `Manual work (+${MINUTES}m)`,
  });

  // Recompute aggregates exactly like syncManualTotalsIntoWorklog().
  const afterAdd = sumSeconds(worklog.manualAdjustments);
  worklog.add_time = String(afterAdd);
  worklog.total_time = Math.max(0, real + afterAdd);
  await worklog.save();

  console.log('\n=== AFTER ===');
  console.log(`  manual:    ${(afterAdd / 60).toFixed(0)}m (add_time)   (+${MINUTES}m)`);
  console.log(`  total:     ${(worklog.total_time / 60).toFixed(0)}m (real_time + add_time)`);
  console.log(`\n✅ Added ${MINUTES}m manual time for ${user.email} on ${DATE}.`);
};

run()
  .catch((err) => {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
