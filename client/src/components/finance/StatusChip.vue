<template>
  <span :class="['status-chip', `status-${status}`]">
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from 'vue';
import { getStatusColor } from '../../utils/financeHelpers';

const props = defineProps({
  status: {
    type: String,
    required: true,
    validator: (value) => ['pending', 'accepted', 'canceled'].includes(value)
  }
});

const label = computed(() => {
  const labels = {
    pending: 'Pending',
    accepted: 'Accepted',
    canceled: 'Canceled'
  };
  return labels[props.status] || props.status;
});
</script>

<style scoped>
.status-chip {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-pending {
  background-color: #fef3c7;
  color: #92400e;
}

.status-accepted {
  background-color: #d1fae5;
  color: #065f46;
}

.status-canceled {
  background-color: #fee2e2;
  color: #991b1b;
}
</style>
