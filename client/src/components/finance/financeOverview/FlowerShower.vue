<template>
  <div v-if="show" class="flower-shower-container">
    <div
      v-for="(flower, index) in flowers"
      :key="index"
      class="flower"
      :style="flower.style"
    >
      {{ flower.emoji }}
    </div>
    <div class="congratulations-text">
      🎉 Congratulations! 🎉
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  duration: {
    type: Number,
    default: 3000 // 3 seconds
  }
})

const flowers = ref([])
const flowerEmojis = ['🌸', '🌺', '🌻', '🌷', '🌹', '🌼', '💐', '🌿', '✨', '⭐', '🌟', '💫']

const createFlower = () => {
  const emoji = flowerEmojis[Math.floor(Math.random() * flowerEmojis.length)]
  const startX = Math.random() * 100
  const delay = Math.random() * 0.5
  const duration = 2 + Math.random() * 1.5
  const size = 20 + Math.random() * 20
  
  return {
    emoji,
    style: {
      left: `${startX}%`,
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`,
      fontSize: `${size}px`,
      opacity: 0.8 + Math.random() * 0.2
    }
  }
}

const startShower = () => {
  if (!props.show) return
  
  // Create 50 flowers
  flowers.value = Array.from({ length: 50 }, () => createFlower())
  
  // Clear flowers after animation
  setTimeout(() => {
    flowers.value = []
  }, props.duration + 2000)
}

let showTimeout = null

watch(() => props.show, (newVal) => {
  if (newVal) {
    startShower()
  } else {
    flowers.value = []
  }
})

onMounted(() => {
  if (props.show) {
    startShower()
  }
})

onBeforeUnmount(() => {
  if (showTimeout) {
    clearTimeout(showTimeout)
  }
})
</script>

<style scoped>
.flower-shower-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
  overflow: hidden;
  border-radius: 8px;
}

.flower {
  position: absolute;
  top: -50px;
  animation: fall linear forwards;
  pointer-events: none;
  user-select: none;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.congratulations-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 2rem;
  font-weight: 900;
  color: #fbbf24;
  text-shadow: 
    0 0 10px rgba(251, 191, 36, 0.8),
    0 0 20px rgba(251, 191, 36, 0.6),
    0 0 30px rgba(251, 191, 36, 0.4),
    2px 2px 4px rgba(0, 0, 0, 0.3);
  animation: celebrate 1s ease-out, fadeOut 0.5s ease-out 2.5s forwards;
  pointer-events: none;
  white-space: nowrap;
  z-index: 11;
}

@keyframes fall {
  0% {
    transform: translateY(0) rotate(0deg) scale(1);
    opacity: 1;
  }
  50% {
    transform: translateY(50vh) rotate(180deg) scale(1.2);
    opacity: 0.8;
  }
  100% {
    transform: translateY(100vh) rotate(360deg) scale(0.8);
    opacity: 0;
  }
}

@keyframes celebrate {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.5) rotate(-10deg);
  }
  50% {
    transform: translate(-50%, -50%) scale(1.1) rotate(5deg);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
  }
}

@keyframes fadeOut {
  to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
}
</style>

