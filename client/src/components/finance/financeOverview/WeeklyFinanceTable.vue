<script setup>
import { computed } from 'vue';

const props = defineProps({
  weeks: {
    type: Array,
    required: true
  }
});

// Calculate totals
const totalTarget = computed(() => {
  return props.weeks.reduce((sum, week) => sum + (parseFloat(week.target) || 0), 0).toFixed(2);
});

const totalActual = computed(() => {
  return props.weeks.reduce((sum, week) => sum + (parseFloat(week.actualIncome) || 0), 0).toFixed(2);
});

const totalPending = computed(() => {
  return props.weeks.reduce((sum, week) => sum + (parseFloat(week.pendingIncome) || 0), 0).toFixed(2);
});

const totalGap = computed(() => {
  return (parseFloat(totalTarget.value) - parseFloat(totalActual.value) - parseFloat(totalPending.value)).toFixed(2);
});
</script>

<template>
  <section>
    <h2>Weekly Breakdown</h2>

    <table>
      <thead>
        <tr>
          <th>Period</th>
          <th>Target</th>
          <th>Actual</th>
          <th>Pending</th>
          <th>Gap</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(week, i) in weeks" :key="i">
          <td>{{ week.period }}</td>
          <td>{{ week.target }}</td>
          <td>{{ week.actualIncome }}</td>
          <td>{{ week.pendingIncome }}</td>
          <td :class="{ negative: week.gap < 0 }">
            {{ week.gap }}
          </td>
        </tr>
        <!-- Total Row -->
        <tr v-if="weeks.length > 0" class="total-row">
          <td class="total-label"><strong>Total</strong></td>
          <td class="total-amount">{{ totalTarget }}</td>
          <td class="total-amount">{{ totalActual }}</td>
          <td class="total-amount">{{ totalPending }}</td>
          <td :class="['total-amount', { negative: totalGap < 0 }]">
            {{ totalGap }}
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: 8px;
  border-bottom: 1px solid #ddd;
}
.negative {
  color: red;
}

.total-row {
  background-color: #f9fafb;
  border-top: 2px solid #e5e7eb;
  font-weight: 600;
}

.total-label {
  text-align: right;
  padding: 12px 8px;
  color: #111827;
}

.total-amount {
  padding: 12px 8px;
  font-weight: 600;
}
</style>
