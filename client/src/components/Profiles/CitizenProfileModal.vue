<template>
  <Teleport to="body">
    <div class="cpm-overlay" @mousedown.self="requestClose">
      <div ref="dialogRef" class="cpm-dialog" role="dialog" aria-modal="true" aria-labelledby="cpm-title">
        <header class="cpm-head">
          <div>
            <h2 id="cpm-title">{{ profile ? 'Edit citizen profile' : 'New citizen profile' }}</h2>
            <p class="cpm-sub">Owner, share and the accounts this profile holds.</p>
          </div>
          <button type="button" class="cpm-close" aria-label="Close" :disabled="saving" @click="requestClose">×</button>
        </header>

        <form id="cpm-form" class="cpm-body" novalidate @submit.prevent="save">
          <div class="cpm-photo-row">
            <div class="cpm-photo" :class="{ 'is-empty': !photoUrl }">
              <img v-if="photoUrl" :src="photoUrl" alt="" />
              <span v-else aria-hidden="true">👤</span>
            </div>
            <div class="cpm-photo-actions">
              <span class="cpm-photo-label">Photo</span>
              <div class="cpm-photo-buttons">
                <button type="button" class="cpm-btn cpm-btn--small" :disabled="uploadingPhoto" @click="photoInput?.click()">
                  {{ uploadingPhoto ? 'Uploading…' : photoUrl ? 'Replace' : 'Upload photo' }}
                </button>
                <button v-if="photoUrl" type="button" class="cpm-btn cpm-btn--small" @click="clearPhoto">Remove</button>
              </div>
              <small class="cpm-photo-hint">JPG or PNG, up to 10MB.</small>
              <input
                ref="photoInput"
                type="file"
                accept="image/png,image/jpeg"
                class="cpm-file"
                @change="onPhotoPicked"
              />
            </div>
          </div>

          <div class="cpm-grid">
            <label class="cpm-field">
              <span>Citizen name</span>
              <input v-model.trim="form.name" type="text" required maxlength="120" placeholder="e.g. John Miller" />
            </label>
            <div class="cpm-field">
              <span>Country</span>
              <CountrySelect v-model="form.countryCode" />
            </div>
            <label class="cpm-field">
              <span>Share %</span>
              <input v-model.number="form.sharePercent" type="number" min="0" max="100" step="1" />
            </label>
            <label class="cpm-field">
              <span>Owner</span>
              <select v-model="form.ownerUserId" required :disabled="!canReassign">
                <option value="">Select member</option>
                <option v-for="u in owners" :key="u.id" :value="u.id">
                  {{ u.name }}<template v-if="u.group"> · {{ u.group }}</template>
                </option>
              </select>
              <small v-if="!canReassign" class="cpm-lock">Only an admin can hand this profile to another member.</small>
            </label>
            <label class="cpm-field">
              <span>Status</span>
              <select v-model="form.status">
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>

          <section class="cpm-accounts">
            <h3>Accounts</h3>
            <p class="cpm-hint">
              Tick the {{ isJobOwner ? 'profiles' : 'platforms' }} this profile holds. A big profile
              (or one with reviews) reads green; a fresh one reads grey.
            </p>
            <table class="cpm-table">
              <thead>
                <tr>
                  <th scope="col">Platform</th>
                  <th scope="col" class="c-has">Has account</th>
                  <th scope="col" class="c-state">State</th>
                  <th scope="col" class="c-reviews">Reviews</th>
                  <th scope="col" class="c-managers">Manage members</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in accountRows" :key="p.key" :class="{ 'is-off': !accounts[p.key].on }">
                  <th scope="row">
                    <span class="cpm-platform">{{ p.label }}</span>
                    <span v-if="p.short !== p.label" class="cpm-short">{{ p.short }}</span>
                  </th>
                  <td class="c-has">
                    <input v-model="accounts[p.key].on" type="checkbox" :aria-label="`${p.label} account`" />
                  </td>
                  <td class="c-state">
                    <select v-model="accounts[p.key].size" :disabled="!accounts[p.key].on" :aria-label="`${p.label} state`">
                      <option value="new">New profile</option>
                      <option value="big">Big profile</option>
                    </select>
                  </td>
                  <td class="c-reviews">
                    <input
                      v-if="p.reviews"
                      v-model="accounts[p.key].reviewCount"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="—"
                      :disabled="!accounts[p.key].on"
                      :aria-label="`${p.label} review count`"
                    />
                    <span v-else class="cpm-dash">—</span>
                  </td>
                  <td class="c-managers">
                    <MemberPicker
                      v-model="accounts[p.key].managerUserIds"
                      :members="owners"
                      :disabled="!accounts[p.key].on"
                      compact
                      placeholder="Add member"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <label class="cpm-field cpm-field--full">
            <span>Note</span>
            <textarea v-model.trim="form.note" rows="2" maxlength="2000" placeholder="Optional"></textarea>
          </label>
        </form>

        <footer class="cpm-foot">
          <p v-if="errorMsg" class="cpm-error" role="alert">{{ errorMsg }}</p>
          <span v-else class="cpm-count">{{ selectedCount }} account{{ selectedCount === 1 ? '' : 's' }} selected</span>
          <div class="cpm-actions">
            <button type="button" class="cpm-btn" :disabled="saving" @click="requestClose">Cancel</button>
            <button type="submit" form="cpm-form" class="cpm-btn cpm-btn--primary" :disabled="saving">
              {{ saving ? 'Saving…' : profile ? 'Save changes' : 'Create profile' }}
            </button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { PROFILE_PLATFORMS, JOB_PROFILE_KINDS, WORKING_ROLES } from '../../constants/profiles';
import CountrySelect from '../common/CountrySelect.vue';
import MemberPicker from '../common/MemberPicker.vue';
import {
  createCitizenProfile,
  updateCitizenProfile,
  uploadCitizenImage,
  citizenImageUrl,
} from '../../services/citizenProfiles';

const props = defineProps({
  /** The profile being edited, or null for a new one. */
  profile: { type: Object, default: null },
  /** Members who can own a profile: [{ id, name, group, workingRole }] */
  owners: { type: Array, default: () => [] },
  /** Pre-selected owner for a new profile. */
  defaultOwnerId: { type: String, default: '' },
  /** False for an owner editing their own profile: they may not reassign it. */
  canReassign: { type: Boolean, default: true },
});

const emit = defineEmits(['close', 'saved']);

const dialogRef = ref(null);
const saving = ref(false);
const errorMsg = ref('');

const photoInput = ref(null);
const uploadingPhoto = ref(false);
const photoFileId = ref(props.profile?.photoFileId?._id || props.profile?.photoFileId || '');
const photoUrl = computed(() => citizenImageUrl(photoFileId.value));

async function onPhotoPicked(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  uploadingPhoto.value = true;
  errorMsg.value = '';
  try {
    const meta = await uploadCitizenImage(file);
    photoFileId.value = meta?.id || '';
  } catch (err) {
    errorMsg.value = err?.response?.data?.message || err?.message || 'Could not upload the photo.';
  } finally {
    uploadingPhoto.value = false;
  }
}

const clearPhoto = () => {
  photoFileId.value = '';
};

const form = reactive({
  name: props.profile?.name || '',
  countryCode: props.profile?.countryCode || '',
  sharePercent: props.profile?.sharePercent ?? 0,
  ownerUserId: String(props.profile?.ownerUserId?._id || props.profile?.ownerUserId || props.defaultOwnerId || ''),
  status: props.profile?.status || 'active',
  note: props.profile?.note || '',
});

const JOB_ROWS = JOB_PROFILE_KINDS.map((k) => ({ ...k, short: k.label, reviews: false }));
const ALL_ROWS = [...PROFILE_PLATFORMS, ...JOB_ROWS];

const isJobOwner = computed(() => {
  const owner = props.owners.find((u) => String(u.id) === String(form.ownerUserId));
  return owner?.workingRole === WORKING_ROLES.JOB_WORKING;
});

/** A job member keeps caller / keeper profiles; everyone else the platforms. */
const accountRows = computed(() => (isJobOwner.value ? JOB_ROWS : PROFILE_PLATFORMS));

/** One editable row per account, pre-filled from the profile's accounts. */
const accounts = reactive(
  Object.fromEntries(
    ALL_ROWS.map((p) => {
      const existing = (props.profile?.accounts || []).find((a) => a.platform === p.key);
      return [
        p.key,
        {
          on: !!existing,
          size: existing?.size || 'new',
          reviewCount: existing?.reviewCount ?? '',
          managerUserIds: (existing?.managerUserIds || []).map((m) => String(m?._id || m)),
        },
      ];
    }),
  ),
);

const selectedCount = computed(() => accountRows.value.filter((p) => accounts[p.key].on).length);

const toCount = (v) => {
  const t = String(v ?? '').trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : null;
};

async function save() {
  errorMsg.value = '';
  if (!form.name.trim()) {
    errorMsg.value = 'A citizen name is required.';
    return;
  }
  if (!form.ownerUserId) {
    errorMsg.value = 'Pick the member who owns this profile.';
    return;
  }

  const payload = {
    name: form.name.trim(),
    photoFileId: photoFileId.value || null,
    countryCode: form.countryCode || '',
    sharePercent: Number(form.sharePercent) || 0,
    ownerUserId: form.ownerUserId,
    status: form.status,
    note: form.note || '',
    accounts: accountRows.value.filter((p) => accounts[p.key].on).map((p) => ({
      platform: p.key,
      size: accounts[p.key].size || 'new',
      managerUserIds: accounts[p.key].managerUserIds || [],
      ...(p.reviews ? { reviewCount: toCount(accounts[p.key].reviewCount) } : {}),
    })),
  };

  saving.value = true;
  try {
    if (props.profile?._id) await updateCitizenProfile(props.profile._id, payload);
    else await createCitizenProfile(payload);
    emit('saved');
  } catch (err) {
    errorMsg.value = err?.response?.data?.message || err?.message || 'Could not save the profile.';
  } finally {
    saving.value = false;
  }
}

function requestClose() {
  if (!saving.value) emit('close');
}

const onKeydown = (e) => {
  if (e.key === 'Escape') requestClose();
};

onMounted(async () => {
  document.addEventListener('keydown', onKeydown);
  await nextTick();
  dialogRef.value?.querySelector('input')?.focus();
});

onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown));
</script>

<style scoped>
.cpm-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal-backdrop, 1040);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.55);
}

.cpm-dialog {
  display: flex;
  flex-direction: column;
  width: min(940px, 100%);
  max-height: min(90vh, 940px);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  background: var(--bg-primary);
  color: var(--text-primary);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.cpm-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--border-light);
}

.cpm-head h2 {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
}

.cpm-sub {
  margin: 2px 0 0;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.cpm-close {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-tertiary);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.cpm-close:hover:not(:disabled) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.cpm-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg);
  overflow-y: auto;
}

.cpm-lock {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  text-transform: none;
  letter-spacing: normal;
}

.cpm-btn--small {
  padding: 4px 10px;
  font-size: var(--font-size-xs);
}

.cpm-photo-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.cpm-photo {
  width: 84px;
  height: 84px;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  background: var(--bg-tertiary);
}

.cpm-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cpm-photo.is-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  color: var(--text-tertiary);
}

.cpm-photo-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cpm-photo-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cpm-photo-buttons {
  display: flex;
  gap: 6px;
}

.cpm-photo-hint {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.cpm-file {
  display: none;
}

.c-managers {
  width: 210px;
}

.cpm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--spacing-md);
}

.cpm-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  font-size: var(--font-size-sm);
}

.cpm-field--full {
  grid-column: 1 / -1;
}

.cpm-field > span {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cpm-field input,
.cpm-field select,
.cpm-field textarea {
  padding: 7px 10px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font: inherit;
}

.cpm-accounts h3 {
  margin: 0 0 2px;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
}

.cpm-hint {
  margin: 0 0 var(--spacing-sm);
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.cpm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.cpm-table th,
.cpm-table td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-light);
  text-align: left;
}

.cpm-table thead th {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: var(--bg-tertiary);
}

.cpm-table tbody tr.is-off {
  color: var(--text-tertiary);
}

.cpm-platform {
  font-weight: var(--font-weight-medium);
}

.cpm-short {
  margin-left: 8px;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background: var(--bg-tertiary);
  font-size: 11px;
  color: var(--text-tertiary);
}

.c-has {
  width: 110px;
  text-align: center !important;
}

.c-state {
  width: 160px;
}

.c-reviews {
  width: 110px;
}

.cpm-table select,
.cpm-table input[type='number'] {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  font: inherit;
}

.cpm-table input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}

.cpm-dash {
  color: var(--text-tertiary);
}

.cpm-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--border-light);
}

.cpm-count {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.cpm-error {
  margin: 0;
  font-size: var(--font-size-sm);
  color: #dc2626;
}

.cpm-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-left: auto;
}

.cpm-btn {
  padding: 7px 16px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}

.cpm-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.cpm-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.cpm-btn--primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--text-inverse);
}

.cpm-btn--primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
  color: var(--text-inverse);
}
</style>
