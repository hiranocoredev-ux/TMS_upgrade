<template>
  <div 
    class="time-ticket-card" 
    :style="{ borderLeftColor: getStageColor(), backgroundColor: getStageColorWithOpacity() }"
  >
    <!-- Top Line: Time, Duration, Stage -->
    <div class="card-top-line">
      <div class="top-left">
        <span class="time-display">{{ getTimeDisplay() }}</span>
        <span class="duration-display">{{ getDurationDisplay() }}</span>
        <div v-if="getStageName()" class="stage-badge">
          <span class="stage-color-dot" :style="{ backgroundColor: getStageColor() }"></span>
          <span class="stage-name">{{ getStageName() }}</span>
        </div>
      </div>
    </div>

    <!-- Company Name -->
    <div class="company-line">
      <h3 class="company-name">{{ ticket.companyName }}</h3>
    </div>

    <!-- Bottom Line: Position (left) and Priority (right) -->
    <div class="card-bottom-line">
      <div v-if="ticket.position" class="position-text">
        {{ truncateText(ticket.position, 25) }}
      </div>
      <div v-if="ticket.priority" class="priority-badge" :class="`priority-${ticket.priority}`">
        {{ ticket.priority.toUpperCase() }}
      </div>
    </div>

    <!-- Member Badge (Candidate) -->
    <div v-if="ticket.candidateName || ticket.candidateUserId" class="member-badge">
      <div class="avatar-circle" :style="{ backgroundColor: getAvatarColor() }">
        <img v-if="getCandidateAvatar()" :src="getCandidateAvatar()" alt="" class="avatar-img" />
        <span v-else class="avatar-initials">{{ getCandidateInitials() }}</span>
      </div>
      <span class="member-name">{{ getCandidateName() }}</span>
      <div v-if="hasNotes()" class="note-indicator" title="Has notes">
        <i class="fas fa-sticky-note"></i>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { utcToEST, formatESTDateTime } from '../../utils/timezoneHelpers';

const props = defineProps({
  ticket: {
    type: Object,
    required: true
  },
  users: {
    type: Array,
    default: () => []
  },
  canDelete: {
    type: Boolean,
    default: false
  },
  boardId: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['delete']);

const getTicketTime = () => {
  const primaryIndex = props.ticket.primaryDateIndex || 0;
  const dateObj = props.ticket.dates?.[primaryIndex];
  if (!dateObj || !dateObj.scheduledAt) return null;
  
  // Convert UTC to EST
  const est = utcToEST(dateObj.scheduledAt);
  return est ? est.dateTime : null;
};

const getTimeDisplay = () => {
  const time = getTicketTime();
  if (!time) return 'No time';
  
  const hours = time.getUTCHours();
  const minutes = time.getUTCMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  
  return `${displayHours}:${displayMinutes} ${ampm}`;
};

const getDurationDisplay = () => {
  const primaryIndex = props.ticket.primaryDateIndex || 0;
  const dateObj = props.ticket.dates?.[primaryIndex];
  const duration = dateObj?.durationMinutes || 60;
  
  if (duration < 60) {
    return `${duration}m`;
  }
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
};

const getCandidate = () => {
  if (props.ticket.candidateUserId) {
    const ticketUserId = props.ticket.candidateUserId?._id || props.ticket.candidateUserId;
    const user = props.users.find(u => {
      const userId = u._id || u.id;
      return userId && ticketUserId && userId.toString() === ticketUserId.toString();
    });
    return user || null;
  }
  return null;
};

const getCandidateName = () => {
  const candidate = getCandidate();
  if (candidate) {
    return candidate.name || candidate.email || 'Unknown';
  }
  return props.ticket.candidateName || 'No candidate';
};

const getCandidateAvatar = () => {
  // User model doesn't have avatar field
  // If needed in future, can check PersonalProfile via ownerUserId
  return null;
};

const getCandidateInitials = () => {
  const name = getCandidateName();
  if (!name || name === 'No candidate' || name === 'Unknown') return '?';
  
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const getAvatarColor = () => {
  // Generate a consistent, distinct color based on the candidate name or ID
  const candidate = getCandidate();
  let identifier = '';
  
  if (candidate) {
    // Use user ID if available for more consistent color assignment
    identifier = (candidate._id || candidate.id || '').toString();
    if (!identifier) {
      identifier = candidate.name || candidate.email || '';
    }
  } else {
    identifier = getCandidateName();
  }
  
  if (!identifier) return '#3498db';
  
  // Use a larger, more distinct color palette
  const colors = [
    '#3498db', // Blue
    '#2ecc71', // Green
    '#e74c3c', // Red
    '#f39c12', // Orange
    '#9b59b6', // Purple
    '#1abc9c', // Turquoise
    '#e67e22', // Dark Orange
    '#16a085', // Dark Turquoise
    '#27ae60', // Dark Green
    '#2980b9', // Dark Blue
    '#8e44ad', // Dark Purple
    '#c0392b', // Dark Red
    '#d35400', // Darker Orange
    '#7f8c8d', // Gray
    '#34495e', // Dark Gray
    '#f1c40f', // Yellow
    '#e91e63', // Pink
    '#00bcd4', // Cyan
    '#4caf50', // Light Green
    '#ff9800', // Amber
    '#795548', // Brown
    '#607d8b', // Blue Gray
    '#9c27b0', // Deep Purple
    '#3f51b5', // Indigo
    '#009688', // Teal
  ];
  
  // Create a hash from the identifier for consistent color assignment
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Use absolute value and modulo to get index
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const hasNotes = () => {
  return props.ticket.notes && props.ticket.notes.trim().length > 0;
};

const getStageColor = () => {
  const stage = props.ticket.stageId;
  if (stage && stage.color) {
    return stage.color;
  }
  return '#3498db'; // Default blue
};

const getStageColorWithOpacity = () => {
  const color = getStageColor();
  // Convert hex to rgba with 0.08 opacity
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.08)`;
};

const getStageName = () => {
  const stage = props.ticket.stageId;
  if (stage && stage.name) {
    return stage.name;
  }
  return '';
};

const truncateText = (text, maxLength) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

const handleDelete = async () => {
  if (confirm('Are you sure you want to delete this ticket?')) {
    emit('delete', props.ticket);
  }
};
</script>

<style scoped>
.time-ticket-card {
  position: relative;
  width: 100%;
  background: var(--bg-primary);
  border: 1px solid var(--border-medium);
  border-left: 4px solid;
  border-radius: 6px;
  padding: 6px 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.2s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-sizing: border-box;
}

.time-ticket-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
  z-index: 20;
}

/* Top Line: Time, Duration, Stage */
.card-top-line {
  display: flex;
  align-items: center;
  margin-bottom: 2px;
}

.top-left {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.time-display {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.2px;
}

.duration-display {
  font-size: 0.65rem;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  padding: 2px 5px;
  border-radius: 8px;
  font-weight: 500;
}

.stage-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-primary);
}

.stage-color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.stage-name {
  text-transform: capitalize;
  font-size: 0.7rem;
}

.priority-badge {
  font-size: 0.6rem;
  padding: 2px 5px;
  border-radius: 3px;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.3px;
  flex-shrink: 0;
}

.priority-low {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.priority-medium {
  background: #3b82f6;
  color: white;
}

.priority-high {
  background: #f59e0b;
  color: white;
}

.priority-urgent {
  background: #ef4444;
  color: white;
}

/* Company Name Line */
.company-line {
  margin-bottom: 2px;
}

.company-name {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0.3px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* Bottom Line: Position and Priority */
.card-bottom-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.position-text {
  font-size: 0.7rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

/* Member Badge (Candidate) */
.member-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  padding-top: 4px;
  border-top: 1px solid var(--border-light);
}

.avatar-circle {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-initials {
  font-size: 0.65rem;
  font-weight: 700;
  color: white;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.member-name {
  font-size: 0.7rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.note-indicator {
  margin-left: auto;
  color: var(--color-primary);
  font-size: 0.75rem;
  opacity: 0.7;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: help;
}

.note-indicator:hover {
  opacity: 1;
  transform: scale(1.1);
  transition: all 0.2s ease;
}
</style>

