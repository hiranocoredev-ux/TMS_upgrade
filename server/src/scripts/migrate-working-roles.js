/**
 * Moves members from the old multi-select working roles to one role each.
 *
 *   ai_training / freelancing / others → normal_working
 *   job_working                        → job_working
 *   hunting_profile                    → dropped
 *
 * `workingRoles` is kept as the derived list of profile tabs the member works in
 * (freelancing + ai_training for normal working), so the profile module keeps
 * working unchanged. The retired `profileHunter` flag is removed from every
 * record, straight on the collection so it goes whether or not the schema still
 * knows about it.
 *
 * Usage:  node src/scripts/migrate-working-roles.js [--dry-run]
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { ROLES, normalizeRole } from '../constants/roles.js';
import { workingRoleFromLegacy, workingRoleTabs } from '../constants/profiles.js';

dotenv.config();

const dryRun = process.argv.includes('--dry-run');

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/teammanagement');

  const users = await User.find({}).select('_id name email role degree workingRole workingRoles').lean();
  let changed = 0;

  for (const user of users) {
    const isSuperAdmin = normalizeRole(user.role, user.degree) === ROLES.SUPER_ADMIN;
    const legacy = Array.isArray(user.workingRoles) ? user.workingRoles : [];

    const workingRole = isSuperAdmin ? '' : user.workingRole || workingRoleFromLegacy(legacy);
    const tabs = workingRoleTabs(workingRole);

    const sameTabs = legacy.length === tabs.length && legacy.every((r) => tabs.includes(r));
    if (user.workingRole === workingRole && sameTabs) continue;

    changed += 1;
    console.log(
      `${user.name || user.email}: [${legacy.join(', ') || '—'}] → ${workingRole || '—'}` +
        ` (tabs: ${tabs.join(', ') || '—'})`,
    );
    if (!dryRun) {
      await User.updateOne({ _id: user._id }, { $set: { workingRole, workingRoles: tabs } });
    }
  }

  const withHunterFlag = await User.collection.countDocuments({ profileHunter: { $exists: true } });
  if (!dryRun && withHunterFlag) {
    await User.collection.updateMany({ profileHunter: { $exists: true } }, { $unset: { profileHunter: '' } });
  }

  console.log(dryRun ? `Dry run — ${changed} user(s) would change.` : `Updated ${changed} user(s).`);
  console.log(
    dryRun
      ? `${withHunterFlag} user(s) still carry the retired profileHunter flag.`
      : `Removed the retired profileHunter flag from ${withHunterFlag} user(s).`,
  );

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
