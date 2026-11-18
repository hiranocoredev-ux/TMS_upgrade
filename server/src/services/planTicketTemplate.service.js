import PlanTicketTemplate from '../models/PlanTicketTemplate.js';
import {
  PLAN_TICKET_DEFAULTS_BY_PERIOD,
  ADMIN_PLAN_TICKET_DEFAULTS_BY_PERIOD,
  FINANCE_PLAN_TICKET_DEFAULTS_BY_PERIOD,
  PLAN_TICKET_PERIODS,
  PLAN_TICKET_AUDIENCES
} from '../constants/planTicketDefaults.js';

const LEGACY_BITTENSOR_TASK_TITLE = 'Working on Task (or Bittensor)';

/** 'admin', 'finance' or 'member' (anything else, including nothing, means member). */
export function normalizeAudience(audience) {
  const a = String(audience || '').toLowerCase();
  return PLAN_TICKET_AUDIENCES.includes(a) ? a : 'member';
}

/** Mongo filter for one audience; member tickets saved before the field existed have none. */
export function audienceFilter(audience) {
  const a = normalizeAudience(audience);
  return a === 'member' ? { audience: { $nin: ['admin', 'finance'] } } : { audience: a };
}

async function migrateBittensorTaskTitle(period) {
  const row = (PLAN_TICKET_DEFAULTS_BY_PERIOD[period] || []).find((r) => r.key === 'BITTENSOR_TASK');
  if (!row?.title) return;
  await PlanTicketTemplate.updateMany(
    { period, key: 'BITTENSOR_TASK', title: LEGACY_BITTENSOR_TASK_TITLE },
    { $set: { title: row.title } }
  );
}

export async function ensurePlanTicketDefaults(period, audience = 'member') {
  const p = String(period || '').toLowerCase();
  if (!PLAN_TICKET_PERIODS.includes(p)) return;
  const aud = normalizeAudience(audience);

  const count = await PlanTicketTemplate.countDocuments({ period: p, ...audienceFilter(aud) });
  if (count > 0) {
    if (aud === 'member') await migrateBittensorTaskTitle(p);
    return;
  }

  const source =
    aud === 'admin'
      ? ADMIN_PLAN_TICKET_DEFAULTS_BY_PERIOD
      : aud === 'finance'
        ? FINANCE_PLAN_TICKET_DEFAULTS_BY_PERIOD
        : PLAN_TICKET_DEFAULTS_BY_PERIOD;
  const defaults = source[p] || [];
  if (!defaults.length) return;

  try {
    await PlanTicketTemplate.insertMany(
      defaults.map((row) => ({
        period: p,
        audience: aud,
        key: row.key,
        title: row.title,
        sortOrder: row.sortOrder,
        isDefault: true,
        active: true
      })),
      { ordered: false }
    );
  } catch (err) {
    // Two first loads at once may both seed; the unique index keeps one copy.
    if (err?.code !== 11000 && !err?.writeErrors?.every?.((e) => e?.code === 11000)) throw err;
  }
}

export async function listPlanTicketTemplates(period, { activeOnly = true, audience = 'member' } = {}) {
  const p = String(period || '').toLowerCase();
  const aud = normalizeAudience(audience);
  await ensurePlanTicketDefaults(p, aud);
  const filter = { period: p, ...audienceFilter(aud) };
  if (activeOnly) filter.active = true;
  return PlanTicketTemplate.find(filter).sort({ sortOrder: 1, createdAt: 1 }).lean();
}
