import SummarizeGroupCount from '../models/SummarizeGroupCount.js';
import SummarizeCallCount from '../models/SummarizeCallCount.js';
import { GROUP_COUNT_METRICS } from '../constants/summarize.js';

/**
 * Keeps the Summarize weekly-count collections in step with their schemas.
 *
 * Weekly group counts started out as "getting citizen" only, with a unique index
 * on (groupCode, periodId). Rows now carry a `metric`, so that old index would
 * reject a second metric for the same group and week (a job team's job offer
 * beside an earlier citizen row). Tag the untagged rows and re-sync the indexes,
 * which drops the stale one.
 *
 * Runs at startup and never blocks it: a failure here is logged, not thrown.
 */
export const ensureSummarizeIndexes = async () => {
  try {
    const tagged = await SummarizeGroupCount.updateMany(
      { metric: { $exists: false } },
      { $set: { metric: GROUP_COUNT_METRICS.CITIZEN } },
    );
    if (tagged.modifiedCount) {
      console.log(`🗂  Tagged ${tagged.modifiedCount} weekly group count(s) as "${GROUP_COUNT_METRICS.CITIZEN}"`);
    }
    await SummarizeGroupCount.syncIndexes();
    await SummarizeCallCount.syncIndexes();
  } catch (error) {
    console.warn('⚠️  Could not sync summarize indexes:', error.message);
  }
};
