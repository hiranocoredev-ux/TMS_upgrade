/**
 * Removes the old client-profile records, now that Profile Management is built
 * on CitizenProfile instead.
 *
 * What it touches:
 *   - every Profile document (the old "client record" with its role tabs)
 *   - optionally, with --files, the FileMeta rows of module 'profiles'
 *     (uploaded files on disk are left alone; delete them yourself if wanted)
 *
 * The interview boards still read /profiles for their profile picker, so run
 * this only once those are ported to citizen profiles — or accept that the
 * picker will come back empty.
 *
 * Usage:
 *   node src/scripts/drop-legacy-profiles.js            # dry run, counts only
 *   node src/scripts/drop-legacy-profiles.js --confirm  # delete the profiles
 *   node src/scripts/drop-legacy-profiles.js --confirm --files
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Profile from '../models/Profile.js';
import FileMeta from '../models/FileMeta.js';

dotenv.config();

const confirm = process.argv.includes('--confirm');
const withFiles = process.argv.includes('--files');

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/teammanagement');

  const profileCount = await Profile.countDocuments({});
  const fileCount = await FileMeta.countDocuments({ module: 'profiles' });

  console.log(`Legacy profiles: ${profileCount}`);
  console.log(`Profile file records: ${fileCount}${withFiles ? '' : ' (kept — pass --files to remove)'}`);

  if (!confirm) {
    console.log('\nDry run. Nothing was deleted. Re-run with --confirm to delete.');
    await mongoose.disconnect();
    return;
  }

  const profiles = await Profile.deleteMany({});
  console.log(`Deleted ${profiles.deletedCount} legacy profile(s).`);

  if (withFiles) {
    const files = await FileMeta.deleteMany({ module: 'profiles' });
    console.log(`Deleted ${files.deletedCount} profile file record(s). Files on disk were not touched.`);
  }

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
