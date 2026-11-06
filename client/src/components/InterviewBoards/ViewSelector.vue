<template>
  <div class="view-selector">
    <div class="view-tabs">
      <button v-for="view in views" :key="view.value" :class="['view-tab', { active: currentView === view.value }]"
        @click="$emit('change-view', view.value)">
        <span class="tab-icon">{{ view.icon }}</span>
        <span class="tab-label">{{ view.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  currentView: {
    type: String,
    required: true
  },
  views: {
    type: Array,
    default: () => [
      { value: 'time', label: 'Time View', icon: '📅' },
      { value: 'stage', label: 'Stage View', icon: '📋' },
      { value: 'company', label: 'Company View', icon: '🏢' },
      { value: 'filter', label: 'Filter View', icon: '🔍' },
      { value: 'settings', label: 'Settings', icon: '⚙️' }
    ]
  }
});

defineEmits(['change-view']);
</script>

<style scoped>
.view-selector {
  margin-bottom: 24px;
  border-bottom: 2px solid #e0e0e0;
}

.view-tabs {
  display: flex;
  gap: 4px;
}

.view-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-size: 0.95rem;
  color: #7f8c8d;
  transition: all 0.2s;
  position: relative;
  bottom: -2px;
}

.view-tab:hover {
  color: #2c3e50;
  background: rgba(52, 152, 219, 0.05);
}

.view-tab.active {
  color: #3498db;
  border-bottom-color: #3498db;
  font-weight: 500;
}

.tab-icon {
  font-size: 1.1rem;
}

.tab-label {
  font-weight: 500;
}
</style>
