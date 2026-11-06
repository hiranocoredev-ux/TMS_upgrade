<template>
  <div class="form-section">
    <h3>Files</h3>
    <div class="file-upload-group">
      <div class="form-group">
        <label>Profile Picture</label>
        <div class="file-upload-control">
          <button type="button" @click="pictureInputRef?.click()" class="btn-upload">
            {{ pictureFile || pictureFileName ? 'Replace Picture' : 'Upload Picture' }}
          </button>
          <input
            ref="pictureInputRef"
            type="file"
            accept="image/jpeg,image/png"
            style="display: none"
            @change="handlePictureSelect"
          />
          <span v-if="pictureFileName" class="file-name">{{ pictureFileName }}</span>
        </div>
      </div>
      <div class="form-group">
        <label>Attachments</label>
        <div class="file-upload-control">
          <button type="button" @click="attachmentInputRef?.click()" class="btn-upload">
            + Add Attachments
          </button>
          <input
            ref="attachmentInputRef"
            type="file"
            accept=".pdf,.docx,.jpg,.jpeg,.png"
            style="display: none"
            multiple
            @change="handleAttachmentSelect"
          />
          <div v-if="attachmentFiles.length > 0" class="attachment-files">
            <div v-for="(file, index) in attachmentFiles" :key="index" class="attachment-file">
              <div class="file-info">
                <span class="file-name-text">{{ file.name }}</span>
                <span class="file-size">{{ formatFileSize(file.size) }}</span>
              </div>
              <button
                type="button"
                @click="removeAttachment(index)"
                class="remove-file"
                title="Remove file"
              >
                ✕
              </button>
            </div>
          </div>
          <p v-if="attachmentFiles.length === 0" class="file-hint">
            Select multiple files to upload (PDF, DOCX, JPG, PNG)
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  pictureFile: {
    type: File,
    default: null
  },
  attachmentFiles: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:pictureFile', 'update:attachmentFiles']);

const pictureInputRef = ref(null);
const attachmentInputRef = ref(null);
const pictureFileName = ref('');

const handlePictureSelect = (event) => {
  const file = event.target.files[0];
  if (file) {
    pictureFileName.value = file.name;
    emit('update:pictureFile', file);
  }
};

const handleAttachmentSelect = (event) => {
  const files = Array.from(event.target.files);
  emit('update:attachmentFiles', [...props.attachmentFiles, ...files]);
};

const removeAttachment = (index) => {
  const newFiles = [...props.attachmentFiles];
  newFiles.splice(index, 1);
  emit('update:attachmentFiles', newFiles);
};

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

watch(() => props.pictureFile, (newFile) => {
  if (!newFile) {
    pictureFileName.value = '';
    if (pictureInputRef.value) {
      pictureInputRef.value.value = '';
    }
  }
});
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

.file-upload-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.file-upload-control {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn-upload {
  padding: 8px 16px;
  background: #95a5a6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  width: fit-content;
  transition: background 0.2s;
}

.btn-upload:hover {
  background: #7f8c8d;
}

.file-name {
  color: #2c3e50;
  font-size: 0.9rem;
}

.attachment-files {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.attachment-file {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #2c3e50;
  gap: 12px;
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.file-name-text {
  font-weight: 500;
  color: #2c3e50;
  word-break: break-word;
}

.file-size {
  font-size: 0.8rem;
  color: #7f8c8d;
}

.file-hint {
  margin-top: 8px;
  font-size: 0.85rem;
  color: #7f8c8d;
  font-style: italic;
}

.remove-file {
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  width: 20px;
  height: 20px;
  cursor: pointer;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.remove-file:hover {
  background: #c0392b;
}
</style>
