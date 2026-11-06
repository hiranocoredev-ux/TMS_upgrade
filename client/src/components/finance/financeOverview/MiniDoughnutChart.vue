<template>
  <div class="mini-doughnut-chart">
    <div class="chart-header">
      <h4 class="chart-title">{{ title }}</h4>
    </div>
    <div class="chart-wrapper">
      <canvas ref="chartCanvas"></canvas>
    </div>
    <div class="chart-legend">
      <div
        v-for="(item, index) in chartData"
        :key="index"
        class="legend-item"
      >
        <div class="legend-color" :style="{ backgroundColor: item.backgroundColor }"></div>
        <span class="legend-label">{{ item.label }}</span>
        <span class="legend-value">{{ formatValue(item.value) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import { Chart, registerables } from 'chart.js'
import { formatCurrency } from '../../../utils/financeHelpers'

Chart.register(...registerables)

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  data: {
    type: Array,
    required: true,
    validator: (val) => Array.isArray(val) && val.every(item => 
      item.label && typeof item.value === 'number'
    )
  },
  currency: {
    type: String,
    default: 'USD'
  },
  colors: {
    type: Array,
    default: () => [
      '#10b981', // green for income
      '#ef4444', // red for outcome
      '#f59e0b', // amber for pending
      '#6366f1'  // indigo for other
    ]
  }
})

const chartCanvas = ref(null)
let chartInstance = null

const chartData = ref([])

const formatValue = (value) => {
  return formatCurrency(value, props.currency)
}

const calculatePercentages = () => {
  const total = props.data.reduce((sum, item) => sum + item.value, 0)
  
  return props.data.map((item, index) => ({
    label: item.label,
    value: item.value,
    percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : 0,
    backgroundColor: props.colors[index % props.colors.length],
    borderColor: '#ffffff'
  }))
}

const createChart = () => {
  if (!chartCanvas.value) return

  // Destroy existing chart if it exists
  if (chartInstance) {
    chartInstance.destroy()
  }

  chartData.value = calculatePercentages()

  const data = {
    labels: chartData.value.map(item => item.label),
    datasets: [{
      data: chartData.value.map(item => item.value),
      backgroundColor: chartData.value.map(item => item.backgroundColor),
      borderColor: chartData.value.map(item => item.borderColor),
      borderWidth: 3,
      hoverOffset: 6
    }]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || ''
            const value = formatCurrency(context.parsed, props.currency)
            const percentage = chartData.value[context.dataIndex].percentage
            return `${label}: ${value} (${percentage}%)`
          }
        },
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 10,
        titleFont: {
          size: 13,
          weight: 'bold'
        },
        bodyFont: {
          size: 12
        },
        cornerRadius: 6
      },
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 1000,
        easing: 'easeOutQuart'
      }
    },
    cutout: '70%'
  }

  chartInstance = new Chart(chartCanvas.value, {
    type: 'doughnut',
    data,
    options
  })
}

watch(() => props.data, () => {
  createChart()
}, { deep: true })

onMounted(() => {
  createChart()
})

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.destroy()
  }
})
</script>

<style scoped>
.mini-doughnut-chart {
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--border-light);
  animation: fadeInScale 0.5s ease-out;
}

.chart-header {
  margin-bottom: 12px;
}

.chart-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  text-align: center;
}

.chart-wrapper {
  position: relative;
  height: 140px;
  margin-bottom: 12px;
}

.chart-legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.legend-label {
  flex: 1;
  color: var(--text-secondary);
  font-weight: 500;
}

.legend-value {
  color: var(--text-primary);
  font-weight: 600;
  font-size: 0.8rem;
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>

