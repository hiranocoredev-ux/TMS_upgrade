/**
 * Finance Module Type Definitions
 * 
 * JSDoc type definitions for Finance module
 * Based on FRONTEND_DATA_CONTRACT.md
 */

/**
 * @typedef {Object} User
 * @property {string} _id
 * @property {string} email
 * @property {string} name
 */

/**
 * @typedef {Object} FinanceTransaction
 * @property {string} _id
 * @property {'income'|'outcome'} type
 * @property {string|User} userId - Populated in responses
 * @property {string} date - ISO 8601 format
 * @property {number} amount - Derived: inputPrice when Tron, else inputPrice * 0.98
 * @property {number} [inputPrice] - Price entered by the user; absent on legacy rows
 * @property {string} currency - Default: 'USD'
 * @property {string} [category] - Required for outcome
 * @property {string} [source] - Required for income
 * @property {string} description
 * @property {boolean} [throughTeamWallet] - Default: true; absent on legacy rows
 * @property {boolean} [isTron] - Default: false; forced true for outcomes and non-wallet income
 * @property {string[]} attachments - FileMeta IDs
 * @property {string} [linkedProjectId]
 * @property {string|Object} [linkedJobTicketId] - Populated as { _id, title }
 * @property {'not_required'|'pending'|'approved'|'rejected'} approvalStatus
 * @property {string|User} [approvedByUserId] - Populated
 * @property {string} [approvedAt] - ISO 8601
 * @property {string} [rejectionReason]
 * @property {'pending'|'accepted'|'canceled'} status - ⭐ NEW FIELD
 * @property {string} createdAt - ISO 8601
 * @property {string} updatedAt - ISO 8601
 */

/**
 * @typedef {Object} MonthlyFinancialPlan
 * @property {string} _id
 * @property {string|User} userId - Populated
 * @property {string} month - YYYY-MM format (e.g., "2026-01")
 * @property {number} monthlyFinancialGoal
 * @property {string} note
 * @property {string[]|PeriodicFinancialPlan[]} periodicPlanIds - Populated in GET responses
 * @property {string} createdAt - ISO 8601
 * @property {string} updatedAt - ISO 8601
 */

/**
 * @typedef {Object} PeriodicFinancialPlan
 * @property {string} _id
 * @property {string|User} userId - Populated
 * @property {string} month - YYYY-MM format
 * @property {string} startDate - ISO 8601
 * @property {string} endDate - ISO 8601
 * @property {number} periodicFinancialGoal
 * @property {string} note
 * @property {string} createdAt - ISO 8601
 * @property {string} updatedAt - ISO 8601
 */

/**
 * @typedef {Object} PaginationMeta
 * @property {number} page
 * @property {number} limit
 * @property {number} total
 * @property {number} totalPages
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} ok
 * @property {*} [data]
 * @property {Object} [error]
 * @property {string} [error.code]
 * @property {string} [error.message]
 * @property {string} [message]
 */

/**
 * Transaction Status Logic:
 * 
 * - pending: Expected funds, count ONLY toward budgeted performance
 *   - Used for: Expected income that hasn't been received yet
 *   - Calculation: Included in pendingIncome and budgetedPerformance
 *   - NOT included in actualIncome or actualExpense
 * 
 * - accepted: Real income/expense, count toward actual performance
 *   - Used for: Confirmed transactions
 *   - Calculation: Included in actualIncome (if type=income) or actualExpense (if type=outcome)
 *   - Included in budgetedPerformance (if type=income)
 * 
 * - canceled: Ignored entirely, must NOT affect any totals
 *   - Used for: Transactions that were created but should be ignored
 *   - Calculation: Excluded from ALL calculations
 *   - Can still be returned in list queries if explicitly requested
 * 
 * Default: 'accepted' (for backward compatibility)
 */

export {};
