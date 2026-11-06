/**
 * Repairs the Summarize weekly-count collections:
 *  - tags rows written before job teams existed with `metric: "citizen"`
 *  - re-syncs the indexes, dropping the old unique index on (groupCode, periodId)
 *    that rejected a second metric for the same group and week
 *
 * The server does this at startup too; this script is for running it on demand.
 *
 * Usage:  node src/scripts/migrate-summarize-group-counts.js [--dry-run]
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SummarizeGroupCount from '../models/SummarizeGroupCount.js';
import { ensureSummarizeIndexes } from '../config/summarizeIndexes.js';

dotenv.config();

const dryRun = process.argv.includes('--dry-run');

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/teammanagement');

  const untagged = await SummarizeGroupCount.countDocuments({ metric: { $exists: false } });
  const indexes = await SummarizeGroupCount.collection.indexes();
  const stale = indexes.filter((i) => i.name !== '_id_' && !i.key.metric && i.key.groupCode && i.key.periodId);

  console.log(`Rows without a metric: ${untagged}`);
  console.log(`Stale indexes: ${stale.map((i) => i.name).join(', ') || 'none'}`);

  if (dryRun) {
    console.log('Dry run — nothing written.');
  } else {
    await ensureSummarizeIndexes();
    console.log('Done.');
  }

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
