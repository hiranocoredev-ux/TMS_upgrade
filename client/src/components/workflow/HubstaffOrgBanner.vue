<template>
  <div v-if="visible" class="hubstaff-org-banner" role="alert">
    <span class="hubstaff-org-banner__dot">!</span>
    <span class="hubstaff-org-banner__text">
      <template v-if="hubstaffOrg.organizationId">
        The Hubstaff organization ID changes every two weeks — please enter this period's ID
        (current: <strong>{{ hubstaffOrg.organizationId }}</strong>).
      </template>
      <template v-else>
        Set the Hubstaff organization ID so members' time can link to Hubstaff.
      </template>
      <span class="hubstaff-org-banner__hint">It is the number after /organizations/ in the Hubstaff address.</span>
    </span>
    <form class="hubstaff-org-banner__form" @submit.prevent="submit">
      <input
        v-model.trim="draft"
        class="hubstaff-org-banner__input"
        inputmode="numeric"
        placeholder="e.g. 795932"
        aria-label="Hubstaff organization ID"
      />
      <button type="submit" class="hubstaff-org-banner__btn" :disabled="saving || !draft">
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '../../composables/useAuth';
import { isFullAdminRole } from '../../constants/roles';
import { useHubstaffOrg } from '../../composables/useHubstaffOrg';

/**
 * Two-weekly reminder (super admin and admins): the Hubstaff organization ID
 * changes every two weeks; from each due date this asks for the new one until
 * someone saves it. The ID builds the "Open in Hubstaff" links.
 */
const toast = useToast();
const authStore = useAuthStore();
const { hubstaffOrg, loadHubstaffOrg, saveHubstaffOrg } = useHubstaffOrg();
const canUpdate = computed(() => isFullAdminRole(authStore.user?.role, authStore.user?.degree));
const visible = computed(() => canUpdate.value && hubstaffOrg.value.needsUpdate);
const draft = ref('');
const saving = ref(false);

const submit = async () => {
  if (!/^\d{1,15}$/.test(draft.value)) {
    toast.warning('Enter the number after /organizations/ in the Hubstaff address, e.g. 795932.');
    return;
  }
  saving.value = true;
  try {
    await saveHubstaffOrg(draft.value);
    toast.success(`Hubstaff organization ID saved (${draft.value}). Next reminder: ${hubstaffOrg.value.nextDue || 'in two weeks'}.`);
    draft.value = '';
  } catch {
    // The API interceptor already shows the error.
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  if (canUpdate.value) loadHubstaffOrg({ force: true });
});
</script>

<style scoped>
.hubstaff-org-banner {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin: 8px 10px 0;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(59, 130, 246, 0.35);
  background: rgba(59, 130, 246, 0.08);
  color: var(--text-primary, #1e3a8a);
  font-size: 0.78rem;
  font-weight: 600;
}
.hubstaff-org-banner__dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgb(37, 99, 235);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  font-weight: 800;
  flex-shrink: 0;
}
.hubstaff-org-banner__text { flex: 1; min-width: 220px; }
.hubstaff-org-banner__hint { display: block; font-weight: 500; opacity: 0.8; }
.hubstaff-org-banner__form { display: flex; gap: 6px; }
.hubstaff-org-banner__input {
  width: 130px;
  padding: 5px 8px;
  border-radius: 8px;
  border: 1px solid rgba(59, 130, 246, 0.45);
  background: var(--bg-primary, #fff);
  color: inherit;
  font: inherit;
}
.hubstaff-org-banner__btn {
  padding: 5px 12px;
  border-radius: 8px;
  border: none;
  background: rgb(37, 99, 235);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}
.hubstaff-org-banner__btn:disabled { opacity: 0.55; cursor: not-allowed; }
</style>
