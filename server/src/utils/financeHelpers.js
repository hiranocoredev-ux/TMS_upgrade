/**
 * Finance Module Helper Utilities
 * Centralized helper functions for finance operations
 */

/**
 * Parse month string (YYYY-MM) to date range
 * @param {string} month - Month in YYYY-MM format
 * @returns {Object} Date range with $gte and $lte
 */
export const parseMonthToDateRange = (month) => {
  const [year, monthNum] = month.split('-').map(Number);
  return {
    $gte: new Date(year, monthNum - 1, 1),
    $lte: new Date(year, monthNum, 0, 23, 59, 59, 999)
  };
};

/**
 * Validate month format (YYYY-MM)
 * @param {string} month - Month string to validate
 * @returns {boolean} True if valid format
 */
export const isValidMonthFormat = (month) => {
  return /^\d{4}-\d{2}$/.test(month);
};

/**
 * Calculate transaction totals from array of transactions
 * @param {Array} transactions - Array of transaction objects
 * @returns {Object} Object with deposits and expenditures totals
 */
export const calculateTransactionTotals = (transactions) => {
  let deposits = 0;
  let expenditures = 0;

  transactions.forEach((tx) => {
    if (tx.type === 'deposit') {
      deposits += tx.amount;
    } else if (tx.type === 'expenditure') {
      expenditures += tx.amount;
    }
  });

  return { deposits, expenditures };
};

/**
 * Build date range filter from query parameters
 * @param {string} from - Start date (ISO string)
 * @param {string} to - End date (ISO string)
 * @returns {Object|null} Date filter object or null
 */
export const buildDateRangeFilter = (from, to) => {
  if (!from && !to) return null;

  const filter = {};
  if (from) filter.$gte = new Date(from);
  if (to) filter.$lte = new Date(to);

  return filter;
};

/**
 * Build text search filter
 * @param {string} field - Field name to search
 * @param {string} value - Search value
 * @returns {RegExp|null} Regex pattern or null
 */
export const buildTextSearchFilter = (field, value) => {
  if (!value) return null;
  return new RegExp(value, 'i');
};

/**
 * Validate date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Object} Validation result with isValid and message
 */
export const validateDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return {
      isValid: false,
      message: 'Invalid date format'
    };
  }

  if (start >= end) {
    return {
      isValid: false,
      message: 'Start date must be before end date'
    };
  }

  return { isValid: true };
};
