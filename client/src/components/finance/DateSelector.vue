<template>
  <TmsNativeCalendarField
    :model-value="modelValue"
    type="date"
    :disabled="disabled"
    :min="minBound"
    :max="maxBound"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>

<script setup>
import { computed } from 'vue';
import TmsNativeCalendarField from '../ui/TmsNativeCalendarField.vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  minYear: {
    type: Number,
    default: null
  },
  maxYear: {
    type: Number,
    default: null
  }
});

const emit = defineEmits(['update:modelValue']);

const currentYear = new Date().getFullYear();
const defaultMinYear = props.minYear ?? currentYear - 10;
const defaultMaxYear = props.maxYear ?? currentYear + 10;

const minBound = computed(() => `${defaultMinYear}-01-01`);
const maxBound = computed(() => `${defaultMaxYear}-12-31`);
</script>
