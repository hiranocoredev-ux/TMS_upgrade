<template>
  <form @submit.prevent="handleSubmit">
    <!-- Basic Information Section -->
    <div class="form-section">
      <h3>Basic Information</h3>
      <div class="form-group">
        <label>Profile Name *</label>
        <input v-model="form.name" type="text" required placeholder="e.g., John Doe" />
      </div>
      <div class="form-group">
        <label>Status *</label>
        <select v-model="form.status" required>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>
    </div>

    <!-- Contact Information Section -->
    <div class="form-section">
      <h3>Contact Information</h3>
      <div class="form-row">
        <div class="form-group">
          <label>Email</label>
          <input v-model="form.email" type="email" placeholder="email@example.com" />
        </div>
        <div class="form-group">
          <label>Phone</label>
          <input v-model="form.phone" type="text" placeholder="+1234567890" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Country</label>
          <CountrySelect v-model="form.country" value-type="name" />
        </div>
        <div class="form-group">
          <label>Address</label>
          <input v-model="form.address" type="text" placeholder="123 Main Street" />
        </div>
      </div>
    </div>

    <!-- Social Links Section -->
    <div class="form-section">
      <h3>Social Links</h3>
      <div class="form-row">
        <div class="form-group">
          <label>LinkedIn URL</label>
          <input v-model="form.socialLinks.linkedin" type="url" placeholder="https://linkedin.com/in/..." />
        </div>
        <div class="form-group">
          <label>GitHub URL</label>
          <input v-model="form.socialLinks.github" type="url" placeholder="https://github.com/..." />
        </div>
      </div>
      <div class="form-group">
        <label>Website URL</label>
        <input v-model="form.socialLinks.website" type="url" placeholder="https://example.com" />
      </div>
    </div>

    <!-- Sensitive Information Section (Owner only) -->
    <div class="form-section" v-if="canEditSensitiveFields">
      <h3>Sensitive Information</h3>
      <div class="form-row">
        <div class="form-group">
          <label>Bank Account</label>
          <input v-model="form.bankAccount" type="text" placeholder="Account number" />
        </div>
        <div class="form-group">
          <label>ID Number</label>
          <input v-model="form.idNumber" type="text" placeholder="National ID" />
        </div>
      </div>
      <div class="form-group">
        <label>Driver License Number</label>
        <input v-model="form.driverLicenseNumber" type="text" placeholder="Driver license number" />
      </div>
    </div>

    <!-- Tags Section -->
    <div class="form-section">
      <h3>Tags</h3>
      <div class="form-group">
        <input
          v-model="tagsInput"
          type="text"
          placeholder="Enter tags separated by commas"
          @blur="updateTags"
          @keyup.enter="updateTags"
        />
        <div v-if="form.tags.length > 0" class="tags-preview">
          <span v-for="tag in form.tags" :key="tag" class="tag-preview">
            {{ tag }}
            <button type="button" @click="removeTag(tag)" class="tag-remove">✕</button>
          </span>
        </div>
      </div>
    </div>

    <!-- Notes Section -->
    <div class="form-section">
      <h3>Notes</h3>
      <div class="form-group">
        <textarea v-model="form.notes" rows="4" placeholder="Additional notes..."></textarea>
      </div>
    </div>

    <!-- File Upload Section -->
    <FileUploadSection
      v-model:picture-file="pictureFile"
      v-model:attachment-files="attachmentFiles"
    />

    <div class="form-actions">
      <button type="button" @click="$emit('cancel')" class="btn-cancel">Cancel</button>
      <button type="submit" :disabled="saving" class="btn-save">
        {{ saving ? 'Saving...' : (profile ? 'Update' : 'Create') }}
      </button>
    </div>
  </form>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useAuthStore } from '../../../composables/useAuth';
import { normalizeRole, ROLES } from '../../../constants/roles.js';
import FileUploadSection from '../../Profiles/ProfileModal/FileUploadSection.vue';
import CountrySelect from '../../common/CountrySelect.vue';

const props = defineProps({
  profile: {
    type: Object,
    default: null
  },
  saving: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['submit', 'cancel']);

const authStore = useAuthStore();
const tagsInput = ref('');
const pictureFile = ref(null);
const attachmentFiles = ref([]);

const canEditSensitiveFields = computed(() => {
  if (!authStore.user) return false;
  if (!props.profile) return true;
  const ownerId = props.profile.ownerUserId?._id || props.profile.ownerUserId;
  return ownerId === authStore.user._id;
});

const form = ref({
  name: '',
  status: 'active',
  email: '',
  phone: '',
  country: '',
  address: '',
  socialLinks: {
    linkedin: '',
    github: '',
    website: '',
    other: []
  },
  bankAccount: '',
  idNumber: '',
  driverLicenseNumber: '',
  tags: [],
  notes: ''
});


function resetForm() {
    form.value = {
      name: '',
      status: 'active',
      email: '',
      phone: '',
      country: '',
      address: '',
      socialLinks: {
        linkedin: '',
        github: '',
        website: '',
        other: []
      },
      bankAccount: '',
      idNumber: '',
      driverLicenseNumber: '',
      tags: [],
      notes: ''
    };
  
    tagsInput.value = '';
    pictureFile.value = null;
    attachmentFiles.value = [];
  }
  
// Watch profile changes and update form
  
watch(
    () => props.profile,
    (newProfile) => {
      if (newProfile) {
        form.value = {
          name: newProfile.name || '',
          status: newProfile.status || 'active',
          email: newProfile.email || '',
          phone: newProfile.phone || '',
          country: newProfile.country || '',
          address: newProfile.address || '',
          socialLinks: {
            linkedin: newProfile.socialLinks?.linkedin || '',
            github: newProfile.socialLinks?.github || '',
            website: newProfile.socialLinks?.website || '',
            other: newProfile.socialLinks?.other || []
          },
          bankAccount: newProfile.bankAccount || '',
          idNumber: newProfile.idNumber || '',
          driverLicenseNumber: newProfile.driverLicenseNumber || '',
          tags: newProfile.tags || [],
          notes: newProfile.notes || ''
        };
  
        pictureFile.value = null;
        attachmentFiles.value = [];
      } else {
        resetForm();
      }
    },
    { immediate: true }
  );
const updateTags = () => {
  if (tagsInput.value.trim()) {
    const newTags = tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
    form.value.tags = [...new Set([...form.value.tags, ...newTags])];
    tagsInput.value = '';
  }
};

const removeTag = (tag) => {
  form.value.tags = form.value.tags.filter(t => t !== tag);
};

const handleSubmit = () => {
  emit('submit', {
    formData: form.value,
    pictureFile: pictureFile.value,
    attachmentFiles: attachmentFiles.value
  });
};
</script>

<style scoped>
.form-section {
  margin-bottom: 30px;
  padding-bottom: 30px;
  border-bottom: 1px solid #f0f0f0;
}

.form-section:last-of-type {
  border-bottom: none;
}

.form-section h3 {
  margin: 0 0 20px 0;
  color: #2c3e50;
  font-size: 1.1rem;
  font-weight: 600;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #2c3e50;
  font-size: 0.9rem;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.2s;
  box-sizing: border-box;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #3498db;
}

.form-group textarea {
  resize: vertical;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.tags-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.tag-preview {
  background: #ecf0f1;
  color: #2c3e50;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tag-remove {
  background: none;
  border: none;
  color: #7f8c8d;
  cursor: pointer;
  padding: 0;
  font-size: 0.85rem;
  line-height: 1;
}

.tag-remove:hover {
  color: #e74c3c;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;
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
</style>
