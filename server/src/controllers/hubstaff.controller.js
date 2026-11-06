const HUBSTAFF_BASE = 'https://api.hubstaff.com/v2';

/**
 * Makes an authenticated request to the Hubstaff API.
 * Handles array params as repeated keys (e.g. user_ids[]=1&user_ids[]=2).
 */
const hubstaffFetch = async (path, params = {}) => {
  const token = process.env.HUBSTAFF_TOKEN;
  if (!token) throw new Error('HUBSTAFF_TOKEN is not configured');

  const url = new URL(`${HUBSTAFF_BASE}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach(v => url.searchParams.append(`${key}[]`, v));
    } else {
      url.searchParams.append(key, value);
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Hubstaff API ${response.status}: ${body}`);
  }

  return response.json();
};

/**
 * GET /api/hubstaff/members
 * Returns all active members of the configured organization.
 */
export const getMembers = async (req, res) => {
  try {
    const orgId = process.env.HUBSTAFF_ORG_ID;
    if (!orgId) return res.status(500).json({ ok: false, message: 'HUBSTAFF_ORG_ID is not configured' });

    const data = await hubstaffFetch(`/organizations/${orgId}/members`, {
      include: ['users'],
    });

    // Flatten: attach user info directly onto each member
    const users = data.users || [];
    const usersMap = Object.fromEntries(users.map(u => [u.id, u]));

    const members = (data.members || []).map(m => ({
      ...m,
      user: usersMap[m.user_id] || null,
    }));

    res.json({ ok: true, data: { members } });
  } catch (err) {
    console.error('Hubstaff getMembers error:', err.message);
    res.status(500).json({ ok: false, message: err.message });
  }
};

/**
 * GET /api/hubstaff/activities
 * Query params: date_from (YYYY-MM-DD), date_to (YYYY-MM-DD), user_ids (comma-separated or array)
 * Returns activity records (tracked, keyboard, mouse, overall) per user per day.
 */
export const getActivities = async (req, res) => {
  try {
    const orgId = process.env.HUBSTAFF_ORG_ID;
    if (!orgId) return res.status(500).json({ ok: false, message: 'HUBSTAFF_ORG_ID is not configured' });

    const { date_from, date_to, user_ids } = req.query;

    const userIdArray = user_ids
      ? (Array.isArray(user_ids) ? user_ids : user_ids.split(',').map(s => s.trim()))
      : [];

    const params = { date_from, date_to };
    if (userIdArray.length) params.user_ids = userIdArray;

    const data = await hubstaffFetch(`/organizations/${orgId}/activities`, params);
    res.json({ ok: true, data });
  } catch (err) {
    console.error('Hubstaff getActivities error:', err.message);
    res.status(500).json({ ok: false, message: err.message });
  }
};

/**
 * GET /api/hubstaff/time-entries
 * Query params: date_from, date_to, user_ids
 * Returns time entries with start/end times.
 */
export const getTimeEntries = async (req, res) => {
  try {
    const orgId = process.env.HUBSTAFF_ORG_ID;
    if (!orgId) return res.status(500).json({ ok: false, message: 'HUBSTAFF_ORG_ID is not configured' });

    const { date_from, date_to, user_ids } = req.query;

    const userIdArray = user_ids
      ? (Array.isArray(user_ids) ? user_ids : user_ids.split(',').map(s => s.trim()))
      : [];

    const params = { date_from, date_to };
    if (userIdArray.length) params.user_ids = userIdArray;

    const data = await hubstaffFetch(`/organizations/${orgId}/time_entries`, params);
    res.json({ ok: true, data });
  } catch (err) {
    console.error('Hubstaff getTimeEntries error:', err.message);
    res.status(500).json({ ok: false, message: err.message });
  }
};

/**
 * GET /api/hubstaff/summary
 * Fetches activities and aggregates them per-user for the given date range.
 * Returns a summary array: [{ user_id, tracked, keyboard, mouse, overall, days }]
 */
export const getSummary = async (req, res) => {
  try {
    const orgId = process.env.HUBSTAFF_ORG_ID;
    if (!orgId) return res.status(500).json({ ok: false, message: 'HUBSTAFF_ORG_ID is not configured' });

    const { date_from, date_to, user_ids } = req.query;

    const userIdArray = user_ids
      ? (Array.isArray(user_ids) ? user_ids : user_ids.split(',').map(s => s.trim()))
      : [];

    const params = { date_from, date_to };
    if (userIdArray.length) params.user_ids = userIdArray;

    // Fetch activities and members in parallel
    const [activityData, memberData] = await Promise.all([
      hubstaffFetch(`/organizations/${orgId}/activities`, params),
      hubstaffFetch(`/organizations/${orgId}/members`, { include: ['users'] }),
    ]);

    const activities = activityData.activities || [];

    // Build users map from members response
    const usersRaw = memberData.users || [];
    const usersMap = Object.fromEntries(usersRaw.map(u => [u.id, u]));

    // Aggregate activities per user
    const byUser = {};
    for (const act of activities) {
      if (!byUser[act.user_id]) {
        byUser[act.user_id] = {
          user_id: act.user_id,
          user: usersMap[act.user_id] || null,
          tracked: 0,
          keyboard: 0,
          mouse: 0,
          overall: 0,
          days: new Set(),
        };
      }
      const entry = byUser[act.user_id];
      entry.tracked += act.tracked || 0;
      entry.keyboard += act.keyboard || 0;
      entry.mouse += act.mouse || 0;
      entry.overall += act.overall || 0;
      if (act.date) entry.days.add(act.date);
    }

    const summary = Object.values(byUser).map(entry => ({
      ...entry,
      days: entry.days.size,
    }));

    // Sort by tracked time descending
    summary.sort((a, b) => b.tracked - a.tracked);

    res.json({ ok: true, data: { summary, date_from, date_to } });
  } catch (err) {
    console.error('Hubstaff getSummary error:', err.message);
    res.status(500).json({ ok: false, message: err.message });
  }
};
