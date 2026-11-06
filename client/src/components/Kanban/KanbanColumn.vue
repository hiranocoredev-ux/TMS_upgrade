<template>
  <div
    class="kanban-column"
    :class="{ 'column-dropping': isDraggingOver }"
    @dragover.prevent="handleDragOver"
    @dragenter.prevent="handleDragEnter"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <div class="column-header">
      <h3 class="column-title">{{ stageLabel }}</h3>
      <span class="column-count">({{ tickets.length }})</span>
    </div>
    <div class="column-content" ref="columnContent">
      <TicketCard
        v-for="ticket in tickets"
        :key="ticket._id"
        :ticket="ticket"
        :interview-count="getInterviewCount(ticket._id)"
        @drag-start="handleCardDragStart"
        @click="handleCardClick"
      />
      <div v-if="tickets.length === 0" class="empty-column">
        No tickets
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import TicketCard from './TicketCard.vue';

const props = defineProps({
  stage: {
    type: String,
    required: true
  },
  stageLabel: {
    type: String,
    required: true
  },
  tickets: {
    type: Array,
    default: () => []
  },
  interviewCounts: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['drop-ticket', 'click-ticket']);

const isDraggingOver = ref(false);
const columnContent = ref(null);

const handleDragOver = (e) => {
  e.preventDefault();
  isDraggingOver.value = true;
};

const handleDragEnter = (e) => {
  e.preventDefault();
  isDraggingOver.value = true;
};

const handleDragLeave = (e) => {
  // Only set to false if we're leaving the column itself, not a child
  if (!columnContent.value?.contains(e.relatedTarget)) {
    isDraggingOver.value = false;
  }
};

const handleDrop = (e) => {
  e.preventDefault();
  isDraggingOver.value = false;
  
  const ticketId = e.dataTransfer.getData('text/plain');
  if (ticketId) {
    emit('drop-ticket', ticketId, props.stage);
  }
};

const handleCardDragStart = (ticket) => {
  // Card is already handling drag start
};

const handleCardClick = (ticket) => {
  emit('click-ticket', ticket);
};

const getInterviewCount = (ticketId) => {
  return props.interviewCounts[ticketId] || 0;
};
</script>

<style scoped>
.kanban-column {
  flex: 1;
  min-width: 280px;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  margin: 0 8px;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 200px);
  transition: background-color 0.2s;
}

.kanban-column:first-child {
  margin-left: 0;
}

.kanban-column:last-child {
  margin-right: 0;
}

.column-dropping {
  background: #e3f2fd;
  border: 2px dashed #2196f3;
}

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #e0e0e0;
}

.column-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
  text-transform: capitalize;
}

.column-count {
  font-size: 0.85rem;
  color: #7f8c8d;
  background: #ecf0f1;
  padding: 2px 8px;
  border-radius: 12px;
}

.column-content {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

.empty-column {
  text-align: center;
  color: #95a5a6;
  font-size: 0.85rem;
  padding: 20px;
  font-style: italic;
}

/* Scrollbar styling */
.column-content::-webkit-scrollbar {
  width: 6px;
}

.column-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.column-content::-webkit-scrollbar-thumb {
  background: #bdc3c7;
  border-radius: 3px;
}

.column-content::-webkit-scrollbar-thumb:hover {
  background: #95a5a6;
}
</style>

