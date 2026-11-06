<template>
    <div class="earnings-trend">
      <div class="page-header">
        <div>
          <h1>Earnings Trend</h1>
          <p class="subtitle">
            Earnings over time based on completed assignments
          </p>
        </div>
      </div>
  
      <!-- Filters -->
      <div class="card filters">
        <div class="filter-group">
          <label>From</label>
          <TmsNativeCalendarField v-model="filters.from" type="date" />
        </div>
  
        <div class="filter-group">
          <label>To</label>
          <TmsNativeCalendarField v-model="filters.to" type="date" />
        </div>
  
        <div class="filter-group">
          <label>Group By</label>
          <select v-model="filters.groupBy">
            <option value="day">Day</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
          </select>
        </div>
  
        <button class="btn-primary" @click="loadTrend">
          Apply
        </button>
      </div>
  
      <!-- Loading -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading trend data...</p>
      </div>
  
      <!-- Error -->
      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
      </div>
  
      <!-- Chart Placeholder -->
      <div v-else class="card chart-container">
        <div v-if="chartData.length === 0" class="empty-state">
          No earnings data for the selected period.
        </div>
  
        <!--
          This is intentionally library-agnostic.
          Plug chartData into Chart.js / ECharts / ApexCharts later.
        -->
        <table v-else class="trend-table">
          <thead>
            <tr>
              <th>Period</th>
              <th>User</th>
              <th>Currency</th>
              <th>Total Amount</th>
              <th>Assignments</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in chartData" :key="row.key">
              <td>{{ row.period }}</td>
              <td>{{ row.userName }}</td>
              <td>{{ row.currencyCode }}</td>
              <td class="amount">{{ row.totalAmount }}</td>
              <td>{{ row.taskCount }}</td>
            </tr>
            <!-- Total Row -->
            <tr v-if="chartData.length > 0" class="total-row">
              <td colspan="3" class="total-label"><strong>Total</strong></td>
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
  import { fetchEarningsTrend } from '../../services/assignments';
  
  const authStore = useAuthStore();
  
  const loading = ref(false);
  const error = ref(null);
  const trend = ref([]);
  
  const filters = ref({
    from: '',
    to: '',
    groupBy: 'month'
  });
  
  const loadTrend = async () => {
    loading.value = true;
    error.value = null;
  
    try {
      const res = await fetchEarningsTrend({
        from: filters.value.from || undefined,
        to: filters.value.to || undefined,
        groupBy: filters.value.groupBy
      });
  
      trend.value = res.data.trend || [];
    } catch (err) {
      error.value =
        err.response?.data?.message || 'Failed to load earnings trend';
    } finally {
      loading.value = false;
    }
  };
  
  /**
   * Normalize backend response into chart/table-friendly rows
   */
  // const chartData = computed(() => {
  //   return trend.value.map(item => ({
  //     key: `${item.period}-${item.ownerUserId}-${item.currencyCode}`,
  //     period: item.period,
  //     userLabel:
  //       item.ownerUserId === authStore.user?._id
  //         ? 'You'
  //         : item.ownerUserId,
  //     currencyCode: item.currencyCode,
  //     totalAmount: item.totalAmount,
  //     taskCount: item.taskCount
  //   }));
  // });
  const chartData = computed(() => {
  return trend.value.map(item => {
    const isSelf = item.ownerUserId === authStore.user?._id;

    return {
      key: `${item.period}-${item.ownerUserId}-${item.currencyCode}`,
      period: item.period,
      userName: isSelf ? 'You' : item.user?.name || 'Unknown',
      userEmail: isSelf ? authStore.user?.email : item.user?.email,
      currencyCode: item.currencyCode,
      totalAmount: item.totalAmount,
      taskCount: item.taskCount
    };
  });
});

// Calculate totals
const totalAmount = computed(() => {
  return chartData.value.reduce((sum, row) => sum + (parseFloat(row.totalAmount) || 0), 0).toFixed(2);
});

const totalAssignments = computed(() => {
  return chartData.value.reduce((sum, row) => sum + (parseInt(row.taskCount) || 0), 0);
});
  onMounted(loadTrend);
  </script>
  
  <style scoped>
  .earnings-trend {
    max-width: 1100px;
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
  
  .filter-group input,
  .filter-group select {
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
  
  .chart-container {
    overflow-x: auto;
  }
  
  .trend-table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .trend-table th,
  .trend-table td {
    padding: 14px;
    border-bottom: 1px solid #e0e0e0;
  }
  
  .trend-table th {
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
    padding: 40px;
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
  