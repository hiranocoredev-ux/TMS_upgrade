<template>
  <div v-if="ticket" class="drawer-overlay" @click="handleOverlayClick">
    <div class="drawer" @click.stop>
      <div class="drawer-header">
        <h2>{{ ticket.title }}</h2>
        <button @click="close" class="close-btn">✕</button>
      </div>

      <div class="drawer-content">
        <!-- Edit Mode Toggle -->
        <div class="section-header">
          <button @click="isEditing = !isEditing" class="btn-edit">
            {{ isEditing ? 'Cancel Edit' : 'Edit' }}
          </button>
        </div>

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
              <span class="stage-badge">{{ formatStage(ticket.currentStage) }}</span>
            </div>
            <div class="info-item">
              <label>Priority</label>
              <span :class="['priority-badge', `priority-${ticket.priority}`]">{{ ticket.priority }}</span>
            </div>
            <div class="info-item">
              <label>Job Profile</label>
              <span>{{ ticket.jobProfileId?.name || 'None' }}</span>
            </div>
            <div class="info-item">
              <label>Platform</label>
              <span>{{ ticket.platformSource || 'N/A' }}</span>
            </div>
            <div class="info-item">
              <label>Client</label>
              <span>{{ ticket.clientName || 'N/A' }}</span>
            </div>
            <div class="info-item">
              <label>Job URL</label>
              <a v-if="ticket.jobUrl" :href="ticket.jobUrl" target="_blank" rel="noopener noreferrer">
                View Job Posting
              </a>
              <span v-else>N/A</span>
            </div>
          </div>

          <!-- Edit Form -->
          <form v-else @submit.prevent="handleUpdate" class="edit-form">
            <div class="form-row">
              <div class="form-group">
                <label>Title *</label>
                <input v-model="editForm.title" type="text" required />
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
                <label>Platform</label>
                <input v-model="editForm.platformSource" type="text" />
              </div>
              <div class="form-group">
                <label>Client Name</label>
                <input v-model="editForm.clientName" type="text" />
              </div>
            </div>
            <div class="form-group">
              <label>Job URL</label>
              <input v-model="editForm.jobUrl" type="url" />
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea v-model="editForm.descriptionRichText" rows="4"></textarea>
            </div>
            <div class="form-actions">
              <button type="submit" :disabled="saving" class="btn-save">Save Changes</button>
            </div>
          </form>
        </div>

        <!-- Dates & Financial -->
        <div class="section">
          <h3>Dates & Financial</h3>
          <div class="info-grid">
            <div class="info-item">
              <label>Bid Date</label>
              <span>{{ formatDate(ticket.bidDate) }}</span>
            </div>
            <div class="info-item">
              <label>Bid Amount</label>
              <span>{{ ticket.bidAmount ? `$${ticket.bidAmount.toLocaleString()}` : 'N/A' }}</span>
            </div>
            <div class="info-item">
              <label>Follow-up Date</label>
              <span>{{ formatDate(ticket.followUpDate) }}</span>
            </div>
            <div class="info-item">
              <label>Created</label>
              <span>{{ formatDate(ticket.createdAt) }}</span>
            </div>
          </div>
        </div>

        <!-- Tags -->
        <div v-if="ticket.tags && ticket.tags.length > 0" class="section">
          <h3>Tags</h3>
          <div class="tags-list">
            <span v-for="tag in ticket.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>

        <!-- Attachments -->
        <div v-if="ticket.attachments && ticket.attachments.length > 0" class="section">
          <h3>Attachments</h3>
          <div class="attachments-list">
            <a
              v-for="file in ticket.attachments"
              :key="file._id"
              :href="`/api/files/${file._id}/download`"
              target="_blank"
              class="attachment-item"
            >
              📎 {{ file.originalName }}
              <span class="file-size">({{ formatFileSize(file.size) }})</span>
            </a>
          </div>
        </div>

        <!-- Stage History Timeline -->
        <div v-if="ticket.stageHistory && ticket.stageHistory.length > 0" class="section">
          <h3>Stage History</h3>
          <div class="timeline">
            <div
              v-for="(entry, index) in sortedStageHistory"
              :key="index"
              class="timeline-item"
            >
              <div class="timeline-dot"></div>
              <div class="timeline-content">
                <div class="timeline-header">
                  <span class="timeline-stage">{{ formatStage(entry.fromStage) }} → {{ formatStage(entry.toStage) }}</span>
                  <span class="timeline-date">{{ formatDateTime(entry.changedAt) }}</span>
                </div>
                <div v-if="entry.changedByUserId" class="timeline-user">
                  Changed by: {{ entry.changedByUserId.name || entry.changedByUserId.email }}
                </div>
                <div v-if="entry.reason" class="timeline-reason">
                  {{ entry.reason }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Linked Interviews -->
        <div class="section">
          <h3>Linked Interviews ({{ interviews.length }})</h3>
          <div v-if="interviews.length > 0" class="interviews-list">
            <div v-for="interview in interviews" :key="interview._id" class="interview-item">
              <div class="interview-header">
                <span class="interview-date">{{ formatDateTime(interview.scheduledAt) }}</span>
                <span v-if="interview.durationMinutes" class="interview-duration">
                  {{ interview.durationMinutes }} min
                </span>
              </div>
              <div v-if="interview.interviewType" class="interview-type">
                {{ interview.interviewType }}
              </div>
              <div v-if="interview.participants" class="interview-participants">
                Participants: {{ interview.participants }}
              </div>
              <div v-if="interview.meetingLink" class="interview-link">
                <a :href="interview.meetingLink" target="_blank" rel="noopener noreferrer">
                  Meeting Link
                </a>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            No interviews linked to this ticket
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import apiClient from '../../services/axios';

const props = defineProps({
  ticket: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close', 'updated']);

const isEditing = ref(false);
const saving = ref(false);
const interviews = ref([]);
const loadingInterviews = ref(false);

const editForm = ref({
  title: '',
  priority: 'medium',
  platformSource: '',
  clientName: '',
  jobUrl: '',
  descriptionRichText: ''
});

const sortedStageHistory = computed(() => {
  if (!props.ticket?.stageHistory) return [];
  return [...props.ticket.stageHistory].sort((a, b) => 
    new Date(b.changedAt) - new Date(a.changedAt)
  );
});

const formatStage = (stage) => {
  if (!stage) return '';
  return stage.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString();
};

const formatDateTime = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString();
};

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const loadInterviews = async () => {
  if (!props.ticket?._id) return;
  
  loadingInterviews.value = true;
  try {
    const response = await apiClient.get('/interviews', {
      params: { jobTicketId: props.ticket._id, limit: 100 }
    });
    if (response.data.ok && response.data.data) {
      interviews.value = response.data.data.interviews || [];
    }
  } catch (error) {
    console.error('Failed to load interviews:', error);
    interviews.value = [];
  } finally {
    loadingInterviews.value = false;
  }
};

const handleUpdate = async () => {
  saving.value = true;
  try {
    const response = await apiClient.put(`/job-tickets/${props.ticket._id}`, editForm.value);
    if (response.data.ok) {
      emit('updated', response.data.data.ticket);
      isEditing.value = false;
    }
  } catch (error) {
    alert(error.response?.data?.message || 'Failed to update ticket');
  } finally {
    saving.value = false;
  }
};

const handleOverlayClick = () => {
  close();
};

const close = () => {
  isEditing.value = false;
  emit('close');
};

watch(() => props.ticket, (newTicket) => {
  if (newTicket) {
    editForm.value = {
      title: newTicket.title || '',
      priority: newTicket.priority || 'medium',
      platformSource: newTicket.platformSource || '',
      clientName: newTicket.clientName || '',
      jobUrl: newTicket.jobUrl || '',
      descriptionRichText: newTicket.descriptionRichText || ''
    };
    loadInterviews();
  }
}, { immediate: true });

onMounted(() => {
  if (props.ticket) {
    loadInterviews();
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
  from { opacity: 0; }
  to { opacity: 1; }
}

.drawer {
  width: 500px;
  max-width: 500px;
  background: var(--bg-primary);
  height: 100%;
  overflow-y: auto;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.2);
  animation: slideIn 0.3s;
}

@media (max-width: 600px) {
  .drawer {
    width: calc(100vw - 40px);
    max-width: calc(100vw - 40px);
  }
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
  position: sticky;
  top: 0;
  background: white;
  z-index: 10;
}

.drawer-header h2 {
  margin: 0;
  font-size: 1.3rem;
  color: #2c3e50;
  flex: 1;
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

.drawer-content {
  padding: 20px;
}

.section {
  margin-bottom: 30px;
}

.section-header {
  margin-bottom: 16px;
}

.btn-edit {
  padding: 8px 16px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-edit:hover {
  background: #2980b9;
}

.section h3 {
  font-size: 1.1rem;
  color: #2c3e50;
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 2px solid #ecf0f1;
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
  font-weight: 500;
  color: #7f8c8d;
}

.info-item span,
.info-item a {
  font-size: 0.95rem;
  color: #2c3e50;
}

.info-item a {
  color: #3498db;
  text-decoration: none;
}

.info-item a:hover {
  text-decoration: underline;
}

.status-badge,
.stage-badge,
.priority-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
}

.status-open {
  background: #2ecc71;
  color: white;
}

.status-closed {
  background: #95a5a6;
  color: white;
}

.stage-badge {
  background: #3498db;
  color: white;
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
  gap: 6px;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 500;
  color: #2c3e50;
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
  font-family: inherit;
}

.form-group textarea {
  resize: vertical;
}

.form-actions {
  margin-top: 8px;
}

.btn-save {
  padding: 10px 20px;
  background: #2ecc71;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-save:hover:not(:disabled) {
  background: #27ae60;
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  background: #ecf0f1;
  color: #2c3e50;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
}

.attachments-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 4px;
  text-decoration: none;
  color: #2c3e50;
  transition: background 0.2s;
}

.attachment-item:hover {
  background: #ecf0f1;
}

.file-size {
  color: #7f8c8d;
  font-size: 0.85rem;
}

.timeline {
  position: relative;
  padding-left: 24px;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #e0e0e0;
}

.timeline-item {
  position: relative;
  margin-bottom: 24px;
}

.timeline-dot {
  position: absolute;
  left: -20px;
  top: 4px;
  width: 12px;
  height: 12px;
  background: #3498db;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 0 0 2px #e0e0e0;
}

.timeline-content {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 4px;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.timeline-stage {
  font-weight: 600;
  color: #2c3e50;
}

.timeline-date {
  font-size: 0.85rem;
  color: #7f8c8d;
}

.timeline-user {
  font-size: 0.85rem;
  color: #7f8c8d;
  margin-bottom: 4px;
}

.timeline-reason {
  font-size: 0.9rem;
  color: #2c3e50;
  margin-top: 4px;
}

.interviews-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.interview-item {
  padding: 12px;
  background: #f8f9fa;
  border-radius: 4px;
  border-left: 3px solid #9b59b6;
}

.interview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.interview-date {
  font-weight: 600;
  color: #2c3e50;
}

.interview-duration {
  font-size: 0.85rem;
  color: #7f8c8d;
}

.interview-type {
  font-weight: 500;
  color: #2c3e50;
  margin-bottom: 4px;
}

.interview-participants {
  font-size: 0.85rem;
  color: #7f8c8d;
  margin-bottom: 4px;
}

.interview-link a {
  color: #3498db;
  text-decoration: none;
  font-size: 0.85rem;
}

.interview-link a:hover {
  text-decoration: underline;
}

.empty-state {
  text-align: center;
  padding: 20px;
  color: #95a5a6;
  font-style: italic;
}
</style>

