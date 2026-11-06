<template>
  <div class="metric-card" :class="cardClass">
    <div class="card-header">
      <div class="icon-wrapper" :style="{ backgroundColor: iconBgColor }">
        <span class="icon">{{ icon }}</span>
      </div>
      <div class="card-title">{{ title }}</div>
    </div>
    <div class="card-value" :class="valueClass">
      {{ formattedValue }}
    </div>
    <div v-if="subtitle" class="card-subtitle">{{ subtitle }}</div>
    <div v-if="trend !== null" class="card-trend" :class="trendClass">
      <span class="trend-icon">{{ trendIcon }}</span>
      <span class="trend-text">{{ trendText }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatCurrency } from '../../../utils/financeHelpers'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  value: {
    type: [Number, String],
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'default', // 'income', 'expense', 'target', 'gap', 'default'
    validator: (val) => ['income', 'expense', 'target', 'gap', 'default'].includes(val)
  },
  icon: {
    type: String,
    default: '💰'
  },
  trend: {
    type: Number,
    default: null // percentage change
  },
  currency: {
    type: String,
    default: 'USD'
  }
})

const formattedValue = computed(() => {
  if (typeof props.value === 'string') return props.value
  return formatCurrency(props.value, props.currency)
})

const cardClass = computed(() => {
  return `metric-card--${props.type}`
})

const valueClass = computed(() => {
  return `card-value--${props.type}`
})

const iconBgColor = computed(() => {
  const colors = {
    income: '#d1fae5',
    expense: '#fee2e2',
    target: '#dbeafe',
    gap: '#fef3c7',
    default: '#f3f4f6'
  }
  return colors[props.type] || colors.default
})

const trendClass = computed(() => {
  if (props.trend === null) return ''
  return props.trend >= 0 ? 'trend-positive' : 'trend-negative'
})

const trendIcon = computed(() => {
  if (props.trend === null) return ''
  return props.trend >= 0 ? '↑' : '↓'
})

const trendText = computed(() => {
  if (props.trend === null) return ''
  const absTrend = Math.abs(props.trend)
  return `${absTrend.toFixed(1)}%`
})
</script>

<style scoped>
.metric-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  border: 1px solid #e5e7eb;
  position: relative;
  overflow: hidden;
}

.metric-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.metric-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.metric-card:hover::before {
  opacity: 1;
}

.metric-card--income::before {
  background: linear-gradient(90deg, #10b981, #34d399);
}

.metric-card--expense::before {
  background: linear-gradient(90deg, #ef4444, #f87171);
}

.metric-card--target::before {
  background: linear-gradient(90deg, #6366f1, #818cf8);
}

.metric-card--gap::before {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon {
  font-size: 24px;
}

.card-title {
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex: 1;
}

.card-value {
  font-size: 32px;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 8px;
  color: #111827;
}

.card-value--income {
  color: #10b981;
}

.card-value--expense {
  color: #ef4444;
}

.card-value--target {
  color: #6366f1;
}

.card-value--gap {
  color: #f59e0b;
}

.card-subtitle {
  font-size: 13px;
  color: #9ca3af;
  margin-bottom: 8px;
}

.card-trend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  margin-top: 8px;
}

.trend-positive {
  color: #10b981;
}

.trend-negative {
  color: #ef4444;
}

.trend-icon {
  font-size: 14px;
}

.trend-text {
  font-weight: 600;
}

@media (max-width: 768px) {
  .metric-card {
    padding: 20px;
  }

  .card-value {
    font-size: 28px;
  }

  .icon-wrapper {
    width: 40px;
    height: 40px;
  }

  .icon {
    font-size: 20px;
  }
}
</style>

