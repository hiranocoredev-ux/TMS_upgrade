<script setup>
import { computed } from 'vue';

const props = defineProps({
  title: String,
  metrics: Object
});

const percent = computed(() => {
  if (!props.metrics.target) return 0;
  return Math.min(
    100,
    Math.round((props.metrics.actualIncome / props.metrics.target) * 100)
  );
});
</script>

<template>
  <section>
    <h2>{{ title }}</h2>

    <div class="progress-bar">
      <div class="progress" :style="{ width: percent + '%' }"></div>
    </div>

    <p>{{ percent }}% of target</p>
  </section>
</template>

<style scoped>
.progress-bar {
  height: 10px;
  background: #eee;
  border-radius: 5px;
}
.progress {
  height: 100%;
  background: #4caf50;
  border-radius: 5px;
}
</style>
