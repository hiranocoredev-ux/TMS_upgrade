<template>
  <div v-if="ticket" class="drawer-overlay">
    <div class="drawer" @click.stop>
      <div class="drawer-header">
        <div class="header-left">
          <h2>{{ ticket.companyName }}</h2>
          <span class="position-subtitle">{{ ticket.position }}</span>
        </div>
        <div class="header-right">
          <button v-if="canEdit" @click="isEditing = !isEditing" class="btn-edit">
            {{ isEditing ? 'Cancel Edit' : 'Edit' }}
          </button>
          <button @click="close" class="close-btn">×</button>
        </div>
      </div>

      <div class="drawer-content">
        <!-- Basic Info -->
        <div class="section">
          <h3>Basic Information</h3>
          <div v-if="!isEditing" class="info-grid">
            <div class="info-item">
              <label>Status</label>
              <span :class="['status-badge', `status-${ticket.status}`]">{{ ticket.status }}</span>
            </div>
            <div class="info-item">
              <label>Stage</label>
              <span class="stage-badge">{{ ticket.stageId?.name || 'Unknown' }}</span>
            </div>
            <div class="info-item">
              <label>Priority</label>
              <span :class="['priority-badge', `priority-${ticket.priority}`]">{{ ticket.priority }}</span>
            </div>
            <div class="info-item">
              <label>Candidate (Member)</label>
              <span>{{ getCandidateDisplayName(ticket) || 'N/A' }}</span>
            </div>
            <div class="info-item">
              <label>Job Profile</label>
              <span>{{ ticket.jobProfileId?.name || 'None' }}</span>
            </div>
          </div>

          <!-- Edit Form -->
          <form v-else @submit.prevent="handleUpdate" class="edit-form">
            <div class="form-row">
              <div class="form-group">
                <label>Company Name *</label>
                <input v-model="editForm.companyName" type="text" required />
              </div>
              <div class="form-group">
                <label>Position *</label>
                <input v-model="editForm.position" type="text" required />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Candidate (Member)</label>
                <select v-model="editForm.candidateUserId">
                  <option value="">Select a member...</option>
                  <option v-for="user in users" :key="user._id || user.id" :value="String(user._id || user.id)">
                    {{ user.name || user.email }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label>Priority</label>
                <select v-model="editForm.priority">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Stage</label>
                <select v-model="editForm.stageId" required class="stage-select">
                  <option v-for="stage in stages" :key="stage._id" :value="stage._id" :data-color="stage.color || '#3498db'">
                    {{ stage.name }}
                  </option>
                </select>
                <div class="stage-select-preview" v-if="editForm.stageId">
                  <span 
                    class="stage-color-indicator" 
                    :style="{ backgroundColor: getSelectedStageColor() }"
                  ></span>
                  <span class="stage-name-preview">{{ getSelectedStageName() }}</span>
                </div>
              </div>
              <div class="form-group">
                <label>Status</label>
                <select v-model="editForm.status">
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Job Profile</label>
                <select v-model="editForm.jobProfileId">
                  <option value="null">None</option>
                  <option v-for="profile in jobProfiles" :key="profile._id || profile.id"
                    :value="profile._id || profile.id">
                    {{ profile.name }}
                  </option>
                </select>
              </div>
            </div>
            <!-- Schedule (EDIT ONLY) -->
            <div class="form-row">
              <div class="form-group">
                <label>Schedule Date</label>
                <TmsNativeCalendarField v-model="scheduleDate" type="date" :required="true" />
              </div>

              <div class="form-group">
                <label>Start Time</label>
                <input type="time" v-model="scheduleTime" required />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Duration (minutes)</label>
                <input type="number" min="15" step="15" v-model.number="durationMinutes" />
              </div>
            </div>
            <div class="form-group">
              <label>Notes</label>
              <textarea v-model="editForm.notes" rows="4"></textarea>
            </div>
            <div class="form-group">
              <label>Tags (comma-separated)</label>
              <input v-model="tagsInput" type="text" placeholder="e.g., frontend, remote, senior" />
            </div>
            <div class="form-actions">
              <button type="submit" :disabled="saving" class="btn-save">Save Changes</button>
              <button v-if="canDelete" type="button" @click="handleDelete" class="btn-delete">Delete Ticket</button>
            </div>
          </form>
        </div>

        <!-- Delete Button (outside edit form) -->
        <div v-if="!isEditing && canDelete" class="section delete-section">
          <button type="button" @click="handleDelete" class="btn-delete-full">Delete Ticket</button>
        </div>

        <!-- Interview Dates -->
        <div class="section">
          <h3>Interview Dates ({{ ticket.dates?.length || 0 }})</h3>
          <div v-if="ticket.dates && ticket.dates.length > 0" class="dates-list">
            <div v-for="(date, index) in ticket.dates" :key="index" class="date-item">
              <div class="date-header">
                <span class="date-label">Date {{ index + 1 }}</span>
                <span :class="['date-status', `status-${date.status}`]">{{ date.status }}</span>
              </div>
              <div class="date-details">
                <div><strong>Scheduled:</strong> {{ formatDateTime(date.scheduledAt) }}</div>
                <div><strong>Duration:</strong> {{ date.durationMinutes }} minutes</div>
                <div><strong>Type:</strong> {{ date.interviewType }}</div>
                <div v-if="date.platform"><strong>Platform:</strong> {{ date.platform }}</div>
                <div v-if="date.meetingLink">
                  <a :href="date.meetingLink" target="_blank" rel="noopener noreferrer">Meeting Link</a>
                </div>
                <div v-if="date.participants"><strong>Participants:</strong> {{ date.participants }}</div>
                <div v-if="date.outcome"><strong>Outcome:</strong> {{ date.outcome }}</div>
                <div v-if="date.notes"><strong>Notes:</strong> {{ date.notes }}</div>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">No interview dates scheduled</div>
        </div>

        <!-- Tags -->
        <div v-if="ticket.tags && ticket.tags.length > 0" class="section">
          <h3>Tags</h3>
          <div class="tags-list">
            <span v-for="tag in ticket.tags" :key="tag" class="tag-chip">{{ tag }}</span>
          </div>
        </div>

        <!-- Notes -->
        <div v-if="ticket.notes" class="section">
          <h3>Notes</h3>
          <p class="notes-text">{{ ticket.notes }}</p>
        </div>

        <!-- Attachments -->
        <div v-if="ticket.attachments && ticket.attachments.length > 0" class="section">
          <h3>Attachments ({{ ticket.attachments.length }})</h3>
          <ul class="attachments-list">
            <li v-for="file in ticket.attachments" :key="file._id">
              <a :href="`/api/files/${file._id}/download`" target="_blank">{{ file.originalName }}</a>
              <span class="file-size">({{ formatFileSize(file.size) }})</span>
            </li>
          </ul>
        </div>

        <!-- Activity Log -->
        <div class="section">
          <h3>Activity Log</h3>
          <div v-if="activities.length > 0" class="activity-list">
            <div v-for="activity in activities" :key="activity._id" class="activity-item">
              <div class="activity-header">
                <span class="activity-actor">{{ activity.actorUserId?.name || 'Unknown' }}</span>
                <span class="activity-type">{{ activity.actionType }}</span>
                <span class="activity-time">{{ formatDateTime(activity.createdAt) }}</span>
              </div>
              <div v-if="activity.description" class="activity-description">{{ activity.description }}</div>
            </div>
          </div>
          <div v-else class="empty-state">No activity recorded</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import TmsNativeCalendarField from '../ui/TmsNativeCalendarField.vue';
import * as boardService from '../../services/interviewBoards';
import * as userService from '../../services/users';
import * as profileService from '../../services/profiles';
import { useAuthStore } from '../../composables/useAuth';
import { estToUTC, utcToEST, formatESTDateTime } from '../../utils/timezoneHelpers';

const props = defineProps({
  ticket: {
    type: Object,
    default: null
  },
  boardId: {
    type: String,
    required: true
  },
  stages: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['close', 'updated', 'deleted']);

const authStore = useAuthStore();
const isEditing = ref(false);
const saving = ref(false);
const users = ref([]);
const jobProfiles = ref([]);
const activities = ref([]);
const tagsInput = ref('');
const scheduleDate = ref('');
const scheduleTime = ref('');
const durationMinutes = ref(60);
const editForm = ref({
  companyName: '',
  position: '',
  candidateUserId: '',
  stageId: '',
  priority: 'medium',
  status: 'active',
  jobProfileId: '',
  notes: '',
  tags: []
});

const canEdit = computed(() => {
  // Collaborators can edit if board is shared
  // For now, assume user can edit if they can see the ticket
  return true; // Can be enhanced with permission checks
});
const buildScheduledAt = () => {
  // Convert EST time to UTC for database storage
  return estToUTC(scheduleDate.value, scheduleTime.value);
};
  
const canDelete = computed(() => {
  // All members with board access can delete tickets
  // This is checked via canEdit prop which is passed from parent
  return canEdit.value;
});
const formatDateTime = (date) => {
  if (!date) return 'N/A';
  return formatESTDateTime(date, true);
};
// const formatDateTime = (date) => {
//   if (!date) return 'N/A';
//   return (date).toLocaleString();
// };

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const loadUsers = async () => {
  try {
    const response = await userService.fetchUsers();
    if (response.ok && response.data) {
      users.value = response.data.users || [];
    }
  } catch (err) {
    console.error('Failed to load users:', err);
  }
};

const loadJobProfiles = async () => {
  try {
    const response = await profileService.listProfiles({ type: 'job' });
    if (response.ok && response.data) {
      jobProfiles.value = response.data.profiles || [];
    }
  } catch (err) {
    console.error('Failed to load job profiles:', err);
  }
};

const loadActivity = async () => {
  if (!props.ticket?._id) return;
  try {
    const response = await boardService.fetchTicketActivity(props.boardId, props.ticket._id);
    if (response.ok && response.data) {
      activities.value = response.data.activities || [];
    }
  } catch (err) {
    console.error('Failed to load activity:', err);
  }
};

const getCandidateDisplayName = (ticket) => {
  if (!ticket) return '';
  // If candidateUserId exists, find the user and return their name
  if (ticket.candidateUserId) {
    const user = users.value.find(u => {
      const userId = u._id || u.id;
      const ticketUserId = ticket.candidateUserId?._id || ticket.candidateUserId;
      return userId && ticketUserId && userId.toString() === ticketUserId.toString();
    });
    if (user) return user.name || user.email;
  }
  // Fallback to candidateName for backward compatibility
  return ticket.candidateName || '';
};

const getSelectedStageColor = () => {
  if (!editForm.value.stageId) return '';
  const stage = props.stages.find(s => s._id === editForm.value.stageId);
  return stage?.color || '#3498db';
};

const getSelectedStageName = () => {
  if (!editForm.value.stageId) return '';
  const stage = props.stages.find(s => s._id === editForm.value.stageId);
  return stage?.name || '';
};

const handleUpdate = async () => {
  saving.value = true;
  try {
    // Parse tags
    editForm.value.tags = tagsInput.value
      ? tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag)
      : [];
    
    // Get candidate name from selected user if candidateUserId is set
    const selectedUser = editForm.value.candidateUserId 
      ? users.value.find(u => (u._id || u.id) === editForm.value.candidateUserId)
      : null;
    const candidateName = selectedUser ? (selectedUser.name || selectedUser.email) : '';
    
    const payload = {
      ...editForm.value,
      candidateName, // Include candidateName for backward compatibility
      dates: [{
        scheduledAt: buildScheduledAt(),
        durationMinutes: durationMinutes.value
      }]
    };
    const response = await boardService.updateInterviewTicket(props.boardId, props.ticket._id, payload);
    if (response.ok) {
      emit('updated', response.data.ticket);
      isEditing.value = false;
    }
  } catch (error) {
    alert(error.response?.data?.message || 'Failed to update ticket');
  } finally {
    saving.value = false;
  }
};

const handleDelete = async () => {
  if (!confirm(`Are you sure you want to delete this ticket? This action cannot be undone.`)) {
    return;
  }

  try {
    const response = await boardService.deleteInterviewTicket(props.boardId, props.ticket._id);
    if (response.ok) {
      emit('deleted');
      close();
    }
  } catch (error) {
    alert(error.response?.data?.message || 'Failed to delete ticket');
  }
};

const handleOverlayClick = () => {
  close();
};

const close = () => {
  isEditing.value = false;
  emit('close');
};

const initializeForm = () => {
  if (!props.ticket) return;
  
  // Extract candidateUserId - handle both object and string formats
  let candidateUserId = '';
  
  if (props.ticket.candidateUserId) {
    // Handle both object format (candidateUserId._id) and string format
    const ticketCandidateId = props.ticket.candidateUserId._id || props.ticket.candidateUserId || '';
    
    if (ticketCandidateId && users.value.length > 0) {
      // Convert to string for comparison
      const ticketUserIdStr = ticketCandidateId.toString();
      
      // Find matching user in the users array
      const matchedUser = users.value.find(u => {
        const userId = (u._id || u.id);
        if (!userId) return false;
        // Compare as strings to handle ObjectId comparison issues
        return userId.toString() === ticketUserIdStr;
      });
      
      if (matchedUser) {
        // Use the exact same format as the select option value (string)
        candidateUserId = String(matchedUser._id || matchedUser.id);
      }
    } else if (props.ticket.candidateName && users.value.length > 0) {
      // Fallback: try to match by name/email if candidateUserId not found
      const matchedByName = users.value.find(u => 
        (u.name === props.ticket.candidateName || u.email === props.ticket.candidateName)
      );
      if (matchedByName) {
        candidateUserId = String(matchedByName._id || matchedByName.id);
      }
    } else if (ticketCandidateId) {
      // If users not loaded yet, store the raw value as string
      candidateUserId = String(ticketCandidateId);
    }
  }
  
  editForm.value = {
    companyName: props.ticket.companyName || '',
    position: props.ticket.position || '',
    candidateUserId: candidateUserId,
    stageId: props.ticket.stageId?._id || props.ticket.stageId || '',
    priority: props.ticket.priority || 'medium',
    status: props.ticket.status || 'active',
    jobProfileId: props.ticket.jobProfileId?._id || props.ticket.jobProfileId || '',
    notes: props.ticket.notes || '',
    tags: props.ticket.tags || []
  };
  tagsInput.value = props.ticket.tags ? props.ticket.tags.join(', ') : '';
  const primaryDate = props.ticket.dates?.[props.ticket.primaryDateIndex || 0];
  if (primaryDate) {
    // Convert UTC to EST for display
    const est = utcToEST(primaryDate.scheduledAt);
    if (est) {
      scheduleDate.value = est.date;
      scheduleTime.value = est.time;
    }
    durationMinutes.value = primaryDate.durationMinutes || 60;
  }
};

watch(() => props.ticket, (newTicket) => {
  if (newTicket) {
    // Initialize form - it will handle users loading state
    initializeForm();
    loadActivity();
  }
}, { immediate: true });

// Watch for users to be loaded and re-initialize form to set candidate selection
watch(() => users.value, (newUsers) => {
  if (newUsers.length > 0 && props.ticket) {
    // Re-initialize form once users are loaded to set candidate selection
    initializeForm();
  }
}, { deep: true });

onMounted(() => {
  loadUsers();
  loadJobProfiles();
  if (props.ticket) {
    loadActivity();
  }
});
</script>

<style scoped>
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
  animation: fadeIn 0.2s;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.drawer {
  width: 600px;
  max-width: 600px;
  background: var(--bg-primary);
  height: 100%;
  overflow-y: auto;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.2);
  animation: slideIn 0.3s;
}

@media (max-width: 700px) {
  .drawer {
    width: calc(100vw - 40px);
    max-width: calc(100vw - 40px);
  }
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
  }

  to {
    transform: translateX(0);
  }
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
  position: sticky;
  top: 0;
  background: white;
  z-index: 10;
}

.header-left {
  flex: 1;
}

.drawer-header h2 {
  margin: 0 0 4px 0;
  font-size: 1.3rem;
  color: #2c3e50;
}

.position-subtitle {
  font-size: 0.9rem;
  color: #7f8c8d;
  font-style: italic;
}

.header-right {
  display: flex;
  gap: 8px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #7f8c8d;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.close-btn:hover {
  background: #ecf0f1;
}

.btn-edit {
  padding: 8px 16px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.btn-edit:hover {
  background: #2980b9;
}

.drawer-content {
  padding: 20px;
}

.section {
  margin-bottom: 30px;
}

.section h3 {
  font-size: 1.1rem;
  color: #2c3e50;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e0e0e0;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item label {
  font-size: 0.85rem;
  color: #7f8c8d;
  font-weight: 500;
}

.status-badge,
.priority-badge,
.stage-badge {
  font-size: 0.75rem;
  padding: 4px 8px;
  border-radius: 4px;
  display: inline-block;
  text-transform: capitalize;
  font-weight: 500;
}

.status-active {
  background: #d5f4e6;
  color: #27ae60;
}

.status-completed {
  background: #d5e8f7;
  color: #3498db;
}

.status-cancelled {
  background: #fadbd8;
  color: #e74c3c;
}

.status-on_hold {
  background: #fdebd0;
  color: #f39c12;
}

.priority-low {
  background: #ecf0f1;
  color: #7f8c8d;
}

.priority-medium {
  background: #3498db;
  color: white;
}

.priority-high {
  background: #f39c12;
  color: white;
}

.priority-urgent {
  background: #e74c3c;
  color: white;
}

.stage-badge {
  background: #e8eaf6;
  color: #3f51b5;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group label {
  font-size: 0.9rem;
  color: #2c3e50;
  font-weight: 500;
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

.stage-select {
  position: relative;
}

.stage-select-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  font-size: 0.9rem;
}

.stage-color-indicator {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: inline-block;
  border: 2px solid var(--border-medium);
  flex-shrink: 0;
}

.stage-name-preview {
  color: var(--text-primary);
  font-weight: 500;
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.btn-save {
  padding: 10px 20px;
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.btn-save:hover:not(:disabled) {
  background: #229954;
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-delete {
  padding: 10px 20px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.btn-delete:hover {
  background: #c0392b;
}

.delete-section {
  border-top: 2px solid var(--border-light);
  padding-top: 20px;
}

.btn-delete-full {
  width: 100%;
  background: var(--color-error);
  color: var(--text-inverse);
  padding: 12px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.95rem;
  transition: background 0.2s;
}

.btn-delete-full:hover {
  background: var(--color-error-dark);
}

.dates-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.date-item {
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 3px solid #3498db;
}

.date-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.date-label {
  font-weight: 600;
  color: #2c3e50;
}

.date-status {
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 3px;
  text-transform: capitalize;
}

.date-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
  color: #7f8c8d;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-chip {
  background: #ecf0f1;
  color: #2c3e50;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
}

.notes-text {
  color: #7f8c8d;
  line-height: 1.6;
  white-space: pre-wrap;
}

.attachments-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.attachments-list li {
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 8px;
}

.attachments-list a {
  color: #3498db;
  text-decoration: none;
}

.attachments-list a:hover {
  text-decoration: underline;
}

.file-size {
  color: #7f8c8d;
  font-size: 0.85rem;
  margin-left: 8px;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.activity-item {
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 3px solid #3498db;
}

.activity-header {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 4px;
}

.activity-actor {
  font-weight: 600;
  color: #2c3e50;
}

.activity-type {
  font-size: 0.75rem;
  color: #7f8c8d;
  background: #ecf0f1;
  padding: 2px 6px;
  border-radius: 3px;
}

.activity-time {
  font-size: 0.75rem;
  color: #7f8c8d;
  margin-left: auto;
}

.activity-description {
  font-size: 0.85rem;
  color: #7f8c8d;
  margin-top: 4px;
}

.empty-state {
  text-align: center;
  color: #95a5a6;
  font-style: italic;
  padding: 20px;
}
</style>
