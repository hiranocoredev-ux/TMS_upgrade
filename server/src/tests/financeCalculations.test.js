/**
 * Finance Calculation Tests
 * 
 * Jest tests for finance calculation utilities
 * Run with: npm test -- financeCalculations.test.js
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateMonthlySummary,
  verifyCalculation,
  parseMonthToDateRange,
  isValidMonthFormat
} from '../utils/financeCalculations.js';

describe('Finance Calculations', () => {
  describe('calculateMonthlySummary', () => {
    it('should calculate totals correctly', () => {
      const transactions = [
        { type: 'income', amount: 1000 },
        { type: 'income', amount: 500 },
        { type: 'outcome', amount: 300 },
        { type: 'outcome', amount: 200 }
      ];

      const summary = calculateMonthlySummary(transactions);

      expect(summary.totals.income).toBe(1500);
      expect(summary.totals.outcome).toBe(500);
      expect(summary.totals.net).toBe(1000);
    });

    it('should calculate goal progress when incomeGoal provided', () => {
      const transactions = [
        { type: 'income', amount: 800 },
        { type: 'outcome', amount: 300 }
      ];

      const summary = calculateMonthlySummary(transactions, 1000);

      expect(summary.goalProgress).toBeDefined();
      expect(summary.goalProgress.incomeGoal).toBe(1000);
      expect(summary.goalProgress.incomeAchieved).toBe(800);
      expect(summary.goalProgress.incomeProgress).toBe(80);
      expect(summary.goalProgress.isIncomeGoalMet).toBe(false);
    });

    it('should calculate expense progress when expenseLimit provided', () => {
      const transactions = [
        { type: 'income', amount: 1000 },
        { type: 'outcome', amount: 600 }
      ];

      const summary = calculateMonthlySummary(transactions, 1000, 500);

      expect(summary.goalProgress.expenseLimit).toBe(500);
      expect(summary.goalProgress.expenseUsed).toBe(600);
      expect(summary.goalProgress.expenseProgress).toBe(120);
      expect(summary.goalProgress.isOverExpenseLimit).toBe(true);
    });

    it('should cap progress at 100%', () => {
      const transactions = [
        { type: 'income', amount: 2000 }
      ];

      const summary = calculateMonthlySummary(transactions, 1000);

      expect(summary.goalProgress.incomeProgress).toBe(100);
      expect(summary.goalProgress.isIncomeGoalMet).toBe(true);
    });

    it('should handle empty transactions', () => {
      const summary = calculateMonthlySummary([], 1000, 500);

      expect(summary.totals.income).toBe(0);
      expect(summary.totals.outcome).toBe(0);
      expect(summary.totals.net).toBe(0);
      expect(summary.goalProgress.incomeProgress).toBe(0);
    });
  });

  describe('verifyCalculation', () => {
    it('should verify correct calculations', () => {
      const summary = {
        totals: { income: 1500, outcome: 500, net: 1000 },
        goalProgress: {
          incomeGoal: 1000,
          incomeAchieved: 1500,
          incomeProgress: 100,
          isIncomeGoalMet: true
        }
      };

      const result = verifyCalculation(summary);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect incorrect net calculation', () => {
      const summary = {
        totals: { income: 1500, outcome: 500, net: 999 } // Should be 1000
      };

      const result = verifyCalculation(summary);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect incorrect progress calculation', () => {
      const summary = {
        totals: { income: 800, outcome: 200, net: 600 },
        goalProgress: {
          incomeGoal: 1000,
          incomeAchieved: 800,
          incomeProgress: 70 // Should be 80
        }
      };

      const result = verifyCalculation(summary);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('parseMonthToDateRange', () => {
    // A month runs from the 6th to the 5th of the next month.
    const dayKey = (date) => date.toISOString().slice(0, 10);

    it('runs from the 6th to the 5th of the next month', () => {
      const { start, end } = parseMonthToDateRange('2026-01');

      expect(start.toISOString()).toBe('2026-01-06T00:00:00.000Z');
      expect(dayKey(end)).toBe('2026-02-05'); // the last instant of the 5th
      expect(end.toISOString()).toBe('2026-02-05T23:59:59.999Z');
    });

    it('does not change length with the calendar month', () => {
      const february = parseMonthToDateRange('2024-02');
      expect(dayKey(february.start)).toBe('2024-02-06');
      expect(dayKey(february.end)).toBe('2024-03-05');
    });

    it('counts a transaction stored on the first day of the month', () => {
      const { start, end } = parseMonthToDateRange('2026-09');
      const onTheSixth = new Date('2026-09-06'); // UTC midnight, as stored
      expect(onTheSixth >= start && onTheSixth <= end).toBe(true);
    });

    it('should throw error for invalid format', () => {
      expect(() => parseMonthToDateRange('2026-1')).toThrow();
      expect(() => parseMonthToDateRange('26-01')).toThrow();
      expect(() => parseMonthToDateRange('invalid')).toThrow();
    });
  });

  describe('isValidMonthFormat', () => {
    it('should validate correct format', () => {
      expect(isValidMonthFormat('2026-01')).toBe(true);
      expect(isValidMonthFormat('2024-12')).toBe(true);
    });

    it('should reject invalid format', () => {
      expect(isValidMonthFormat('2026-1')).toBe(false);
      expect(isValidMonthFormat('26-01')).toBe(false);
      expect(isValidMonthFormat('2026/01')).toBe(false);
      expect(isValidMonthFormat('invalid')).toBe(false);
    });
  });
});

