<template>
  <div class="projects-view">
    <div class="page-header">
      <div class="header-content">
        <div>
          <h1>Projects & Tasks</h1>
          <p class="subtitle">Manage projects and track tasks</p>
        </div>
        <button @click="openCreateModal" class="btn-primary">
          + Create Project
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading projects...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button @click="loadProjects" class="btn-retry">Retry</button>
    </div>

    <!-- Projects Table -->
    <div v-else class="projects-table-container">
      <table class="projects-table">
        <thead>
          <tr>
            <th>Project Name</th>
            <th>Client Company</th>
            <th>Status</th>
            <th>Progress</th>
            <th>Owner</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="project in projects" :key="project._id || project.id">
            <td>{{ project.name }}</td>
            <td>{{ project.clientCompanyName || 'N/A' }}</td>
            <td>
              <span class="status-badge" :class="`status-${project.status}`">
                {{ project.status }}
              </span>
            </td>
            <td>{{ project.progressPercent || 0 }}%</td>
            <td>{{ project.ownerUserId?.name || project.ownerUserId?.email || 'N/A' }}</td>
            <td>{{ formatDate(project.createdAt) }}</td>
            <td @click.stop>
              <div class="action-buttons">
                <button @click="viewProject(project)" class="btn-view">View</button>
                <button @click="openEditModal(project)" class="btn-edit" v-if="canEditProject(project)">Edit</button>
                <button @click="handleDelete(project)" class="btn-delete" v-if="canDeleteProject(project)">Delete</button>
              </div>
            </td>
          </tr>
          <tr v-if="projects.length === 0">
            <td colspan="7" class="empty-state">
              No projects found. Click "Create Project" to add one.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>{{ editingProject ? 'Edit Project' : 'Create Project' }}</h2>
          <button @click="closeModal" class="close-btn">âœ•</button>
        </div>
        <div class="modal-content">
          <form @submit.prevent="handleSubmit">
            <div class="form-group">
              <label>Project Name *</label>
              <input
                v-model="form.name"
                type="text"
                required
                placeholder="e.g., E-commerce Website"
              />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Client Company</label>
                <input v-model="form.clientCompanyName" type="text" placeholder="Company name" />
              </div>
              <div class="form-group">
                <label>Status</label>
                <select v-model="form.status">
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea v-model="form.description" rows="4" placeholder="Project description..."></textarea>
            </div>
            <div class="form-group">
              <label>Progress (%)</label>
              <input
                v-model.number="form.progressPercent"
                type="number"
                min="0"
                max="100"
                placeholder="0"
              />
            </div>
            <div class="form-actions">
              <button type="button" @click="closeModal" class="btn-cancel">Cancel</button>
              <button type="submit" :disabled="saving" class="btn-save">
                {{ saving ? 'Saving...' : (editingProject ? 'Update' : 'Create') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../composables/useAuth';
import { isAdmin } from '../utils/permissions';
import * as projectService from '../services/projects';

const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const error = ref(null);
const projects = ref([]);
const showModal = ref(false);
const editingProject = ref(null);
const saving = ref(false);

const form = ref({
  name: '',
  clientCompanyName: '',
  status: 'active',
  description: '',
  progressPercent: 0
});

const loadProjects = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await projectService.fetchProjects({ limit: 1000 });
    if (response.ok && response.data) {
      projects.value = response.data.projects || [];
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to load projects';
    console.error('Error loading projects:', err);
  } finally {
    loading.value = false;
  }
};

const openCreateModal = () => {
  editingProject.value = null;
  form.value = {
    name: '',
    clientCompanyName: '',
    status: 'active',
    description: '',
    progressPercent: 0
  };
  showModal.value = true;
};

const openEditModal = (project) => {
  editingProject.value = project;
  form.value = {
    name: project.name || '',
    clientCompanyName: project.clientCompanyName || '',
    status: project.status || 'active',
    description: project.description || '',
    progressPercent: project.progressPercent || 0
  };
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  editingProject.value = null;
};

const handleSubmit = async () => {
  saving.value = true;
  error.value = null;
  try {
    const projectData = {
      name: form.value.name,
      status: form.value.status,
      description: form.value.description,
      progressPercent: form.value.progressPercent
    };
    
    if (form.value.clientCompanyName) {
      projectData.clientCompanyName = form.value.clientCompanyName;
    }

    if (editingProject.value) {
      const response = await projectService.updateProject(
        editingProject.value._id || editingProject.value.id,
        projectData
      );
      if (response.ok) {
        await loadProjects();
        closeModal();
      }
    } else {
      const response = await projectService.createProject(projectData);
      if (response.ok) {
        await loadProjects();
        closeModal();
      }
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to save project';
    console.error('Error saving project:', err);
  } finally {
    saving.value = false;
  }
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString();
};

const canEditProject = (project) => {
  if (!authStore.user || !project) return false;
  const isOwner = (project.ownerUserId?._id || project.ownerUserId) === authStore.user._id;
  return isOwner || isAdmin(authStore.user);
};

const canDeleteProject = (project) => {
  if (!authStore.user || !project) return false;
  const isOwner = (project.ownerUserId?._id || project.ownerUserId) === authStore.user._id;
  return isOwner || authStore.user.role === 'SUPER_ADMIN';
};

const viewProject = (project) => {
  router.push({ name: 'ProjectDetail', params: { id: project._id || project.id } });
};

const handleDelete = async (project) => {
  if (!confirm(`Are you sure you want to delete the project "${project.name}"? This will also delete all associated tasks.`)) {
    return;
  }

  try {
    const response = await projectService.deleteProject(project._id || project.id);
    if (response.ok) {
      await loadProjects();
    } else {
      alert(response.message || 'Failed to delete project');
    }
  } catch (err) {
    alert(err.response?.data?.message || 'Failed to delete project');
    console.error('Error deleting project:', err);
  }
};

onMounted(() => {
  loadProjects();
});
</script>

<style scoped>
.projects-view {
  background: transparent;
  padding: 0;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.page-header {
  background: var(--bg-primary);
  padding: 20px 30px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header h1 {
  color: var(--text-primary);
  margin: 0 0 4px 0;
  font-size: 1.8rem;
}

.subtitle {
  color: var(--text-secondary);
  margin: 0;
  font-size: 0.95rem;
}

.btn-primary {
  padding: 10px 20px;
  background: var(--color-primary);
  color: var(--text-inverse);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
}

.loading-state,
.error-state {
  text-align: center;
  padding: 60px 20px;
  background: var(--bg-primary);
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}

.spinner {
  border: 4px solid var(--border-light);
  border-top: 4px solid var(--color-primary);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.projects-table-container {
  background: var(--bg-primary);
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  border: 1px solid var(--border-light);
}

.projects-table {
  width: 100%;
  border-collapse: collapse;
}

.projects-table thead {
  background: var(--bg-tertiary);
}

.projects-table th {
  padding: 16px;
  text-align: left;
  font-weight: 600;
  color: var(--text-primary);
  border-bottom: 2px solid var(--border-light);
}

.projects-table td {
  padding: 16px;
  border-bottom: 1px solid var(--border-light);
  color: var(--text-primary);
}

.projects-table tbody tr:hover {
  background: var(--bg-tertiary);
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
}

.status-active {
  background: #2ecc71;
  color: white;
}

.status-paused {
  background: var(--color-warning);
  color: var(--text-inverse);
}

.status-done {
  background: #95a5a6;
  color: white;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.btn-view,
.btn-edit,
.btn-delete {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.2s;
}

.btn-view {
  background: #27ae60;
  color: white;
}

.btn-view:hover {
  background: #229954;
}

.btn-edit {
  background: #3498db;
  color: white;
}

.btn-edit:hover {
  background: #2980b9;
}

.btn-delete {
  background: #e74c3c;
  color: white;
}

.btn-delete:hover {
  background: #c0392b;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #95a5a6;
}

/* Modal Styles - Same as other pages */
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
  border-bottom: 1px solid var(--border-light);
}

.modal-header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.5rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.close-btn:hover {
  background: var(--bg-tertiary);
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
  color: var(--text-primary);
  font-size: 0.9rem;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-medium);
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.2s;
  box-sizing: border-box;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-group textarea {
  resize: vertical;
  font-family: inherit;
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
  font-size: 1rem;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-cancel {
  background: #95a5a6;
  color: white;
}

.btn-cancel:hover {
  background: #7f8c8d;
}

.btn-save {
  background: #2ecc71;
  color: white;
}

.btn-save:hover:not(:disabled) {
  background: #27ae60;
}

.btn-save:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.btn-retry {
  padding: 10px 20px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 16px;
}
</style>
