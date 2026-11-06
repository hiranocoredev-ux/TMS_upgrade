import * as jobTicketService from '../../services/jobTickets';

const STAGE_ORDER = [
  'NEW',
  'BID_SUBMITTED',
  'CLIENT_REPLIED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_DONE',
  'OFFER_CONTRACT',
  'IN_PROGRESS',
  'WON',
  'LOST_CLOSED'
];

export default {
  namespaced: true,

  state: () => ({
    tickets: [],
    loading: false,
    error: null,
    pagination: {
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 0
    }
  }),

  getters: {
    tickets: (s) => s.tickets,
    loading: (s) => s.loading,
    error: (s) => s.error,
    pagination: (s) => s.pagination,

    ticketsByStage: (s) => {
      const grouped = {};
      STAGE_ORDER.forEach((stage) => {
        grouped[stage] = s.tickets.filter((ticket) => ticket.currentStage === stage);
      });
      return grouped;
    }
  },

  mutations: {
    SET_LOADING(s, v) {
      s.loading = v;
    },
    SET_ERROR(s, v) {
      s.error = v;
    },
    SET_TICKETS(s, tickets) {
      s.tickets = tickets;
    },
    SET_PAGINATION(s, pagination) {
      s.pagination = pagination;
    },
    UPSERT_TICKET(s, ticket) {
      const index = s.tickets.findIndex((t) => t._id === ticket._id);
      if (index !== -1) {
        s.tickets.splice(index, 1, ticket);
      }
    }
  },

  actions: {
    async fetchTickets({ commit }, filters = {}) {
      commit('SET_LOADING', true);
      commit('SET_ERROR', null);
      try {
        const response = await jobTicketService.fetchJobTickets(filters);
        if (response.ok && response.data) {
          commit('SET_TICKETS', response.data.tickets || []);
          if (response.data.pagination) {
            commit('SET_PAGINATION', response.data.pagination);
          }
        } else {
          throw new Error(response.message || 'Failed to fetch tickets');
        }
      } catch (err) {
        commit('SET_ERROR', err.response?.data?.message || err.message || 'Failed to fetch job tickets');
        commit('SET_TICKETS', []);
        throw err;
      } finally {
        commit('SET_LOADING', false);
      }
    },

    async fetchTicket({ commit, state }, id) {
      commit('SET_LOADING', true);
      commit('SET_ERROR', null);
      try {
        const response = await jobTicketService.fetchJobTicket(id);
        if (response.ok && response.data) {
          commit('UPSERT_TICKET', response.data.ticket);
          return response.data.ticket;
        }
        throw new Error(response.message || 'Failed to fetch ticket');
      } catch (err) {
        commit('SET_ERROR', err.response?.data?.message || err.message || 'Failed to fetch job ticket');
        throw err;
      } finally {
        commit('SET_LOADING', false);
      }
    },

    async moveStage({ commit, state }, { ticketId, toStage, reason = '' }) {
      try {
        const response = await jobTicketService.moveTicketStage(ticketId, toStage, reason);
        if (response.ok && response.data) {
          commit('UPSERT_TICKET', response.data.ticket);
          return response.data.ticket;
        }
        throw new Error(response.message || 'Failed to move ticket stage');
      } catch (err) {
        commit('SET_ERROR', err.response?.data?.message || err.message || 'Failed to move ticket stage');
        throw err;
      }
    },

    async updateTicket({ commit }, { ticketId, data }) {
      try {
        const response = await jobTicketService.updateJobTicket(ticketId, data);
        if (response.ok && response.data) {
          commit('UPSERT_TICKET', response.data.ticket);
          return response.data.ticket;
        }
        throw new Error(response.message || 'Failed to update ticket');
      } catch (err) {
        commit('SET_ERROR', err.response?.data?.message || err.message || 'Failed to update ticket');
        throw err;
      }
    }
  }
};
