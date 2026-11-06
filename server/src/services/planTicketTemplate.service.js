import PlanTicketTemplate from '../models/PlanTicketTemplate.js';
import { PLAN_TICKET_DEFAULTS_BY_PERIOD, PLAN_TICKET_PERIODS } from '../constants/planTicketDefaults.js';

const LEGACY_BITTENSOR_TASK_TITLE = 'Working on Task (or Bittensor)';

async function migrateBittensorTaskTitle(period) {
  const row = (PLAN_TICKET_DEFAULTS_BY_PERIOD[period] || []).find((r) => r.key === 'BITTENSOR_TASK');
  if (!row?.title) return;
  await PlanTicketTemplate.updateMany(
    { period, key: 'BITTENSOR_TASK', title: LEGACY_BITTENSOR_TASK_TITLE },
    { $set: { title: row.title } }
  );
}

export async function ensurePlanTicketDefaults(period) {
  const p = String(period || '').toLowerCase();
  if (!PLAN_TICKET_PERIODS.includes(p)) return;

  const count = await PlanTicketTemplate.countDocuments({ period: p });
  if (count > 0) {
    await migrateBittensorTaskTitle(p);
    return;
  }

  const defaults = PLAN_TICKET_DEFAULTS_BY_PERIOD[p] || [];
  if (!defaults.length) return;

  await PlanTicketTemplate.insertMany(
    defaults.map((row) => ({
      period: p,
      key: row.key,
      title: row.title,
      sortOrder: row.sortOrder,
      isDefault: true,
      active: true
    }))
  );
}

export async function listPlanTicketTemplates(period, { activeOnly = true } = {}) {
  const p = String(period || '').toLowerCase();
  await ensurePlanTicketDefaults(p);
  const filter = { period: p };
  if (activeOnly) filter.active = true;
  return PlanTicketTemplate.find(filter).sort({ sortOrder: 1, createdAt: 1 }).lean();
}
