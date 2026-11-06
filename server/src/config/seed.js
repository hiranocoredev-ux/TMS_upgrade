import dotenv from 'dotenv';
import User from '../models/User.js';
import Group from '../models/Group.js';
import bcrypt from 'bcrypt';

dotenv.config();

const DEFAULT_GROUPS = [
  { name: 'Group 1', code: 'GROUP_1', sortOrder: 1 },
  { name: 'Group 2', code: 'GROUP_2', sortOrder: 2 },
  { name: 'Group 3', code: 'GROUP_3', sortOrder: 3 },
  { name: 'Group 4', code: 'GROUP_4', sortOrder: 4 }
];

export const seedGroups = async () => {
  try {
    const count = await Group.countDocuments();
    if (count > 0) {
      console.log('✅ Groups already exist, skipping group seed');
      return;
    }
    await Group.insertMany(DEFAULT_GROUPS);
    console.log('✅ Default groups created (GROUP_1, GROUP_2, GROUP_3, GROUP_4)');
  } catch (error) {
    console.error('❌ Error seeding groups:', error.message);
  }
};

export const seedSuperAdmin = async () => {
  try {
    // Check if any users exist
    const userCount = await User.countDocuments();
    
    if (userCount > 0) {
      console.log('✅ Users already exist, skipping seed');
      return;
    }

    // Check for required environment variables
    const email = process.env.SEED_SUPERADMIN_EMAIL;
    const password = process.env.SEED_SUPERADMIN_PASSWORD;
    const name = process.env.SEED_SUPERADMIN_NAME || 'Super Admin';

    if (!email || !password) {
      console.log('⚠️  SEED_SUPERADMIN_EMAIL and SEED_SUPERADMIN_PASSWORD not set, skipping seed');
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create SUPER_ADMIN user
    // Note: Use SUPER_ADMIN (not ADMIN) for seed user
    const superAdmin = new User({
      email: email.toLowerCase(),
      passwordHash,
      name,
      group: 'SUPER_ADMIN',
      role: 'SUPER_ADMIN',
      status: 'active'
    });

    await superAdmin.save();

    console.log('✅ Super admin user created successfully');
    console.log(`   Email: ${email}`);
    console.log(`   Name: ${name}`);
  } catch (error) {
    console.error('❌ Error seeding super admin:', error.message);
    // Don't throw - allow server to start even if seed fails
  }
};

