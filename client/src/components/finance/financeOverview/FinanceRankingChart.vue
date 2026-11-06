<template>
  <div class="ranking-chart-container">
    <div class="chart-header">
      <h3 class="chart-title">{{ title }}</h3>
      <div v-if="subtitle" class="chart-subtitle">{{ subtitle }}</div>
    </div>
    <div class="chart-wrapper">
      <canvas ref="chartCanvas"></canvas>
    </div>
    <div v-if="showRankingList" class="ranking-list">
      <div
        v-for="(item, index) in sortedData"
        :key="index"
        class="ranking-item"
        :class="{ 'top-three': index < 3 }"
      >
        <div class="rank-badge" :class="getRankClass(index)">
          {{ index + 1 }}
        </div>
        <div class="rank-info">
          <div class="rank-name">{{ item.label }}</div>
          <div class="rank-bar-container">
            <div
              class="rank-bar"
              :style="{
                width: `${getPercentage(item.value)}%`,
                backgroundColor: getBarColor(index)
              }"
            ></div>
          </div>
        </div>
        <div class="rank-value">{{ formatValue(item.value) }}</div>
      </div>
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
  showRankingList: {
    type: Boolean,
    default: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  sortOrder: {
    type: String,
    default: 'desc', // 'asc' or 'desc'
    validator: (val) => ['asc', 'desc'].includes(val)
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
  },
  formatAsPercentage: {
    type: Boolean,
    default: false
  },
  /** When true, vertical bars (labels on X, values on Y); when false, horizontal bars */
  swapAxes: {
    type: Boolean,
    default: false
  }
})

const chartCanvas = ref(null)
let chartInstance = null

const sortedData = computed(() => {
  const sorted = [...props.data].sort((a, b) => {
    return props.sortOrder === 'desc' ? b.value - a.value : a.value - b.value
  })
  return sorted
})

const maxValue = computed(() => {
  if (sortedData.value.length === 0) return 1
  return Math.max(...sortedData.value.map(item => item.value), 1)
})

const formatValue = (value) => {
  if (props.formatAsPercentage) {
    return `${value}%`
  }
  return formatCurrency(value, props.currency)
}

const getPercentage = (value) => {
  if (maxValue.value === 0) return 0
  return (value / maxValue.value) * 100
}

const getBarColor = (index) => {
  if (index < 3) {
    const topColors = ['#fbbf24', '#94a3b8', '#f97316'] // gold, silver, bronze
    return topColors[index]
  }
  return props.colors[index % props.colors.length]
}

const getRankClass = (index) => {
  if (index === 0) return 'rank-gold'
  if (index === 1) return 'rank-silver'
  if (index === 2) return 'rank-bronze'
  return ''
}

const createChart = () => {
  if (!chartCanvas.value) return

  // Destroy existing chart if it exists
  if (chartInstance) {
    chartInstance.destroy()
  }

  const labels = sortedData.value.map(item => item.label)
  const values = sortedData.value.map(item => item.value)
  const backgroundColors = sortedData.value.map((item, index) => getBarColor(index))
  const vertical = props.swapAxes

  const data = {
    labels,
    datasets: [{
      label: props.title,
      data: values,
      backgroundColor: backgroundColors,
      borderColor: '#ffffff',
      borderWidth: 2,
      borderRadius: 8,
      barThickness: 'flex',
      maxBarThickness: 50
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
            const value = props.formatAsPercentage 
              ? `${raw}%`
              : formatCurrency(raw, props.currency)
            return `${context.label}: ${value}`
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
    scales: vertical
      ? {
          x: {
            ticks: {
              font: { size: 12 },
              maxRotation: 45,
              minRotation: 45
            },
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return props.formatAsPercentage 
                  ? `${value}%`
                  : formatCurrency(value, props.currency)
              },
              font: { size: 11 }
            },
            grid: { color: '#f3f4f6' }
          }
        }
      : {
          x: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return props.formatAsPercentage 
                  ? `${value}%`
                  : formatCurrency(value, props.currency)
              },
              font: { size: 11 }
            },
            grid: { color: '#f3f4f6' }
          },
          y: {
            ticks: { font: { size: 12 } },
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
.ranking-chart-container {
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

.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.ranking-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  transition: background-color 0.2s ease;
}

.ranking-item:hover {
  background-color: #f9fafb;
}

.ranking-item.top-three {
  background: linear-gradient(90deg, rgba(251, 191, 36, 0.05), transparent);
}

.rank-badge {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  color: white;
  background-color: #6b7280;
  flex-shrink: 0;
}

.rank-badge.rank-gold {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  box-shadow: 0 2px 8px rgba(251, 191, 36, 0.3);
}

.rank-badge.rank-silver {
  background: linear-gradient(135deg, #94a3b8, #64748b);
  box-shadow: 0 2px 8px rgba(148, 163, 184, 0.3);
}

.rank-badge.rank-bronze {
  background: linear-gradient(135deg, #f97316, #ea580c);
  box-shadow: 0 2px 8px rgba(249, 115, 22, 0.3);
}

.rank-info {
  flex: 1;
  min-width: 0;
}

.rank-name {
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rank-bar-container {
  width: 100%;
  height: 8px;
  background-color: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.rank-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.rank-value {
  font-weight: 600;
  color: #111827;
  font-size: 14px;
  min-width: 100px;
  text-align: right;
}

@media (max-width: 768px) {
  .ranking-chart-container {
    padding: 20px;
  }

  .chart-wrapper {
    height: 250px;
  }

  .rank-value {
    font-size: 12px;
    min-width: 80px;
  }

  .rank-name {
    font-size: 13px;
  }
}
</style>

