<template>
  <div class="profiles-cards-wrap">
    <div v-if="profiles.length === 0" class="empty-state">
      No profiles found.
      <button v-if="canCreate" type="button" @click="$emit('create')" class="btn-link">
        Create one
      </button>
    </div>
    <div v-else class="profiles-cards">
      <FreelancerProfileRow
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
import { canCreateFreelancerProfile } from '../../utils/profilePermissions';
import FreelancerProfileRow from './FreelancerProfileRow.vue';

defineProps({
  profiles: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['view', 'edit', 'delete', 'create']);

const authStore = useAuthStore();

const canCreate = computed(() => {
  return canCreateFreelancerProfile(authStore.user);
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
  gap: 20px;
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  background: var(--bg-primary);
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
  color: var(--text-tertiary);
}

.btn-link {
  background: none;
  border: none;
  color: var(--color-primary);
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
  margin-left: 8px;
}

.btn-link:hover {
  color: var(--color-primary-dark, #2980b9);
}

@media (max-width: 480px) {
  .profiles-cards {
    grid-template-columns: 1fr;
  }
}
</style>
