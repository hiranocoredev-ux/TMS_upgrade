import mongoose from 'mongoose';
import { GROUP_COUNT_METRICS, GROUP_COUNT_METRIC_VALUES, DEFAULT_GROUP_COUNT_PLAN } from '../constants/summarize.js';

/**
 * SummarizeGroupCount
 * - Weekly plan + result kept per group and metric, entered by super admin on the
 *   Summarize page: "getting citizen" for normal teams, job interviews / job
 *   offers for job teams.
 * - One row per group per week (FinancePeriod) per metric.
 * - Weeks without a row use DEFAULT_GROUP_COUNT_PLAN and a 0 result.
 *
 * The collection keeps its original name from when citizen counts were the only
 * group metric, so existing rows stay in place.
 */
const summarizeGroupCountSchema = new mongoose.Schema({
  groupCode: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  periodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FinancePeriod',
    required: true,
    index: true
  },
  metric: {
    type: String,
    enum: GROUP_COUNT_METRIC_VALUES,
    default: GROUP_COUNT_METRICS.CITIZEN,
    required: true
  },
  plan: {
    type: Number,
    min: 0,
    default: DEFAULT_GROUP_COUNT_PLAN
  },
  result: {
    type: Number,
    min: 0,
    default: 0
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  collection: 'summarizecitizencounts'
});

summarizeGroupCountSchema.index({ groupCode: 1, periodId: 1, metric: 1 }, { unique: true });

export default mongoose.model('SummarizeGroupCount', summarizeGroupCountSchema);
