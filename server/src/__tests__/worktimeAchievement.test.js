/**
 * The server's worktime achievement must stay identical to the one the client
 * shows (Worktime Management / Summarize), so the weekend automation scores a
 * week exactly like the page does.
 *
 * Run with: npm test -- worktimeAchievement.test.js
 */

import { describe, it, expect } from '@jest/globals';
import { achievementFromDays } from '../services/worktimeAchievement.js';
import {
  computeWorktimeMetrics,
  WORKTIME_FINAL_BASELINE as CLIENT_BASELINE,
  worktimeFinalPercent as clientFinalPercent,
} from '../../../client/src/utils/worktimeMetrics.js';
 import { WORKTIME_FINAL_BASELINE, finalWorktimePercent } from '../constants/summarize.js';

const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

describe('achievementFromDays', () => {
  it('matches the client calculation on random weeks', () => {
    let seed = 11;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    let compared = 0;

    for (let i = 0; i < 5000; i += 1) {
      const days = Array.from({ length: 1 + Math.floor(rnd() * 7) }, (_, k) => ({
        date: `2026-09-${String(k + 1).padStart(2, '0')}`,
        target: pick(rnd, [810, 810, 720, 600, 0, 1440]),
        isHoliday: rnd() < 0.3,
        real_time: pick(rnd, [0, 0, 3600, 20000, 48600, 90000]),
        add_time: pick(rnd, [0, 0, 1800, 7200, 30000]),
      }));

      const mine = achievementFromDays(days);
      const theirs = computeWorktimeMetrics({ days }, { includeHoliday: true }).achievementPercent;
      expect(mine).toBeCloseTo(theirs, 10);
      compared += 1;
    }

    expect(compared).toBe(5000);
  });

  it('caps each day at 100% and reads a holiday as a full day', () => {
    const target = 600;
    expect(achievementFromDays([{ target, isHoliday: false, real_time: 600 * 60, add_time: 0 }])).toBe(100);
    // 120% on one day and 80% on the next averages to 90%, not 100%.
    expect(
      achievementFromDays([
        { target, isHoliday: false, real_time: 720 * 60, add_time: 0 },
        { target, isHoliday: false, real_time: 480 * 60, add_time: 0 },
      ]),
    ).toBe(90);
    expect(achievementFromDays([{ target: 0, isHoliday: true, real_time: 0, add_time: 0 }])).toBe(100);
  });

  it('is 0% with nothing to measure', () => {
    expect(achievementFromDays([])).toBe(0);
  });
});

describe('final worktime percent', () => {
  it('uses the same baseline as the client', () => {
    expect(WORKTIME_FINAL_BASELINE).toBe(CLIENT_BASELINE);
    for (let real = 0; real <= 100; real += 0.5) {
      expect(finalWorktimePercent(real)).toBeCloseTo(clientFinalPercent(real), 10);
    }
    expect(finalWorktimePercent(null)).toBeNull();
  });

  it('reads 0% at the baseline and 100% at a full target', () => {
    expect(finalWorktimePercent(95)).toBe(0);
    expect(finalWorktimePercent(97.5)).toBe(50);
    expect(finalWorktimePercent(100)).toBe(100);
    expect(finalWorktimePercent(80)).toBe(0);
  });
});
