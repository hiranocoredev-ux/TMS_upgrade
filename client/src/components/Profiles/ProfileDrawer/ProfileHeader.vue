<template>
  <div class="drawer-header">
    <div class="header-left">
      <img
        v-if="profile.pictureFileId && profile.pictureFileId._id"
        :src="getPictureUrl(profile.pictureFileId._id)"
        alt="Profile Picture"
        class="profile-picture"
      />
      <div v-else class="profile-picture-placeholder">
        <span>👤</span>
      </div>
      <div>
        <h2>{{ profile.name || 'N/A' }}</h2>
        <p class="profile-status">
          <span :class="['status-badge', `status-${profile.status || 'active'}`]">
            {{ profile.status || 'active' }}
          </span>
        </p>
      </div>
    </div>
    <button @click="$emit('close')" class="close-btn">✕</button>
  </div>
</template>

<script setup>
defineProps({
  profile: {
    type: Object,
    required: true
  }
});

defineEmits(['close']);

const getPictureUrl = (fileId) => {
  if (!fileId) return '';
  return `/api/files/${fileId}/download`;
};
</script>

<style scoped>
.drawer-header {
  padding: 24px 30px;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  background: var(--bg-primary);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.profile-picture,
.profile-picture-placeholder {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.drawer-header h2 {
  margin: 0 0 4px 0;
  color: var(--text-primary);
  font-size: 1.5rem;
}

.profile-status {
  margin: 0;
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

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.close-btn:hover {
  background: #f0f0f0;
}
</style>
