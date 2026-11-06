/**
 * How a Summarize result percent is read, shared by the table cells and the
 * member ranking chart so the same number always wears the same colour.
 *
 *   100% and above → success · 80–100% → normal · 50–80% → warning · under 50% → error
 */
export const RESULT_TIERS = Object.freeze([
  { key: 'good', min: 100, label: '100% and above' },
  { key: 'ok', min: 80, label: '80 – 100%' },
  { key: 'warn', min: 50, label: '50 – 80%' },
  { key: 'low', min: Number.NEGATIVE_INFINITY, label: 'Under 50%' }
]);

/** Tier key of a percent; 'none' when there is no value to read. */
export const resultTier = (value) =>
  typeof value === 'number' && Number.isFinite(value)
    ? RESULT_TIERS.find((tier) => value >= tier.min).key
    : 'none';
