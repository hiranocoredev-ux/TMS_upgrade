import express from 'express';
import mongoose from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';
import { log as auditLog, getRequestMeta } from '../utils/audit.js';

// Import all models
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import JobTicket from '../models/JobTicket.js';
import InterviewBoard from '../models/InterviewBoard.js';
import InterviewStage from '../models/InterviewStage.js';
import InterviewTicket from '../models/InterviewTicket.js';
import Assignment from '../models/Assignment.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import FinanceTransaction from '../models/FinanceTransaction.js';
import MonthlyFinancialPlan from '../models/MonthlyFinancialPlan.js';
import PeriodicFinancialPlan from '../models/PeriodicFinancialPlan.js';
import FinancePeriod from '../models/FinancePeriod.js';
import FinanceGoal from '../models/FinanceGoal.js';
import FileMeta from '../models/FileMeta.js';
import AuditLog from '../models/AuditLog.js';
import Budget from '../models/Budget.js';
import Interview from '../models/Interview.js';
import InterviewActivityLog from '../models/InterviewActivityLog.js';

const router = express.Router();

// Only SUPER_ADMIN and ADMIN can access database routes
router.use(requireAuth);
router.use(requireRole('SUPER_ADMIN', 'GROUP_BOSS', 'ADMIN', 'BOSS'));

// Model mapping for easy iteration
const models = {
  User,
  Profile,
  JobTicket,
  InterviewBoard,
  InterviewStage,
  InterviewTicket,
  Assignment,
  Project,
  Task,
  FinanceTransaction,
  MonthlyFinancialPlan,
  PeriodicFinancialPlan,
  FinancePeriod,
  FinanceGoal,
  FileMeta,
  AuditLog,
  Budget,
  Interview,
  InterviewActivityLog
};

/**
 * GET /admin/database/export
 * Export all database collections as JSON backup
 */
router.get('/export', async (req, res, next) => {
  try {
    const backup = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      collections: {}
    };

    // Export all collections
    for (const [modelName, Model] of Object.entries(models)) {
      try {
        const documents = await Model.find({}).lean();
        backup.collections[modelName] = documents;
      } catch (err) {
        console.error(`Error exporting ${modelName}:`, err);
        // Continue with other collections even if one fails
        backup.collections[modelName] = [];
      }
    }

    // Audit log
    await auditLog(
      req,
      'DATABASE_EXPORT',
      'DATABASE',
      null,
      {
        ...getRequestMeta(req),
        collections: Object.keys(backup.collections),
        documentCount: Object.values(backup.collections).reduce((sum, docs) => sum + docs.length, 0)
      }
    );

    // Set headers for file download
    const filename = `database-backup-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.json(createSuccessResponse(backup));
  } catch (error) {
    console.error('Database export error:', error);
    next(error);
  }
});

/**
 * POST /admin/database/import
 * Import database from JSON backup file
 * WARNING: This will clear all existing data and restore from backup
 */
router.post('/import', async (req, res, next) => {
  try {
    const { backup, clearExisting = true } = req.body;

    if (!backup || !backup.collections) {
      return res.status(400).json(createErrorResponse(
        'INVALID_BACKUP',
        'Invalid backup format. Expected object with collections property.',
        400
      ));
    }

    // Validate backup structure
    if (!backup.version || !backup.timestamp) {
      return res.status(400).json(createErrorResponse(
        'INVALID_BACKUP_FORMAT',
        'Backup file is missing version or timestamp.',
        400
      ));
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let totalImported = 0;
      const importResults = {};

      // Clear existing data if requested
      if (clearExisting) {
        for (const [modelName, Model] of Object.entries(models)) {
          try {
            await Model.deleteMany({}).session(session);
          } catch (err) {
            console.error(`Error clearing ${modelName}:`, err);
            throw err;
          }
        }
      }

      // Import collections
      for (const [modelName, documents] of Object.entries(backup.collections)) {
        if (!models[modelName]) {
          console.warn(`Model ${modelName} not found, skipping...`);
          continue;
        }

        const Model = models[modelName];
        
        if (!Array.isArray(documents) || documents.length === 0) {
          importResults[modelName] = { imported: 0, skipped: 0 };
          continue;
        }

        try {
          // Remove _id and __v to allow MongoDB to generate new ones
          const cleanDocuments = documents.map(doc => {
            const { _id, __v, ...rest } = doc;
            return rest;
          });

          const result = await Model.insertMany(cleanDocuments, { session });
          const imported = result.length;
          totalImported += imported;
          importResults[modelName] = { imported, skipped: 0 };
        } catch (err) {
          console.error(`Error importing ${modelName}:`, err);
          importResults[modelName] = { 
            imported: 0, 
            skipped: documents.length,
            error: err.message 
          };
          // Continue with other collections
        }
      }

      await session.commitTransaction();

      // Audit log
      await auditLog(
        req,
        'DATABASE_IMPORT',
        'DATABASE',
        null,
        {
          ...getRequestMeta(req),
          backupVersion: backup.version,
          backupTimestamp: backup.timestamp,
          clearExisting,
          totalImported,
          importResults
        }
      );

      res.json(createSuccessResponse({
        message: 'Database imported successfully',
        totalImported,
        importResults,
        collections: Object.keys(importResults)
      }));
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Database import error:', error);
    next(error);
  }
});

/**
 * GET /admin/database/stats
 * Get database statistics (document counts per collection)
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = {};

    for (const [modelName, Model] of Object.entries(models)) {
      try {
        const count = await Model.countDocuments({});
        stats[modelName] = count;
      } catch (err) {
        console.error(`Error counting ${modelName}:`, err);
        stats[modelName] = 0;
      }
    }

    res.json(createSuccessResponse({
      stats,
      totalDocuments: Object.values(stats).reduce((sum, count) => sum + count, 0),
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Database stats error:', error);
    next(error);
  }
});

export default router;

