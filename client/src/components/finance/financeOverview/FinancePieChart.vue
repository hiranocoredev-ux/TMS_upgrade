<template>
  <div class="pie-chart-container">
    <div class="chart-header">
      <h3 class="chart-title">{{ title }}</h3>
      <div v-if="subtitle" class="chart-subtitle">{{ subtitle }}</div>
    </div>
    <div class="chart-wrapper">
      <canvas ref="chartCanvas"></canvas>
    </div>
    <div v-if="showLegend" class="chart-legend">
      <div
        v-for="(item, index) in chartData"
        :key="index"
        class="legend-item"
      >
        <div class="legend-color" :style="{ backgroundColor: item.backgroundColor }"></div>
        <span class="legend-label">{{ item.label }}</span>
        <span class="legend-value">{{ formatValue(item.value) }}</span>
        <span class="legend-percentage">({{ item.percentage }}%)</span>
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
  subtitle: {
    type: String,
    default: ''
  },
  data: {
    type: Array,
    required: true,
    validator: (val) => Array.isArray(val) && val.every(item => 
      item.label && typeof item.value === 'number'
    )
  },
  showLegend: {
    type: Boolean,
    default: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  colors: {
    type: Array,
    default: () => [
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // amber
      '#ef4444', // red
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#06b6d4', // cyan
      '#84cc16'  // lime
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
      borderWidth: 2,
      hoverOffset: 4
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
        padding: 12,
        titleFont: {
          size: 14,
          weight: 'bold'
        },
        bodyFont: {
          size: 13
        },
        cornerRadius: 8
      }
    },
    cutout: '60%'
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
.pie-chart-container {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
}

.chart-header {
  margin-bottom: 24px;
}

.chart-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 4px 0;
}

.chart-subtitle {
  font-size: 13px;
  color: #6b7280;
}

.chart-wrapper {
  position: relative;
  height: 300px;
  margin-bottom: 24px;
}

.chart-legend {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  flex-shrink: 0;
}

.legend-label {
  flex: 1;
  color: #374151;
  font-weight: 500;
}

.legend-value {
  color: #111827;
  font-weight: 600;
  min-width: 80px;
  text-align: right;
}

.legend-percentage {
  color: #6b7280;
  font-size: 13px;
  min-width: 50px;
  text-align: right;
}

@media (max-width: 768px) {
  .pie-chart-container {
    padding: 20px;
  }

  .chart-wrapper {
    height: 250px;
  }

  .legend-item {
    font-size: 13px;
  }

  .legend-value,
  .legend-percentage {
    font-size: 12px;
  }
}
</style>

