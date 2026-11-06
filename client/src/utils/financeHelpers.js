/**
 * Finance Module Helper Utilities
 *
 * Utility functions for finance calculations and formatting
 */

import { getESTMonthKey } from './timezoneHelpers';

/**
 * Format amount with currency
 * @param {number} amount
 * @param {string} currency - Default: 'USD'
 * @returns {string}
 */
export const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

/**
 * Format month string (YYYY-MM) to display format
 * @param {string} month - YYYY-MM format
 * @returns {string} - e.g., "January 2026"
 */
export const formatMonth = (month) => {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return month;
  }
  
  const [year, monthNum] = month.split('-').map(Number);
  const date = new Date(year, monthNum - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

/**
 * Get current month in YYYY-MM format
 * @returns {string}
 */
export const getCurrentMonth = () => {
  // EST is the system-wide timezone; default to the current EST month so the
  // value matches what the rest of the system considers "this month".
  return getESTMonthKey();
};

/**
 * Get previous month in YYYY-MM format
 * @param {string} month - YYYY-MM format
 * @returns {string}
 */
export const getPreviousMonth = (month) => {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return month;
  }
  
  const [year, monthNum] = month.split('-').map(Number);
  const date = new Date(year, monthNum - 1, 1);
  date.setMonth(date.getMonth() - 1);
  
  const prevYear = date.getFullYear();
  const prevMonth = String(date.getMonth() + 1).padStart(2, '0');
  return `${prevYear}-${prevMonth}`;
};

/**
 * Get next month in YYYY-MM format
 * @param {string} month - YYYY-MM format
 * @returns {string}
 */
export const getNextMonth = (month) => {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return month;
  }
  
  const [year, monthNum] = month.split('-').map(Number);
  const date = new Date(year, monthNum - 1, 1);
  date.setMonth(date.getMonth() + 1);
  
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  return `${nextYear}-${nextMonth}`;
};

/**
 * Get date range for a month
 * @param {string} month - YYYY-MM format
 * @returns {Object} { start: Date, end: Date }
 */
export const getMonthDateRange = (month) => {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return null;
  }
  
  const [year, monthNum] = month.split('-').map(Number);
  const start = new Date(year, monthNum - 1, 1);
  const end = new Date(year, monthNum, 0, 23, 59, 59, 999);
  
  return { start, end };
};

/**
 * Calculate percentage
 * @param {number} value
 * @param {number} total
 * @returns {number} - Percentage (0-100)
 */
export const calculatePercentage = (value, total) => {
  if (!total || total === 0) return 0;
  return Math.min((value / total) * 100, 100);
};

/**
 * Get status badge color
 * @param {'pending'|'accepted'|'canceled'} status
 * @returns {string} - CSS color class or hex
 */
export const getStatusColor = (status) => {
  const colors = {
    pending: '#f59e0b',    // amber
    accepted: '#10b981',   // green
    canceled: '#ef4444'    // red
  };
  return colors[status] || '#6b7280'; // gray default
};

/**
 * Get approval status badge color
 * @param {'not_required'|'pending'|'approved'|'rejected'} approvalStatus
 * @returns {string} - CSS color class or hex
 */
export const getApprovalStatusColor = (approvalStatus) => {
  const colors = {
    not_required: '#6b7280', // gray
    pending: '#f59e0b',        // amber
    approved: '#10b981',      // green
    rejected: '#ef4444'       // red
  };
  return colors[approvalStatus] || '#6b7280';
};

/**
 * Format date to ISO 8601 string
 * @param {Date|string} date
 * @returns {string} - ISO 8601 format
 */
export const formatDateISO = (date) => {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString();
};

/**
 * Format date for display
 * @param {Date|string} date
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string}
 */
// export const formatDate = (date, options = {}) => {
//   if (!date) return '';
//   const d = date instanceof Date ? date : new Date(date);
//   const defaultOptions = {
//     year: 'numeric',
//     month: 'short',
//     day: 'numeric',
//     ...options
//   };
//   return d.toLocaleDateString('en-US', defaultOptions);
// };
export const formatDate = (dateStr) => {
  if (!dateStr) return '-';

  // Handles YYYY-MM-DD or ISO strings safely
  const [year, month, day] = dateStr.split('T')[0].split('-');

  return `${month}/${day}/${year}`;
};
/**
 * Check if a date is within a date range
 * @param {Date|string} date
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @returns {boolean}
 */
export const isDateInRange = (date, startDate, endDate) => {
  if (!date || !startDate || !endDate) return false;
  
  const d = date instanceof Date ? date : new Date(date);
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = endDate instanceof Date ? endDate : new Date(endDate);
  
  return d >= start && d <= end;
};

/**
 * Calculate gap between target and performance
 * @param {number} target
 * @param {number} budgetedPerformance
 * @param {number} actualExpense
 * @returns {number|null}
 */
export const calculateGap = (target, budgetedPerformance, actualExpense) => {
  if (target === null || target === undefined) return null;
  return target - (budgetedPerformance - actualExpense);
};

/**
 * Get transaction type label
 * @param {'income'|'outcome'} type
 * @returns {string}
 */
export const getTransactionTypeLabel = (type) => {
  return type === 'income' ? 'Income' : 'Expense';
};

/**
 * Get transaction type color
 * @param {'income'|'outcome'} type
 * @returns {string} - CSS color class or hex
 */
export const getTransactionTypeColor = (type) => {
  return type === 'income' ? '#10b981' : '#ef4444'; // green : red
};
