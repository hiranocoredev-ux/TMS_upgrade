import apiClient from './axios';

/** @param {{ start: string, end: string, memberId?: string, groupId?: string }} params */
export const getFinanceOverview = ({ start, end, memberId, groupId }) => {
  return apiClient.get('/finance/finance-overview', {
    params: {
      start,
      end,
      ...(memberId && { memberId }),
      ...(groupId && { groupId })
    }
  });
};

/**
 * Per-user profit for every quarter of a year (accepted income − outcome).
 * @param {{ year: number, groupId?: string }} params
 */
export const getQuarterProfit = ({ year, groupId } = {}) => {
  return apiClient.get('/finance/quarter-profit', {
    params: {
      ...(year && { year }),
      ...(groupId && groupId !== 'all' && { groupId })
    }
  });
};

/**
 * Finance API service
 * 
 * All endpoints follow the pattern:
 * - GET: Returns { ok: true, data: {...} }
 * - POST/PUT: Returns { ok: true, data: {...}, message: "..." }
 * - Errors: Returns { ok: false, error: { code, message } }
 */

// ============================================
// Transaction Endpoints
// ============================================

/**
 * Fetch transactions with filters
 * @param {Object} filters - Query filters
 * @param {'income'|'outcome'} [filters.type]
 * @param {string} [filters.currency]
 * @param {string} [filters.category]
 * @param {string} [filters.source]
 * @param {string} [filters.memberId] - Admin only
 * @param {string} [filters.groupId] - SUPER_ADMIN / platform admin: limit to users in this group code
 * @param {string} [filters.from] - ISO 8601
 * @param {string} [filters.to] - ISO 8601
 * @param {'not_required'|'pending'|'approved'|'rejected'} [filters.approvalStatus]
 * @param {'pending'|'accepted'|'canceled'} [filters.status] - ⭐ NEW
 * @param {string} [filters.description] - Text search
 * @param {number} [filters.page]
 * @param {number} [filters.limit]
 * @returns {Promise<ApiResponse>} { ok: true, data: { transactions: FinanceTransaction[], pagination: PaginationMeta } }
 */
export const fetchTransactions = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.type) params.append('type', filters.type);
  if (filters.currency) params.append('currency', filters.currency);
  if (filters.category) params.append('category', filters.category);
  if (filters.source) params.append('source', filters.source);
  if (filters.memberId) params.append('memberId', filters.memberId);
  if (filters.groupId) params.append('groupId', filters.groupId);
  if (filters.from) params.append('from', filters.from);
  if (filters.to) params.append('to', filters.to);
  if (filters.approvalStatus) params.append('approvalStatus', filters.approvalStatus);
  if (filters.status) params.append('status', filters.status); // ⭐ NEW
  if (filters.description) params.append('description', filters.description);
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);
  else params.append('limit', '1000');

  const response = await apiClient.get(`/finance/transactions?${params.toString()}`);
  return response.data;
};

/**
 * Get a single transaction by ID
 * @param {string} id - Transaction ID
 * @returns {Promise<ApiResponse>} { ok: true, data: { transaction: FinanceTransaction } }
 */
export const getTransaction = async (id) => {
  const response = await apiClient.get(`/finance/transactions/${id}`);
  return response.data;
};

/**
 * Create a new transaction (Boss only)
 * @param {Object} transactionData
 * @param {'income'|'outcome'} transactionData.type
 * @param {string} transactionData.date - ISO 8601
 * @param {number} transactionData.amount - Re-derived server-side when inputPrice is sent
 * @param {number} [transactionData.inputPrice] - Price entered by the user; falls back to amount
 * @param {string} [transactionData.currency] - Default: 'USD'
 * @param {string} [transactionData.category] - Required for outcome
 * @param {string} [transactionData.source] - Required for income
 * @param {string} [transactionData.description]
 * @param {boolean} [transactionData.throughTeamWallet] - Default: true
 * @param {boolean} [transactionData.isTron] - Forced true for outcomes and non-wallet income
 * @param {string[]} [transactionData.attachments]
 * @param {string} [transactionData.linkedProjectId]
 * @param {string} [transactionData.linkedJobTicketId]
 * @param {'pending'|'accepted'|'canceled'} [transactionData.status] - Default: 'accepted'
 * @param {string} [transactionData.userId] - For creating transactions for other users (boss only)
 * @returns {Promise<ApiResponse>} { ok: true, data: { transaction: FinanceTransaction, budgetWarning?: {...} } }
 */
export const createTransaction = async (transactionData) => {
  const response = await apiClient.post('/finance/transactions', transactionData);
  return response.data;
};

/**
 * Update a transaction (Boss only)
 * @param {string} id - Transaction ID
 * @param {Object} transactionData - Partial transaction data
 * @param {string} [transactionData.userId] - Can reassign transaction to different user
 * @returns {Promise<ApiResponse>} { ok: true, data: { transaction: FinanceTransaction } }
 */
export const updateTransaction = async (id, transactionData) => {
  const response = await apiClient.put(`/finance/transactions/${id}`, transactionData);
  return response.data;
};

/**
 * Delete a transaction
 * @param {string} id - Transaction ID
 * @returns {Promise<ApiResponse>} { ok: true, message: "Transaction deleted successfully" }
 */
export const deleteTransaction = async (id) => {
  const response = await apiClient.delete(`/finance/transactions/${id}`);
  return response.data;
};

/**
 * Approve a transaction (Boss/Admin only)
 * @param {string} id - Transaction ID
 * @returns {Promise<ApiResponse>} { ok: true, data: { transaction: FinanceTransaction } }
 */
export const approveTransaction = async (id) => {
  const response = await apiClient.post(`/finance/transactions/${id}/approve`);
  return response.data;
};

/**
 * Reject a transaction (Boss/Admin only)
 * @param {string} id - Transaction ID
 * @param {string} [reason] - Rejection reason
 * @returns {Promise<ApiResponse>} { ok: true, data: { transaction: FinanceTransaction } }
 */
export const rejectTransaction = async (id, reason = '') => {
  const response = await apiClient.post(`/finance/transactions/${id}/reject`, { reason });
  return response.data;
};

// ============================================
// Monthly Financial Plan Endpoints
// ============================================

/**
 * Fetch monthly financial plans
 * @param {Object} filters
 * @param {string} [filters.userId] - Admin can filter
 * @param {string} [filters.month] - YYYY-MM format
 * @param {string} [filters.groupId] - SUPER_ADMIN / meta admin: limit to team code
 * @returns {Promise<ApiResponse>} { ok: true, data: { plans: MonthlyFinancialPlan[] } }
 */
export const fetchMonthlyPlans = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.userId) params.append('userId', filters.userId);
  if (filters.month) params.append('month', filters.month);
  if (filters.groupId) params.append('groupId', filters.groupId);

  const response = await apiClient.get(`/finance/monthly-plans?${params.toString()}`);
  return response.data;
};

/**
 * Get a single monthly plan by ID
 * @param {string} id - Monthly plan ID
 * @returns {Promise<ApiResponse>} { ok: true, data: { plan: MonthlyFinancialPlan } }
 */
export const getMonthlyPlan = async (id) => {
  const response = await apiClient.get(`/finance/monthly-plans/${id}`);
  return response.data;
};

/**
 * Create a monthly financial plan (Boss only)
 * @param {Object} planData
 * @param {string} planData.userId
 * @param {string} planData.month - YYYY-MM format
 * @param {number} planData.monthlyFinancialGoal
 * @param {string} [planData.note]
 * @returns {Promise<ApiResponse>} { ok: true, data: { plan: MonthlyFinancialPlan } }
 */
export const createMonthlyPlan = async (planData) => {
  const response = await apiClient.post('/finance/monthly-plans', planData);
  return response.data;
};

/**
 * Update a monthly financial plan (Boss only)
 * @param {string} id - Monthly plan ID
 * @param {Object} planData
 * @param {number} [planData.monthlyFinancialGoal]
 * @param {string} [planData.note]
 * @returns {Promise<ApiResponse>} { ok: true, data: { plan: MonthlyFinancialPlan } }
 */
export const updateMonthlyPlan = async (id, planData) => {
  const response = await apiClient.put(`/finance/monthly-plans/${id}`, planData);
  return response.data;
};

// ============================================
// Periodic Financial Plan Endpoints
// ============================================

/**
 * Fetch periodic financial plans
 * @param {Object} filters
 * @param {string} [filters.userId]   - Optional user filter
 * @param {string} [filters.periodId] - Optional period filter
 * @param {string} [filters.groupId]  - SUPER_ADMIN / meta admin: limit to team code
 * @returns {Promise<ApiResponse>} { ok: true, data: { plans: PeriodicFinancialPlan[] } }
 */
export const fetchPeriodicPlans = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.userId) params.append('userId', filters.userId);
  if (filters.periodId) params.append('periodId', filters.periodId);
  if (filters.groupId) params.append('groupId', filters.groupId);

  const response = await apiClient.get(
    `/finance/periodic-plans?${params.toString()}`
  );
  return response.data;
};
/**
 * Assign a financial goal to a user for a period (Boss only)
 * @param {Object} planData
 * @param {string} planData.userId
 * @param {string} planData.periodId
 * @param {number} planData.periodicFinancialGoal
 * @param {string} [planData.note]
 * @returns {Promise<ApiResponse>} { ok: true, data: { periodicPlan: PeriodicFinancialPlan } }
 */
export const createPeriodicPlan = async (planData) => {
  const response = await apiClient.post(
    '/finance/periodic-plans',
    planData
  );
  return response.data;
};

/**
 * Update a periodic financial plan (Boss only)
 * @param {string} id - Periodic plan ID
 * @param {Object} planData
 * @param {number} [planData.periodicFinancialGoal]
 * @param {string} [planData.note]
 * @returns {Promise<ApiResponse>} { ok: true, data: { periodicPlan: PeriodicFinancialPlan } }
 */
export const updatePeriodicPlan = async (id, planData) => {
  const response = await apiClient.put(
    `/finance/periodic-plans/${id}`,
    planData
  );
  return response.data;
};
/**
 * Fetch all finance periods
 * @param {Object} filters
 * @param {string} [filters.month] - Optional YYYY-MM filter
 * @returns {Promise<ApiResponse>} { ok: true, data: { periods: FinancePeriod[] } }
 */
export const fetchPeriods = async (filters = {}) => {
  console.log('Fetching finance periods with filters:', filters);
  const params = new URLSearchParams();
  if (filters.month) params.append('month', filters.month);

  const response = await apiClient.get(`/finance/periods?${params.toString()}`);
  return response.data;
};

/**
 * Get a single finance period by ID
 * @param {string} id - Period ID
 * @returns {Promise<ApiResponse>} { ok: true, data: { period: FinancePeriod } }
 */
export const getPeriod = async (id) => {
  const response = await apiClient.get(`/finance/periods/${id}`);
  return response.data;
};

/**
 * Create a finance period (Boss/Admin only)
 * @param {Object} periodData
 * @param {string} periodData.definition - Period name
 * @param {string} periodData.month - YYYY-MM
 * @param {string} periodData.startDate - ISO 8601
 * @param {string} periodData.endDate - ISO 8601
 * @returns {Promise<ApiResponse>} { ok: true, data: { period: FinancePeriod } }
 */
export const createPeriod = async (periodData) => {
  const response = await apiClient.post('/finance/periods', periodData);
  return response.data;
};

/**
 * Update a finance period (Boss/Admin only)
 * @param {string} id - Period ID
 * @param {Object} periodData
 * @param {string} [periodData.definition]
 * @param {string} [periodData.month]
 * @param {string} [periodData.startDate]
 * @param {string} [periodData.endDate]
 * @returns {Promise<ApiResponse>} { ok: true, data: { period: FinancePeriod } }
 */
export const updatePeriod = async (id, periodData) => {
  const response = await apiClient.put(`/finance/periods/${id}`, periodData);
  return response.data;
};

// ============================================
// Summary Endpoint
// ============================================

/**
 * Get financial summary with breakdowns
 * @param {Object} filters
 * @param {string} [filters.month] - YYYY-MM format
 * @param {string} [filters.from] - ISO 8601 (alternative to month)
 * @param {string} [filters.to] - ISO 8601 (alternative to month)
 * @param {string} [filters.memberId] - Admin can filter
 * @param {string} [filters.currency]
 * @returns {Promise<ApiResponse>} { ok: true, data: { summary: FinanceSummary } }
 */
export const getFinanceSummary = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.month) params.append('month', filters.month);
  if (filters.from) params.append('from', filters.from);
  if (filters.to) params.append('to', filters.to);
  if (filters.memberId) params.append('memberId', filters.memberId);
  if (filters.currency) params.append('currency', filters.currency);

  const response = await apiClient.get(`/finance/summary?${params.toString()}`);
  return response.data;
};

// ============================================
// Legacy Finance Goal Endpoints (Deprecated)
// ============================================

/**
 * Get finance goal for a month (Legacy - use MonthlyFinancialPlan instead)
 * @deprecated Use fetchMonthlyPlans instead
 * @param {string} month - YYYY-MM format
 * @param {string} [userId] - Optional user ID
 * @returns {Promise<ApiResponse>} { ok: true, data: { goal: FinanceGoal } }
 */
export const getFinanceGoal = async (month, userId = null) => {
  const params = new URLSearchParams();
  params.append('month', month);
  if (userId) params.append('userId', userId);
  
  const response = await apiClient.get(`/finance/goals?${params.toString()}`);
  return response.data;
};

/**
 * Create or update finance goal for a month (Legacy - use MonthlyFinancialPlan instead)
 * @deprecated Use createMonthlyPlan instead
 * @param {string} month - YYYY-MM format
 * @param {Object} goalData
 * @param {number} goalData.incomeGoal
 * @param {number} [goalData.expenseLimit]
 * @param {string} [userId] - Optional user ID
 * @returns {Promise<ApiResponse>} { ok: true, data: { goal: FinanceGoal } }
 */
export const updateFinanceGoal = async (month, goalData, userId = null) => {
  const params = new URLSearchParams();
  params.append('month', month);
  if (userId) params.append('userId', userId);
  
  const response = await apiClient.put(`/finance/goals?${params.toString()}`, goalData);
  return response.data;
};

/**
 * Get team summary by month (Admin only)
 * @param {Object} filters
 * @param {string} filters.month - YYYY-MM format
 * @param {string} [filters.currency]
 * @returns {Promise<ApiResponse>} { ok: true, data: { month, currency, teamTotals, perUserTotals } }
 */
export const getTeamSummary = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.month) params.append('month', filters.month);
  if (filters.currency) params.append('currency', filters.currency);

  const response = await apiClient.get(`/finance/team-summary?${params.toString()}`);
  return response.data;
};

// ============================================
// Payment requests (member → boss, boss → platform)
// ============================================

/** @param {'my'|'team_inbox'|'platform_inbox'} scope */
export const fetchPaymentRequests = async (scope = 'my') => {
  const response = await apiClient.get('/finance/payment-requests', { params: { scope } });
  return response.data;
};

export const createPaymentRequest = async (payload) => {
  const response = await apiClient.post('/finance/payment-requests', payload);
  return response.data;
};

export const updatePaymentRequestStatus = async (id, payload) => {
  const response = await apiClient.patch(`/finance/payment-requests/${id}/status`, payload);
  return response.data;
};

/**
 * One year of monthly goals as a grid: members (already in team order, each
 * team's boss first) with the goal they carry in each month.
 * @param {{ year: string, groupId?: string }} params
 */
export const fetchMonthlyPlanMatrix = async ({ year, groupId } = {}) => {
  const response = await apiClient.get('/finance/monthly-plans/matrix', {
    params: { year, ...(groupId && groupId !== 'all' ? { groupId } : {}) },
  });
  return response.data;
};

/**
 * One month of week goals as a grid: the month's weeks as columns, each
 * member's goal and booked income per week, and the monthly goal behind them.
 * @param {{ month: string, groupId?: string }} params
 */
export const fetchPeriodicPlanMatrix = async ({ month, groupId } = {}) => {
  const response = await apiClient.get('/finance/periodic-plans/matrix', {
    params: { month, ...(groupId && groupId !== 'all' ? { groupId } : {}) },
  });
  return response.data;
};

/** One week plan, for the editor dialog. */
export const getPeriodicPlan = async (id) => {
  const response = await apiClient.get(`/finance/periodic-plans/${id}`);
  return response.data;
};
