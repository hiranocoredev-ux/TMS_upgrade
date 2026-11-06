<template>
  <div class="profiles-cards-wrap">
    <div v-if="profiles.length === 0" class="empty-state">
      No profiles found.
      <button v-if="canCreate" type="button" @click="$emit('create')" class="btn-link">
        Create one
      </button>
    </div>
    <div v-else class="profiles-cards">
      <ProfileRow
        v-for="profile in profiles"
        :key="profile._id || profile.id"
        :profile="profile"
        @view="handleView"
        @edit="handleEdit"
        @delete="handleDelete"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useAuthStore } from '../../composables/useAuth';
import { normalizeRole, ROLES } from '../../constants/roles.js';
import ProfileRow from './ProfileRow.vue';

defineProps({
  profiles: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['view', 'edit', 'delete', 'create']);

const authStore = useAuthStore();

const canCreate = computed(() => {
  if (!authStore.user) return false;
  const userRole = normalizeRole(authStore.user.role, authStore.user.degree);
  return (
    userRole === ROLES.SUPER_ADMIN ||
    userRole === ROLES.GROUP_BOSS ||
    authStore.user.editor === true
  );
});

const handleView = (profile) => {
  emit('view', profile);
};

const handleEdit = (profile) => {
  emit('edit', profile);
};

const handleDelete = (profile) => {
  emit('delete', profile);
};
</script>

<style scoped>
.profiles-cards-wrap {
  width: 100%;
}

.profiles-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-lg);
}

.empty-state {
  text-align: center;
  padding: var(--spacing-3xl);
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-light);
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
}

.btn-link {
  background: none;
  border: none;
  color: var(--color-primary);
  cursor: pointer;
  text-decoration: none;
  padding: 0;
  font-size: inherit;
  font-weight: var(--font-weight-semibold);
  transition: color var(--transition-fast);
  margin-left: var(--spacing-xs);
}

.btn-link:hover {
  color: var(--color-primary-dark);
  text-decoration: underline;
}

@media (max-width: 480px) {
  .profiles-cards {
    grid-template-columns: 1fr;
  }
}
</style>
