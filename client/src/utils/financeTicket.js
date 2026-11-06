/**
 * The income / outcome block that opens every monthly and weekly plan and
 * report. Its figures come from Finance Management and the member's own
 * transactions, so it is never filled in by hand — which is why the report
 * validator leaves it alone.
 */

export const FINANCE_TICKET_TITLES = Object.freeze({
  plan: 'Income / Outcome plan',
  report: 'Income / Outcome result',
});

const normalize = (title) =>
  String(title || '')
    .toLowerCase()
    .replace(/[\s/]+/g, ' ')
    .trim();

const KNOWN_TITLES = new Set(
  [
    ...Object.values(FINANCE_TICKET_TITLES),
    // The titles this block replaces, so an old document does not show twice.
    'Earning and Outcome result',
    'Earning and Outcome plan',
    'Income/Outcome plan',
    'Income/Outcome result',
  ].map(normalize),
);

/** True when a saved section is the finance block under any of its names. */
export const isFinanceTicketTitle = (title) => KNOWN_TITLES.has(normalize(title));
