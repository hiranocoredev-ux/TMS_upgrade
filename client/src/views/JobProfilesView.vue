<template>
  <div class="profiles-view">
    <div class="page-header">
      <div class="header-content">
        <div>
          <h1>Job Profiles</h1>
          <p class="subtitle">Manage client profiles</p>
        </div>
        <button @click="openCreateModal" class="btn-primary" v-if="canCreate">
          + Create Profile
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-section">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search by name, email, phone, country..."
        class="search-input"
        @input="handleSearch"
      />
      <select v-model="statusFilter" @change="handleFilterChange" class="filter-select">
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="archived">Archived</option>
      </select>
      <select v-if="groups.length" v-model="groupFilter" @change="handleFilterChange" class="filter-select">
        <option value="">All Groups</option>
        <option v-for="g in groups" :key="g._id" :value="g.code">{{ g.name }}</option>
      </select>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading profiles...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button @click="loadProfiles" class="btn-retry">Retry</button>
    </div>

    <!-- Profiles Table -->
    <ProfileTable
      v-else
      :profiles="profiles"
      @view="handleView"
      @edit="handleEdit"
      @delete="handleDelete"
      @create="openCreateModal"
    />

    <!-- Create/Edit Modal -->
    <ProfileModal
      :show="showModal"
      :editing-profile="editingProfile"
      :saving="saving"
      @close="closeModal"
      @submit="handleSubmit"
    />

    <!-- Profile Detail Drawer -->
    <ProfileDrawer />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useStore } from 'vuex';
import { useAuthStore } from '../composables/useAuth';
import { normalizeRole, ROLES, isFullAdminRole } from '../constants/roles.js';
import { fetchGroups } from '../services/admin.js';
import ProfileTable from '../components/Profiles/ProfileTable.vue';
import ProfileModal from '../components/Profiles/ProfileModal/ProfileModal.vue';
import ProfileDrawer from '../components/Profiles/ProfileDrawer/ProfileDrawer.vue';

const store = useStore();
const authStore = useAuthStore();

const profiles = computed(() => store.getters['jobProfiles/profiles']);
const loading = computed(() => store.getters['jobProfiles/loading']);
const error = computed(() => store.getters['jobProfiles/error']);

const showModal = ref(false);
const editingProfile = ref(null);
const saving = ref(false);
const searchQuery = ref('');
const statusFilter = ref('');
const groupFilter = ref('');
const groups = ref([]);

let searchTimeout = null;

const canCreate = computed(() => {
  if (!authStore.user) return false;
  const userRole = normalizeRole(authStore.user.role, authStore.user.degree);
  return isFullAdminRole(userRole) ||
         userRole === ROLES.GROUP_BOSS ||
         authStore.user.editor === true;
});

const loadProfiles = async () => {
  await store.dispatch('jobProfiles/setFilters', {
    search: searchQuery.value,
    status: statusFilter.value,
    group: groupFilter.value
  });
  await store.dispatch('jobProfiles/fetchProfiles');
};

const loadGroups = async () => {
  try {
    const res = await fetchGroups();
    groups.value = res?.data?.groups || res?.groups || [];
  } catch {
    groups.value = [];
  }
};

const handleSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadProfiles();
  }, 500);
};

const handleFilterChange = () => {
  loadProfiles();
};

const openCreateModal = () => {
  editingProfile.value = null;
  showModal.value = true;
};

const handleView = async (profile) => {
  await store.dispatch('jobProfiles/fetchProfile', profile._id || profile.id);
};

const handleEdit = (profile) => {
  editingProfile.value = profile;
  showModal.value = true;
};

const handleDelete = async (profile) => {
  if (!confirm(`Are you sure you want to delete "${profile.name}"?`)) {
    return;
  }

  await store.dispatch('jobProfiles/deleteProfile', profile._id || profile.id);
};

const closeModal = () => {
  showModal.value = false;
  editingProfile.value = null;
};

const handleSubmit = async ({ formData, pictureFile, attachmentFiles }) => {
  saving.value = true;
  
  try {
    if (editingProfile.value) {
      // Update existing profile
      const profileId = editingProfile.value._id || editingProfile.value.id;
      
      // Update profile data
      await store.dispatch('jobProfiles/updateProfile', {
        profileId,
        profileData: formData
      });

      if (pictureFile) {
        await store.dispatch('jobProfiles/uploadProfilePicture', {
          profileId,
          pictureFile
        });
      }

      if (attachmentFiles && attachmentFiles.length > 0) {
        await store.dispatch('jobProfiles/uploadAttachments', {
          profileId,
          files: attachmentFiles
        });
      }

      // Reload profiles list
      await loadProfiles();
      closeModal();
    } else {
      // Create new profile
      const response = await store.dispatch('jobProfiles/createProfile', formData);
      
      if (response.ok && response.data && response.data.profile) {
        const newProfileId = response.data.profile._id || response.data.profile.id;
        
        if (pictureFile) {
          await store.dispatch('jobProfiles/uploadProfilePicture', {
            profileId: newProfileId,
            pictureFile
          });
        }

        if (attachmentFiles && attachmentFiles.length > 0) {
          await store.dispatch('jobProfiles/uploadAttachments', {
            profileId: newProfileId,
            files: attachmentFiles
          });
        }

        // Reload profiles list
        await loadProfiles();
        closeModal();
      }
    }
  } catch (err) {
    alert(err.message || 'Failed to save profile');
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  await loadGroups();
  await loadProfiles();
});
</script>

<style scoped>
.profiles-view {
  background: transparent;
  padding: 0;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.page-header {
  background: var(--bg-primary);
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
  margin-bottom: var(--spacing-lg);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-light);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-md);
}

.page-header h1 {
  color: var(--text-primary);
  margin: 0 0 var(--spacing-xs) 0;
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.02em;
}

.subtitle {
  color: var(--text-secondary);
  margin: 0;
  font-size: var(--font-size-sm);
}

.filters-section {
  background: var(--bg-primary);
  padding: var(--spacing-lg);
  border-radius: var(--radius-lg);
  margin-bottom: var(--spacing-lg);
  display: flex;
  gap: var(--spacing-md);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-light);
}

.search-input {
  flex: 1;
  min-width: 200px;
  padding: var(--spacing-md);
  border: 1.5px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  transition: all var(--transition-base);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.filter-select {
  padding: var(--spacing-md);
  border: 1.5px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  min-width: 150px;
  transition: all var(--transition-base);
}

.filter-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.btn-primary {
  padding: var(--spacing-md) var(--spacing-xl);
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  color: var(--text-inverse);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  transition: all var(--transition-base);
  box-shadow: var(--shadow-md);
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.loading-state,
.error-state {
  text-align: center;
  padding: var(--spacing-3xl) var(--spacing-xl);
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-light);
}

.spinner {
  border: 3px solid var(--border-light);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  width: 48px;
  height: 48px;
  animation: spin 0.8s linear infinite;
  margin: 0 auto var(--spacing-lg);
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
  padding: var(--spacing-md) var(--spacing-xl);
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  color: var(--text-inverse);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  margin-top: var(--spacing-lg);
  font-weight: var(--font-weight-semibold);
  box-shadow: var(--shadow-md);
  transition: all var(--transition-base);
}

.btn-retry:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

@media (max-width: 768px) {
  .page-header {
    padding: var(--spacing-lg);
  }
  
  .page-header h1 {
    font-size: var(--font-size-2xl);
  }
  
  .filters-section {
    flex-direction: column;
  }
  
  .search-input,
  .filter-select {
    width: 100%;
  }
}
</style>
