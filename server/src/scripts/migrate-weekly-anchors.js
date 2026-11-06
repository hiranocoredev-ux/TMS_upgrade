/**
 * Moves weekly plans and reports onto the system's one week unit.
 *
 * Weekly documents used to be anchored on the Monday of a calendar week. Weeks
 * now run Saturday → Friday — the same unit the finance weeks use — so each
 * document moves back to the Saturday that starts its week (Monday − 2 days).
 * The shift is uniform, so two documents can never collide.
 *
 * Usage:
 *   node src/scripts/migrate-weekly-anchors.js             # dry run
 *   node src/scripts/migrate-weekly-anchors.js --confirm   # move them
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Weekly from '../models/Weekly.js';
import { weekStartDateKey } from '../utils/weekRule.js';

dotenv.config();

const confirm = process.argv.includes('--confirm');

const dayKey = (date) => new Date(date).toISOString().slice(0, 10);
const weekdayOf = (date) => new Date(date).getUTCDay(); // 0 Sun … 6 Sat

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/teammanagement');

  const docs = await Weekly.find({}).select('_id userId username kind date').lean();
  console.log(`Weekly documents: ${docs.length}`);

  const moves = [];
  const already = [];
  const odd = [];

  for (const doc of docs) {
    const current = dayKey(doc.date);
    const start = weekStartDateKey(current);
    if (!start) {
      odd.push({ doc, reason: 'unreadable date' });
      continue;
    }
    if (start === current) {
      already.push(doc);
      continue;
    }
    if (weekdayOf(doc.date) !== 1) {
      // Not a Monday and not a Saturday — worth a look before it is moved.
      odd.push({ doc, reason: `weekday ${weekdayOf(doc.date)}` });
    }
    moves.push({ doc, from: current, to: start });
  }

  console.log(`Already on a week start: ${already.length}`);
  console.log(`To move: ${moves.length}`);
  if (odd.length) {
    console.log(`\nUnexpected anchors (${odd.length}) — check these:`);
    for (const { doc, reason } of odd.slice(0, 20)) {
      console.log(`  ${doc.username} ${doc.kind} ${dayKey(doc.date)} (${reason})`);
    }
  }

  for (const move of moves.slice(0, 10)) {
    console.log(`  ${move.doc.username} ${move.doc.kind}: ${move.from} → ${move.to}`);
  }
  if (moves.length > 10) console.log(`  … and ${moves.length - 10} more`);

  if (!confirm) {
    console.log('\nDry run. Nothing was moved. Re-run with --confirm to apply.');
    await mongoose.disconnect();
    return;
  }

  if (moves.length > 0) {
    const operations = moves.map(({ doc, to }) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { date: new Date(`${to}T00:00:00.000Z`) } },
      },
    }));
    const result = await Weekly.bulkWrite(operations, { ordered: false });
    console.log(`\nMoved ${result.modifiedCount} weekly document(s).`);
  }

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
