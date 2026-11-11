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
          <p class="card-group">{{ formatGroupLabel(profile.group) }}</p>
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
import { normalizeRole, ROLES, isFullAdminRole } from '../../constants/roles.js';
import { formatGroupLabel } from '../../constants/groups.js';

const props = defineProps({
  profile: {
    type: Object,
    required: true
  }
});

defineEmits(['view', 'edit', 'delete']);

const authStore = useAuthStore();

const canEdit = computed(() => {
  if (!authStore.user || !props.profile) return false;
  const userRole = normalizeRole(authStore.user.role, authStore.user.degree);
  const userGroup = authStore.user?.group;
  const profileGroup = props.profile.group;

  if (isFullAdminRole(userRole)) return true;

  if (userGroup && !['SUPER_ADMIN', 'ADMIN'].includes(userGroup)) {
    if (profileGroup !== userGroup) return false;
  }

  if (
    props.profile.ownerUserId?._id === authStore.user._id ||
    props.profile.ownerUserId === authStore.user._id
  ) {
    return true;
  }

  if (userRole === ROLES.GROUP_BOSS) return true;

  return false;
});

const canDelete = computed(() => {
  if (!authStore.user || !props.profile) return false;
  const userRole = normalizeRole(authStore.user.role, authStore.user.degree);
  const userGroup = authStore.user?.group;
  const profileGroup = props.profile.group;

  if (isFullAdminRole(userRole)) return true;

  if (userGroup && !['SUPER_ADMIN', 'ADMIN'].includes(userGroup)) {
    if (profileGroup !== userGroup) return false;
  }

  if (
    props.profile.ownerUserId?._id === authStore.user._id ||
    props.profile.ownerUserId === authStore.user._id
  ) {
    return true;
  }

  if (userRole === ROLES.GROUP_BOSS) return true;

  return false;
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
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  cursor: pointer;
  transition: box-shadow var(--transition-base), transform var(--transition-base),
    border-color var(--transition-base);
}

.profile-card:hover {
  box-shadow: var(--shadow-lg);
  border-color: var(--border-medium);
  transform: translateY(-2px);
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.card-identity {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
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
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  line-height: 1.3;
  word-break: break-word;
}

.card-group {
  margin: var(--spacing-xs) 0 0;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
}

.card-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.card-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
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
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
}

.tag-more {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.status-badge {
  flex-shrink: 0;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
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
  gap: var(--spacing-sm);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--border-light);
}

.btn-view,
.btn-edit {
  padding: 8px 14px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  color: var(--text-inverse);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: opacity var(--transition-fast), transform var(--transition-fast);
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
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: background var(--transition-fast);
}

.btn-delete:hover {
  background: #c0392b;
}
</style>
