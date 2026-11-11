<template>
  <div class="project-detail-view">
    <!-- Header -->
    <div class="page-header">
      <div class="header-left">
        <button @click="goBack" class="btn-back">Back</button>
        <div>
          <h1>{{ project?.name || 'Loading...' }}</h1>
          <p v-if="project?.description" class="subtitle">{{ project.description }}</p>
        </div>
      </div>
      <div class="header-right">
        <button v-if="canEditProject" @click="openEditModal" class="btn-secondary">Edit Project</button>
        <button v-if="canCreateTask" @click="openCreateTaskModal" class="btn-primary">+ Create Task</button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading && !project" class="loading-state">
      <div class="spinner"></div>
      <p>Loading project...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error && !project" class="error-state">
      <p>{{ error }}</p>
      <button @click="loadProject" class="btn-retry">Retry</button>
    </div>

    <!-- Project Details -->
    <div v-else-if="project" class="project-details">
      <!-- Project Info -->
      <div class="info-section">
        <div class="info-grid">
          <div class="info-item">
            <label>Status</label>
            <span class="status-badge" :class="`status-${project.status}`">{{ project.status }}</span>
          </div>
          <div class="info-item">
            <label>Progress</label>
            <span>{{ project.progressPercent || 0 }}%</span>
          </div>
          <div class="info-item">
            <label>Client Company</label>
            <span>{{ project.clientCompanyName || 'N/A' }}</span>
          </div>
          <div class="info-item">
            <label>Owner</label>
            <span>{{ project.ownerUserId?.name || project.ownerUserId?.email || 'N/A' }}</span>
          </div>
          <div class="info-item" v-if="canViewClientContacts && project.clientContacts">
            <label>Client Email</label>
            <span>{{ project.clientContacts.email || 'N/A' }}</span>
          </div>
          <div class="info-item" v-if="canViewClientContacts && project.clientContacts">
            <label>Client Phone</label>
            <span>{{ project.clientContacts.phone || 'N/A' }}</span>
          </div>
        </div>
      </div>

      <!-- Tasks Section -->
      <div class="tasks-section">
        <div class="section-header">
          <h2>Tasks ({{ tasks.length }})</h2>
          <div class="task-filters">
            <select v-model="taskStatusFilter" @change="loadTasks" class="filter-select">
              <option value="">All Status</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
            <select v-model="taskPriorityFilter" @change="loadTasks" class="filter-select">
              <option value="">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <!-- Tasks Loading -->
        <div v-if="tasksLoading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading tasks...</p>
        </div>

        <!-- Tasks Table -->
        <div v-else class="tasks-table-container">
          <table class="tasks-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assigned To</th>
                <th>Due Date</th>
                <th>Progress</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="task in tasks" :key="task._id || task.id">
                <td>{{ task.title }}</td>
                <td>
                  <span class="status-badge" :class="`status-${task.status}`">
                    {{ task.status.replace('_', ' ') }}
                  </span>
                </td>
                <td>
                  <span class="priority-badge" :class="`priority-${task.priority}`">
                    {{ task.priority }}
                  </span>
                </td>
                <td>N/A</td>
                <td>{{ formatDate(task.dueDate) }}</td>
                <td>
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :style="{ width: getTaskProgress(task) + '%' }"
                    ></div>
                    <span class="progress-text">{{ getTaskProgress(task) }}%</span>
                  </div>
                </td>
                <td @click.stop>
                  <div class="action-buttons">
                    <button @click="openEditTaskModal(task)" class="btn-edit" v-if="canEditTask(task)">Edit</button>
                    <button @click="handleDeleteTask(task)" class="btn-delete" v-if="canDeleteTask(task)">Delete</button>
                  </div>
                </td>
              </tr>
              <tr v-if="tasks.length === 0">
                <td colspan="7" class="empty-state">
                  No tasks found. Click "Create Task" to add one.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Edit Project Modal (inline) -->
    <div v-if="showEditProjectModal" class="modal-overlay" @click="closeEditModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>Edit Project</h2>
          <button @click="closeEditModal" class="close-btn">×</button>
        </div>
        <div class="modal-content">
          <form @submit.prevent="handleUpdateProject">
            <div class="form-group">
              <label>Project Name *</label>
              <input v-model="editForm.name" type="text" required />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Client Company</label>
                <input v-model="editForm.clientCompanyName" type="text" />
              </div>
              <div class="form-group">
                <label>Status</label>
                <select v-model="editForm.status">
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea v-model="editForm.description" rows="4"></textarea>
            </div>
            <div class="form-group">
              <label>Progress (%)</label>
              <input v-model.number="editForm.progressPercent" type="number" min="0" max="100" />
            </div>
            <div class="form-actions">
              <button type="button" @click="closeEditModal" class="btn-cancel">Cancel</button>
              <button type="submit" :disabled="saving" class="btn-save">
                {{ saving ? 'Saving...' : 'Update Project' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Task Modal -->
    <TaskModal
      :show="showTaskModal"
      :task="editingTask"
      :users="users"
      :project-id="projectId"
      @close="closeTaskModal"
      @saved="handleTaskSaved"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../composables/useAuth';
import { isAdmin } from '../utils/permissions';
import * as projectService from '../services/projects';
import * as userService from '../services/users';
import TaskModal from '../components/Tasks/TaskModal.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const projectId = computed(() => route.params.id);

const loading = ref(false);
const error = ref(null);
const project = ref(null);
const tasks = ref([]);
const tasksLoading = ref(false);
const users = ref([]);
const taskStatusFilter = ref('');
const taskPriorityFilter = ref('');

const showEditProjectModal = ref(false);
const showTaskModal = ref(false);
const editingTask = ref(null);
const saving = ref(false);

const editForm = ref({
  name: '',
  clientCompanyName: '',
  status: 'active',
  description: '',
  progressPercent: 0
});

const canEditProject = computed(() => {
  if (!project.value || !authStore.user) return false;
  const isOwner = (project.value.ownerUserId?._id || project.value.ownerUserId) === authStore.user._id;
  return isOwner || isAdmin(authStore.user);
});

const canViewClientContacts = computed(() => {
  if (!project.value || !authStore.user) return false;
  const isOwner = (project.value.ownerUserId?._id || project.value.ownerUserId) === authStore.user._id;
  return isOwner || isAdmin(authStore.user);
});

const canCreateTask = computed(() => {
  return canEditProject.value; // Only owners/admins can create tasks
});

const canEditTask = (task) => {
  if (!authStore.user || !project.value) return false;
  // Owner can edit all tasks
  const isOwner = (project.value.ownerUserId?._id || project.value.ownerUserId) === authStore.user._id;
  if (isOwner || isAdmin(authStore.user)) return true;
  // Collaborators can edit tasks
  if (project.value.collaboratorUserIds) {
    const isCollaborator = project.value.collaboratorUserIds.some(
      id => (id._id || id) === authStore.user._id
    );
    if (isCollaborator) return true;
  }
  return false;
};

const canDeleteTask = (task) => {
  if (!authStore.user || !project.value) return false;
  const isOwner = (project.value.ownerUserId?._id || project.value.ownerUserId) === authStore.user._id;
  return isOwner || ['SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(authStore.user.role);
};

const loadProject = async () => {
  if (!projectId.value) return;
  loading.value = true;
  error.value = null;
  try {
    const response = await projectService.getProject(projectId.value);
    if (response.ok && response.data) {
      project.value = response.data.project;
      editForm.value = {
        name: project.value.name || '',
        clientCompanyName: project.value.clientCompanyName || '',
        status: project.value.status || 'active',
        description: project.value.description || '',
        progressPercent: project.value.progressPercent || 0
      };
    } else {
      throw new Error(response.message || 'Failed to load project');
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to load project';
    console.error('Error loading project:', err);
  } finally {
    loading.value = false;
  }
};

const loadTasks = async () => {
  if (!projectId.value) return;
  tasksLoading.value = true;
  try {
    const filters = {};
    if (taskStatusFilter.value) filters.status = taskStatusFilter.value;
    if (taskPriorityFilter.value) filters.priority = taskPriorityFilter.value;
    const response = await projectService.fetchTasks(projectId.value, filters);
    if (response.ok && response.data) {
      tasks.value = response.data.tasks || [];
    }
  } catch (err) {
    console.error('Error loading tasks:', err);
    tasks.value = [];
  } finally {
    tasksLoading.value = false;
  }
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

const openEditModal = () => {
  showEditProjectModal.value = true;
};

const closeEditModal = () => {
  showEditProjectModal.value = false;
};

const handleUpdateProject = async () => {
  saving.value = true;
  try {
    const response = await projectService.updateProject(projectId.value, editForm.value);
    if (response.ok) {
      await loadProject();
      closeEditModal();
    }
  } catch (err) {
    alert(err.response?.data?.message || 'Failed to update project');
    console.error('Error updating project:', err);
  } finally {
    saving.value = false;
  }
};

const openCreateTaskModal = () => {
  editingTask.value = null;
  showTaskModal.value = true;
};

const openEditTaskModal = (task) => {
  editingTask.value = task;
  showTaskModal.value = true;
};

const closeTaskModal = () => {
  showTaskModal.value = false;
  editingTask.value = null;
};

const handleTaskSaved = async (taskData) => {
  saving.value = true;
  try {
    if (editingTask.value) {
      // Update task
      const response = await projectService.updateTask(
        projectId.value,
        editingTask.value._id || editingTask.value.id,
        taskData
      );
      if (response.ok) {
        await loadTasks();
        closeTaskModal();
      }
    } else {
      // Create task
      const response = await projectService.createTask(projectId.value, taskData);
      if (response.ok) {
        await loadTasks();
        closeTaskModal();
      }
    }
  } catch (err) {
    alert(err.response?.data?.message || 'Failed to save task');
    console.error('Error saving task:', err);
  } finally {
    saving.value = false;
  }
};

const handleDeleteTask = async (task) => {
  if (!confirm(`Are you sure you want to delete the task "${task.title}"?`)) {
    return;
  }

  try {
    const response = await projectService.deleteTask(projectId.value, task._id || task.id);
    if (response.ok) {
      await loadTasks();
    }
  } catch (err) {
    alert(err.response?.data?.message || 'Failed to delete task');
    console.error('Error deleting task:', err);
  }
};

const getTaskProgress = (task) => {
  if (!task.checklist || task.checklist.length === 0) {
    return task.status === 'done' ? 100 : task.status === 'in_progress' ? 50 : 0;
  }
  const completed = task.checklist.filter(item => item.done).length;
  return Math.round((completed / task.checklist.length) * 100);
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString();
};

const goBack = () => {
  router.push('/project-job-management');
};

watch(projectId, async () => {
  if (projectId.value) {
    await Promise.all([loadProject(), loadTasks(), loadUsers()]);
  }
}, { immediate: true });

onMounted(async () => {
  if (projectId.value) {
    await Promise.all([loadProject(), loadTasks(), loadUsers()]);
  }
});
</script>

<style scoped>
/* Styles match Projects.vue pattern */
.project-detail-view {
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  padding: 20px 30px;
  background: var(--bg-primary);
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
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

.btn-primary,
.btn-secondary {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
}

.btn-primary {
  background: var(--color-success);
  color: var(--text-inverse);
}

.btn-secondary {
  background: var(--color-primary);
  color: var(--text-inverse);
}

.project-details {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.info-section,
.tasks-section {
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 24px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h2 {
  margin: 0;
  color: var(--text-primary);
}

.task-filters {
  display: flex;
  gap: 12px;
}

.filter-select {
  padding: 6px 12px;
  border: 1px solid var(--border-medium);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.tasks-table-container {
  overflow-x: auto;
}

.tasks-table {
  width: 100%;
  border-collapse: collapse;
}

.tasks-table th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: var(--text-primary);
  border-bottom: 2px solid var(--border-light);
  background: var(--bg-tertiary);
}

.tasks-table td {
  padding: 12px;
  border-bottom: 1px solid var(--border-light);
  color: var(--text-primary);
}

.status-badge,
.priority-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
}

.status-todo {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.status-in_progress {
  background: var(--color-info);
  color: var(--text-inverse);
}

.status-done {
  background: var(--color-success);
  color: var(--text-inverse);
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
  background: #e74c3c;
  color: white;
}

.progress-bar {
  position: relative;
  height: 20px;
  background: #ecf0f1;
  border-radius: 10px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #27ae60;
  transition: width 0.3s;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.75rem;
  font-weight: 500;
  color: #2c3e50;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.btn-edit,
.btn-delete {
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-edit {
  background: #3498db;
  color: white;
}

.btn-delete {
  background: #e74c3c;
  color: white;
}

/* Modal and form styles - same as Projects.vue */
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
  padding: 20px 30px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h2 {
  margin: 0;
  color: #2c3e50;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #95a5a6;
  cursor: pointer;
}

.modal-content {
  padding: 30px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #2c3e50;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 30px;
}

.btn-cancel,
.btn-save {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-cancel {
  background: #95a5a6;
  color: white;
}

.btn-save {
  background: #2ecc71;
  color: white;
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
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>

