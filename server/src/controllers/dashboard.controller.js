import User from '../models/User.js';
import {
  currentMonthKey,
  monthStartDateKey,
  monthEndExclusiveDateKey,
} from '../utils/businessMonth.js';
import Worklog from '../models/Worklog.js';
import Daily from '../models/Daily.js';
import FinanceTransaction from '../models/FinanceTransaction.js';
import { normalizeRole, ROLES, NON_MEMBER_ROLES } from '../constants/roles.js';
import { countableCondition } from '../utils/transactionReview.js';
import {
  estDateKeyToUtcDate,
  getESTDateKey,
  getESTMonthStartKey,
  shiftESTDateKey,
  shiftESTMonthStartKey
} from '../utils/estTime.js';

/**
 * GET /api/dashboard?group=<groupName|all>
 *
 * Aggregates per-user data for the dashboard cards:
 *   - todayHours / yesterdayHours: sum of worklog.total_time (= real_time + add_time),
 *     bucketed by UTC day (today = current UTC day, yesterday = previous UTC day).
 *   - dailyTodayState: Daily.state for today (UTC day)  null if no doc.
 *   - monthlyIncome: per-user sum of FinanceTransaction.amount where
 *     type='income', status='accepted', date within the current UTC month.
 *
 * Excludes:
 *   - Users with status !== 'active'
 *   - Group '*' (super-admin sentinel)
 *   - Non-member roles (SUPER_ADMIN, SYSTEM_ADMIN, FINANCE_MANAGER)  never appear in cards or in the
 *     returned `groups` list.
 */
export const getDashboard = async (req, res) => {
  try {
    const { group } = req.query;

    // ── EST day & month boundaries ──────────────────────────────────────────
    const todayStr = getESTDateKey();
    const yesterdayStr = shiftESTDateKey(todayStr, -1);
    const tomorrowStr = shiftESTDateKey(todayStr, 1);
    const todayStart = estDateKeyToUtcDate(todayStr);
    const todayEnd = estDateKeyToUtcDate(tomorrowStr);
    // The month runs from the 6th to the 5th of the next month.
    const monthKey = currentMonthKey();
    const monthStartStr = monthStartDateKey(monthKey);
    const monthEndStr = monthEndExclusiveDateKey(monthKey);
    // Transaction dates are day values at UTC midnight, so the month window is
    // measured the same way (an EST conversion would drop the month's first day).
    const monthStart = new Date(`${monthStartStr}T00:00:00.000Z`);
    const monthEnd = new Date(`${monthEndStr}T00:00:00.000Z`);

    // ── 1. Active users (group filter applied here when present) ─────────
    const userQuery = {
      status: 'active',
      group: { $ne: '*' },
      role: { $nin: NON_MEMBER_ROLES },
    };
    if (group && group !== 'all') {
      userQuery.group = group;
    }
    const users = await User.find(userQuery)
      .select('name email group role degree hubstaff_id avatarUrl')
      .sort({ name: 1 })
      .lean();

    const userIds = users.map(u => u._id);

// ── 2. Worklogs (today + yesterday) ──────────────────────────────────
    const member_id = users.map(u => u.hubstaff_id).filter(Boolean);

    let worklogs = [];
    if (member_id.length > 0) {
      worklogs = await Worklog.find({
        member: { $in: member_id },
        date: { $gte: yesterdayStr, $lt: tomorrowStr },
      })
        .select('member date real_time add_time total_time')
        .lean();
    }

    const hoursByUser = {};
    for (const w of worklogs) {
      const hubId = w.member;
      if (!hubId) continue;
      const user = users.find(u => String(u.hubstaff_id) === hubId);
      if (!user) continue;
      const uid = user._id.toString();
      if (!hoursByUser[uid]) hoursByUser[uid] = { today: 0, yesterday: 0 };
      const total = (Number(w.real_time) || 0) + (Number(w.add_time) || 0);
      if (w.date === todayStr) {
        hoursByUser[uid].today += total;
      } else if (w.date === yesterdayStr) {
        hoursByUser[uid].yesterday += total;
      }
    }

    // Ensure all users are in hoursByUser (even if no worklogs)
    for (const u of users) {
      const uid = u._id.toString();
      if (!hoursByUser[uid]) hoursByUser[uid] = { today: 0, yesterday: 0 };
    }

    // ── 3. Today's Daily reports per user ────────────────────────────────
    const dailies = await Daily.find({
      userId: { $in: userIds },
      date: { $gte: todayStart, $lt: todayEnd },
    })
      .select('userId state date')
      .lean();

    // If multiple dailies exist for the same user/day, keep the latest by date
    const dailyByUser = {};
    for (const d of dailies) {
      const uid = d.userId?.toString();
      if (!uid) continue;
      const existing = dailyByUser[uid];
      if (!existing || new Date(d.date) > new Date(existing.date)) {
        dailyByUser[uid] = d;
      }
    }

    // ── 4. Monthly income per user (current UTC month) ──────────────────
    const incomeAgg = await FinanceTransaction.aggregate([
      {
        $match: {
          // Counts in totals: created before approval was required, or fully approved.
          ...countableCondition(),
          userId: { $in: userIds },
          type: 'income',
          status: 'accepted',
          date: { $gte: monthStart, $lt: monthEnd },
        },
      },
      { $group: { _id: '$userId', total: { $sum: '$amount' } } },
    ]);
    const incomeByUser = {};
    for (const row of incomeAgg) {
      incomeByUser[row._id.toString()] = row.total || 0;
    }

    // ── 5. Groups (always full list, regardless of the group filter) ─────
    const groupsList = await User.distinct('group', {
      status: 'active',
      group: { $ne: '*' },
      role: { $nin: NON_MEMBER_ROLES },
    });
    // A user without a group must not add an empty entry or break the sort.
    const groupCodes = groupsList.filter((g) => typeof g === 'string' && g);
    groupCodes.sort();

    // ── 6. Build cards ───────────────────────────────────────────────────
    const cards = users.map(u => {
      const uid = u._id.toString();
      const h = hoursByUser[uid] || { today: 0, yesterday: 0 };
      const dailyDoc = dailyByUser[uid];
      return {
        userId: u._id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl || '',
        group: u.group,
        role: normalizeRole(u.role, u.degree),
        todaySeconds: h.today,
        yesterdaySeconds: h.yesterday,
        dailyTodayState: dailyDoc ? dailyDoc.state : null,
        monthlyIncome: incomeByUser[uid] || 0,
      };
    });

    // Sort: group ascending → group bosses first → name ascending.
    const isGroupBoss = (c) => c.role === ROLES.GROUP_BOSS;
    cards.sort((a, b) => {
      const g = String(a.group || '').localeCompare(String(b.group || ''), undefined, { numeric: true, sensitivity: 'base' });
      if (g !== 0) return g;
      const adminDelta = (isGroupBoss(b) ? 1 : 0) - (isGroupBoss(a) ? 1 : 0);
      if (adminDelta !== 0) return adminDelta;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    res.json({
      ok: true,
      data: {
        groups: groupCodes,
        cards,
        meta: {
          todayEST: todayStr,
          monthEST: monthKey,
        },
      },
    });
  } catch (err) {
    console.error('dashboard getDashboard error:', err.message);
    res.status(500).json({ ok: false, message: err.message });
  }
};
