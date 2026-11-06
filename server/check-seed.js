// Quick script to check if seed user exists and verify credentials
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from './src/models/User.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/teammanagement';
const SEED_EMAIL = process.env.SEED_SUPERADMIN_EMAIL || 'admin@example.com';
const SEED_PASSWORD = process.env.SEED_SUPERADMIN_PASSWORD || 'changeme123';

async function checkSeed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const user = await User.findOne({ email: SEED_EMAIL.toLowerCase() });
    
    if (!user) {
      console.log('❌ User not found in database');
      console.log(`   Looking for: ${SEED_EMAIL}`);
      console.log('\n📝 To create seed user, make sure:');
      console.log('   1. No users exist in database');
      console.log('   2. SEED_SUPERADMIN_EMAIL and SEED_SUPERADMIN_PASSWORD are set in .env');
      console.log('   3. Server starts (seed runs on server start)');
    } else {
      console.log('✅ User found in database:');
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.status}`);
      
      // Test password
      console.log('\n🔐 Testing password...');
      const isValid = await user.comparePassword(SEED_PASSWORD);
      if (isValid) {
        console.log('✅ Password is valid!');
      } else {
        console.log('❌ Password is INVALID!');
        console.log(`   Expected password from .env: ${SEED_PASSWORD ? 'SET' : 'NOT SET'}`);
      }
    }
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkSeed();

