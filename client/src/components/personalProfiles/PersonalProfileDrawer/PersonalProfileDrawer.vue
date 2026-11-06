<template>
  <div v-if="hasSelectedProfile" class="drawer-overlay" @click="handleOverlayClick">
    <div class="drawer" @click.stop>
      <ProfileHeader :profile="selectedProfile" @close="handleClose" />
      
      <div class="drawer-content">
        <!-- Edit Mode Toggle -->
        <div class="section-header" v-if="canEdit">
          <button @click="isEditing = !isEditing" class="btn-edit">
            {{ isEditing ? 'Cancel Edit' : 'Edit' }}
          </button>
        </div>

        <!-- Basic Information -->
        <div class="section">
          <h3>Basic Information</h3>
          <div v-if="!isEditing" class="info-grid">
            <div class="info-item">
              <label>Status</label>
              <span :class="['status-badge', `status-${selectedProfile.status || 'active'}`]">
                {{ selectedProfile.status || 'active' }}
              </span>
            </div>
            <div class="info-item">
              <label>Owner</label>
              <span>{{ selectedProfile.ownerUserId?.name || selectedProfile.ownerUserId?.email || 'N/A' }}</span>
            </div>
            <div class="info-item">
              <label>Created</label>
              <span>{{ formatDate(selectedProfile.createdAt) }}</span>
            </div>
          </div>

          <!-- Edit Form -->
          <form v-else @submit.prevent="handleUpdate" class="edit-form">
            <div class="form-row">
              <div class="form-group">
                <label>Name *</label>
                <input v-model="editForm.name" type="text" required />
              </div>
              <div class="form-group">
                <label>Status</label>
                <select v-model="editForm.status">
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <div class="form-actions">
              <button type="button" @click="isEditing = false" class="btn-cancel">Cancel</button>
              <button type="submit" :disabled="saving" class="btn-save">
                {{ saving ? 'Saving...' : 'Save' }}
              </button>
            </div>
          </form>
        </div>

        <!-- Contact Information -->
        <div class="section">
          <h3>Contact Information</h3>
          <div v-if="!isEditing" class="info-grid">
            <div class="info-item">
              <label>Email</label>
              <span>{{ displayEmail }}</span>
            </div>
            <div class="info-item">
              <label>Phone</label>
              <span>{{ displayPhone }}</span>
            </div>
            <div class="info-item">
              <label>Country</label>
              <span>{{ selectedProfile.country || 'N/A' }}</span>
            </div>
            <div class="info-item">
              <label>Address</label>
              <span>{{ displayAddress }}</span>
            </div>
          </div>

          <!-- Edit Form -->
          <form v-else @submit.prevent="handleUpdate" class="edit-form">
            <div class="form-row">
              <div class="form-group">
                <label>Email</label>
                <input v-model="editForm.email" type="email" placeholder="email@example.com" />
              </div>
              <div class="form-group">
                <label>Phone</label>
                <input v-model="editForm.phone" type="text" placeholder="+1234567890" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Country</label>
                <input v-model="editForm.country" type="text" placeholder="USA" />
              </div>
              <div class="form-group">
                <label>Address</label>
                <input v-model="editForm.address" type="text" placeholder="123 Main Street" />
              </div>
            </div>
          </form>
        </div>

        <!-- Social Links -->
        <div
          v-if="selectedProfile.socialLinks && (selectedProfile.socialLinks.linkedin || selectedProfile.socialLinks.github || selectedProfile.socialLinks.website)"
          class="section"
        >
          <h3>Social Links</h3>
          <div class="social-links">
            <a
              v-if="selectedProfile.socialLinks.linkedin"
              :href="selectedProfile.socialLinks.linkedin"
              target="_blank"
              rel="noopener noreferrer"
              class="social-link"
            >
              🔗 LinkedIn
            </a>
            <a
              v-if="selectedProfile.socialLinks.github"
              :href="selectedProfile.socialLinks.github"
              target="_blank"
              rel="noopener noreferrer"
              class="social-link"
            >
              🔗 GitHub
            </a>
            <a
              v-if="selectedProfile.socialLinks.website"
              :href="selectedProfile.socialLinks.website"
              target="_blank"
              rel="noopener noreferrer"
              class="social-link"
            >
              🔗 Website
            </a>
          </div>
        </div>

        <!-- Sensitive Information (Owner only) -->
        <div v-if="showSensitiveFields" class="section">
          <h3>Sensitive Information</h3>
          <div class="info-grid">
            <div class="info-item" v-if="selectedProfile.bankAccount">
              <label>Bank Account</label>
              <span>{{ selectedProfile.bankAccount }}</span>
            </div>
            <div class="info-item" v-if="selectedProfile.idNumber">
              <label>ID Number</label>
              <span>{{ selectedProfile.idNumber }}</span>
            </div>
            <div class="info-item" v-if="selectedProfile.driverLicenseNumber">
              <label>Driver License</label>
              <span>{{ selectedProfile.driverLicenseNumber }}</span>
            </div>
          </div>
        </div>

        <!-- Tags -->
        <div v-if="selectedProfile.tags && selectedProfile.tags.length > 0" class="section">
          <h3>Tags</h3>
          <div class="tags">
            <span v-for="tag in selectedProfile.tags" :key="tag" class="tag">
              {{ tag }}
            </span>
          </div>
        </div>

        <!-- Notes -->
        <div v-if="selectedProfile.notes" class="section">
          <h3>Notes</h3>
          <p class="notes-text">{{ selectedProfile.notes }}</p>
        </div>

        <!-- Profile Picture -->
        <PersonalProfilePicture :profile="selectedProfile" />

        <!-- Attachments -->
        <PersonalProfileAttachments :profile="selectedProfile" :can-edit="canEdit" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useStore } from 'vuex';
import { useAuthStore } from '../../../composables/useAuth';
import { canEditPersonalProfile } from '../../../utils/profilePermissions';
import ProfileHeader from '../../Profiles/ProfileDrawer/ProfileHeader.vue';
import PersonalProfilePicture from './PersonalProfilePicture.vue';
import PersonalProfileAttachments from './PersonalProfileAttachments.vue';

const store = useStore();
const authStore = useAuthStore();

const selectedProfile = computed(() => store.getters['personalProfiles/selectedProfile']);
const hasSelectedProfile = computed(() => store.getters['personalProfiles/hasSelectedProfile']);

const isEditing = ref(false);
const saving = ref(false);

const canEdit = computed(() => {
  return canEditPersonalProfile(authStore.user, selectedProfile.value);
});

const showSensitiveFields = computed(() => {
  const profile = selectedProfile.value;
  if (!profile || !authStore.user) return false;
  
  const ownerId = profile.ownerUserId?._id || profile.ownerUserId;
  return ownerId === authStore.user._id;
});

const displayEmail = computed(() => {
  const profile = selectedProfile.value;
  return profile?.email || 'N/A';
});

const displayPhone = computed(() => {
  const profile = selectedProfile.value;
  return profile?.phone || 'N/A';
});

const displayAddress = computed(() => {
  const profile = selectedProfile.value;
  return profile?.address || 'N/A';
});

const editForm = ref({
  name: '',
  status: 'active',
  email: '',
  phone: '',
  country: '',
  address: ''
});

watch(() => selectedProfile.value, (newProfile) => {
  if (newProfile) {
    editForm.value = {
      name: newProfile.name || '',
      status: newProfile.status || 'active',
      email: newProfile.email || '',
      phone: newProfile.phone || '',
      country: newProfile.country || '',
      address: newProfile.address || ''
    };
  } else {
    isEditing.value = false;
  }
}, { immediate: true });

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString();
};

const handleUpdate = async () => {
  const profile = selectedProfile.value;
  if (!profile) return;
  
  saving.value = true;
  try {
    await store.dispatch('personalProfiles/updateProfile', {
      profileId: profile._id || profile.id,
      profileData: editForm.value
    });
    isEditing.value = false;
  } catch (error) {
    alert(error.message || 'Failed to update profile');
  } finally {
    saving.value = false;
  }
};

const handleClose = () => {
  isEditing.value = false;
  store.dispatch('personalProfiles/clearSelectedProfile');
};

const handleOverlayClick = () => {
  handleClose();
};
</script>

<style scoped>
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  z-index: 1000;
}

.drawer {
  width: 500px;
  max-width: 500px;
  height: 100vh;
  background: var(--bg-primary);
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

@media (max-width: 600px) {
  .drawer {
    width: calc(100vw - 40px);
    max-width: calc(100vw - 40px);
  }
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 30px;
}

.section-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 20px;
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

.section {
  margin-bottom: 30px;
  padding-bottom: 30px;
  border-bottom: 1px solid #f0f0f0;
}

.section:last-child {
  border-bottom: none;
}

.section h3 {
  margin: 0 0 16px 0;
  color: #2c3e50;
  font-size: 1.1rem;
  font-weight: 600;
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

.info-item span {
  color: #2c3e50;
  font-size: 0.95rem;
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

.status-archived {
  background: #95a5a6;
  color: white;
}

.edit-form {
  margin-top: 16px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group label {
  font-size: 0.85rem;
  color: #2c3e50;
  font-weight: 500;
}

.form-group input,
.form-group select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.95rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

.btn-cancel,
.btn-save {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-cancel {
  background: #95a5a6;
  color: white;
}

.btn-save {
  background: #2ecc71;
  color: white;
}

.btn-save:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.social-links {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.social-link {
  color: #3498db;
  text-decoration: none;
  font-size: 0.95rem;
}

.social-link:hover {
  text-decoration: underline;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  background: #ecf0f1;
  color: #2c3e50;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
}

.notes-text {
  color: #2c3e50;
  line-height: 1.6;
  white-space: pre-wrap;
}
</style>
