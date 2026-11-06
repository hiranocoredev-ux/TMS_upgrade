<template>
    <div class="earnings-summary">
      <div class="page-header">
        <div>
          <h1>Earnings Summary</h1>
          <p class="subtitle">
            Completed assignment earnings
          </p>
        </div>
      </div>
  
      <!-- Filters -->
      <div class="filters card">
        <div class="filter-group">
          <label>From</label>
          <TmsNativeCalendarField v-model="filters.from" type="date" />
        </div>
  
        <div class="filter-group">
          <label>To</label>
          <TmsNativeCalendarField v-model="filters.to" type="date" />
        </div>
  
        <button class="btn-primary" @click="loadSummary">
          Apply
        </button>
      </div>
  
      <!-- Loading -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading earnings...</p>
      </div>
  
      <!-- Error -->
      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
      </div>
  
      <!-- Table -->
      <div v-else class="card table-container">
        <table class="summary-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Currency</th>
              <th>Total Amount</th>
              <th>Completed Assignments</th>
            </tr>
          </thead>
  
          <tbody>
            <template v-for="row in rows" :key="row.key">
              <tr>
                <td>{{ row.userLabel }}</td>
                <td>{{ row.currencyCode }}</td>
                <td class="amount">
                  {{ row.totalAmount }}
                </td>
                <td>{{ row.taskCount }}</td>
              </tr>
            </template>

            <tr v-if="rows.length === 0">
              <td colspan="4" class="empty-state">
                No earnings for the selected period.
              </td>
            </tr>
            <!-- Total Row -->
            <tr v-if="rows.length > 0" class="total-row">
              <td colspan="2" class="total-label"><strong>Total</strong></td>
              <td class="total-amount amount">{{ totalAmount }}</td>
              <td class="total-amount">{{ totalAssignments }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, computed, onMounted } from 'vue';
  import TmsNativeCalendarField from '../../components/ui/TmsNativeCalendarField.vue';
  import { useAuthStore } from '../../composables/useAuth';
  import { fetchEarningsSummary } from '../../services/assignments.js';
  
  const authStore = useAuthStore();
  
  const loading = ref(false);
  const error = ref(null);
  const summary = ref([]);
  
  const filters = ref({
    from: '',
    to: ''
  });
  
  const loadSummary = async () => {
    loading.value = true;
    error.value = null;
  
    try {
      const res = await fetchEarningsSummary({
        from: filters.value.from || undefined,
        to: filters.value.to || undefined
      });
  
      summary.value = res.data.summary || [];
    } catch (err) {
      error.value =
        err.response?.data?.message || 'Failed to load earnings summary';
    } finally {
      loading.value = false;
    }
  };
  
  /**
   * Flatten backend structure for table rendering
   */
  const rows = computed(() => {
    const result = [];

    for (const userBlock of summary.value) {
      for (const earning of userBlock.earnings) {
        result.push({
          key: `${userBlock.ownerUserId}-${earning.currencyCode}`,
          userLabel:
            userBlock.ownerUserId === authStore.user?._id
              ? 'You'
              : userBlock.user?.name || userBlock.user?.email || 'Unknown',
          currencyCode: earning.currencyCode,
          totalAmount: earning.totalAmount,
          taskCount: earning.taskCount
        });
      }
    }

    return result;
  });

  // Calculate totals
  const totalAmount = computed(() => {
    return rows.value.reduce((sum, row) => sum + (parseFloat(row.totalAmount) || 0), 0).toFixed(2);
  });

  const totalAssignments = computed(() => {
    return rows.value.reduce((sum, row) => sum + (parseInt(row.taskCount) || 0), 0);
  });
  
  onMounted(loadSummary);
  </script>
  
  <style scoped>
  .earnings-summary {
    max-width: 1000px;
    margin: 0 auto;
  }
  
  .page-header {
    margin-bottom: 24px;
  }
  
  .subtitle {
    color: #7f8c8d;
    margin-top: 4px;
  }
  
  .card {
    background: white;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
  }
  
  .filters {
    display: flex;
    gap: 16px;
    align-items: flex-end;
  }
  
  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .filter-group label {
    font-size: 0.85rem;
    color: #7f8c8d;
  }
  
  .filter-group input {
    padding: 8px 10px;
    border-radius: 4px;
    border: 1px solid #ddd;
  }
  
  .btn-primary {
    background: #3498db;
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
  }
  
  .table-container {
    overflow-x: auto;
  }
  
  .summary-table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .summary-table th,
  .summary-table td {
    padding: 14px;
    border-bottom: 1px solid #e0e0e0;
  }
  
  .summary-table th {
    text-align: left;
    font-weight: 600;
    color: #2c3e50;
  }
  
  .amount {
    font-weight: 600;
  }
  
  .total-row {
    background-color: #f9fafb;
    border-top: 2px solid #e5e7eb;
    font-weight: 600;
  }

  .total-label {
    text-align: right;
    padding: 16px 14px;
    color: #111827;
  }

  .total-amount {
    padding: 16px 14px;
    font-weight: 600;
  }
  
  .empty-state {
    text-align: center;
    padding: 30px;
    color: #95a5a6;
  }
  
  /* Loading */
  .loading-state {
    text-align: center;
    padding: 60px 20px;
  }
  
  .spinner {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  </style>
  