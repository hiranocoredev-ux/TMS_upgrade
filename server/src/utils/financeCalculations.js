import { monthRangeDates } from './businessMonth.js';
/**
 * Finance Calculation Utilities
 * 
 * Verification and calculation helpers for finance module
 * Used for testing and ensuring calculation accuracy
 */

/**
 * Calculate monthly summary from transactions
 * @param {Array} transactions - Array of transaction objects
 * @param {Number} incomeGoal - Target income goal (optional)
 * @param {Number} expenseLimit - Expense limit (optional)
 * @returns {Object} Summary object with totals and progress
 */
export const calculateMonthlySummary = (transactions, incomeGoal = null, expenseLimit = null) => {
  const totals = transactions.reduce(
    (acc, tx) => {
      if (tx.type === 'income') {
        acc.income += tx.amount;
      } else if (tx.type === 'outcome') {
        acc.outcome += tx.amount;
      }
      return acc;
    },
    { income: 0, outcome: 0 }
  );

  totals.net = totals.income - totals.outcome;

  const summary = { totals };

  // Calculate goal progress if goals provided
  if (incomeGoal !== null && incomeGoal > 0) {
    summary.goalProgress = {
      incomeGoal,
      incomeProgress: Math.min((totals.income / incomeGoal) * 100, 100),
      incomeAchieved: totals.income,
      isIncomeGoalMet: totals.income >= incomeGoal
    };

    if (expenseLimit !== null && expenseLimit > 0) {
      summary.goalProgress.expenseLimit = expenseLimit;
      summary.goalProgress.expenseProgress = Math.min((totals.outcome / expenseLimit) * 100, 100);
      summary.goalProgress.expenseUsed = totals.outcome;
      summary.goalProgress.isOverExpenseLimit = totals.outcome > expenseLimit;
    }
  }

  return summary;
};

/**
 * Verify calculation accuracy
 * - Ensures income + outcome calculations are correct
 * - Verifies net = income - outcome
 * - Validates goal progress percentages
 * @param {Object} summary - Summary object from calculateMonthlySummary
 * @returns {Object} { valid: Boolean, errors: Array<String> }
 */
export const verifyCalculation = (summary) => {
  const errors = [];

  // Verify net calculation
  const expectedNet = summary.totals.income - summary.totals.outcome;
  if (Math.abs(summary.totals.net - expectedNet) > 0.01) {
    errors.push(`Net calculation incorrect: expected ${expectedNet}, got ${summary.totals.net}`);
  }

  // Verify goal progress calculations
  if (summary.goalProgress) {
    const { incomeGoal, incomeAchieved, incomeProgress } = summary.goalProgress;
    
    if (incomeGoal > 0) {
      const expectedProgress = (incomeAchieved / incomeGoal) * 100;
      if (Math.abs(incomeProgress - Math.min(expectedProgress, 100)) > 0.01) {
        errors.push(`Income progress calculation incorrect: expected ${expectedProgress}%, got ${incomeProgress}%`);
      }

      if (incomeAchieved >= incomeGoal && !summary.goalProgress.isIncomeGoalMet) {
        errors.push('Income goal met flag should be true');
      }
      if (incomeAchieved < incomeGoal && summary.goalProgress.isIncomeGoalMet) {
        errors.push('Income goal met flag should be false');
      }
    }

    if (summary.goalProgress.expenseLimit && summary.goalProgress.expenseLimit > 0) {
      const { expenseLimit, expenseUsed, expenseProgress } = summary.goalProgress;
      const expectedProgress = (expenseUsed / expenseLimit) * 100;
      if (Math.abs(expenseProgress - Math.min(expectedProgress, 100)) > 0.01) {
        errors.push(`Expense progress calculation incorrect: expected ${expectedProgress}%, got ${expenseProgress}%`);
      }

      if (expenseUsed > expenseLimit && !summary.goalProgress.isOverExpenseLimit) {
        errors.push('Expense limit exceeded flag should be true');
      }
      if (expenseUsed <= expenseLimit && summary.goalProgress.isOverExpenseLimit) {
        errors.push('Expense limit exceeded flag should be false');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Parse YYYY-MM month string to date range
 * @param {String} monthStr - Month string in YYYY-MM format
 * @returns {Object} { start: Date, end: Date }
 */
export const parseMonthToDateRange = (monthStr) => {
  if (!/^\d{4}-\d{2}$/.test(monthStr)) {
    throw new Error('Invalid month format. Expected YYYY-MM');
  }

  // A month runs from the 6th to the 5th of the next month.
  const { start, end } = monthRangeDates(monthStr);

  return { start, end };
};

/**
 * Validate month format
 * @param {String} monthStr - Month string
 * @returns {Boolean}
 */
export const isValidMonthFormat = (monthStr) => {
  return /^\d{4}-\d{2}$/.test(monthStr);
};

/**
 * Calculate financial metrics from transactions based on status
 * 
 * Status Logic:
 * - pending: Expected funds, count ONLY toward budgeted performance
 * - accepted: Real income/expense, count toward actual performance
 * - canceled: Ignored entirely, must NOT affect any totals
 * 
 * @param {Array} transactions - Array of transaction objects with status field
 * @param {Number} target - Target financial goal (optional)
 * @returns {Object} Metrics object with:
 *   - actualIncome: accepted deposits
 *   - actualExpense: accepted expenditures
 *   - pendingIncome: pending deposits only
 *   - budgetedPerformance: actualIncome + pendingIncome
 *   - gap: target - (budgetedPerformance - actualExpense)
 */
export const calculateFinancialMetrics = (transactions, target = null) => {
  let actualIncome = 0;
  let actualExpense = 0;
  let pendingIncome = 0;

  transactions.forEach((tx) => {
    // Canceled transactions are ignored entirely
    if (tx.status === 'canceled') {
      return;
    }

    if (tx.type === 'income') {
      if (tx.status === 'accepted') {
        actualIncome += tx.amount;
      } else if (tx.status === 'pending') {
        pendingIncome += tx.amount;
      }
    } else if (tx.type === 'outcome') {
      if (tx.status === 'accepted') {
        actualExpense += tx.amount;
      }
      // Pending outcomes don't count toward budgeted performance
    }
  });

  const budgetedPerformance = actualIncome + pendingIncome;
  const gap = target !== null ? target - (budgetedPerformance - actualExpense) : null;

  return {
    actualIncome,
    actualExpense,
    pendingIncome,
    budgetedPerformance,
    gap
  };
};

/**
 * Calculate financial metrics for a specific date range
 * @param {Array} transactions - Array of transaction objects
 * @param {Date} startDate - Start date (inclusive)
 * @param {Date} endDate - End date (inclusive)
 * @param {Number} target - Target financial goal (optional)
 * @returns {Object} Metrics object
 */
export const calculateFinancialMetricsForDateRange = (transactions, startDate, endDate, target = null) => {
  const filteredTransactions = transactions.filter((tx) => {
    const txDate = new Date(tx.date);
    return txDate >= startDate && txDate <= endDate;
  });

  return calculateFinancialMetrics(filteredTransactions, target);
};

/**
 * Calculate financial metrics for a specific month
 * @param {Array} transactions - Array of transaction objects
 * @param {String} month - Month in YYYY-MM format
 * @param {Number} target - Target financial goal (optional)
 * @returns {Object} Metrics object
 */
export const calculateFinancialMetricsForMonth = (transactions, month, target = null) => {
  if (!isValidMonthFormat(month)) {
    throw new Error('Invalid month format. Expected YYYY-MM');
  }

  const { start, end } = parseMonthToDateRange(month);
  return calculateFinancialMetricsForDateRange(transactions, start, end, target);
};

/**
 * Aggregate financial metrics across multiple users
 * @param {Array} userMetrics - Array of metrics objects from calculateFinancialMetrics
 * @param {Number} target - Aggregate target (optional)
 * @returns {Object} Aggregated metrics
 */
export const aggregateFinancialMetrics = (userMetrics, target = null) => {
  const aggregated = userMetrics.reduce(
    (acc, metrics) => ({
      actualIncome: acc.actualIncome + metrics.actualIncome,
      actualExpense: acc.actualExpense + metrics.actualExpense,
      pendingIncome: acc.pendingIncome + metrics.pendingIncome,
      budgetedPerformance: acc.budgetedPerformance + metrics.budgetedPerformance
    }),
    {
      actualIncome: 0,
      actualExpense: 0,
      pendingIncome: 0,
      budgetedPerformance: 0
    }
  );

  aggregated.gap = target !== null 
    ? target - (aggregated.budgetedPerformance - aggregated.actualExpense)
    : null;

  return aggregated;
};

