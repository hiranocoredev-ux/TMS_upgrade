<template>
  <div class="interview-board-view">
    <div class="page-header">
      <div class="header-left">
        <button @click="goBack" class="btn-back">← Back</button>
        <div>
          <h1>{{ board?.title || 'Loading...' }}</h1>
          <p v-if="board?.description" class="subtitle">{{ board.description }}</p>
        </div>
      </div>
      <div class="header-right">
        <!-- <button @click="openCreateModal" class="btn-create">+ Create Ticket</button> -->
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading && !board" class="loading-state">
      <div class="spinner"></div>
      <p>Loading board...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error && !board" class="error-state">
      <p>{{ error }}</p>
      <button @click="loadBoard" class="btn-retry">Retry</button>
    </div>

    <!-- View Selector and Content -->
    <div v-else-if="board" class="board-content">
      <ViewSelector :current-view="currentView" @change-view="handleViewChange" />

      <!-- Stage View (Default Kanban) -->
      <div v-if="currentView === 'stage' && stages.length > 0" class="kanban-board">
        <InterviewKanbanColumn v-for="stage in stages" :key="stage._id" :stage="stage"
          :tickets="ticketsByStage[stage._id] || []" :can-edit="canEditBoard" @drop-ticket="handleStageDrop"
          @click-ticket="handleTicketClick" @edit-stage="handleEditStage" @delete-stage="handleDeleteStage" />
      </div>
      <div v-else-if="currentView === 'stage' && stages.length === 0" class="empty-state">
        <p>No stages found. The board should have default stages.</p>
      </div>

      <InterviewBoardTimeGrid v-else-if="currentView === 'time'" :refresh-key="timeViewKey" :board-id="boardId"
        :can-edit="canEditBoard" :users="users" @click-ticket="handleTicketClick"
        @add-ticket-for-day="openCreateModalForDay" @ticket-moved="handleTimeViewChanged" />
      <!-- Company View -->
      <CompanyView v-else-if="currentView === 'company'" :tickets="displayedTickets" :loading="ticketsLoading"
        @click-ticket="handleTicketClick" />

      <!-- Filter View -->
      <FilterView v-else-if="currentView === 'filter'" :tickets="tickets" :stages="stages" :users="users"
        :loading="ticketsLoading" @click-ticket="handleTicketClick" @filters-change="handleFiltersChange" />

      <!-- Settings View -->
      <SettingsView v-else-if="currentView === 'settings'" :board-id="boardId" :stages="stages" :tickets="tickets"
        :can-edit="canEditBoard" @stage-updated="handleStageUpdated" />
    </div>

    <!-- Ticket Detail Drawer -->
    <InterviewTicketDrawer v-if="selectedTicket" :ticket="selectedTicket" :board-id="boardId" :stages="stages"
      @close="selectedTicket = null" @updated="handleTicketUpdated" @deleted="handleTicketDeleted" />

    <!-- Create Ticket Modal -->
    <div v-if="showCreateModal" class="modal-overlay">
      <div class="modal modal-large" @click.stop>
        <div class="modal-header">
          <h2>Create Interview Ticket</h2>
          <button @click="closeCreateModal" class="close-btn">×</button>
        </div>
        <div class="modal-content">
          <form @submit.prevent="handleCreateTicket">
            <div class="form-row">
              <div class="form-group">
                <label>Company Name *</label>
                <input v-model="ticketForm.companyName" type="text" required placeholder="e.g., Tech Corp" />
              </div>
              <div class="form-group">
                <label>Position *</label>
                <input v-model="ticketForm.position" type="text" required
                  placeholder="e.g., Senior Frontend Developer" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Candidate (Member)</label>
                <select v-model="ticketForm.candidateUserId">
                  <option value="">Select a member...</option>
                  <option v-for="user in users" :key="user._id || user.id" :value="user._id || user.id">
                    {{ user.name || user.email }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label>Stage *</label>
                <select v-model="ticketForm.stageId" required class="stage-select">
                  <option value="">Select Stage</option>
                  <option v-for="stage in stages" :key="stage._id" :value="stage._id"
                    :data-color="stage.color || '#3498db'">
                    {{ stage.name }}
                  </option>
                </select>
                <div class="stage-select-preview" v-if="ticketForm.stageId">
                  <span class="stage-color-indicator" :style="{ backgroundColor: getSelectedStageColor() }"></span>
                  <span class="stage-name-preview">{{ getSelectedStageName() }}</span>
                </div>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Priority</label>
                <select v-model="ticketForm.priority">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Job Profile</label>
              <select v-model="ticketForm.jobProfileId">
                <option value="">None</option>
                <option v-for="profile in jobProfiles" :key="profile._id || profile.id"
                  :value="profile._id || profile.id">
                  {{ profile.name }}
                </option>
              </select>
            </div>
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
              <label>Tags (comma-separated)</label>
              <input v-model="ticketForm.tags" type="text" placeholder="e.g., frontend, remote, senior" />
            </div>
            <div class="form-group">
              <label>Notes</label>
              <textarea v-model="ticketForm.notes" rows="3" placeholder="Optional notes..."></textarea>
            </div>
            <div class="form-actions">
              <button type="button" @click="closeCreateModal" class="btn-cancel">Cancel</button>
              <button type="submit" :disabled="saving" class="btn-save">
                {{ saving ? 'Creating...' : 'Create Ticket' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Create Stage Modal -->
    <div v-if="showCreateStageModal" class="modal-overlay" @click="closeCreateStageModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>Create Stage</h2>
          <button @click="closeCreateStageModal" class="close-btn">×</button>
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
              <input v-model="stageForm.color" type="color" />
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
    <div v-if="showEditStageModal && editingStage" class="modal-overlay" @click="closeEditStageModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>Edit Stage</h2>
          <button @click="closeEditStageModal" class="close-btn">×</button>
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
              <input v-model="stageForm.color" type="color" />
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
    <div v-if="showDeleteStageModal && deletingStage" class="modal-overlay" @click="closeDeleteStageModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>Delete Stage</h2>
          <button @click="closeDeleteStageModal" class="close-btn">×</button>
        </div>
        <div class="modal-content">
          <div v-if="deleteStageError" class="error-message">
            {{ deleteStageError }}
          </div>
          <p>Are you sure you want to delete the stage <strong>"{{ deletingStage.name }}"</strong>?</p>
          <p v-if="ticketsByStage[deletingStage._id]?.length > 0" class="warning-message">
            ⚠️ This stage has {{ ticketsByStage[deletingStage._id].length }} ticket(s).
            Please move or delete all tickets before deleting this stage.
          </p>
          <div class="form-actions">
            <button type="button" @click="closeDeleteStageModal" class="btn-cancel">Cancel</button>
            <button type="button" @click="confirmDeleteStage"
              :disabled="deletingStageLoading || ticketsByStage[deletingStage._id]?.length > 0" class="btn-delete">
              {{ deletingStageLoading ? 'Deleting...' : 'Delete Stage' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import TmsNativeCalendarField from '../components/ui/TmsNativeCalendarField.vue';
import { useAuthStore } from '../composables/useAuth';
import { normalizeRole, ROLES } from '../constants/roles.js';
import * as boardService from '../services/interviewBoards';
import * as userService from '../services/users';
import { excludeSuperAdmin } from '../utils/userFilters';
import * as profileService from '../services/profiles';
import InterviewKanbanColumn from '../components/InterviewBoards/InterviewKanbanColumn.vue';
import InterviewTicketDrawer from '../components/InterviewBoards/InterviewTicketDrawer.vue';
import ViewSelector from '../components/InterviewBoards/ViewSelector.vue';
import TimeView from '../components/InterviewBoards/TimeView.vue';
import CompanyView from '../components/InterviewBoards/CompanyView.vue';
import FilterView from '../components/InterviewBoards/FilterView.vue';
import InterviewBoardTimeGrid from '../components/InterviewBoards/InterviewBoardTimeGrid.vue';
import SettingsView from '../components/InterviewBoards/SettingsView.vue';
import { estToUTC } from '../utils/timezoneHelpers';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const boardId = computed(() => route.params.id);

const loading = ref(false);
const error = ref(null);
const board = ref(null);
const stages = ref([]);
const tickets = ref([]);
const users = ref([]);
const jobProfiles = ref([]);
const selectedTicket = ref(null);
const showCreateModal = ref(false);
const saving = ref(false);
const currentView = ref('time'); // 'stage', 'time', 'company', 'filter'
const ticketsLoading = ref(false);
const activeFilters = ref({});
const scheduleDate = ref('');
const scheduleTime = ref('09:00');
const durationMinutes = ref(60);
// Stage management
const showCreateStageModal = ref(false);
const showEditStageModal = ref(false);
const showDeleteStageModal = ref(false);
const editingStage = ref(null);
const deletingStage = ref(null);
const savingStage = ref(false);
const deletingStageLoading = ref(false);
const deleteStageError = ref(null);
const timeViewKey = ref(0);
const stageForm = ref({
  name: '',
  description: '',
  color: '#3498db'
});
const handleTimeViewChanged = () => {
  timeViewKey.value++;
};

const handleStageUpdated = async () => {
  await loadStages();
  await loadTickets();
};
// const openCreateModalForDay = (day) => {
//   ticketForm.value = {
//     companyName: '',
//     position: '',
//     candidateName: '',
//     stageId: stages.value[0]?._id || '',
//     priority: 'medium',
//     status: 'active',
//     jobProfileId: '',
//     tags: '',
//     notes: '',
//     dates: [{
//       scheduledAt: `${day}T09:00:00.000Z`,
//       durationMinutes: 60
//     }]
//   };
//   showCreateModal.value = true;
// };

const ticketForm = ref({
  companyName: '',
  position: '',
  candidateUserId: '',
  stageId: '',
  priority: 'medium',
  status: 'active',
  jobProfileId: '',
  tags: '',
  notes: ''
});
const buildScheduledAt = () => {
  // Convert EST time to UTC for database storage
  return estToUTC(scheduleDate.value, scheduleTime.value);
};
const openCreateModalForDay = (day) => {
  ticketForm.value = {
    companyName: '',
    position: '',
    candidateUserId: '',
    stageId: stages.value[0]?._id || '',
    priority: 'medium',
    status: 'active',
    jobProfileId: '',
    tags: '',
    notes: ''
  };

  // schedule defaults
  scheduleDate.value = day;
  scheduleTime.value = '09:00';
  durationMinutes.value = 60;

  showCreateModal.value = true;
};
// Group tickets by stage
const ticketsByStage = computed(() => {
  const grouped = {};
  tickets.value.forEach(ticket => {
    const stageId = ticket.stageId?._id || ticket.stageId;
    if (!grouped[stageId]) {
      grouped[stageId] = [];
    }
    grouped[stageId].push(ticket);
  });
  return grouped;
});

const canEditBoard = computed(() => {
  // Must have user and board loaded
  if (!authStore.user || !board.value) return false;

  // If board is loaded and user is authenticated, they have access
  // No role checks - all members with board access have full permissions
  // The backend middleware already checks board access
  return true;
});

// Check if user can edit board
// const canEditBoard = computed(() => {
//   if (!authStore.user || !board.value) return false;

//   const userRole = normalizeRole(authStore.user.role);

//   // SUPER_ADMIN can edit
//   if (userRole === ROLES.SUPER_ADMIN) {
//     return true;
//   }

//   // Owner can edit
//   const isOwner = board.value.ownerUserId?._id === authStore.user._id ||
//     board.value.ownerUserId === authStore.user._id;
//   if (isOwner) {
//     return true;
//   }

//   // Shared boards: if user can access, they can edit
//   if (board.value.visibility === 'shared') {
//     return true; // Simplified - backend will enforce actual permissions
//   }

//   return false;
// });

const loadBoard = async () => {
  if (!boardId.value) return;

  loading.value = true;
  error.value = null;
  try {
    const response = await boardService.getInterviewBoard(boardId.value);
    if (response.ok && response.data) {
      board.value = response.data.board;
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to load board';
    console.error('Error loading board:', err);
  } finally {
    loading.value = false;
  }
};

const loadStages = async () => {
  if (!boardId.value) return;

  try {
    const response = await boardService.fetchStages(boardId.value);
    if (response.ok && response.data) {
      stages.value = (response.data.stages || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    }
  } catch (err) {
    console.error('Error loading stages:', err);
  }
};

const getSelectedStageColor = () => {
  if (!ticketForm.value.stageId) return '';
  const stage = stages.value.find(s => s._id === ticketForm.value.stageId);
  return stage?.color || '#3498db';
};

const getSelectedStageName = () => {
  if (!ticketForm.value.stageId) return '';
  const stage = stages.value.find(s => s._id === ticketForm.value.stageId);
  return stage?.name || '';
};

const loadTickets = async () => {
  if (!boardId.value) return;

  ticketsLoading.value = true;
  try {
    const response = await boardService.fetchTickets(boardId.value, { limit: 1000 });
    if (response.ok && response.data) {
      tickets.value = response.data.tickets || [];
    }
  } catch (err) {
    console.error('Error loading tickets:', err);
  } finally {
    ticketsLoading.value = false;
  }
};

// Tickets to display (filtered if needed)
const displayedTickets = computed(() => {
  return tickets.value;
});

// Handle view change
const handleViewChange = (view) => {
  currentView.value = view;
};

// Handle filters change from FilterView
const handleFiltersChange = (filters) => {
  activeFilters.value = filters;
  // Filtering is handled within FilterView component
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

const handleStageDrop = async (ticketId, newStageId) => {
  try {
    const ticket = tickets.value.find(t => t._id === ticketId);
    if (!ticket || (ticket.stageId?._id || ticket.stageId) === newStageId) {
      return;
    }

    // Optimistically update UI
    ticket.stageId = { _id: newStageId };

    // Call API to move stage
    const response = await boardService.moveTicketStage(boardId.value, ticketId, newStageId);

    if (response.ok) {
      // Reload to get updated data
      await loadTickets();
    } else {
      // Revert on error
      await loadTickets();
    }
  } catch (err) {
    console.error('Error moving ticket:', err);
    // Reload to revert
    await loadTickets();
  }
};

const handleTicketClick = async (ticket) => {
  try {
    // Fetch full ticket details
    const response = await boardService.getInterviewTicket(boardId.value, ticket._id);
    if (response.ok && response.data) {
      selectedTicket.value = response.data.ticket;
    }
  } catch (err) {
    console.error('Error loading ticket details:', err);
  }
};

// const handleTicketUpdated = async (updatedTicket) => {
//   selectedTicket.value = updatedTicket;
//   await loadTickets(); // Reload to get latest data
// };
const handleTicketUpdated = (updatedTicket) => {
  selectedTicket.value = updatedTicket;

  const index = tickets.value.findIndex(t => t._id === updatedTicket._id);
  if (index !== -1) {
    tickets.value[index] = updatedTicket;
  }

  timeViewKey.value++;
};

// const handleTicketDeleted = async () => {
//   selectedTicket.value = null;
//   await loadTickets(); // Reload after deletion
// };
const handleTicketDeleted = () => {
  tickets.value = tickets.value.filter(
    t => t._id !== selectedTicket.value._id
  );

  selectedTicket.value = null;
  timeViewKey.value++;
};
const openCreateModal = () => {
  ticketForm.value = {
    companyName: '',
    position: '',
    candidateUserId: '',
    stageId: stages.value.length > 0 ? stages.value[0]._id : '',
    priority: 'medium',
    status: 'active',
    jobProfileId: '',
    tags: '',
    notes: ''
  };
  showCreateModal.value = true;
};

const closeCreateModal = () => {
  showCreateModal.value = false;
};

const handleCreateTicket = async () => {
  saving.value = true;
  try {
    // Parse tags
    const tags = ticketForm.value.tags
      ? ticketForm.value.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      : [];

    // Get candidate name from selected user if candidateUserId is set
    const selectedUser = ticketForm.value.candidateUserId
      ? users.value.find(u => (u._id || u.id) === ticketForm.value.candidateUserId)
      : null;
    const candidateName = selectedUser ? (selectedUser.name || selectedUser.email) : '';

    const ticketData = {
      ...ticketForm.value,
      candidateName, // Include candidateName for backward compatibility
      tags,
      dates: [{
        scheduledAt: buildScheduledAt(),   // local time
        durationMinutes: durationMinutes.value,
        status: 'scheduled'
      }],
    };

    const response = await boardService.createInterviewTicket(boardId.value, ticketData);
    if (response.ok) {
      tickets.value.unshift(response.data.ticket); // instant UI
      timeViewKey.value++;                         // refresh Time View
      closeCreateModal();
    }
  } catch (err) {
    alert(err.response?.data?.message || 'Failed to create ticket');
    console.error('Error creating ticket:', err);
  } finally {
    saving.value = false;
  }
};

const goBack = () => {
  router.push('/interview-boards');
};

// Stage Management Functions
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
    const response = await boardService.createStage(boardId.value, stageForm.value);
    if (response.ok) {
      await loadStages();
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
      boardId.value,
      editingStage.value._id,
      stageForm.value
    );
    if (response.ok) {
      await loadStages();
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

  // Check if stage has tickets
  const ticketCount = ticketsByStage.value[deletingStage.value._id]?.length || 0;
  if (ticketCount > 0) {
    deleteStageError.value = `Cannot delete stage with ${ticketCount} ticket(s). Please move or delete tickets first.`;
    return;
  }

  deletingStageLoading.value = true;
  deleteStageError.value = null;

  try {
    const response = await boardService.deleteStage(boardId.value, deletingStage.value._id);
    if (response.ok) {
      await loadStages();
      closeDeleteStageModal();
    } else {
      deleteStageError.value = response.message || 'Failed to delete stage';
    }
  } catch (err) {
    const errorMessage = err.response?.data?.message || 'Failed to delete stage';
    deleteStageError.value = errorMessage;

    // Check if error is about tickets
    if (err.response?.data?.code === 'STAGE_HAS_TICKETS') {
      // Error already handled by backend
    }

    console.error('Error deleting stage:', err);
  } finally {
    deletingStageLoading.value = false;
  }
};

watch(boardId, async (newId) => {
  if (newId) {
    await Promise.all([
      loadBoard(),
      loadStages(),
      loadTickets(),
      loadUsers(),
      loadJobProfiles()
    ]);
  }
}, { immediate: true });

onMounted(async () => {
  if (boardId.value) {
    await Promise.all([
      loadBoard(),
      loadStages(),
      loadTickets(),
      loadUsers(),
      loadJobProfiles()
    ]);
  }
});
</script>

<style scoped>
.interview-board-view {
  padding: 24px;
  min-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
}

.board-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.btn-back {
  padding: 8px 16px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.btn-back:hover {
  background: var(--bg-secondary);
}

.page-header h1 {
  margin: 0;
  font-size: 1.8rem;
  color: var(--text-primary);
}

.subtitle {
  margin: 4px 0 0 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.header-right {
  display: flex;
  gap: 12px;
}

.btn-create {
  padding: 10px 20px;
  background: var(--color-success);
  color: var(--text-inverse);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-create:hover {
  background: var(--color-success-dark);
}

.btn-secondary {
  padding: 10px 20px;
  background: var(--color-primary);
  color: var(--text-inverse);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  transition: background 0.2s;
  margin-right: 12px;
}

.btn-secondary:hover {
  background: var(--color-primary-dark);
}

.error-message {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--color-error);
  color: var(--color-error);
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 16px;
  border-left: 4px solid var(--color-error);
}

.warning-message {
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid var(--color-warning);
  color: var(--color-warning);
  padding: 12px;
  border-radius: 4px;
  margin: 12px 0;
  border-left: 4px solid var(--color-warning);
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

.loading-state,
.error-state {
  text-align: center;
  padding: 40px;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.spinner {
  border: 3px solid var(--bg-tertiary);
  border-top: 3px solid var(--color-info);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
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
  background: var(--color-info);
  color: var(--text-inverse);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 12px;
}

.kanban-board {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  flex: 1;
  padding-bottom: 16px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
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
  width: 550px;
  max-width: 550px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-light);
}

@media (max-width: 600px) {
  .modal {
    width: calc(100vw - 40px);
    max-width: calc(100vw - 40px);
  }
}

.modal-large {
  width: 650px;
  max-width: 650px;
}

@media (max-width: 700px) {
  .modal-large {
    width: calc(100vw - 40px);
    max-width: calc(100vw - 40px);
  }
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
.form-group select,
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
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
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

.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
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
