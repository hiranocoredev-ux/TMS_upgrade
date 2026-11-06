import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Worklog from '../models/Worklog.js';

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  console.log('\n=== All Worklogs (raw) ===');
  const worklogs = await Worklog.find({}).lean();
  console.log(`Total worklog docs: ${worklogs.length}`);
  worklogs.forEach((w, i) => {
    console.log(`${i + 1}. userId=${w.userId} hubstaff_id=${w.hubstaff_id} date=${w.date} real=${w.real_time}s add=${w.add_time}s`);
  });

  console.log('\n=== All Users (with hubstaff_id) ===');
  const users = await User.find({}).select('name email hubstaff_id status').lean();
  users.forEach((u, i) => {
    console.log(`${i + 1}. ${u.name}  email=${u.email}  hubstaff_id=${u.hubstaff_id}  status=${u.status}`);
  });

  console.log('\n=== List collections in DB ===');
  const cols = await mongoose.connection.db.listCollections().toArray();
  cols.forEach(c => console.log(` - ${c.name}`));

  // Check if there's a legacy "worklog" or "worklogs" collection with different schema
  for (const name of ['worklog', 'worklogs', 'work_logs', 'activities', 'timeentries']) {
    try {
      const count = await mongoose.connection.db.collection(name).countDocuments();
      if (count > 0) {
        console.log(`\n=== Sample from collection "${name}" (count=${count}) ===`);
        const sample = await mongoose.connection.db.collection(name).find({}).limit(3).toArray();
        console.log(JSON.stringify(sample, null, 2).slice(0, 1500));
      }
    } catch {}
  }

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('❌', err);
  await mongoose.disconnect();
  process.exit(1);
});
