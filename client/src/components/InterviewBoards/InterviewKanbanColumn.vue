<template>
  <div
    class="interview-kanban-column"
    :class="{ 'column-dropping': isDraggingOver }"
    :style="{ borderTop: `3px solid ${stage.color || '#3498db'}` }"
    @dragover.prevent="handleDragOver"
    @dragenter.prevent="handleDragEnter"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <div class="column-header">
      <div class="column-title-wrapper">
        <h3 class="column-title">{{ stage.name }}</h3>
        <span class="column-count">({{ tickets.length }})</span>
      </div>
      <div v-if="canEdit" class="column-actions">
        <button @click.stop="handleEdit" class="btn-icon" title="Edit Stage">
          ✏️
        </button>
        <button @click.stop="handleDelete" class="btn-icon btn-delete" title="Delete Stage">
          🗑️
        </button>
      </div>
    </div>
    <div class="column-content" ref="columnContent">
      <InterviewTicketCard
        v-for="ticket in tickets"
        :key="ticket._id"
        :ticket="ticket"
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
import { ref } from 'vue';
import InterviewTicketCard from './InterviewTicketCard.vue';


const props = defineProps({
  stage: {
    type: Object,
    required: true
  },
  tickets: {
    type: Array,
    default: () => []
  },
  canEdit: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['drop-ticket', 'click-ticket', 'edit-stage', 'delete-stage']);

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
    emit('drop-ticket', ticketId, props.stage._id);
  }
};

const handleCardDragStart = (ticket) => {
  // Optional: handle visual feedback during drag
};

const handleCardClick = (ticket) => {
  emit('click-ticket', ticket);
};

const handleEdit = () => {
  emit('edit-stage', props.stage);
};

const handleDelete = () => {
  emit('delete-stage', props.stage);
};
</script>

<style scoped>
.interview-kanban-column {
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

.interview-kanban-column:first-child {
  margin-left: 0;
}

.interview-kanban-column:last-child {
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
  gap: 8px;
}

.column-title-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.column-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.interview-kanban-column:hover .column-actions {
  opacity: 1;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 0.9rem;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover {
  background: #e0e0e0;
}

.btn-delete:hover {
  background: #ffebee;
  color: #c62828;
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

