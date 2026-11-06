<template>
  <div
    class="interview-ticket-card"
    :class="{ 'ticket-card-urgent': ticket.priority === 'urgent' }"
    draggable="true"
    @dragstart="handleDragStart"
    @click="handleClick"
  >
    <div class="ticket-header">
      <h3 class="ticket-title">{{ ticket.companyName }}</h3>
      <span v-if="ticket.priority" :class="['priority-badge', `priority-${ticket.priority}`]">
        {{ ticket.priority }}
      </span>
    </div>
    
    <div class="ticket-position">
      <span class="position-text">{{ ticket.position }}</span>
    </div>
    
    
    <div class="ticket-profile">
      <span v-if="ticket.jobProfileId" class="profile-label">📄 {{ ticket.jobProfileId.name }}</span>
      <span v-if="ticket.candidateName">
        👤{{ ticket.candidateName }}
      </span>
    </div>
    <div v-if="ticket.stageId" class="ticket-status">
      <span :class="['status-badge', `status-${ticket.stageId}`]">
        {{ ticket.stageId.name }}
      </span>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  ticket: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['drag-start', 'click']);

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
.interview-ticket-card {
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

.interview-ticket-card::before {
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

.interview-ticket-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
  background: var(--bg-secondary);
}

.interview-ticket-card:hover::before {
  opacity: 1;
}

.interview-ticket-card:active {
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

.ticket-position {
  margin-bottom: 10px;
}

.position-text {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
  display: block;
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

.ticket-candidate,
.ticket-assignee {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.candidate-icon,
.assignee-icon {
  font-size: 0.9rem;
}

.candidate-name,
.assignee-name {
  font-weight: 500;
  color: var(--text-primary);
}

.ticket-profile {
  margin-top: 10px;
  font-size: 0.8rem;
  color: var(--color-info);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.profile-label {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}

.ticket-dates {
  margin-top: 8px;
}

.dates-badge {
  font-size: 0.75rem;
  color: var(--color-success);
  background: rgba(16, 185, 129, 0.15);
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 500;
  display: inline-block;
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

.ticket-status {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.status-badge {
  font-size: 0.7rem;
  padding: 4px 8px;
  border-radius: 4px;
  text-transform: capitalize;
  font-weight: 500;
}

.status-active {
  background: rgba(16, 185, 129, 0.15);
  color: var(--color-success);
}

.status-completed {
  background: rgba(99, 102, 241, 0.15);
  color: var(--color-primary);
}

.status-cancelled {
  background: rgba(239, 68, 68, 0.15);
  color: var(--color-error);
}

.status-on_hold {
  background: rgba(251, 191, 36, 0.15);
  color: var(--color-warning);
}
</style>

