<template>
    <div class="summary-card">
      <div class="title">{{ title }}</div>
      <div class="value" :class="valueClass">
        {{ formattedValue }}
      </div>
    </div>
  </template>
  
  <script setup>
  import { computed } from 'vue';
  
  const props = defineProps({
    title: {
      type: String,
      required: true
    },
    value: {
      type: Number,
      default: 0
    },
    highlight: {
      type: String,
      default: '' // 'positive' | 'negative'
    }
  });
  
  const formattedValue = computed(() =>
    Number(props.value).toLocaleString()
  );
  
  const valueClass = computed(() => {
    if (props.highlight === 'positive') return 'positive';
    if (props.highlight === 'negative') return 'negative';
    return '';
  });
  </script>
  
  <style scoped>
  .summary-card {
    background: #ffffff;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .title {
    font-size: 0.85rem;
    color: #6b7280;
    font-weight: 500;
  }
  
  .value {
    font-size: 1.6rem;
    font-weight: 700;
    color: #111827;
  }
  
  .value.positive {
    color: #16a34a;
  }
  
  .value.negative {
    color: #dc2626;
  }
  </style>
  