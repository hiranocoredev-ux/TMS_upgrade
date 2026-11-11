<template>
  <form @submit.prevent="handleSubmit"> <!-- Basic Information Section -->
    <div class="form-section">
      <h3>Basic Information</h3>
      <div class="form-group">
        <label>Profile Name *</label>
        <input v-model="form.name" type="text" required placeholder="e.g., John Doe - Frontend Developer" />
      </div>
      <div class="form-group">
        <label>Status *</label>
        <select v-model="form.status" required>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <div class="form-group">
        <label>Group *</label>
        <select v-model="form.group" required>
          <option v-for="opt in entityGroupOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
    </div> <!-- Contact Information Section -->
    <div class="form-section">
      <h3>Contact Information</h3>
      <div class="form-row">
        <div class="form-group"> <label>Email</label> <input v-model="form.email" type="email"
            placeholder="client@example.com" /> </div>
        <div class="form-group"> <label>Phone</label> <input v-model="form.phone" type="text"
            placeholder="+1234567890" /> </div>
      </div>
      <div class="form-row">
        <div class="form-group"> <label>Country</label>
          <CountrySelect v-model="form.country" value-type="name" />
        </div>
        <div class="form-group"> <label>Address</label> <input v-model="form.address" type="text"
            placeholder="123 Main Street" /> </div>
      </div>
    </div> <!-- Social Links Section -->
    <div class="form-section">
      <h3>Social Links</h3>
      <div class="form-row">
        <div class="form-group"> <label>LinkedIn URL</label> <input v-model="form.socialLinks.linkedin" type="url"
            placeholder="https://linkedin.com/in/..." /> </div>
        <div class="form-group"> <label>GitHub URL</label> <input v-model="form.socialLinks.github" type="url"
            placeholder="https://github.com/..." /> </div>
      </div>
      <div class="form-group"> <label>Website URL</label> <input v-model="form.socialLinks.website" type="url"
          placeholder="https://example.com" /> </div>
    </div> <!-- Professional Information Section -->
    <div class="form-section">
      <h3>Professional Information</h3>
      <div class="form-group"> <label>Experience</label> <textarea v-model="form.experience" rows="4"
          placeholder="5 years as Senior Developer..."></textarea> </div>
      <div class="form-group"> <label>Education</label> <textarea v-model="form.education" rows="4"
          placeholder="BS Computer Science..."></textarea> </div>
    </div> <!-- Sensitive Information Section (Owner/Admin only) -->
    <div class="form-section" v-if="canEditSensitiveFields">
      <h3>Sensitive Information</h3>
      <div class="form-row">
        <div class="form-group"> <label>Bank Account</label> <input v-model="form.bankAccount" type="text"
            placeholder="Account number" /> </div>
        <div class="form-group"> <label>ID Number</label> <input v-model="form.idNumber" type="text"
            placeholder="National ID" /> </div>
      </div>
      <div class="form-group"> <label>Driver License Number</label> <input v-model="form.driverLicenseNumber"
          type="text" placeholder="Driver license number" /> </div>
    </div> <!-- Tags Section -->
    <div class="form-section">
      <h3>Tags</h3>
      <div class="form-group"> <input v-model="tagsInput" type="text"
          placeholder="Enter tags separated by commas (e.g., developer, remote, senior)" @blur="updateTags"
          @keyup.enter="updateTags" />
        <div v-if="form.tags.length > 0" class="tags-preview"> <span v-for="tag in form.tags" :key="tag"
            class="tag-preview"> {{ tag }} <button type="button" @click="removeTag(tag)" class="tag-remove">âœ•</button>
          </span> </div>
      </div>
    </div> <!-- Notes Section -->
    <div class="form-section">
      <h3>Notes</h3>
      <div class="form-group"> <textarea v-model="form.notes" rows="4" placeholder="Additional notes..."></textarea>
      </div>
    </div> <!-- File Upload Section -->
    <FileUploadSection v-model:picture-file="pictureFile" v-model:attachment-files="attachmentFiles" />
    <div class="form-actions"> <button type="button" @click="$emit('cancel')" class="btn-cancel">Cancel</button> <button
        type="submit" :disabled="saving" class="btn-save"> {{ saving ? 'Saving...' : (profile ? 'Update' : 'Create') }}
      </button> </div>
  </form>
</template>
<script setup>
import { ref, watch, computed } from 'vue';
import { useAuthStore } from '../../../composables/useAuth';
import { normalizeRole, ROLES, isFullAdminRole } from '../../../constants/roles.js';
import { ENTITY_GROUP_OPTIONS, DEFAULT_ENTITY_GROUP } from '../../../constants/groups.js';
import FileUploadSection from './FileUploadSection.vue';
import CountrySelect from '../../common/CountrySelect.vue';

const entityGroupOptions = ENTITY_GROUP_OPTIONS;

/* ---------------- props / emits ---------------- */

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

/* ---------------- stores ---------------- */

const authStore = useAuthStore();

/* ---------------- refs ---------------- */

const tagsInput = ref('');
const pictureFile = ref(null);
const attachmentFiles = ref([]);

/* ---------------- computed ---------------- */

const canEditSensitiveFields = computed(() => {
  if (!authStore.user) return false;
  if (!props.profile) return true;

  const ownerId =
    props.profile.ownerUserId?._id ||
    props.profile.ownerUserId;

  const userRole = normalizeRole(authStore.user.role);

  return (
    ownerId === authStore.user._id ||
    isFullAdminRole(userRole)
  );
});

/* ---------------- form state ---------------- */

const form = ref({
  name: '',
  email: '',
  status: 'active',
  group: DEFAULT_ENTITY_GROUP,
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
  experience: '',
  education: '',
  tags: [],
  notes: ''
});

/* ---------------- helpers (MUST be hoisted) ---------------- */

function resetForm() {
  form.value = {
    name: '',
    email: '',
    status: 'active',
    group: DEFAULT_ENTITY_GROUP,
    phone: '',
    country: '',
    address: '',
    anydeskNumber: '',
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
};
// Watch profile changes and update form
watch(() => props.profile, (newProfile) => {
  if (newProfile) {
    form.value = {
      name: newProfile.name || '',
      email: newProfile.email || '',
      status: newProfile.status || 'active',
      group: newProfile.group || DEFAULT_ENTITY_GROUP,
      phone: newProfile.phone || '',
      country: newProfile.country || '',
      address: newProfile.address || '',
      anydeskNumber: newProfile.anydeskNumber || '',
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
}, { immediate: true });

/* ---------------- methods ---------------- */

const updateTags = () => {
  if (!tagsInput.value.trim()) return;

  const newTags = tagsInput.value
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  form.value.tags = [
    ...new Set([...form.value.tags, ...newTags])
  ];

  tagsInput.value = '';
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
  margin-bottom: var(--spacing-xl);
  padding-bottom: var(--spacing-xl);
  border-bottom: 1px solid var(--border-light);
}

.form-section:last-of-type {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.form-section h3 {
  margin: 0 0 var(--spacing-lg) 0;
  color: var(--text-primary);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.01em;
}

.form-group {
  margin-bottom: var(--spacing-lg);
}

.form-group label {
  display: block;
  margin-bottom: var(--spacing-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: var(--spacing-md);
  border: 1.5px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  transition: all var(--transition-base);
  box-sizing: border-box;
  font-family: inherit;
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
  min-height: 100px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

.tags-preview {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}

.tag-preview {
  background: linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%);
  color: var(--text-primary);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  border: 1px solid var(--border-light);
}

.tag-remove {
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 0;
  font-size: var(--font-size-sm);
  line-height: 1;
  transition: color var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: var(--radius-full);
}

.tag-remove:hover {
  color: var(--color-error);
  background: rgba(239, 68, 68, 0.1);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  margin-top: var(--spacing-xl);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--border-light);
}

.btn-cancel,
.btn-save {
  padding: var(--spacing-md) var(--spacing-xl);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  transition: all var(--transition-base);
}

.btn-cancel {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1.5px solid var(--border-medium);
}

.btn-cancel:hover {
  background: var(--border-medium);
}

.btn-save {
  background: linear-gradient(135deg, var(--color-success) 0%, #059669 100%);
  color: var(--text-inverse);
  box-shadow: var(--shadow-md);
}

.btn-save:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .form-section {
    margin-bottom: var(--spacing-lg);
    padding-bottom: var(--spacing-lg);
  }
}
</style>
