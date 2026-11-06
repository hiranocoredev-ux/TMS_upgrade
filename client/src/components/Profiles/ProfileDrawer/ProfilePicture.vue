<template>
  <div class="section">
    <div v-if="profile.pictureFileId" class="current-picture">
      <h3>Profile Picture</h3>
      <img :src="getPictureUrl(profile.pictureFileId._id)" alt="Profile Picture" class="preview-image" />
      <!-- <button @click="uploadPictureRef?.click()" class="btn-secondary">Replace Picture</button> -->
    </div>
    <input
      ref="uploadPictureRef"
      type="file"
      accept="image/jpeg,image/png"
      style="display: none"
      @change="handlePictureUpload"
    />
    <div v-if="uploading" class="upload-status">Uploading picture...</div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useStore } from 'vuex';

const props = defineProps({
  profile: {
    type: Object,
    required: true
  }
});

const store = useStore();
const uploadPictureRef = ref(null);
const uploading = ref(false);

const getPictureUrl = (fileId) => {
  if (!fileId) return '';
  return `/api/files/${fileId}/download`;
};

const handlePictureUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Only image files are allowed for profile pictures');
    return;
  }

  uploading.value = true;
  try {
    await store.dispatch('jobProfiles/uploadProfilePicture', {
      profileId: props.profile._id || props.profile.id,
      pictureFile: file
    });
  } catch (error) {
    alert(error.message || 'Failed to upload picture');
  } finally {
    uploading.value = false;
    if (uploadPictureRef.value) {
      uploadPictureRef.value.value = '';
    }
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

.current-picture {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}

.preview-image {
  max-width: 200px;
  max-height: 200px;
  border-radius: 8px;
  object-fit: cover;
}

.btn-secondary {
  padding: 8px 16px;
  background: #95a5a6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: #7f8c8d;
}

.upload-status {
  margin-top: 8px;
  color: #7f8c8d;
  font-size: 0.85rem;
}
</style>
