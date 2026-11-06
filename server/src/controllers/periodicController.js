import Periodic from '../models/Periodic.js';
import UserPeriodicPlan from '../models/UserPeriodicPlan.js';
import User from '../models/User.js';

export const getPeriods = async (req, res) => {
  const periods = await Periodic.find(req.query.month ? { month: req.query.month } : {});
  res.json({ ok: true, data: { periods } });
};

export const createPeriod = async (req, res) => {
  const period = await Periodic.create(req.body);
  res.json({ ok: true, data: { period } });
};

export const getUserPeriodicPlans = async (req, res) => {
  const users = await User.find().lean();
  const plans = await UserPeriodicPlan.find({ periodId: req.query.periodId }).lean();

  const rows = users.map(u => {
    const p = plans.find(x => x.userId.toString() === u._id.toString());
    return {
      userId: u._id,
      name: u.name,
      periodicFinancialGoal: p?.periodicFinancialGoal || 0,
      note: p?.note || ''
    };
  });

  res.json({ ok: true, data: { rows } });
};

export const upsertUserPeriodicPlan = async (req, res) => {
  const plan = await UserPeriodicPlan.findOneAndUpdate(
    { userId: req.body.userId, periodId: req.body.periodId },
    req.body,
    { upsert: true, new: true }
  );
  res.json({ ok: true, data: { plan } });
};
