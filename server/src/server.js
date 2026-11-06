import dotenv from 'dotenv';
import app from './app.js';
import { connectDB } from './config/db.js';
import { seedSuperAdmin, seedGroups } from './config/seed.js';
import { ensureSummarizeIndexes } from './config/summarizeIndexes.js';
import { startWeekendRuleScheduler } from './services/summarizeWeekendRules.js';
import { startNotificationScheduler } from './services/notification.service.js';

dotenv.config();

const PORT = process.env.PORT || 3003;

const startServer = async () => {
  try {
    await connectDB();
    await seedGroups();
    await seedSuperAdmin();
    await ensureSummarizeIndexes();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      startNotificationScheduler();
      console.log('🔔 Notification scheduler started');
      startWeekendRuleScheduler();
      console.log('🗓  Summarize weekend rule scheduler started');
    });
  } catch (error) {
    console.error('❌ Server failed to start:', error);
    process.exit(1);
  }
};

startServer();