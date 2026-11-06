import express from 'express';
import rateLimit from 'express-rate-limit';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import adminRoutes from './admin.routes.js';
import databaseRoutes from './database.routes.js';
import auditRoutes from './audit.routes.js';
import fileRoutes from './file.routes.js';
import profileRoutes from './profile.routes.js';
import jobTicketRoutes from './jobTicket.routes.js';
import calendarRoutes from './calendar.routes.js';
import interviewBoardRoutes from './interviewBoardRoutes.js';
import interviewStageRoutes from './interviewStageRoutes.js';
// import interviewTicketRoutes from './interviewTicket.routes.js';
import interviewTicketRoutes from './interviewTicketRoutes.js';
import assignmentRoutes from './assignmentRoutes.js';
import financeRoutes from './finance.routes.js';
import paymentRequestRoutes from './paymentRequest.routes.js';
import projectRoutes from './project.routes.js';
import taskRoutes from './task.routes.js';
import uploadRoutes from './upload.routes.js';

import dailyRoutes from './daily.router.js'
import reportRoutes from './report.router.js'
import planRoutes from './plan.router.js'
import planTicketTemplatesRoutes from './planTicketTemplates.routes.js'
import hubstaffRoutes from './hubstaff.routes.js'
import timeEntryRoutes from './timeEntry.routes.js'
import workflowRoutes from './workflow.routes.js'
import dashboardRoutes from './dashboard.routes.js'
import competitionRoutes from './competition.routes.js'
import notificationRoutes from './notification.routes.js'
import summarizeRoutes from './summarize.routes.js'
import citizenProfileRoutes from './citizenProfile.routes.js'

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 55, // limit each IP to 5 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      ok: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later.'
    });
  }
});

// API Routes

router.use('/daily', dailyRoutes);
router.use('/reports', reportRoutes);
router.use('/plans', planRoutes);
router.use('/plan-ticket-templates', planTicketTemplatesRoutes);


router.use('/auth', authLimiter, authRoutes);
router.use('/', userRoutes); // /me routes
router.use('/admin', adminRoutes); // Admin routes
router.use('/admin/database', databaseRoutes); // Database backup/restore routes
router.use('/', auditRoutes); // Audit logs routes
router.use('/files', fileRoutes); // File upload/download routes
router.use('/profiles', profileRoutes); // Unified profile module (job / freelancer / personal)
router.use('/job-tickets', jobTicketRoutes); // Job ticket routes
// router.use('/interviews', interviewRoutes); // Interview routes
router.use('/calendar', calendarRoutes); // Calendar routes (/calendar/interviews)
// Interview Routine System (PRD v3.0) - Kanban boards
router.use('/interview-boards', interviewBoardRoutes);
router.use('/assignments', assignmentRoutes); // Assignment routes
router.use('/interview-boards/:boardId/stages', interviewStageRoutes);
router.use('/interview-boards/:boardId/tickets', interviewTicketRoutes);
router.use('/finance', financeRoutes); // Finance routes
router.use('/finance', paymentRequestRoutes); // Payment requests (nested under /finance)
router.use('/projects', projectRoutes); // Project routes
router.use('/projects', taskRoutes); // Task routes (nested under /projects/:projectId/tasks)
router.use('/upload', uploadRoutes); // Legacy upload routes (kept for backward compatibility)
router.use('/hubstaff', hubstaffRoutes); // Hubstaff time & activity tracking
router.use('/time-entries', timeEntryRoutes); // In-app time tracking
router.use('/workflow', workflowRoutes); // Workflow analytics + manual time
router.use('/dashboard', dashboardRoutes); // Dashboard landing page
router.use('/competition', competitionRoutes); // Monthly competition scoring
router.use('/summarize', summarizeRoutes); // Summarize page
router.use('/citizen-profiles', citizenProfileRoutes); // Citizen profiles (profile management)
router.use('/', notificationRoutes); // Notification settings + scheduler operations

export default router;

