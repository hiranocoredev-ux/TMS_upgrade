import { ref, computed } from "vue";
import {
  // Transactions
  fetchTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  approveTransaction,
  rejectTransaction,

  // Monthly plans
  fetchMonthlyPlans,
  getMonthlyPlan,
  createMonthlyPlan,
  updateMonthlyPlan,

  // Periodic plans (user goals)
  fetchPeriodicPlans,
  createPeriodicPlan,
  updatePeriodicPlan,

  // Periods (NEW)
  fetchPeriods,
  createPeriod,
  updatePeriod,

  // Summary
  getFinanceSummary,
  getTeamSummary
} from "../services/finance";
import * as financeService from "../services/finance";
/**
 * Vue 3 Composable for Finance Module
 *
 * Provides reactive state and methods for finance operations
 */
export function useFinance() {
  // State
// Transactions
  const transactions = ref([]);

  // Plans
  const monthlyPlans = ref([]);
  const periodicPlans = ref([]);     // PeriodicFinancialPlan (per user per period)

  // NEW: Periods (FinancePeriod)
  const periods = ref([]);

  // Summaries
  const summary = ref(null);
  const teamSummary = ref(null);

  // UI state
  const loading = ref(false);
  const error = ref(null);

//   async function fetchPeriodicPlans() {
//   loading.value = true;
//   error.value = null;

//   try {
//     const res = await financeService.fetchPeriodicPlans();
//     periodicPlans.value = res.data.plans || [];
//   } catch (err) {
//     error.value = err;
//   } finally {
//     loading.value = false;
//   }
// }
// const fetchPeriodicPlans= async (filters = {}) => {
//    loading.value = true;
//   error.value = null;

//   try {
//     const res = await financeService.fetchPeriodicPlans();
//     periodicPlans.value = res.data.plans || [];
//   } catch (err) {
//     error.value = err;
//   } finally {
//     loading.value = false;
//   }
// }
// const fetchPeriods = async (filters = {}) => {
//     loading.value = true;
//   error.value = null;

//   try {
//     const res = await financeService.fetchPeriods(filters);

//     // ✅ THIS IS THE KEY FIX
//     console.log("FETCH PERIODS RES:", res);
//     periods.value = res.data.periods || [];
//     console.log("FETCH PERIODS RES111111111111111111111111111111111", periods.value);
//   } catch (err) {
//     console.error('fetchPeriods error:', err);
//     error.value =
//       err?.response?.data?.error?.message ||
//       'Failed to load periods';
//   } finally {
//     loading.value = false;
//   }
// }
// async function fetchPeriods(filters = {}) {
//   loading.value = true;
//   error.value = null;

//   try {
//     const res = await financeService.fetchPeriods(filters);

//     // ✅ THIS IS THE KEY FIX
//     periodicPlans.value = res.data.periods || [];
//   } catch (err) {
//     console.error('fetchPeriods error:', err);
//     error.value =
//       err?.response?.data?.error?.message ||
//       'Failed to load periods';
//   } finally {
//     loading.value = false;
//   }
// }

  // =====================================================
  // Filters (CONTROLLED BY VIEWS)
  // =====================================================

  // Period-centric filters
  const selectedPeriodId = ref(null); // null = All periods
  const selectedUserId = ref(null);   // null = All users

  // ============================================
  // Transaction Methods
  // ============================================

  /**
   * Load transactions with filters
   * @param {Object} filters - Query filters
   */
  const loadTransactions = async (filters = {}) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await fetchTransactions(filters);
      if (response.ok && response.data) {
        transactions.value = response.data.transactions || [];
        return response.data;
      }
      throw new Error(response.error?.message || "Failed to load transactions");
    } catch (err) {
      error.value = err.message || "An error occurred";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Load a single transaction
   * @param {string} id - Transaction ID
   */
  const loadTransaction = async (id) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await getTransaction(id);
      if (response.ok && response.data) {
        return response.data.transaction;
      }
      throw new Error(response.error?.message || "Failed to load transaction");
    } catch (err) {
      error.value = err.message || "An error occurred";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Create a new transaction
   * @param {Object} transactionData
   */
  const addTransaction = async (transactionData) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await createTransaction(transactionData);
      if (response.ok) {
        // Add to local state
        transactions.value.unshift(response.data.transaction);
        return response.data;
      }
      throw new Error(
        response.error?.message || "Failed to create transaction",
      );
    } catch (err) {
      error.value = err.message || "An error occurred";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Update a transaction
   * @param {string} id - Transaction ID
   * @param {Object} transactionData
   */
  const editTransaction = async (id, transactionData) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await updateTransaction(id, transactionData);
      if (response.ok && response.data) {
        // Update local state
        const index = transactions.value.findIndex((t) => t._id === id);
        if (index !== -1) {
          transactions.value[index] = response.data.transaction;
        }
        return response.data;
      }
      throw new Error(
        response.error?.message || "Failed to update transaction",
      );
    } catch (err) {
      error.value = err.message || "An error occurred";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Delete a transaction
   * @param {string} id - Transaction ID
   */
  const removeTransaction = async (id) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await deleteTransaction(id);
      if (response.ok) {
        // Remove from local state
        transactions.value = transactions.value.filter((t) => t._id !== id);
        return response;
      }
      throw new Error(
        response.error?.message || "Failed to delete transaction",
      );
    } catch (err) {
      error.value = err.message || "An error occurred";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Approve a transaction
   * @param {string} id - Transaction ID
   */
  const approve = async (id) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await approveTransaction(id);
      if (response.ok && response.data) {
        // Update local state
        const index = transactions.value.findIndex((t) => t._id === id);
        if (index !== -1) {
          transactions.value[index] = response.data.transaction;
        }
        return response.data;
      }
      throw new Error(
        response.error?.message || "Failed to approve transaction",
      );
    } catch (err) {
      error.value = err.message || "An error occurred";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Reject a transaction
   * @param {string} id - Transaction ID
   * @param {string} reason - Rejection reason
   */
  const reject = async (id, reason = "") => {
    try {
      loading.value = true;
      error.value = null;
      const response = await rejectTransaction(id, reason);
      if (response.ok && response.data) {
        // Update local state
        const index = transactions.value.findIndex((t) => t._id === id);
        if (index !== -1) {
          transactions.value[index] = response.data.transaction;
        }
        return response.data;
      }
      throw new Error(
        response.error?.message || "Failed to reject transaction",
      );
    } catch (err) {
      error.value = err.message || "An error occurred";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // ============================================
  // Monthly Plan Methods
  // ============================================

  /**
   * Load monthly plans
   * @param {Object} filters
   */
  const loadMonthlyPlans = async (filters = {}) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await fetchMonthlyPlans(filters);
      if (response.ok && response.data) {
        monthlyPlans.value = response.data.plans || [];
        return response.data;
      }
      throw new Error(
        response.error?.message || "Failed to load monthly plans",
      );
    } catch (err) {
      error.value = err.message || "An error occurred";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Load a single monthly plan
   * @param {string} id - Monthly plan ID
   */
  const loadMonthlyPlan = async (id) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await getMonthlyPlan(id);
      if (response.ok && response.data) {
        return response.data.plan;
      }
      throw new Error(response.error?.message || "Failed to load monthly plan");
    } catch (err) {
      error.value = err.message || "An error occurred";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Create a monthly plan
   * @param {Object} planData
   */
  const addMonthlyPlan = async (planData) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await createMonthlyPlan(planData);
      if (response.ok && response.data) {
        monthlyPlans.value.unshift(response.data.plan);
        return response.data;
      }
      throw new Error(
        response.error?.message || "Failed to create monthly plan",
      );
    } catch (err) {
      error.value = err.message || "An error occurred";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Update a monthly plan
   * @param {string} id - Monthly plan ID
   * @param {Object} planData
   */
  const editMonthlyPlan = async (id, planData) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await updateMonthlyPlan(id, planData);
      if (response.ok && response.data) {
        const index = monthlyPlans.value.findIndex((p) => p._id === id);
        if (index !== -1) {
          monthlyPlans.value[index] = response.data.plan;
        }
        return response.data;
      }
      throw new Error(
        response.error?.message || "Failed to update monthly plan",
      );
    } catch (err) {
      error.value = err.message || "An error occurred";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // ============================================
  // Periodic Plan Methods
  // ============================================

  // /**
  //  * Load periodic plans
  //  * @param {Object} filters
  //  */
  // const loadPeriodicPlans = async (filters = {}) => {
  //   try {
  //     loading.value = true;
  //     error.value = null;
  //     const response = await fetchPeriodicPlans(filters);
  //     if (response.ok && response.data) {
  //       periodicPlans.value = response.data.plans || [];
  //       return response.data;
  //     }
  //     throw new Error(
  //       response.error?.message || "Failed to load periodic plans",
  //     );
  //   } catch (err) {
  //     error.value = err.message || "An error occurred";
  //     throw err;
  //   } finally {
  //     loading.value = false;
  //   }
  // };

  // /**
  //  * Create a periodic plan
  //  * @param {Object} planData
  //  */
  // const addPeriodicPlan = async (planData) => {
  //   try {
  //     loading.value = true;
  //     error.value = null;
  //     const response = await createPeriodicPlan(planData);
  //     if (response.ok && response.data) {
  //       periodicPlans.value.unshift(response.data.periodicPlan);
  //       return response.data;
  //     }
  //     throw new Error(
  //       response.error?.message || "Failed to create periodic plan",
  //     );
  //   } catch (err) {
  //     error.value = err.message || "An error occurred";
  //     throw err;
  //   } finally {
  //     loading.value = false;
  //   }
  // };

  // /**
  //  * Update a periodic plan
  //  * @param {string} id - Periodic plan ID
  //  * @param {Object} planData
  //  */
  // const editPeriodicPlan = async (id, planData) => {
  //   try {
  //     loading.value = true;
  //     error.value = null;
  //     const response = await updatePeriodicPlan(id, planData);
  //     if (response.ok && response.data) {
  //       const index = periodicPlans.value.findIndex((p) => p._id === id);
  //       if (index !== -1) {
  //         periodicPlans.value[index] = response.data.periodicPlan;
  //       }
  //       return response.data;
  //     }
  //     throw new Error(
  //       response.error?.message || "Failed to update periodic plan",
  //     );
  //   } catch (err) {
  //     error.value = err.message || "An error occurred";
  //     throw err;
  //   } finally {
  //     loading.value = false;
  //   }
  // };
// =====================================================
  // Periods (NEW – FIRST CLASS)
  // =====================================================

  const loadPeriods = async () => {
    try {
      loading.value = true;
      error.value = null;

      const res = await fetchPeriods();
      if (!res.ok) throw new Error(res.error?.message);

      periods.value = res.data.periods || [];
      return res.data;
    } catch (err) {
      error.value = err.message || 'Failed to load periods';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const addPeriod = async (data) => {
    const res = await createPeriod(data);
    if (!res.ok) throw new Error(res.error?.message);

    periods.value.push(res.data.period);
    return res.data.period;
  };

  const editPeriod = async (id, data) => {
    const res = await updatePeriod(id, data);
    if (!res.ok) throw new Error(res.error?.message);

    const idx = periods.value.findIndex(p => p._id === id);
    if (idx !== -1) {
      periods.value[idx] = res.data.period;
    }
    return res.data.period;
  };

  // =====================================================
  // Periodic Plans (USER GOALS)
  // =====================================================

  const loadPeriodicPlans = async () => {
    const res = await fetchPeriodicPlans();
    if (!res.ok) throw new Error(res.error?.message);

    periodicPlans.value = res.data.plans || [];
    return res.data;
  };

  const addPeriodicPlan = async (data) => {
    const res = await createPeriodicPlan(data);
    console.log("ADD PERIODIC PLAN RES:", res);
    if (!res.ok) throw new Error(res.error?.message);

    periodicPlans.value.unshift(res.data.periodicPlan);
    return res.data;
  };

  const editPeriodicPlan = async (id, data) => {
    const res = await updatePeriodicPlan(id, data);
    if (!res.ok) throw new Error(res.error?.message);

    const idx = periodicPlans.value.findIndex(p => p._id === id);
    if (idx !== -1) {
      periodicPlans.value[idx] = res.data.periodicPlan;
    }
    return res.data;
  };

  // =====================================================
  // PERIOD-CENTRIC DERIVED STATE (CORE)
  // =====================================================

  const plansByPeriodId = computed(() => {
    const map = new Map();

    for (const plan of periodicPlans.value) {
      const periodId = plan.periodId?._id || plan.periodId;
      if (!map.has(periodId)) {
        map.set(periodId, []);
      }
      map.get(periodId).push(plan);
    }

    return map;
  });

  const periodsWithPlans = computed(() => {
    return periods.value.map(period => ({
      period,
      plans: plansByPeriodId.value.get(period._id) || []
    }));
  });

  const filteredPeriods = computed(() => {
    if (!selectedPeriodId.value) {
      return periodsWithPlans.value;
    }

    return periodsWithPlans.value.filter(
      item => item.period._id === selectedPeriodId.value
    );
  });

  const filteredPeriodsWithUser = computed(() => {
    if (!selectedUserId.value) {
      return filteredPeriods.value;
    }

    return filteredPeriods.value.map(item => ({
      period: item.period,
      plans: item.plans.filter(
        p => (p.userId?._id || p.userId) === selectedUserId.value
      )
    }));
  });

  // ============================================
  // Summary Methods
  // ============================================

  /**
   * Load financial summary
   * @param {Object} filters
   */
  const loadSummary = async (filters = {}) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await getFinanceSummary(filters);
      if (response.ok && response.data) {
        summary.value = response.data;
        return response.data;
      }
      throw new Error(response.error?.message || "Failed to load summary");
    } catch (err) {
      error.value = err.message || "An error occurred";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Load team summary (Admin only)
   * @param {Object} filters
   */
  const loadTeamSummary = async (filters = {}) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await getTeamSummary(filters);
      if (response.ok && response.data) {
        teamSummary.value = response.data;
        return response.data;
      }
      throw new Error(response.error?.message || "Failed to load team summary");
    } catch (err) {
      error.value = err.message || "An error occurred";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // ============================================
  // Computed Properties
  // ============================================

  /**
   * Filter transactions by status
   */
  const acceptedTransactions = computed(() => {
    return transactions.value.filter((t) => t.status === "accepted");
  });

  const pendingTransactions = computed(() => {
    return transactions.value.filter((t) => t.status === "pending");
  });

  const canceledTransactions = computed(() => {
    return transactions.value.filter((t) => t.status === "canceled");
  });

  /**
   * Filter transactions by type
   */
  const incomeTransactions = computed(() => {
    return transactions.value.filter((t) => t.type === "income");
  });

  const outcomeTransactions = computed(() => {
    return transactions.value.filter((t) => t.type === "outcome");
  });

  /**
   * Summary metrics helpers
   */
  const summaryMetrics = computed(() => {
    return summary.value?.metrics || null;
  });

  const summaryTotals = computed(() => {
    return summary.value?.totals || null;
  });

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Clear error state
   */
  const clearError = () => {
    error.value = null;
  };

  /**
   * Reset all state
   */
  const reset = () => {
    transactions.value = [];
    monthlyPlans.value = [];
    periodicPlans.value = [];
    periods.value = [];
    summary.value = null;
    teamSummary.value = null;
    selectedPeriodId.value = null;
    selectedUserId.value = null;
    error.value = null;
    loading.value = false;
  };

  return {
    // State
    // raw state
    transactions,
    monthlyPlans,
    periodicPlans,
    periods,
    summary,
    teamSummary,
    loading,
    error,

    // filters
    selectedPeriodId,
    selectedUserId,

    // derived (PERIOD-CENTRIC)
    periodsWithPlans,
    filteredPeriodsWithUser,
    // Transaction methods
    loadTransactions,
    loadTransaction,
    addTransaction,
    editTransaction,
    removeTransaction,
    approve,
    reject,

    // Monthly plan methods
    loadMonthlyPlans,
    loadMonthlyPlan,
    addMonthlyPlan,
    editMonthlyPlan,

    // // Periodic plan methods
    // loadPeriodicPlans,
    // addPeriodicPlan,
    // editPeriodicPlan,
    // periods
    fetchPeriodicPlans,
    fetchPeriods,
    loadPeriods,
    addPeriod,
    editPeriod,

    // periodic plans (goals)
    loadPeriodicPlans,
    addPeriodicPlan,
    editPeriodicPlan,
    // Summary methods
    loadSummary,
    loadTeamSummary,

    // Computed
    acceptedTransactions,
    pendingTransactions,
    canceledTransactions,
    incomeTransactions,
    outcomeTransactions,
    summaryMetrics,
    summaryTotals,

    // Utilities
    clearError,
    reset,
  };
}
