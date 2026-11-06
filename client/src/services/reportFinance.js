import apiClient from './axios';

/**
 * The income / outcome block behind every monthly and weekly plan and report:
 * the target from Finance Management, the result from the member's own
 * transactions over the same range, and the transactions themselves.
 *
 * @param {{ period: 'monthly'|'weekly', date: string, userId?: string }} params
 */
export const getReportFinanceSection = async ({ period, date, userId } = {}) => {
  const response = await apiClient.get('/reports/finance-section', {
    params: { period, date, ...(userId ? { userId } : {}) },
  });
  return response.data;
};

// The titles live in utils/financeTicket so the report validator can share them.
export { FINANCE_TICKET_TITLES, isFinanceTicketTitle } from '../utils/financeTicket';
