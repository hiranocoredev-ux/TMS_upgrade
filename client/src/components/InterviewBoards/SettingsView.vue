<template>
  <div class="settings-view">
    <div class="settings-header">
      <h2>Board Settings</h2>
      <p class="settings-subtitle">Manage stages for this interview board</p>
    </div>

    <!-- Stages Section -->
    <div class="settings-section">
      <div class="section-header">
        <h3>Stages</h3>
        <button v-if="canEdit" @click="openCreateStageModal" class="btn-add-stage">
          + Add Stage
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading stages...</p>
      </div>

      <!-- Stages List -->
      <div v-else-if="stages.length > 0" class="stages-list">
        <div
          v-for="(stage, index) in stages"
          :key="stage._id"
          class="stage-item"
          :style="{ borderLeft: `4px solid ${stage.color || '#3498db'}` }"
        >
          <div class="stage-content">
            <div class="stage-info">
              <div class="stage-header">
                <span class="stage-color-indicator" :style="{ backgroundColor: stage.color || '#3498db' }"></span>
                <h4 class="stage-name">{{ stage.name }}</h4>
                <span class="stage-order">Order: {{ stage.order || index }}</span>
              </div>
              <p v-if="stage.description" class="stage-description">{{ stage.description }}</p>
              <div class="stage-meta">
                <span class="ticket-count">
                  {{ getTicketCount(stage._id) }} ticket(s)
                </span>
              </div>
            </div>
            <div v-if="canEdit" class="stage-actions">
              <button @click="handleEditStage(stage)" class="btn-edit" title="Edit Stage">
                ✏️ Edit
              </button>
              <button @click="handleDeleteStage(stage)" class="btn-delete" title="Delete Stage">
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <p>No stages found. Click "Add Stage" to create one.</p>
      </div>
    </div>

    <!-- Create Stage Modal -->
    <div v-if="showCreateStageModal" class="modal-overlay">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>Create Stage</h2>
          <button @click="closeCreateStageModal" class="close-btn">✕</button>
        </div>
        <div class="modal-content">
          <form @submit.prevent="handleCreateStage">
            <div class="form-group">
              <label>Stage Name *</label>
              <input v-model="stageForm.name" type="text" required placeholder="e.g., Phone Screen" maxlength="100" />
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea v-model="stageForm.description" rows="3" placeholder="Optional description..."></textarea>
            </div>
            <div class="form-group">
              <label>Color</label>
              <div class="color-input-group">
                <input v-model="stageForm.color" type="color" />
                <input v-model="stageForm.color" type="text" placeholder="#3498db" class="color-text-input" />
              </div>
            </div>
            <div class="form-actions">
              <button type="button" @click="closeCreateStageModal" class="btn-cancel">Cancel</button>
              <button type="submit" :disabled="savingStage" class="btn-save">
                {{ savingStage ? 'Creating...' : 'Create Stage' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Edit Stage Modal -->
    <div v-if="showEditStageModal && editingStage" class="modal-overlay">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>Edit Stage</h2>
          <button @click="closeEditStageModal" class="close-btn">✕</button>
        </div>
        <div class="modal-content">
          <form @submit.prevent="handleUpdateStage">
            <div class="form-group">
              <label>Stage Name *</label>
              <input v-model="stageForm.name" type="text" required placeholder="e.g., Phone Screen" maxlength="100" />
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea v-model="stageForm.description" rows="3" placeholder="Optional description..."></textarea>
            </div>
            <div class="form-group">
              <label>Color</label>
              <div class="color-input-group">
                <input v-model="stageForm.color" type="color" />
                <input v-model="stageForm.color" type="text" placeholder="#3498db" class="color-text-input" />
              </div>
            </div>
            <div class="form-actions">
              <button type="button" @click="closeEditStageModal" class="btn-cancel">Cancel</button>
              <button type="submit" :disabled="savingStage" class="btn-save">
                {{ savingStage ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Delete Stage Confirmation Modal -->
    <div v-if="showDeleteStageModal && deletingStage" class="modal-overlay">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>Delete Stage</h2>
          <button @click="closeDeleteStageModal" class="close-btn">✕</button>
        </div>
        <div class="modal-content">
          <div v-if="deleteStageError" class="error-message">
            {{ deleteStageError }}
          </div>
          <p>Are you sure you want to delete the stage <strong>"{{ deletingStage.name }}"</strong>?</p>
          <p v-if="getTicketCount(deletingStage._id) > 0" class="warning-message">
            ⚠️ This stage has {{ getTicketCount(deletingStage._id) }} ticket(s).
            Please move or delete all tickets before deleting this stage.
          </p>
          <div class="form-actions">
            <button type="button" @click="closeDeleteStageModal" class="btn-cancel">Cancel</button>
            <button type="button" @click="confirmDeleteStage"
              :disabled="deletingStageLoading || getTicketCount(deletingStage._id) > 0" class="btn-delete">
              {{ deletingStageLoading ? 'Deleting...' : 'Delete Stage' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import * as boardService from '../../services/interviewBoards';

const props = defineProps({
  boardId: {
    type: String,
    required: true
  },
  stages: {
    type: Array,
    default: () => []
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

const emit = defineEmits(['stage-updated']);

const loading = ref(false);
const showCreateStageModal = ref(false);
const showEditStageModal = ref(false);
const showDeleteStageModal = ref(false);
const editingStage = ref(null);
const deletingStage = ref(null);
const savingStage = ref(false);
const deletingStageLoading = ref(false);
const deleteStageError = ref(null);

const stageForm = ref({
  name: '',
  description: '',
  color: '#3498db'
});

const getTicketCount = (stageId) => {
  return props.tickets.filter(ticket => {
    const ticketStageId = ticket.stageId?._id || ticket.stageId;
    return ticketStageId === stageId;
  }).length;
};

const openCreateStageModal = () => {
  stageForm.value = {
    name: '',
    description: '',
    color: '#3498db'
  };
  showCreateStageModal.value = true;
};

const closeCreateStageModal = () => {
  showCreateStageModal.value = false;
  stageForm.value = {
    name: '',
    description: '',
    color: '#3498db'
  };
};

const handleCreateStage = async () => {
  savingStage.value = true;
  try {
    const response = await boardService.createStage(props.boardId, stageForm.value);
    if (response.ok) {
      emit('stage-updated');
      closeCreateStageModal();
    } else {
      alert(response.message || 'Failed to create stage');
    }
  } catch (err) {
    alert(err.response?.data?.message || 'Failed to create stage');
    console.error('Error creating stage:', err);
  } finally {
    savingStage.value = false;
  }
};

const handleEditStage = (stage) => {
  editingStage.value = stage;
  stageForm.value = {
    name: stage.name || '',
    description: stage.description || '',
    color: stage.color || '#3498db'
  };
  showEditStageModal.value = true;
};

const closeEditStageModal = () => {
  showEditStageModal.value = false;
  editingStage.value = null;
  stageForm.value = {
    name: '',
    description: '',
    color: '#3498db'
  };
};

const handleUpdateStage = async () => {
  if (!editingStage.value) return;

  savingStage.value = true;
  try {
    const response = await boardService.updateStage(
      props.boardId,
      editingStage.value._id,
      stageForm.value
    );
    if (response.ok) {
      emit('stage-updated');
      closeEditStageModal();
    } else {
      alert(response.message || 'Failed to update stage');
    }
  } catch (err) {
    alert(err.response?.data?.message || 'Failed to update stage');
    console.error('Error updating stage:', err);
  } finally {
    savingStage.value = false;
  }
};

const handleDeleteStage = (stage) => {
  deletingStage.value = stage;
  deleteStageError.value = null;
  showDeleteStageModal.value = true;
};

const closeDeleteStageModal = () => {
  showDeleteStageModal.value = false;
  deletingStage.value = null;
  deleteStageError.value = null;
};

const confirmDeleteStage = async () => {
  if (!deletingStage.value) return;

  const ticketCount = getTicketCount(deletingStage.value._id);
  if (ticketCount > 0) {
    deleteStageError.value = `Cannot delete stage with ${ticketCount} ticket(s). Please move or delete tickets first.`;
    return;
  }

  deletingStageLoading.value = true;
  deleteStageError.value = null;

  try {
    const response = await boardService.deleteStage(props.boardId, deletingStage.value._id);
    if (response.ok) {
      emit('stage-updated');
      closeDeleteStageModal();
    } else {
      deleteStageError.value = response.message || 'Failed to delete stage';
    }
  } catch (err) {
    const errorMessage = err.response?.data?.message || 'Failed to delete stage';
    deleteStageError.value = errorMessage;

    if (err.response?.data?.code === 'STAGE_HAS_TICKETS') {
      // Error already handled by backend
    }

    console.error('Error deleting stage:', err);
  } finally {
    deletingStageLoading.value = false;
  }
};
</script>

<style scoped>
.settings-view {
  padding: 24px;
  background: var(--bg-primary);
  border-radius: 8px;
}

.settings-header {
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--border-light);
}

.settings-header h2 {
  margin: 0 0 8px 0;
  font-size: 1.5rem;
  color: var(--text-primary);
}

.settings-subtitle {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.settings-section {
  margin-bottom: 32px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h3 {
  margin: 0;
  font-size: 1.2rem;
  color: var(--text-primary);
}

.btn-add-stage {
  padding: 8px 16px;
  background: var(--color-primary);
  color: var(--text-inverse);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-add-stage:hover {
  background: var(--color-primary-dark);
}

.stages-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stage-item {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 20px;
  transition: all 0.2s;
  box-shadow: var(--shadow-sm);
}

.stage-item:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.stage-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.stage-info {
  flex: 1;
}

.stage-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.stage-color-indicator {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--border-medium);
  flex-shrink: 0;
}

.stage-name {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.stage-order {
  color: var(--text-secondary);
  font-size: 0.85rem;
  background: var(--bg-tertiary);
  padding: 4px 8px;
  border-radius: 4px;
}

.stage-description {
  margin: 8px 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}

.stage-meta {
  margin-top: 12px;
}

.ticket-count {
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

.stage-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.btn-edit,
.btn-delete {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn-edit {
  background: var(--color-info);
  color: var(--text-inverse);
}

.btn-edit:hover {
  background: var(--color-info-dark);
}

.btn-delete {
  background: var(--color-error);
  color: var(--text-inverse);
}

.btn-delete:hover:not(:disabled) {
  background: var(--color-error-dark);
}

.btn-delete:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-tertiary);
}

.loading-state {
  text-align: center;
  padding: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.spinner {
  border: 3px solid var(--bg-tertiary);
  border-top: 3px solid var(--color-info);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-primary);
  border-radius: 8px;
  width: 500px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-light);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-light);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.3rem;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-tertiary);
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: var(--bg-tertiary);
}

.modal-content {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border-medium);
  border-radius: 4px;
  font-size: 0.95rem;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

.color-input-group {
  display: flex;
  gap: 12px;
  align-items: center;
}

.color-input-group input[type="color"] {
  width: 60px;
  height: 40px;
  padding: 2px;
  border: 1px solid var(--border-medium);
  border-radius: 4px;
  cursor: pointer;
}

.color-text-input {
  flex: 1;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.btn-cancel {
  padding: 10px 20px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-cancel:hover {
  background: var(--bg-secondary);
}

.btn-save {
  padding: 10px 20px;
  background: var(--color-success);
  color: var(--text-inverse);
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-save:hover:not(:disabled) {
  background: var(--color-success-dark);
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-delete {
  padding: 10px 20px;
  background: var(--color-error);
  color: var(--text-inverse);
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-delete:hover:not(:disabled) {
  background: var(--color-error-dark);
}

.btn-delete:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  background: var(--color-error-bg);
  border: 1px solid var(--color-error);
  color: var(--color-error);
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 16px;
  border-left: 4px solid var(--color-error);
}

.warning-message {
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning);
  color: var(--color-warning);
  padding: 12px;
  border-radius: 4px;
  margin: 12px 0;
  border-left: 4px solid var(--color-warning);
}
</style>

