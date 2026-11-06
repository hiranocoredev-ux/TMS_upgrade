<template>
  <div class="circular-progress-gauge">
    <div class="gauge-wrapper">
      <svg class="gauge-svg" viewBox="0 0 120 120">
        <!-- Background circle -->
        <circle
          class="gauge-background"
          cx="60"
          cy="60"
          r="50"
          fill="none"
          :stroke="backgroundColor"
          :stroke-width="8"
        />
        <!-- Progress circle -->
        <circle
          class="gauge-progress"
          cx="60"
          cy="60"
          r="50"
          fill="none"
          :stroke="progressColor"
          :stroke-width="8"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="dashOffset"
          stroke-linecap="round"
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div class="gauge-content">
        <div class="gauge-percentage" :class="{ 'percentage-overflow': percentage > 100 }">
          {{ displayPercentage }}%
        </div>
        <div class="gauge-label">{{ label }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  percentage: {
    type: Number,
    required: true,
    default: 0,
    validator: (val) => val >= 0 // Allow > 100%
  },
  label: {
    type: String,
    default: 'Progress'
  },
  progressColor: {
    type: String,
    default: 'var(--color-primary)'
  },
  backgroundColor: {
    type: String,
    default: 'var(--bg-tertiary)'
  },
  size: {
    type: Number,
    default: 120
  }
})

const circumference = computed(() => 2 * Math.PI * 50) // radius = 50

const dashOffset = computed(() => {
  const progress = Math.max(props.percentage, 0)
  // For > 100%, show full circle
  const normalizedProgress = progress > 100 ? 100 : progress
  return circumference.value - (normalizedProgress / 100) * circumference.value
})

const displayPercentage = computed(() => {
  return Math.round(props.percentage)
})
</script>

<style scoped>
.circular-progress-gauge {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.gauge-wrapper {
  position: relative;
  width: 120px;
  height: 120px;
}

.gauge-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
  animation: rotateIn 0.6s ease-out;
}

.gauge-background {
  opacity: 0.2;
}

.gauge-progress {
  transition: stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1);
  filter: drop-shadow(0 2px 4px rgba(99, 102, 241, 0.3));
}

.percentage-overflow {
  color: var(--color-success) !important;
  animation: celebrateGlow 2s ease-in-out infinite;
}

@keyframes celebrateGlow {
  0%, 100% {
    text-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
  }
  50% {
    text-shadow: 0 0 20px rgba(16, 185, 129, 0.8), 0 0 30px rgba(16, 185, 129, 0.6);
  }
}

.gauge-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  animation: fadeInScale 0.8s ease-out 0.3s both;
}

.gauge-percentage {
  font-size: 1.8rem;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 4px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-success) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.gauge-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

@keyframes rotateIn {
  from {
    opacity: 0;
    transform: rotate(-90deg) scale(0.8);
  }
  to {
    opacity: 1;
    transform: rotate(-90deg) scale(1);
  }
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}
</style>

