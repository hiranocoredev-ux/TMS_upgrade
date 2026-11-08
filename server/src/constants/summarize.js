/**
 * Summarize constants shared by the Group model, the summarize builder and the
 * weekly-count endpoints.
 */

/** A group is a normal team, or a job-hunting team. */
export const GROUP_TYPES = Object.freeze({
  NORMAL: 'normal',
  JOB: 'job',
});

export const GROUP_TYPE_VALUES = Object.freeze(Object.values(GROUP_TYPES));

/** Weekly outcome counts kept per group (plan + result, entered by super admin). */
export const GROUP_COUNT_METRICS = Object.freeze({
  CITIZEN: 'citizen',
  OFFER: 'offer',
});

export const GROUP_COUNT_METRIC_VALUES = Object.freeze(Object.values(GROUP_COUNT_METRICS));

/**
 * The weekly outcome count each group type is scored on: normal teams get
 * "getting citizen", job teams get job offers. Both types also score the weekly
 * per-member count (calls for normal teams, job interviews for job teams).
 */
export const GROUP_METRICS_BY_TYPE = Object.freeze({
  [GROUP_TYPES.NORMAL]: [GROUP_COUNT_METRICS.CITIZEN],
  [GROUP_TYPES.JOB]: [GROUP_COUNT_METRICS.OFFER],
});

/** Weeks without an entry count this plan (and a 0 result). */
export const DEFAULT_GROUP_COUNT_PLAN = 2;

/**
 * Summarize scores a member's Real worktime percent against this baseline:
 *   Real 95% or more → Final % = (Real − 95) × 20, capped at 100%
 *   Real under 95%   → Final % = Real − 95, a negative score
 * Kept in step with the client's utils/worktimeMetrics.js (a unit test compares the two).
 */
export const WORKTIME_FINAL_BASELINE = 95;

/** Final worktime % for a Real %; null when there is no Real % to convert. */
export const finalWorktimePercent = (real) => {
  if (typeof real !== 'number' || !Number.isFinite(real)) return null;
  if (real < WORKTIME_FINAL_BASELINE) return real - WORKTIME_FINAL_BASELINE;
  return Math.min(100, ((real - WORKTIME_FINAL_BASELINE) / (100 - WORKTIME_FINAL_BASELINE)) * 100);
};

/** A member whose weekly Total falls under this works the coming weekend. */
export const WEEKEND_RULE_THRESHOLD_PERCENT = 60;

/** The target those weekend days get (12 hours). */
export const WEEKEND_RULE_TARGET_MINUTES = 12 * 60;

/** Marks the rules this automation owns, so it can revoke its own only. */
export const WEEKEND_RULE_SOURCE = 'summarize_weekend';

/** What the weekly per-member count is called, per group type. */
export const memberCountLabel = (type) => (type === GROUP_TYPES.JOB ? 'Interview count' : 'Call count');

export const normalizeGroupType = (type) =>
  GROUP_TYPE_VALUES.includes(type) ? type : GROUP_TYPES.NORMAL;
