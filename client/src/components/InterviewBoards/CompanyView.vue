<template>
  <div class="company-view">
    <div v-if="loading && tickets.length === 0" class="loading-state">
      <div class="spinner"></div>
      <p>Loading tickets...</p>
    </div>

    <div v-else class="company-groups">
      <div v-for="group in companyGroups" :key="group.companyName" class="company-group">
        <div class="group-header">
          <h3 class="group-title">{{ group.companyName || 'Unknown Company' }}</h3>
          <span class="group-count">({{ group.tickets.length }} ticket{{ group.tickets.length !== 1 ? 's' : '' }})</span>
        </div>
        <div class="group-content">
          <div v-if="group.tickets.length === 0" class="empty-group">
            No tickets for this company
          </div>
          <div v-else class="tickets-list">
            <InterviewTicketCard
              v-for="ticket in group.tickets"
              :key="ticket._id"
              :ticket="ticket"
              @click="$emit('click-ticket', ticket)"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-if="!loading && tickets.length === 0" class="empty-state">
      <p>No tickets found</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import InterviewTicketCard from './InterviewTicketCard.vue';

const props = defineProps({
  tickets: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
});

defineEmits(['click-ticket']);

const companyGroups = computed(() => {
  const grouped = {};
  
  props.tickets.forEach(ticket => {
    const companyName = ticket.companyName || 'Unknown Company';
    if (!grouped[companyName]) {
      grouped[companyName] = {
        companyName,
        tickets: []
      };
    }
    grouped[companyName].tickets.push(ticket);
  });

  // Sort tickets within each group by position, then by creation date
  Object.values(grouped).forEach(group => {
    group.tickets.sort((a, b) => {
      // First sort by position
      if (a.position && b.position && a.position !== b.position) {
        return a.position.localeCompare(b.position);
      }
      // Then by creation date (newest first)
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA;
    });
  });

  // Sort groups by company name
  return Object.values(grouped).sort((a, b) => {
    return a.companyName.localeCompare(b.companyName);
  });
});
</script>

<style scoped>
.company-view {
  min-height: 400px;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 40px;
}

.spinner {
  border: 3px solid #f3f3f3;
  border-top: 3px solid #3498db;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.company-groups {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.company-group {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.group-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #e0e0e0;
}

.group-title {
  margin: 0;
  font-size: 1.2rem;
  color: #2c3e50;
}

.group-count {
  font-size: 0.9rem;
  color: #7f8c8d;
  background: #ecf0f1;
  padding: 4px 10px;
  border-radius: 12px;
}

.group-content {
  min-height: 100px;
}

.empty-group {
  text-align: center;
  color: #95a5a6;
  font-style: italic;
  padding: 20px;
}

.tickets-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>

