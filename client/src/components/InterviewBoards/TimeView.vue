<template>
  <div class="time-view">
    <div v-if="loading && tickets.length === 0" class="loading-state">
      <div class="spinner"></div>
      <p>Loading tickets...</p>
    </div>

    <div v-else class="time-groups">
      <div v-for="group in timeGroups" :key="group.key" class="time-group">
        <div class="group-header">
          <h3 class="group-title">{{ group.label }}</h3>
          <span class="group-count">({{ group.tickets.length }})</span>
        </div>
        <div class="group-content">
          <div v-if="group.tickets.length === 0" class="empty-group">
            No tickets in this time period
          </div>
          <div v-else class="tickets-grid">
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
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
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

const now = ref(new Date());

// Helper to get start of day
const getStartOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Helper to get end of day
const getEndOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

// Helper to get start of week (Monday)
const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Helper to get end of week (Sunday)
const getEndOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? 0 : 7); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(23, 59, 59, 999);
  return d;
};

// Get earliest scheduled date from ticket
const getEarliestDate = (ticket) => {
  if (!ticket.dates || ticket.dates.length === 0) {
    return null;
  }
  const dates = ticket.dates
    .map(d => new Date(d.scheduledAt))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a - b);
  return dates.length > 0 ? dates[0] : null;
};

const timeGroups = computed(() => {
  const todayStart = getStartOfDay(now.value);
  const todayEnd = getEndOfDay(now.value);
  const weekStart = getStartOfWeek(now.value);
  const weekEnd = getEndOfWeek(now.value);

  const groups = {
    today: { key: 'today', label: 'Today', tickets: [] },
    thisWeek: { key: 'thisWeek', label: 'This Week', tickets: [] },
    upcoming: { key: 'upcoming', label: 'Upcoming', tickets: [] },
    past: { key: 'past', label: 'Past', tickets: [] }
  };

  props.tickets.forEach(ticket => {
    const earliestDate = getEarliestDate(ticket);
    if (!earliestDate) {
      // No dates - add to upcoming
      groups.upcoming.tickets.push(ticket);
      return;
    }

    if (earliestDate >= todayStart && earliestDate <= todayEnd) {
      groups.today.tickets.push(ticket);
    } else if (earliestDate > todayEnd && earliestDate <= weekEnd) {
      groups.thisWeek.tickets.push(ticket);
    } else if (earliestDate > weekEnd) {
      groups.upcoming.tickets.push(ticket);
    } else {
      groups.past.tickets.push(ticket);
    }
  });

  // Sort tickets within each group by date
  Object.values(groups).forEach(group => {
    group.tickets.sort((a, b) => {
      const dateA = getEarliestDate(a);
      const dateB = getEarliestDate(b);
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA - dateB;
    });
  });

  return Object.values(groups);
});
</script>

<style scoped>
.time-view {
  min-height: 400px;
}

.loading-state {
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

.time-groups {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.time-group {
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
  padding: 40px;
}

.tickets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
</style>

