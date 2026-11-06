<template>
  <div class="section">
    <h3>Attachments</h3>
    <div v-if="profile.attachments && profile.attachments.length > 0" class="attachments-list">
      <div v-for="file in profile.attachments" :key="file._id || file" class="attachment-item">
        <a
          :href="`/api/files/${file._id || file}/download`"
          target="_blank"
          class="attachment-link"
        >
          📎 {{ file.originalName || 'File' }}
          <span class="file-size">({{ formatFileSize(file.size) }})</span>
        </a>
        <button
          v-if="canEdit"
          @click="handleDeleteAttachment(file._id || file)"
          class="btn-delete-small"
          title="Delete attachment"
        >
          ✕
        </button>
      </div>
    </div>
    <div v-else class="empty-attachments">
      <p>No attachments</p>
    </div>
    <div v-if="canEdit" class="upload-actions">
      <input
        ref="uploadAttachmentRef"
        type="file"
        accept=".pdf,.docx,.jpg,.jpeg,.png"
        style="display: none"
        multiple
        @change="handleAttachmentUpload"
      />
      <div v-if="uploading" class="upload-status">Uploading attachment...</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useStore } from 'vuex';

const props = defineProps({
  profile: {
    type: Object,
    required: true
  },
  canEdit: {
    type: Boolean,
    default: false
  }
});

const store = useStore();
const uploadAttachmentRef = ref(null);
const uploading = ref(false);

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const handleAttachmentUpload = async (event) => {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;

  uploading.value = true;
  try {
    await store.dispatch('personalProfiles/uploadAttachments', {
      profileId: props.profile._id || props.profile.id,
      files
    });
  } catch (error) {
    alert(error.message || 'Failed to upload attachments');
  } finally {
    uploading.value = false;
    if (uploadAttachmentRef.value) {
      uploadAttachmentRef.value.value = '';
    }
  }
};

const handleDeleteAttachment = async (fileId) => {
  if (!confirm('Are you sure you want to delete this attachment?')) {
    return;
  }

  try {
    await store.dispatch('personalProfiles/deleteAttachment', {
      profileId: props.profile._id || props.profile.id,
      fileId
    });
  } catch (error) {
    alert(error.message || 'Failed to delete attachment');
  }
};
</script>

<style scoped>
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

.attachments-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.attachment-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 4px;
}

.attachment-link {
  color: #3498db;
  text-decoration: none;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.attachment-link:hover {
  text-decoration: underline;
}

.file-size {
  color: #7f8c8d;
  font-size: 0.85rem;
}

.btn-delete-small {
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-delete-small:hover {
  background: #c0392b;
}

.empty-attachments {
  color: #7f8c8d;
  font-style: italic;
  margin-bottom: 16px;
}

.upload-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.upload-status {
  color: #7f8c8d;
  font-size: 0.85rem;
}
</style>
