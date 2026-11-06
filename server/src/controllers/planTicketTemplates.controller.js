import PlanTicketTemplate from '../models/PlanTicketTemplate.js';
import { listPlanTicketTemplates } from '../services/planTicketTemplate.service.js';
import { PLAN_TICKET_PERIODS } from '../constants/planTicketDefaults.js';

const makeCustomKey = () =>
  `CUSTOM_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

function normalizePeriod(period) {
  const p = String(period || '').toLowerCase();
  if (!PLAN_TICKET_PERIODS.includes(p)) return null;
  return p;
}

export const getPlanTicketTemplates = async (req, res) => {
  try {
    const period = normalizePeriod(req.query.period);
    if (!period) {
      return res.status(400).json({ ok: false, message: 'period must be daily, weekly, or monthly' });
    }
    const data = await listPlanTicketTemplates(period, { activeOnly: true });
    return res.json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

export const getPlanTicketTemplatesAdmin = async (req, res) => {
  try {
    const period = normalizePeriod(req.query.period);
    if (!period) {
      return res.status(400).json({ ok: false, message: 'period must be daily, weekly, or monthly' });
    }
    const data = await listPlanTicketTemplates(period, { activeOnly: false });
    return res.json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

export const createPlanTicketTemplate = async (req, res) => {
  try {
    const period = normalizePeriod(req.body.period || req.query.period);
    if (!period) {
      return res.status(400).json({ ok: false, message: 'period must be daily, weekly, or monthly' });
    }
    const title = String(req.body.title || '').trim();
    if (!title) {
      return res.status(400).json({ ok: false, message: 'title is required' });
    }

    const maxOrder = await PlanTicketTemplate.findOne({ period })
      .sort({ sortOrder: -1 })
      .select('sortOrder')
      .lean();
    const sortOrder =
      typeof req.body.sortOrder === 'number'
        ? req.body.sortOrder
        : (maxOrder?.sortOrder ?? 0) + 1;

    const doc = await PlanTicketTemplate.create({
      period,
      key: makeCustomKey(),
      title,
      sortOrder,
      isDefault: false,
      active: req.body.active !== false,
      createdBy: req.user?.id || null,
      updatedBy: req.user?.id || null
    });

    return res.json({ ok: true, data: doc, message: 'Plan ticket created' });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ ok: false, message: 'A ticket with this key already exists' });
    }
    return res.status(500).json({ ok: false, message: err.message });
  }
};

export const updatePlanTicketTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const title = String(req.body.title || '').trim();
    if (!title) {
      return res.status(400).json({ ok: false, message: 'title is required' });
    }

    const patch = {
      title,
      updatedBy: req.user?.id || null
    };
    if (typeof req.body.sortOrder === 'number') patch.sortOrder = req.body.sortOrder;
    if (typeof req.body.active === 'boolean') patch.active = req.body.active;

    const updated = await PlanTicketTemplate.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ ok: false, message: 'Plan ticket not found' });
    return res.json({ ok: true, data: updated, message: 'Plan ticket updated' });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

export const deletePlanTicketTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await PlanTicketTemplate.findById(id).lean();
    if (!existing) return res.status(404).json({ ok: false, message: 'Plan ticket not found' });
    await PlanTicketTemplate.findByIdAndDelete(id);
    return res.json({ ok: true, message: 'Plan ticket removed' });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};
