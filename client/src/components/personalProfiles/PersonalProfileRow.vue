<template>
  <article class="profile-card" @click="$emit('view', profile)">
    <div class="card-top">
      <div class="card-identity">
        <div v-if="profile.pictureFileId" class="avatar-wrap">
          <img
            :src="getPictureUrl(profile.pictureFileId._id || profile.pictureFileId)"
            alt=""
            class="card-avatar"
          />
        </div>
        <span v-else class="card-avatar card-avatar-placeholder" aria-hidden="true">👤</span>
        <div class="card-title-block">
          <h3 class="card-name">{{ profile.name }}</h3>
        </div>
      </div>
      <span class="status-badge" :class="`status-${profile.status}`">
        {{ profile.status }}
      </span>
    </div>

    <div class="card-body">
      <div class="card-row">
        <span class="card-label">Country</span>
        <span class="card-value">{{ profile.country || '-' }}</span>
      </div>
      <div class="card-row card-contact">
        <span class="card-label">Contact</span>
        <div class="card-value-stack">
          <span v-if="profile.email">{{ displayEmail(profile) }}</span>
          <span v-if="profile.phone">{{ displayPhone(profile) }}</span>
          <span v-if="!profile.email && !profile.phone" class="text-muted">N/A</span>
        </div>
      </div>
      <div v-if="profile.tags && profile.tags.length" class="card-tags">
        <span
          v-for="tag in (profile.tags || []).slice(0, 4)"
          :key="tag"
          class="tag-small"
        >
          {{ tag }}
        </span>
        <span v-if="profile.tags.length > 4" class="tag-more">
          +{{ profile.tags.length - 4 }}
        </span>
      </div>
      <div class="card-row">
        <span class="card-label">Created</span>
        <span class="card-value">{{ formatDate(profile.createdAt) }}</span>
      </div>
    </div>

    <div class="card-actions" @click.stop>
      <button type="button" @click.stop="$emit('view', profile)" class="btn-view">View</button>
      <button
        v-if="canEdit"
        type="button"
        @click.stop="$emit('edit', profile)"
        class="btn-edit"
      >
        Edit
      </button>
      <button
        v-if="canDelete"
        type="button"
        @click.stop="$emit('delete', profile)"
        class="btn-delete"
      >
        Delete
      </button>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import { useAuthStore } from '../../composables/useAuth';
import {
  canEditPersonalProfile,
  canDeletePersonalProfile
} from '../../utils/profilePermissions';

const props = defineProps({
  profile: {
    type: Object,
    required: true
  }
});

defineEmits(['view', 'edit', 'delete']);

const authStore = useAuthStore();

const canEdit = computed(() => {
  return canEditPersonalProfile(authStore.user, props.profile);
});

const canDelete = computed(() => {
  return canDeletePersonalProfile(authStore.user, props.profile);
});

const getPictureUrl = (fileId) => {
  if (!fileId) return '';
  return `/api/files/${fileId}/download`;
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString();
};

const displayEmail = (profile) => {
  if (!profile.email) return '';
  return profile.email;
};

const displayPhone = (profile) => {
  if (!profile.phone) return '';
  return profile.phone;
};
</script>

<style scoped>
.profile-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg, 8px);
  box-shadow: var(--shadow-md, var(--shadow-sm));
  padding: var(--spacing-lg, 20px);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md, 16px);
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
}

.profile-card:hover {
  box-shadow: var(--shadow-lg, 0 8px 24px rgba(0, 0, 0, 0.08));
  border-color: var(--border-medium);
  transform: translateY(-2px);
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md, 16px);
}

.card-identity {
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 12px);
  min-width: 0;
}

.avatar-wrap {
  flex-shrink: 0;
}

.card-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.card-avatar-placeholder {
  border: 1px solid var(--border-light);
}

.card-title-block {
  min-width: 0;
}

.card-name {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
  word-break: break-word;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 0.875rem;
}

.card-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.card-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.card-value {
  color: var(--text-primary);
  word-break: break-word;
}

.card-value-stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--text-primary);
  word-break: break-word;
}

.text-muted {
  color: var(--text-tertiary);
  font-style: italic;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.tag-small {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
}

.tag-more {
  color: var(--text-tertiary);
  font-size: 0.75rem;
}

.status-badge {
  flex-shrink: 0;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.status-active {
  background: rgba(46, 204, 113, 0.15);
  color: #1e8449;
}

.status-archived {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
}

.btn-view,
.btn-edit {
  padding: 8px 14px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  color: var(--text-inverse, #fff);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: opacity 0.15s, transform 0.15s;
}

.btn-view:hover,
.btn-edit:hover {
  opacity: 0.92;
  transform: translateY(-1px);
}

.btn-delete {
  padding: 8px 14px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: background 0.15s;
}

.btn-delete:hover {
  background: #c0392b;
}
</style>
