<template>
  <div
    class="ticket-card"
    :class="{ 'ticket-card-urgent': ticket.priority === 'urgent' }"
    draggable="true"
    @dragstart="handleDragStart"
    @click="handleClick"
  >
    <div class="ticket-header">
      <h3 class="ticket-title">{{ ticket.title }}</h3>
      <span v-if="ticket.priority" :class="['priority-badge', `priority-${ticket.priority}`]">
        {{ ticket.priority }}
      </span>
    </div>
    
    
    <div v-if="ticket.jobProfileId" class="ticket-profile">
      <span class="profile-label">📄 {{ ticket.jobProfileId.name }}</span>
    </div>
    
    <div v-if="ticket.tags && ticket.tags.length > 0" class="ticket-tags">
      <span
        v-for="tag in ticket.tags.slice(0, 3)"
        :key="tag"
        class="tag"
      >
        {{ tag }}
      </span>
      <span v-if="ticket.tags.length > 3" class="tag-more">+{{ ticket.tags.length - 3 }}</span>
    </div>
    
    <div v-if="hasInterviews" class="ticket-interviews">
      <span class="interview-badge">💼 {{ interviewCount }} interview{{ interviewCount > 1 ? 's' : '' }}</span>
    </div>
    
    <div v-if="ticket.platformSource" class="ticket-platform">
      <span class="platform-badge">{{ ticket.platformSource }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  ticket: {
    type: Object,
    required: true
  },
  interviewCount: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['drag-start', 'click']);

const hasInterviews = computed(() => props.interviewCount > 0);

const handleDragStart = (e) => {
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', props.ticket._id);
  emit('drag-start', props.ticket);
};

const handleClick = () => {
  emit('click', props.ticket);
};
</script>

<style scoped>
/* Trello-like Card Design */
.ticket-card {
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid var(--border-light);
  position: relative;
  overflow: hidden;
}

.ticket-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: var(--color-primary);
  opacity: 0;
  transition: opacity 0.2s;
}

.ticket-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
  background: var(--bg-secondary);
}

.ticket-card:hover::before {
  opacity: 1;
}

.ticket-card:active {
  transform: translateY(0);
}

.ticket-card-urgent::before {
  background: var(--color-error);
  opacity: 1;
}

.ticket-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
  gap: 8px;
}

.ticket-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  flex: 1;
  line-height: 1.4;
  word-wrap: break-word;
}

.priority-badge {
  font-size: 0.7rem;
  padding: 3px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
  letter-spacing: 0.3px;
}

.priority-low {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.priority-medium {
  background: var(--color-info);
  color: var(--text-inverse);
}

.priority-high {
  background: var(--color-warning);
  color: var(--text-inverse);
}

.priority-urgent {
  background: var(--color-error);
  color: var(--text-inverse);
}

.ticket-assignee {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.assignee-icon {
  font-size: 0.9rem;
}

.assignee-name {
  font-weight: 500;
  color: var(--text-primary);
}

.ticket-profile {
  margin-top: 10px;
  font-size: 0.8rem;
  color: var(--color-info);
}

.profile-label {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}

.ticket-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.tag {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
  border: 1px solid var(--border-light);
}

.tag-more {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
}

.ticket-interviews {
  margin-top: 10px;
}

.interview-badge {
  background: rgba(139, 92, 246, 0.2);
  color: var(--color-primary);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  display: inline-block;
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.ticket-platform {
  margin-top: 10px;
}

.platform-badge {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
  border: 1px solid var(--border-light);
}
</style>

