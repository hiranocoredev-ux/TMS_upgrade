/**
 * One-off helper: list all users and reset the SUPER_ADMIN password.
 *
 * Usage:
 *   node src/scripts/reset-admin-password.js [newPassword]
 *
 * If no password is given, defaults to "changeme123".
 */
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const NEW_PASSWORD = process.argv[2] || 'changeme123';

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('\n=== All users ===');
  const users = await User.find({}).select('email name role status degree').lean();
  users.forEach((u, i) => {
    console.log(`${i + 1}. ${u.email}   [${u.role}/${u.degree}/${u.status}]   name=${u.name}`);
  });

  const superAdmin = await User.findOne({ role: 'SUPER_ADMIN' });
  if (!superAdmin) {
    console.log('\n⚠️  No SUPER_ADMIN user found.');
    await mongoose.disconnect();
    process.exit(1);
  }

  superAdmin.passwordHash = await bcrypt.hash(NEW_PASSWORD, 10);
  superAdmin.status = 'active';
  await superAdmin.save();

  console.log(`\n✅ SUPER_ADMIN password reset`);
  console.log(`   Email:    ${superAdmin.email}`);
  console.log(`   Password: ${NEW_PASSWORD}`);

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('❌ Error:', err);
  await mongoose.disconnect();
  process.exit(1);
});
