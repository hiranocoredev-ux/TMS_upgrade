<script setup>
defineProps({
  title: String,
  metrics: {
    type: Object,
    required: true
  }
});
</script>

<template>
  <section class="kpi">
    <h2>{{ title }}</h2>

    <div class="grid">
      <div>Actual Income: <strong>{{ metrics.actualIncome }}</strong></div>
      <div>Actual Outcome: <strong>{{ metrics.actualExpense }}</strong></div>
      <div>Pending Income: <strong>{{ metrics.pendingIncome }}</strong></div>
      <div>Target: <strong>{{ metrics.target }}</strong></div>
      <div>
        Gap:
        <strong :class="{ negative: metrics.gap < 0 }">
          {{ metrics.gap }}
        </strong>
      </div>
    </div>
  </section>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.negative {
  color: red;
}
</style>
