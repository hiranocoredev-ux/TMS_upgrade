<template>
  <div class="mini-bar-chart">
    <div class="chart-header">
      <h4 class="chart-title">{{ title }}</h4>
    </div>
    <div class="chart-wrapper">
      <canvas ref="chartCanvas"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'
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
      '#10b981', // green
      '#ef4444', // red
      '#6366f1', // indigo
      '#f59e0b'  // amber
    ]
  },
  /** When true, vertical bars (labels on X, values on Y) */
  swapAxes: {
    type: Boolean,
    default: false
  }
})

const chartCanvas = ref(null)
let chartInstance = null

const formatValue = (value) => {
  return formatCurrency(value, props.currency)
}

const maxValue = computed(() => {
  if (props.data.length === 0) return 1
  return Math.max(...props.data.map(item => item.value), 1)
})

const createChart = () => {
  if (!chartCanvas.value) return

  // Destroy existing chart if it exists
  if (chartInstance) {
    chartInstance.destroy()
  }

  const labels = props.data.map(item => item.label)
  const values = props.data.map(item => item.value)
  const backgroundColors = props.data.map((item, index) => props.colors[index % props.colors.length])
  const vertical = props.swapAxes

  const data = {
    labels,
    datasets: [{
      label: props.title,
      data: values,
      backgroundColor: backgroundColors,
      borderColor: '#ffffff',
      borderWidth: 2,
      borderRadius: 6,
      borderSkipped: false
    }]
  }

  const options = {
    indexAxis: vertical ? 'x' : 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const raw = vertical ? context.parsed.y : context.parsed.x
            return `${context.label}: ${formatValue(raw)}`
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
        duration: 1000,
        easing: 'easeOutQuart'
      }
    },
    scales: vertical
      ? {
          x: {
            ticks: {
              font: { size: 11 },
              maxRotation: 45,
              minRotation: 45
            },
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                if (value >= 1000) return (value / 1000).toFixed(1) + 'k'
                return value
              },
              font: { size: 10 },
              maxTicksLimit: 5
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
              drawBorder: false
            }
          }
        }
      : {
          x: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                if (value >= 1000) return (value / 1000).toFixed(1) + 'k'
                return value
              },
              font: { size: 10 },
              maxTicksLimit: 5
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
              drawBorder: false
            }
          },
          y: {
            ticks: { font: { size: 11 } },
            grid: { display: false }
          }
        }
  }

  chartInstance = new Chart(chartCanvas.value, {
    type: 'bar',
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
.mini-bar-chart {
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

