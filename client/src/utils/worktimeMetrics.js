/**
 * Summarize scores the Real percent against this baseline:
 *   Real 95% or more → Final % = (Real − 95) × 20, capped at 100% (97.5% → 50%, 100% → 100%)
 *   Real under 95%   → Final % = Real − 95, a negative score (85.9% → −9.1%)
 * Kept in step with server/src/constants/summarize.js.
 */
export const WORKTIME_FINAL_BASELINE = 95;

/** Final worktime % for a Real %; null when there is no Real % to convert. */
export const worktimeFinalPercent = (real) => {
  if (typeof real !== 'number' || !Number.isFinite(real)) return null;
  if (real < WORKTIME_FINAL_BASELINE) return real - WORKTIME_FINAL_BASELINE;
  return Math.min(100, ((real - WORKTIME_FINAL_BASELINE) / (100 - WORKTIME_FINAL_BASELINE)) * 100);
};

/**
 * Worktime achievement metrics — shared by Worktime Management and Summarize so
 * both pages show the same target percent for a member.
 *
 * Input is one row of GET /workflow/chart (`chartData[]`): `days` carries the
 * per-day effective target (month target, weekend/holiday rules, day deltas and
 * per-user day overrides are already applied server-side) plus tracked
 * (`real_time`) and manual added (`add_time`) seconds.
 *
 * Achievement is the AVERAGE of each counted day's percent (not one aggregate
 * ratio), and each day is CAPPED AT 100% before averaging — a day worked past
 * target earns no credit toward another day's shortfall. So 80% + 120% is 90%,
 * not 100%, and the resulting achievement never exceeds 100%.
 *
 * A holiday day (weekend or flagged) always counts as 100%; a normal or
 * reduced day is worked ÷ effective target (the target already carries any
 * reduce delta). `includeHoliday` decides whether holidays are part of the
 * hours sum and the percent average at all.
 *
 * Hours totals are NOT capped — only the percent metric is.
 *
 * @param {object} row - chart row: { days?, real_time, add_time }
 * @param {object} [options]
 * @param {boolean} [options.includeHoliday=true]
 * @param {number} [options.fallbackPeriodTargetMinutes=0] - period target used only when the row has no per-day data
 */
export function computeWorktimeMetrics(row, { includeHoliday = true, fallbackPeriodTargetMinutes = 0 } = {}) {
  const inclHol = includeHoliday;
  const days = Array.isArray(row?.days) ? row.days : null;

  // Fallback for payloads without per-day data: aggregate against period target.
  // No per-day breakdown means the 100% day cap can't be applied day by day, so
  // the period ratio is capped instead — the summary still never exceeds 100%.
  if (!days || days.length === 0) {
    const trackedHours = Math.max(0, (Number(row?.real_time) || 0) / 3600);
    const addedHours = Math.max(0, (Number(row?.add_time) || 0) / 3600);
    const periodTargetMinutes = Number(fallbackPeriodTargetMinutes) || 0;
    let trackedPercent = periodTargetMinutes > 0 ? (trackedHours * 60 / periodTargetMinutes) * 100 : 0;
    let addedPercent = periodTargetMinutes > 0 ? (addedHours * 60 / periodTargetMinutes) * 100 : 0;
    const totalPercent = trackedPercent + addedPercent;
    if (totalPercent > 100) {
      trackedPercent = (trackedPercent / totalPercent) * 100;
      addedPercent = 100 - trackedPercent;
    }
    return {
      trackedHours, addedHours, trackedPercent, addedPercent,
      achievementPercent: trackedPercent + addedPercent,
      periodTargetMinutes, totalHours: trackedHours + addedHours,
    };
  }

  let trackedHours = 0, addedHours = 0, targetMinutes = 0;
  let pctTrackedSum = 0, pctAddedSum = 0, counted = 0;
  for (const d of days) {
    const isHol = !!d.isHoliday;
    if (isHol && !inclHol) continue; // excluded from both hours and the average
    const tHours = Math.max(0, (Number(d.real_time) || 0) / 3600);
    const aHours = Math.max(0, (Number(d.add_time) || 0) / 3600);
    trackedHours += tHours;
    addedHours += aHours;
    counted += 1;

    const target = Math.max(0, Number(d.target) || 0);
    let dayTrackedPct;
    let dayAddedPct;
    if (isHol || target <= 0) {
      // Holiday (or a day reduced to a 0 target): always 100%, split by the
      // day's worked composition so stacked tracked/manual still sum to 100%.
      const worked = tHours + aHours;
      if (worked > 0) {
        dayTrackedPct = (tHours / worked) * 100;
        dayAddedPct = (aHours / worked) * 100;
      } else {
        dayTrackedPct = 100;
        dayAddedPct = 0;
      }
    } else {
      dayTrackedPct = (tHours * 60 / target) * 100;
      dayAddedPct = (aHours * 60 / target) * 100;
      targetMinutes += target; // normal-day targets only (for the tooltip)
    }

    // Cap each day at 100%. Overtime on one day never banks credit against
    // another day's shortfall, so 80% + 120% averages to 90%, not 100%. The
    // tracked / manual split is rescaled to sum to exactly 100 so the stacked
    // bars still add up and float drift can't push a full day under the mark.
    const dayTotalPct = dayTrackedPct + dayAddedPct;
    if (dayTotalPct > 100) {
      dayTrackedPct = (dayTrackedPct / dayTotalPct) * 100;
      dayAddedPct = 100 - dayTrackedPct;
    }

    pctTrackedSum += dayTrackedPct;
    pctAddedSum += dayAddedPct;
  }

  const trackedPercent = counted > 0 ? pctTrackedSum / counted : 0;
  const addedPercent = counted > 0 ? pctAddedSum / counted : 0;
  return {
    trackedHours, addedHours, trackedPercent, addedPercent,
    achievementPercent: trackedPercent + addedPercent,
    periodTargetMinutes: targetMinutes,
    totalHours: trackedHours + addedHours,
  };
}
