<template>
  <div class="profiles-view">
    <div class="page-header">
      <div class="header-content">
        <div>
          <h1>Personal Profiles</h1>
          <p class="subtitle">Manage personal information profiles</p>
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
    <PersonalProfileTable
      v-else
      :profiles="profiles"
      @view="handleView"
      @edit="handleEdit"
      @delete="handleDelete"
      @create="openCreateModal"
    />

    <!-- Create/Edit Modal -->
    <PersonalProfileModal
      :show="showModal"
      :editing-profile="editingProfile"
      :saving="saving"
      @close="closeModal"
      @submit="handleSubmit"
    />

    <!-- Profile Detail Drawer -->
    <PersonalProfileDrawer />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { useAuthStore } from '../composables/useAuth';
import { canCreatePersonalProfile } from '../utils/profilePermissions';
import PersonalProfileTable from '../components/personalProfiles/PersonalProfileTable.vue';
import PersonalProfileModal from '../components/personalProfiles/PersonalProfileModal/PersonalProfileModal.vue';
import PersonalProfileDrawer from '../components/personalProfiles/PersonalProfileDrawer/PersonalProfileDrawer.vue';

const store = useStore();
const authStore = useAuthStore();

const profiles = computed(() => store.getters['personalProfiles/profiles']);
const loading = computed(() => store.getters['personalProfiles/loading']);
const error = computed(() => store.getters['personalProfiles/error']);

const showModal = ref(false);
const editingProfile = ref(null);
const saving = ref(false);
const searchQuery = ref('');
const statusFilter = ref('');

let searchTimeout = null;

const canCreate = computed(() => {
  return canCreatePersonalProfile(authStore.user);
});

const loadProfiles = async () => {
  await store.dispatch('personalProfiles/setFilters', {
    search: searchQuery.value,
    status: statusFilter.value
  });
  await store.dispatch('personalProfiles/fetchProfiles');
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
  await store.dispatch('personalProfiles/fetchProfile', profile._id || profile.id);
};

const handleEdit = (profile) => {
  editingProfile.value = profile;
  showModal.value = true;
};

const handleDelete = async (profile) => {
  if (!confirm(`Are you sure you want to delete "${profile.name}"?`)) {
    return;
  }

  await store.dispatch('personalProfiles/deleteProfile', profile._id || profile.id);
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
      await store.dispatch('personalProfiles/updateProfile', {
        profileId,
        profileData: formData
      });

      if (pictureFile) {
        await store.dispatch('personalProfiles/uploadProfilePicture', {
          profileId,
          pictureFile
        });
      }

      if (attachmentFiles && attachmentFiles.length > 0) {
        await store.dispatch('personalProfiles/uploadAttachments', {
          profileId,
          files: attachmentFiles
        });
      }

      // Reload profiles list
      await loadProfiles();
      closeModal();
    } else {
      // Create new profile
      const response = await store.dispatch('personalProfiles/createProfile', formData);
      
      if (response.ok && response.data && response.data.profile) {
        const newProfileId = response.data.profile._id || response.data.profile.id;
        
        if (pictureFile) {
          await store.dispatch('personalProfiles/uploadProfilePicture', {
            profileId: newProfileId,
            pictureFile
          });
        }

        if (attachmentFiles && attachmentFiles.length > 0) {
          await store.dispatch('personalProfiles/uploadAttachments', {
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

.filters-section {
  background: var(--bg-primary);
  padding: 16px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  display: flex;
  gap: 16px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}

.search-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--border-medium);
  border-radius: 4px;
  font-size: 0.95rem;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.filter-select {
  padding: 10px 12px;
  border: 1px solid var(--border-medium);
  border-radius: 4px;
  font-size: 0.95rem;
  min-width: 150px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.btn-primary {
  padding: 10px 20px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #2980b9;
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
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
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
  padding: 10px 20px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 16px;
}
</style>
