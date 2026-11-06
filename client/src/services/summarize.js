import apiClient from './axios';

/**
 * Summarize table: finance, call counts and getting-citizen counts.
 * Omit `periodId` in weekly mode to let the server pick the current week of the month.
 * @param {{ mode: 'week'|'month', month: string, periodId?: string }} params
 * @returns {Promise<ApiResponse>} { ok, data: { mode, month, range, periods, period, scope,
 *   canEditWeeklyInputs, defaultCitizenPlan, groups, overall } }
 */
export const getSummarize = async ({ mode, month, periodId } = {}) => {
  const response = await apiClient.get('/summarize', {
    params: {
      mode,
      month,
      ...(periodId && { periodId })
    }
  });
  return response.data;
};

/**
 * Save weekly call counts (per member) and getting-citizen counts (per group) — super admin only.
 * Send only changed rows; a row with both values null clears it.
 * @param {{ periodId: string,
 *   callCounts?: Array<{ userId: string, plan: number|null, result: number|null }>,
 *   citizens?: Array<{ groupCode: string, plan: number|null, result: number|null }> }} payload
 */
export const saveWeeklyInputs = async (payload) => {
  const response = await apiClient.put('/summarize/weekly-inputs', payload);
  return response.data;
};

/**
 * Set the percentage points taken off one member's Final WorkTime % for one week
 * — super admin only. `points` is the new total (0 clears it).
 * @param {{ periodId: string, userId: string, points: number }} payload
 */
export const saveWorktimeDeduction = async (payload) => {
  // The table updates in place, so skip the generic success toast on every click.
  const response = await apiClient.put('/summarize/worktime-deduction', payload, { silentSuccess: true });
  return response.data;
};

/**
 * Save the monthly profile targets — super admin only. Send only changed rows.
 * @param {{ month: string, targets: Array<{ userId: string, profileTarget?: number,
 *   offerTarget?: number, offerResult?: number }> }} payload
 */
export const saveProfileTargets = async (payload) => {
  const response = await apiClient.put('/summarize/profile-targets', payload);
  return response.data;
};
