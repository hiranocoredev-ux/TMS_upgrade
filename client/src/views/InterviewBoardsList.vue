<template>
  <div class="interview-boards-list">
    <div class="page-header">
      <h1>Interview Boards</h1>
      <button @click="openCreateModal" class="btn-create">+ Create Board</button>
    </div>

    <!-- Loading State -->
    <div v-if="loading && boards.length === 0" class="loading-state">
      <div class="spinner"></div>
      <p>Loading boards...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error && boards.length === 0" class="error-state">
      <p>{{ error }}</p>
      <button @click="loadBoards" class="btn-retry">Retry</button>
    </div>

    <!-- Boards List -->
    <div v-else class="boards-grid">
      <div v-for="board in boards" :key="board._id" class="board-card" @click="openBoard(board._id)">
        <div class="board-header">
          <h3 class="board-title">{{ board.title }}</h3>
          <div class="board-actions" @click.stop>
            <button @click="openEditModal(board)" class="btn-icon" title="Edit">
              ✏️
            </button>
            <button @click="openShareModal(board)" class="btn-icon" title="Share">
              👥
            </button>
            <button v-if="canDelete(board)" @click="confirmDelete(board)" class="btn-icon btn-delete-icon"
              title="Delete">
              🗑️
            </button>
          </div>
        </div>

        <p v-if="board.description" class="board-description">{{ board.description }}</p>

        <div class="board-meta">
          <span :class="['visibility-badge', `visibility-${board.visibility}`]">
            {{ board.visibility }}
          </span>
          <span :class="['status-badge', `status-${board.status}`]">
            {{ board.status }}
          </span>
        </div>

        <div class="board-footer">
          <span class="board-owner">
            <span class="owner-label">Owner:</span> {{ board.ownerUserId?.name || board.ownerUserId?.email }}
          </span>
          <span v-if="board.sharedWith && board.sharedWith.length > 0" class="shared-count">
            Shared with {{ board.sharedWith.length }} user{{ board.sharedWith.length > 1 ? 's' : '' }}
          </span>
        </div>
      </div>

      <div v-if="boards.length === 0" class="empty-state">
        <p>No boards found. Create your first interview board to get started!</p>
        <button @click="openCreateModal" class="btn-create">Create Board</button>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>{{ editingBoard ? 'Edit Board' : 'Create Board' }}</h2>
          <button @click="closeModal" class="close-btn">×</button>
        </div>
        <div class="modal-content">
          <form @submit.prevent="handleSubmit">
            <div class="form-group">
              <label>Title *</label>
              <input v-model="form.title" type="text" required placeholder="e.g., Frontend Developer Interviews" />
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea v-model="form.description" rows="3" placeholder="Optional board description..."></textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Visibility</label>
                <select v-model="form.visibility">
                  <option value="private">Private (Only me)</option>
                  <option value="shared">Shared (Selected users)</option>
                  <option value="team">Team (All members)</option>
                </select>
              </div>
              <div class="form-group">
                <label>Status</label>
                <select v-model="form.status">
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <div class="form-actions">
              <button type="button" @click="closeModal" class="btn-cancel">Cancel</button>
              <button type="submit" :disabled="saving" class="btn-save">
                {{ saving ? 'Saving...' : (editingBoard ? 'Update' : 'Create') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Share Modal -->
    <div v-if="showShareModal" class="modal-overlay" @click="closeShareModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>Share Board: {{ sharingBoard?.title }}</h2>
          <button @click="closeShareModal" class="close-btn">×</button>
        </div>
        <div class="modal-content">
          <div class="form-group">
            <label>Visibility</label>
            <select v-model="shareForm.visibility" @change="handleVisibilityChange">
              <option value="private">Private (Only me)</option>
              <option value="shared">Shared (Selected users)</option>
              <option value="team">Team (All members)</option>
            </select>
          </div>

          <div v-if="shareForm.visibility === 'shared'" class="form-group">
            <label>Share With Users</label>
            <div class="users-list">
              <div v-for="user in availableUsers" :key="user._id || user.id" class="user-checkbox">
                <label>
                  <input type="checkbox" :value="user._id || user.id" v-model="shareForm.sharedWith" />
                  <span>{{ user.name }} ({{ user.email }})</span>
                </label>
              </div>
            </div>
          </div>

          <div class="form-actions">
            <button type="button" @click="closeShareModal" class="btn-cancel">Cancel</button>
            <button @click="handleShareSubmit" :disabled="saving" class="btn-save">
              {{ saving ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../composables/useAuth';
import * as boardService from '../services/interviewBoards';
import * as userService from '../services/users';
import { normalizeRole, ROLES } from '../constants/roles.js';

const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const error = ref(null);
const boards = ref([]);
const users = ref([]);
const showModal = ref(false);
const showShareModal = ref(false);
const editingBoard = ref(null);
const sharingBoard = ref(null);
const saving = ref(false);

const form = ref({
  title: '',
  description: '',
  visibility: 'private',
  status: 'active'
});

const shareForm = ref({
  visibility: 'private',
  sharedWith: []
});

const availableUsers = computed(() => {
  return users.value.filter(user => {
    const userId = user._id || user.id;
    const currentUserId = authStore.user._id || authStore.user.id;
    return userId !== currentUserId;
  });
});

const canDelete = (board) => {
  if (!authStore.user || !board) return false;
  const userRole = normalizeRole(authStore.user.role);
  const isOwner = board.ownerUserId?._id === authStore.user._id || board.ownerUserId === authStore.user._id;
  return isOwner || userRole === ROLES.SUPER_ADMIN;
};

const loadBoards = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await boardService.fetchInterviewBoards();
    if (response.ok && response.data) {
      boards.value = response.data.boards || [];
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to load boards';
    console.error('Error loading boards:', err);
  } finally {
    loading.value = false;
  }
};

const loadUsers = async () => {
  try {
    const response = await userService.fetchUsers();
    if (response.ok && response.data) {
      users.value = excludeSuperAdmin(response.data.users || []);
    }
  } catch (err) {
    console.error('Failed to load users:', err);
  }
};

const openBoard = (boardId) => {
  router.push(`/interview-boards/${boardId}`);
};

const openCreateModal = () => {
  editingBoard.value = null;
  form.value = {
    title: '',
    description: '',
    visibility: 'private',
    status: 'active'
  };
  showModal.value = true;
};

const openEditModal = (board) => {
  editingBoard.value = board;
  form.value = {
    title: board.title || '',
    description: board.description || '',
    visibility: board.visibility || 'private',
    status: board.status || 'active'
  };
  showModal.value = true;
};

const openShareModal = (board) => {
  sharingBoard.value = board;
  shareForm.value = {
    visibility: board.visibility || 'private',
    sharedWith: board.sharedWith ? board.sharedWith.map(u => u._id || u) : []
  };
  showShareModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  editingBoard.value = null;
};

const closeShareModal = () => {
  showShareModal.value = false;
  sharingBoard.value = null;
};

const handleVisibilityChange = () => {
  if (shareForm.value.visibility !== 'shared') {
    shareForm.value.sharedWith = [];
  }
};

const handleSubmit = async () => {
  saving.value = true;
  error.value = null;
  try {
    let response;
    if (editingBoard.value) {
      response = await boardService.updateInterviewBoard(editingBoard.value._id, form.value);
    } else {
      response = await boardService.createInterviewBoard(form.value);
    }

    if (response.ok) {
      await loadBoards();
      closeModal();
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to save board';
    console.error('Error saving board:', err);
  } finally {
    saving.value = false;
  }
};

const handleShareSubmit = async () => {
  saving.value = true;
  error.value = null;
  try {
    const response = await boardService.updateInterviewBoard(sharingBoard.value._id, shareForm.value);
    if (response.ok) {
      await loadBoards();
      closeShareModal();
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to update sharing settings';
    console.error('Error updating sharing:', err);
  } finally {
    saving.value = false;
  }
};

const confirmDelete = async (board) => {
  if (confirm(`Are you sure you want to delete the board "${board.title}"? This will delete all stages and tickets.`)) {
    try {
      const response = await boardService.deleteInterviewBoard(board._id);
      if (response.ok) {
        await loadBoards();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete board');
      console.error('Error deleting board:', err);
    }
  }
};

onMounted(async () => {
  await loadUsers();
  await loadBoards();
});
</script>

<style scoped>
.interview-boards-list {
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0;
  font-size: 1.8rem;
  color: #2c3e50;
}

.btn-create {
  padding: 10px 20px;
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-create:hover {
  background: #229954;
}

.loading-state,
.error-state {
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
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.btn-retry {
  padding: 8px 16px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 12px;
}

.boards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.board-card {
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 20px;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid var(--border-light);
}

.board-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  border-color: var(--border-medium);
}

.board-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.board-title {
  margin: 0;
  font-size: 1.2rem;
  color: var(--text-primary);
  flex: 1;
}

.board-actions {
  display: flex;
  gap: 4px;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
  color: var(--text-secondary);
}

.btn-icon:hover {
  background: var(--bg-tertiary);
}

.btn-delete-icon:hover {
  background: rgba(239, 68, 68, 0.2);
}

.board-description {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin: 0 0 12px 0;
  line-height: 1.5;
}

.board-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.visibility-badge,
.status-badge {
  font-size: 0.75rem;
  padding: 4px 8px;
  border-radius: 4px;
  text-transform: capitalize;
  font-weight: 500;
}

.visibility-private {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.visibility-shared {
  background: rgba(99, 102, 241, 0.2);
  color: var(--color-primary);
}

.visibility-team {
  background: rgba(16, 185, 129, 0.2);
  color: var(--color-success);
}

.status-active {
  background: rgba(16, 185, 129, 0.2);
  color: var(--color-success);
}

.status-archived {
  background: rgba(251, 191, 36, 0.2);
  color: var(--color-warning);
}

.board-footer {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
  color: var(--text-secondary);
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
}

.owner-label {
  font-weight: 500;
  color: var(--text-primary);
}

.shared-count {
  color: var(--color-info);
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px 20px;
  color: #7f8c8d;
}

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
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-light);
}

@media (max-width: 550px) {
  .modal {
    width: calc(100vw - 40px);
    max-width: calc(100vw - 40px);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.3rem;
  color: #2c3e50;
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
}

.close-btn:hover {
  background: #ecf0f1;
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
  color: #2c3e50;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.95rem;
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.users-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 12px;
}

.user-checkbox {
  padding: 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.user-checkbox:hover {
  background: #f8f9fa;
}

.user-checkbox label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.btn-cancel {
  padding: 10px 20px;
  background: #ecf0f1;
  color: #2c3e50;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-cancel:hover {
  background: #bdc3c7;
}

.btn-save {
  padding: 10px 20px;
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-save:hover:not(:disabled) {
  background: #229954;
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>