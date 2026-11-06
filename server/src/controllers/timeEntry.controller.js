import TimeEntry from '../models/TimeEntry.js';
import User from '../models/User.js';
import { getESTDateKey } from '../utils/estTime.js';

// ─── helpers ────────────────────────────────────────────────────────────────

const todayString = () => getESTDateKey();

/**
 * Return all fields to populate on the userId reference.
 */
const USER_FIELDS = 'name email group avatarUrl';

// ─── Timer ──────────────────────────────────────────────────────────────────

/**
 * POST /api/time-entries/start
 * Start a new timer for the authenticated user.
 * Stops any currently running timer first.
 */
export const startTimer = async (req, res) => {
  try {
    const userId = req.user._id;

    // Auto-stop any previously running entry
    const running = await TimeEntry.findOne({ userId, status: 'running' });
    if (running) {
      const now = new Date();
      running.endTime = now;
      running.duration = Math.round((now - running.startTime) / 1000);
      running.status = 'completed';
      await running.save();
    }

    const { description = '' } = req.body;
    const now = new Date();

    const entry = await TimeEntry.create({
      userId,
      group: req.user.group || '',
      date: todayString(),
      startTime: now,
      description,
      status: 'running',
    });

    res.status(201).json({ ok: true, data: entry, message: 'Timer started' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

/**
 * POST /api/time-entries/stop
 * Stop the currently running timer for the authenticated user.
 */
export const stopTimer = async (req, res) => {
  try {
    const userId = req.user._id;
    const running = await TimeEntry.findOne({ userId, status: 'running' });

    if (!running) {
      return res.status(404).json({ ok: false, message: 'No running timer found' });
    }

    const now = new Date();
    running.endTime = now;
    running.duration = Math.round((now - running.startTime) / 1000);
    running.status = 'completed';
    if (req.body.description !== undefined) running.description = req.body.description;
    await running.save();

    res.json({ ok: true, data: running, message: 'Timer stopped' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

/**
 * GET /api/time-entries/running
 * Return the currently running timer for the authenticated user (or null).
 */
export const getRunning = async (req, res) => {
  try {
    const entry = await TimeEntry.findOne({ userId: req.user._id, status: 'running' });
    res.json({ ok: true, data: entry });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

// ─── Manual CRUD ────────────────────────────────────────────────────────────

/**
 * POST /api/time-entries
 * Manually create a completed time entry.
 * Body: { date, startTime, endTime, description }
 */
export const createEntry = async (req, res) => {
  try {
    const { date, startTime, endTime, description = '' } = req.body;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({ ok: false, message: 'date, startTime and endTime are required' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (end <= start) {
      return res.status(400).json({ ok: false, message: 'endTime must be after startTime' });
    }

    const entry = await TimeEntry.create({
      userId: req.user._id,
      group: req.user.group || '',
      date,
      startTime: start,
      endTime: end,
      duration: Math.round((end - start) / 1000),
      description,
      status: 'completed',
    });

    res.status(201).json({ ok: true, data: entry, message: 'Time entry created' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

/**
 * GET /api/time-entries/my
 * Return current user's entries, optionally filtered by date range.
 * Query: date_from, date_to, page, limit
 */
export const getMyEntries = async (req, res) => {
  try {
    const { date_from, date_to, page = 1, limit = 50 } = req.query;
    const filter = { userId: req.user._id };

    if (date_from || date_to) {
      filter.date = {};
      if (date_from) filter.date.$gte = date_from;
      if (date_to) filter.date.$lte = date_to;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [entries, total] = await Promise.all([
      TimeEntry.find(filter).sort({ date: -1, startTime: -1 }).skip(skip).limit(Number(limit)),
      TimeEntry.countDocuments(filter),
    ]);

    res.json({ ok: true, data: { entries, total, page: Number(page), limit: Number(limit) } });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

/**
 * PUT /api/time-entries/:id
 * Update description, startTime, endTime of an owned entry.
 */
export const updateEntry = async (req, res) => {
  try {
    const entry = await TimeEntry.findOne({ _id: req.params.id, userId: req.user._id });
    if (!entry) return res.status(404).json({ ok: false, message: 'Entry not found' });

    const { description, startTime, endTime } = req.body;
    if (description !== undefined) entry.description = description;

    if (startTime !== undefined) entry.startTime = new Date(startTime);
    if (endTime !== undefined) entry.endTime = new Date(endTime);

    if (entry.startTime && entry.endTime) {
      entry.duration = Math.max(0, Math.round((entry.endTime - entry.startTime) / 1000));
    }

    await entry.save();
    res.json({ ok: true, data: entry, message: 'Entry updated' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

/**
 * DELETE /api/time-entries/:id
 * Delete an owned time entry.
 */
export const deleteEntry = async (req, res) => {
  try {
    const entry = await TimeEntry.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!entry) return res.status(404).json({ ok: false, message: 'Entry not found' });
    res.json({ ok: true, message: 'Entry deleted' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

/**
 * DELETE /api/time-entries/my/all
 * Remove every time entry for the authenticated user (including any running timer row).
 */
export const deleteAllMyEntries = async (req, res) => {
  try {
    const result = await TimeEntry.deleteMany({ userId: req.user._id });
    res.json({
      ok: true,
      data: { deletedCount: result.deletedCount },
      message: 'All time entries removed',
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

// ─── Admin Summary ───────────────────────────────────────────────────────────

/**
 * GET /api/time-entries/summary
 * Admin/Boss: aggregated per-user summary for a date range.
 * Query: date_from, date_to, group | groupId (team code, matches TimeEntry.group)
 */
export const getSummary = async (req, res) => {
  try {
    const { date_from, date_to, group, groupId } = req.query;
    const groupCode = group || groupId;

    const matchStage = { status: 'completed' };
    if (date_from || date_to) {
      matchStage.date = {};
      if (date_from) matchStage.date.$gte = date_from;
      if (date_to) matchStage.date.$lte = date_to;
    }
    if (groupCode) matchStage.group = groupCode;

    const agg = await TimeEntry.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$userId',
          totalDuration: { $sum: '$duration' },
          entryCount: { $sum: 1 },
          days: { $addToSet: '$date' },
        },
      },
      { $sort: { totalDuration: -1 } },
    ]);

    // Attach user details
    const userIds = agg.map(r => r._id);
    const users = await User.find({ _id: { $in: userIds } }).select(USER_FIELDS);
    const usersMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));

    const summary = agg.map(r => ({
      userId: r._id,
      user: usersMap[r._id.toString()] || null,
      totalDuration: r.totalDuration,
      entryCount: r.entryCount,
      days: r.days.length,
    }));

    res.json({ ok: true, data: { summary, date_from, date_to } });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

/**
 * GET /api/time-entries/user/:userId
 * Admin: get a specific user's entries.
 */
export const getUserEntries = async (req, res) => {
  try {
    const { date_from, date_to, group, groupId } = req.query;
    const groupCode = group || groupId;
    const filter = { userId: req.params.userId };

    if (date_from || date_to) {
      filter.date = {};
      if (date_from) filter.date.$gte = date_from;
      if (date_to) filter.date.$lte = date_to;
    }
    if (groupCode) filter.group = groupCode;

    const entries = await TimeEntry.find(filter).sort({ date: -1, startTime: -1 }).limit(200);
    res.json({ ok: true, data: { entries } });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};
