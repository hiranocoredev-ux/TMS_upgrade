<template>
  <div class="cd-page">
    <div v-if="loading" class="cd-state"><span class="cd-spinner" aria-hidden="true"></span><p>Loading profile…</p></div>
    <div v-else-if="error" class="cd-state cd-state--error">
      <p>{{ error }}</p>
      <div class="cd-state__actions">
        <button type="button" class="cd-btn" @click="load">Try again</button>
        <router-link class="cd-btn" :to="{ name: 'CitizenProfiles' }">Back to profiles</router-link>
      </div>
    </div>

    <template v-else-if="profile">
      <nav class="cd-breadcrumb">
        <router-link :to="{ name: 'CitizenProfiles' }">Profiles</router-link>
        <span aria-hidden="true">›</span>
        <span>{{ profile.name }}</span>
      </nav>

      <!-- Who this citizen is -->
      <header class="cd-hero">
        <div class="cd-photo" :class="{ 'is-empty': !photoUrl }">
          <img v-if="photoUrl" :src="photoUrl" :alt="profile.name" />
          <span v-else aria-hidden="true">👤</span>
        </div>

        <div class="cd-hero__main">
          <div class="cd-hero__title">
            <h1>{{ profile.name }}</h1>
            <span v-if="profile.status === 'archived'" class="cd-tag">Archived</span>
            <span v-if="!canWrite" class="cd-tag cd-tag--muted">Read only</span>
          </div>

          <dl class="cd-facts">
            <div class="cd-fact">
              <dt>Country</dt>
              <dd>
                <span v-if="profile.countryCode">
                  {{ countryFlag(profile.countryCode) }} {{ countryName(profile.countryCode) || profile.countryCode }}
                </span>
                <span v-else class="cd-muted">—</span>
              </dd>
            </div>
            <div class="cd-fact">
              <dt>Share</dt>
              <dd>{{ profile.sharePercent ? `${profile.sharePercent}%` : '—' }}</dd>
            </div>
            <div class="cd-fact">
              <dt>Owner</dt>
              <dd class="cd-owner">
                <UserAvatar :name="ownerName" :profile-image="profile.ownerUserId?.avatarUrl" :size="22" :tooltip="false" />
                <span>{{ ownerName }}</span>
              </dd>
            </div>
            <div class="cd-fact">
              <dt>Group</dt>
              <dd>{{ profile.group || '—' }}</dd>
            </div>
            <div class="cd-fact">
              <dt>Accounts</dt>
              <dd>{{ profile.accounts?.length || 0 }}</dd>
            </div>
          </dl>

          <p v-if="profile.note" class="cd-note">{{ profile.note }}</p>
        </div>

        <div class="cd-hero__actions">
          <button v-if="canWrite" type="button" class="cd-btn cd-btn--primary" @click="editorOpen = true">Edit profile</button>
          <router-link class="cd-btn" :to="{ name: 'CitizenProfiles' }">Back</router-link>
        </div>
      </header>

      <!-- One collapsible panel per account, the clicked one already open -->
      <section class="cd-accounts">
        <header class="cd-accounts__head">
          <h2>Accounts</h2>
          <div class="cd-accounts__tools">
            <button type="button" class="cd-btn cd-btn--small" @click="expandAll">Expand all</button>
            <button type="button" class="cd-btn cd-btn--small" @click="collapseAll">Collapse all</button>
          </div>
        </header>

        <p v-if="!accountPanels.length" class="cd-empty">
          This profile holds no accounts yet.<span v-if="canWrite"> Add them with “Edit profile”.</span>
        </p>

        <div v-for="group in groupedPanels" :key="group.key" class="cd-group">
          <h3 class="cd-group__title">{{ group.label }}</h3>

          <article
            v-for="panel in group.panels"
            :key="panel.key"
            class="cd-panel"
            :class="{ 'is-open': openKeys.has(panel.key) }"
          >
            <button type="button" class="cd-panel__head" :aria-expanded="openKeys.has(panel.key)" @click="toggle(panel.key)">
              <span class="cd-caret" :class="{ 'is-open': openKeys.has(panel.key) }" aria-hidden="true">▸</span>
              <span class="cd-panel__name">{{ panel.label }}</span>
              <span class="cd-acc" :class="panel.established ? 'is-big' : 'is-new'">
                <span class="cd-acc__dot" aria-hidden="true"></span>
                {{ panel.established ? 'Big profile' : 'New profile' }}
              </span>
              <span v-if="panel.definition.reviews" class="cd-panel__meta">
                {{ panel.account.reviewCount || 0 }} review{{ (panel.account.reviewCount || 0) === 1 ? '' : 's' }}
              </span>
              <span v-if="panel.account.images?.length" class="cd-panel__meta">
                {{ panel.account.images.length }} image{{ panel.account.images.length === 1 ? '' : 's' }}
              </span>
              <span class="cd-panel__managers">
                <UserAvatar
                  v-for="m in panel.account.managerUserIds || []"
                  :key="m._id || m"
                  :name="m.name || 'Member'"
                  :profile-image="m.avatarUrl"
                  :size="20"
                />
                <span v-if="!panel.account.managerUserIds?.length" class="cd-muted">No manager</span>
              </span>
            </button>

            <div v-if="openKeys.has(panel.key)" class="cd-panel__body">
              <div class="cd-panel__grid">
                <label class="cd-field">
                  <span>State</span>
                  <select v-model="drafts[panel.key].size" :disabled="!canWrite">
                    <option value="new">New profile</option>
                    <option value="big">Big profile</option>
                  </select>
                </label>

                <label v-if="panel.definition.reviews" class="cd-field">
                  <span>Reviews</span>
                  <input v-model="drafts[panel.key].reviewCount" type="number" min="0" step="1" :disabled="!canWrite" placeholder="—" />
                </label>

                <div class="cd-field cd-field--wide">
                  <span>Manage members</span>
                  <MemberPicker v-model="drafts[panel.key].managerUserIds" :members="members" :disabled="!canWrite" :max-chips="4" />
                </div>
              </div>

              <label class="cd-field cd-field--full">
                <span>Comment</span>
                <textarea
                  v-model="drafts[panel.key].comment"
                  rows="3"
                  maxlength="4000"
                  :disabled="!canWrite"
                  placeholder="How this account is doing, what it is used for, anything worth knowing."
                ></textarea>
              </label>

              <div class="cd-images">
                <div class="cd-images__head">
                  <span class="cd-field__label">Account state images</span>
                  <button
                    v-if="canWrite"
                    type="button"
                    class="cd-btn cd-btn--small"
                    :disabled="uploadingKey === panel.key"
                    @click="pickImage(panel.key)"
                  >
                    {{ uploadingKey === panel.key ? 'Uploading…' : '＋ Add image' }}
                  </button>
                </div>

                <p v-if="!drafts[panel.key].images.length" class="cd-images__empty">
                  No screenshots yet.<span v-if="canWrite"> Upload one to show the account's state.</span>
                </p>

                <ul v-else class="cd-gallery">
                  <li v-for="(img, i) in drafts[panel.key].images" :key="img.fileId" class="cd-shot">
                    <a :href="imageUrl(img.fileId)" target="_blank" rel="noopener">
                      <img :src="imageUrl(img.fileId)" :alt="img.caption || `${panel.label} screenshot`" loading="lazy" />
                    </a>
                    <input
                      v-model="drafts[panel.key].images[i].caption"
                      type="text"
                      class="cd-shot__caption"
                      maxlength="300"
                      :disabled="!canWrite"
                      placeholder="Caption"
                    />
                    <button
                      v-if="canWrite"
                      type="button"
                      class="cd-shot__remove"
                      :aria-label="`Remove image ${i + 1}`"
                      @click="removeImage(panel.key, i)"
                    >
                      ×
                    </button>
                  </li>
                </ul>
              </div>

              <footer class="cd-panel__foot">
                <p class="cd-panel__info">
                  <span v-if="panel.account.managerUserIds?.length">
                    Managed by {{ (panel.account.managerUserIds || []).map((m) => m.name || 'Member').join(', ') }}.
                  </span>
                  <span v-else>No manage member set.</span>
                  <span v-if="lastUpdated"> Profile last updated {{ lastUpdated }}.</span>
                </p>
                <div v-if="canWrite" class="cd-panel__actions">
                  <span v-if="savedKey === panel.key" class="cd-saved">Saved</span>
                  <button type="button" class="cd-btn cd-btn--small" :disabled="!isDirty(panel.key)" @click="resetPanel(panel.key)">
                    Reset
                  </button>
                  <button
                    type="button"
                    class="cd-btn cd-btn--primary cd-btn--small"
                    :disabled="savingKey === panel.key || !isDirty(panel.key)"
                    @click="savePanel(panel)"
                  >
                    {{ savingKey === panel.key ? 'Saving…' : 'Save account' }}
                  </button>
                </div>
              </footer>
            </div>
          </article>
        </div>
      </section>

      <input ref="imageInput" type="file" accept="image/png,image/jpeg" class="cd-file" @change="onImagePicked" />

      <CitizenProfileModal
        v-if="editorOpen"
        :profile="profile"
        :owners="members"
        :can-reassign="profile.canAdminister"
        @close="editorOpen = false"
        @saved="onProfileSaved"
      />
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import UserAvatar from '../../components/UserAvatar.vue';
import MemberPicker from '../../components/common/MemberPicker.vue';
import CitizenProfileModal from '../../components/Profiles/CitizenProfileModal.vue';
import { PROFILE_PLATFORMS, JOB_PROFILE_KINDS } from '../../constants/profiles';
import { countryFlag, countryName } from '../../constants/countries';
import {
  getCitizenProfile,
  updateCitizenAccount,
  uploadCitizenImage,
  citizenImageUrl,
} from '../../services/citizenProfiles';
import { fetchUsers } from '../../services/users';
import { excludeSuperAdmin } from '../../utils/userFilters';

const route = useRoute();
const router = useRouter();

/** Every account kind, with the section it belongs to. */
const ACCOUNT_GROUPS = [
  { key: 'freelancing', label: 'Freelancing' },
  { key: 'ai_training', label: 'AI Training' },
  { key: 'job_working', label: 'Job profiles' },
];
const DEFINITIONS = [
  ...PROFILE_PLATFORMS.map((p) => ({ ...p, group: p.tab })),
  ...JOB_PROFILE_KINDS.map((k) => ({ ...k, short: k.label, reviews: false, group: 'job_working' })),
];
const DEFINITION_BY_KEY = new Map(DEFINITIONS.map((d) => [d.key, d]));

const profile = ref(null);
const members = ref([]);
const loading = ref(false);
const error = ref('');
const editorOpen = ref(false);

const openKeys = ref(new Set());
const drafts = reactive({});
const savingKey = ref('');
const savedKey = ref('');
const uploadingKey = ref('');
const imageInput = ref(null);
const pendingKey = ref('');

const canWrite = computed(() => !!profile.value?.canWrite);
const ownerName = computed(() => profile.value?.ownerUserId?.name || profile.value?.ownerUserId?.email || 'Unassigned');
const photoUrl = computed(() => citizenImageUrl(profile.value?.photoFileId));
const imageUrl = (fileId) => citizenImageUrl(fileId);

const lastUpdated = computed(() => {
  const raw = profile.value?.updatedAt;
  if (!raw) return '';
  return new Date(raw).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
});

/** One panel per account the profile actually holds. */
const accountPanels = computed(() => {
  const accounts = profile.value?.accounts || [];
  return accounts
    .map((account) => {
      const definition = DEFINITION_BY_KEY.get(account.platform);
      if (!definition) return null;
      return {
        key: account.platform,
        label: definition.label,
        definition,
        account,
        established: account.size === 'big' || (Number(account.reviewCount) || 0) > 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => DEFINITIONS.indexOf(a.definition) - DEFINITIONS.indexOf(b.definition));
});

const groupedPanels = computed(() =>
  ACCOUNT_GROUPS.map((group) => ({
    ...group,
    panels: accountPanels.value.filter((p) => p.definition.group === group.key),
  })).filter((group) => group.panels.length),
);

/** An editable copy per account, so Save sends only what changed. */
const draftFrom = (account) => ({
  size: account.size || 'new',
  reviewCount: account.reviewCount ?? '',
  managerUserIds: (account.managerUserIds || []).map((m) => String(m?._id || m)),
  comment: account.comment || '',
  images: (account.images || []).map((img) => ({
    fileId: String(img.fileId?._id || img.fileId),
    caption: img.caption || '',
  })),
});

function resetDrafts() {
  for (const key of Object.keys(drafts)) delete drafts[key];
  for (const panel of accountPanels.value) drafts[panel.key] = draftFrom(panel.account);
}

const resetPanel = (key) => {
  const panel = accountPanels.value.find((p) => p.key === key);
  if (panel) drafts[key] = draftFrom(panel.account);
};

const isDirty = (key) => {
  const panel = accountPanels.value.find((p) => p.key === key);
  if (!panel || !drafts[key]) return false;
  return JSON.stringify(drafts[key]) !== JSON.stringify(draftFrom(panel.account));
};

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await getCitizenProfile(route.params.id);
    profile.value = res?.data?.profile || null;
    resetDrafts();
    openRequestedAccount();
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || 'Could not load this profile.';
    profile.value = null;
  } finally {
    loading.value = false;
  }
}

/** The account clicked in the table opens; everything else stays collapsed. */
function openRequestedAccount() {
  const wanted = String(route.query.account || '');
  const next = new Set();
  if (wanted && accountPanels.value.some((p) => p.key === wanted)) next.add(wanted);
  else if (accountPanels.value.length === 1) next.add(accountPanels.value[0].key);
  openKeys.value = next;
}

onMounted(async () => {
  await load();
  try {
    const res = await fetchUsers({ limit: 1000 });
    members.value = excludeSuperAdmin(res?.data?.users || []).map((u) => ({
      id: String(u.id || u._id),
      name: u.name || u.email,
      group: u.group || '',
      avatarUrl: u.avatarUrl || '',
      workingRole: u.workingRole || '',
    }));
  } catch {
    members.value = [];
  }
});

watch(() => route.query.account, openRequestedAccount);

function toggle(key) {
  const next = new Set(openKeys.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  openKeys.value = next;
}

const expandAll = () => {
  openKeys.value = new Set(accountPanels.value.map((p) => p.key));
};
const collapseAll = () => {
  openKeys.value = new Set();
};

function pickImage(key) {
  pendingKey.value = key;
  imageInput.value?.click();
}

async function onImagePicked(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  const key = pendingKey.value;
  if (!file || !key) return;

  uploadingKey.value = key;
  error.value = '';
  try {
    const meta = await uploadCitizenImage(file);
    if (meta?.id) drafts[key].images.push({ fileId: String(meta.id), caption: '' });
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || 'Could not upload the image.';
  } finally {
    uploadingKey.value = '';
    pendingKey.value = '';
  }
}

const removeImage = (key, index) => drafts[key].images.splice(index, 1);

async function savePanel(panel) {
  const draft = drafts[panel.key];
  savingKey.value = panel.key;
  savedKey.value = '';
  error.value = '';
  try {
    const reviews = String(draft.reviewCount ?? '').trim();
    const res = await updateCitizenAccount(profile.value._id, panel.key, {
      size: draft.size,
      managerUserIds: draft.managerUserIds,
      comment: draft.comment,
      images: draft.images,
      ...(panel.definition.reviews ? { reviewCount: reviews === '' ? null : Number(reviews) } : {}),
    });
    profile.value = res?.data?.profile || profile.value;
    resetDrafts();
    savedKey.value = panel.key;
    setTimeout(() => {
      if (savedKey.value === panel.key) savedKey.value = '';
    }, 2500);
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || 'Could not save this account.';
  } finally {
    savingKey.value = '';
  }
}

async function onProfileSaved() {
  editorOpen.value = false;
  await load();
}

/** Nothing to show without an id — send the user back to the list. */
if (!route.params.id) router.replace({ name: 'CitizenProfiles' });
</script>

<style scoped>
.cd-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: min(1200px, 100%);
  margin: 0 auto;
  min-width: 0;
}

.cd-breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.cd-breadcrumb a {
  color: var(--color-primary);
  text-decoration: none;
}

.cd-breadcrumb a:hover {
  text-decoration: underline;
}

.cd-hero {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg) var(--spacing-xl);
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.cd-photo {
  width: 108px;
  height: 108px;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  background: var(--bg-tertiary);
}

.cd-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cd-photo.is-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  color: var(--text-tertiary);
}

.cd-hero__main {
  flex: 1;
  min-width: 260px;
}

.cd-hero__title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.cd-hero__title h1 {
  margin: 0;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.02em;
}

.cd-facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-lg);
  margin: 0;
}

.cd-fact dt {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cd-fact dd {
  margin: 2px 0 0;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.cd-owner {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cd-note {
  margin: var(--spacing-md) 0 0;
  padding: var(--spacing-sm) var(--spacing-md);
  border-left: 3px solid var(--border-medium);
  background: var(--bg-secondary);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.cd-hero__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cd-tag {
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.cd-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 7px 14px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
  cursor: pointer;
}

.cd-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.cd-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.cd-btn--primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--text-inverse);
}

.cd-btn--primary:hover:not(:disabled) {
  color: var(--text-inverse);
  filter: brightness(1.05);
}

.cd-btn--small {
  padding: 4px 10px;
  font-size: var(--font-size-xs);
}

.cd-accounts__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
}

.cd-accounts__head h2 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.cd-accounts__tools {
  display: flex;
  gap: 6px;
}

.cd-group {
  margin-bottom: var(--spacing-lg);
}

.cd-group__title {
  margin: 0 0 var(--spacing-xs);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.cd-panel {
  margin-bottom: 8px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  overflow: hidden;
}

.cd-panel.is-open {
  border-color: color-mix(in srgb, var(--color-primary) 40%, var(--border-medium));
  box-shadow: var(--shadow-sm);
}

.cd-panel__head {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  padding: 10px 14px;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
}

.cd-panel__head:hover {
  background: color-mix(in srgb, var(--color-primary) 5%, var(--bg-primary));
}

.cd-caret {
  color: var(--text-tertiary);
  transition: transform 0.15s ease;
}

.cd-caret.is-open {
  transform: rotate(90deg);
}

.cd-panel__name {
  font-weight: var(--font-weight-semibold);
}

.cd-panel__meta {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.cd-panel__managers {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.cd-acc {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
}

.cd-acc__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.cd-acc.is-big {
  background: color-mix(in srgb, #1f7a4d 14%, var(--bg-primary));
  color: #1f7a4d;
}

.cd-acc.is-new {
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
}

[data-theme='dark'] .cd-acc.is-big {
  background: color-mix(in srgb, #4ade80 18%, var(--bg-primary));
  color: #4ade80;
}

.cd-panel__body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg);
  border-top: 1px solid var(--border-light);
  background: var(--bg-secondary);
}

.cd-panel__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: var(--spacing-md);
  align-items: end;
}

.cd-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  font-size: var(--font-size-sm);
}

.cd-field--wide {
  grid-column: span 2;
}

.cd-field--full {
  width: 100%;
}

.cd-field > span,
.cd-field__label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cd-field input,
.cd-field select,
.cd-field textarea {
  padding: 7px 10px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font: inherit;
}

.cd-field textarea {
  resize: vertical;
}

.cd-images__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: 6px;
}

.cd-images__empty {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.cd-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--spacing-md);
  margin: 0;
  padding: 0;
  list-style: none;
}

.cd-shot {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
}

.cd-shot img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
}

.cd-shot__caption {
  width: 100%;
  padding: 4px 7px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-xs);
}

.cd-shot__remove {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.7);
  color: #fff;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}

.cd-panel__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding-top: var(--spacing-sm);
  border-top: 1px dashed var(--border-light);
}

.cd-panel__info {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.cd-panel__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cd-saved {
  font-size: var(--font-size-xs);
  color: #1f7a4d;
}

.cd-file {
  display: none;
}

.cd-empty {
  margin: 0;
  padding: var(--spacing-lg);
  border: 1px dashed var(--border-light);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.cd-muted {
  color: var(--text-tertiary);
}

.cd-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-3xl) var(--spacing-lg);
  border: 1px dashed var(--border-medium);
  border-radius: var(--radius-lg);
  color: var(--text-tertiary);
}

.cd-state p {
  margin: 0;
}

.cd-state--error {
  border-color: #dc2626;
  color: #dc2626;
}

.cd-state__actions {
  display: flex;
  gap: 8px;
}

.cd-spinner {
  width: 26px;
  height: 26px;
  border: 3px solid var(--border-light);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: cd-spin 0.8s linear infinite;
}

@keyframes cd-spin {
  to { transform: rotate(360deg); }
}
</style>
