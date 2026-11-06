<template>
  <div class="kpi-cards">
    <div class="kpi-card">
      <div class="kpi-label">Actual Income</div>
      <div class="kpi-value income">{{ formatCurrency(metrics?.actualIncome || 0, currency) }}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Pending Income</div>
      <div class="kpi-value pending">{{ formatCurrency(metrics?.pendingIncome || 0, currency) }}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Actual Expense</div>
      <div class="kpi-value expense">{{ formatCurrency(metrics?.actualExpense || 0, currency) }}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Budgeted Performance</div>
      <div class="kpi-value performance">{{ formatCurrency(metrics?.budgetedPerformance || 0, currency) }}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Target</div>
      <div class="kpi-value target">{{ formatCurrency(metrics?.target || 0, currency) }}</div>
    </div>
    <div class="kpi-card"
      :class="{ 'gap-positive': (metrics?.gap || 0) >= 0, 'gap-negative': (metrics?.gap || 0) < 0 }">
      <div class="kpi-label">Gap</div>
      <div class="kpi-value" :class="{ 'income': (metrics?.gap || 0) >= 0, 'expense': (metrics?.gap || 0) < 0 }">
        {{ formatCurrency(metrics?.gap || 0, currency) }}
      </div>
    </div>

  </div>
  <div class="goal-section">
    <div class="section-header">
      <h2>Financial Goals</h2>
    </div>
    <div class="goal-progress">
      <div>
        <div class="goal-item">
          <div class="goal-header">
            <span class="goal-label">Income Goal</span>
            <span class="goal-amount"> {{ formatAmount(metrics?.actualIncome || 0) }} / {{
              formatAmount(metrics?.target || 0) }}</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar income-progress"
              :style="{ width: `${Math.min(metrics?.actualIncome / (metrics?.target || 1)*100)}%` }"></div>
          </div>
          <div class="goal-status">
            <span v-if="metrics?.actualIncome >= metrics?.target" class="status-success">✓ Goal Achieved</span>
            <span v-else class="status-pending">{{ Math.round((metrics?.actualIncome / (metrics?.target || 1)) * 100)
              }}% Complete</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatCurrency } from '../../utils/financeHelpers';

const formatAmount = (amount) => {
  return parseFloat(amount || 0).toFixed(2);
};
defineProps({
  metrics: {
    type: Object,
    default: () => ({
      actualIncome: 0,
      pendingIncome: 0,
      actualExpense: 0,
      budgetedPerformance: 0,
      target: 0,
      gap: 0
    })
  },
  currency: {
    type: String,
    default: 'USD'
  }

});
</script>

<style scoped>
.kpi-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.kpi-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.kpi-label {
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  font-weight: 500;
}

.kpi-value {
  font-size: 20px;
  font-weight: 600;
}

.kpi-value.income {
  color: #10b981;
}

.kpi-value.expense {
  color: #ef4444;
}

.kpi-value.pending {
  color: #f59e0b;
}

.kpi-value.performance {
  color: #3b82f6;
}

.kpi-value.target {
  color: #6366f1;
}

.kpi-card.gap-positive {
  border-color: #10b981;
}

.kpi-card.gap-negative {
  border-color: #ef4444;
}

.finance-view {
  background: transparent;
  padding: 0;
}

.page-header {
  background: white;
  padding: 20px 30px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.month-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.month-selector label {
  font-weight: 500;
  color: #2c3e50;
}

.month-selector input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.95rem;
}

.page-header h1 {
  color: #2c3e50;
  margin: 0 0 4px 0;
  font-size: 1.8rem;
}

.subtitle {
  color: #7f8c8d;
  margin: 0;
  font-size: 0.95rem;
}

.finance-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Summary Cards */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.summary-card {
  background: white;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 16px;
}

.card-icon {
  font-size: 2.5rem;
}

.card-content {
  flex: 1;
}

.card-content h3 {
  margin: 0 0 8px 0;
  color: #7f8c8d;
  font-size: 0.9rem;
  font-weight: 500;
}

.card-value {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 700;
}

.income-value {
  color: #2ecc71;
}

.expense-value {
  color: #e74c3c;
}

.card-label {
  margin: 4px 0 0 0;
  color: #95a5a6;
  font-size: 0.85rem;
}

/* Goals Section */
.goals-section,
.team-dashboard-section,
.transactions-section {
  background: white;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h2 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.4rem;
}

.goals-progress {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.goal-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.goal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.goal-label {
  font-weight: 500;
  color: #2c3e50;
}

.goal-amount {
  font-weight: 600;
  color: #7f8c8d;
}

.progress-bar-container {
  width: 100%;
  height: 24px;
  background: #ecf0f1;
  border-radius: 12px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  border-radius: 12px;
  transition: width 0.3s ease;
}

.income-progress {
  background: #2ecc71;
}

.expense-progress {
  background: #3498db;
}

.expense-over {
  background: #e74c3c;
}

.goal-status {
  font-size: 0.85rem;
}

.status-success {
  color: #2ecc71;
  font-weight: 500;
}

.status-warning {
  color: #f39c12;
  font-weight: 500;
}

.status-pending {
  color: #7f8c8d;
}

.no-expense-limit,
.goals-placeholder {
  color: #95a5a6;
  font-style: italic;
  text-align: center;
  padding: 20px;
}


@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
</style>
