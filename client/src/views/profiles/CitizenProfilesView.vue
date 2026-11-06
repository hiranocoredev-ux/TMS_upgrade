<template>
  <div class="cp-page">
    <header class="cp-header">
      <div>
        <h1>Citizen Profiles</h1>
        <p class="cp-sub">Every citizen profile, its owner, share and the accounts it holds.</p>
      </div>
      <div class="cp-tools">
        <label class="cp-field">
          <span class="cp-field__label">Group</span>
          <select v-model="groupFilter" class="cp-select">
            <option value="all">All groups</option>
            <option v-for="g in groups" :key="g.code" :value="g.code">{{ g.name }}</option>
          </select>
        </label>
        <label class="cp-field">
          <span class="cp-field__label">Status</span>
          <select v-model="statusFilter" class="cp-select">
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </label>
        <input v-model.trim="search" class="cp-search" type="search" placeholder="Search citizen…" aria-label="Search citizen" />
        <button v-if="canCreate" type="button" class="cp-btn cp-btn--primary" @click="openCreate">＋ New profile</button>
      </div>
    </header>

    <div v-if="loading" class="cp-state"><span class="cp-spinner" aria-hidden="true"></span><p>Loading profiles…</p></div>
    <div v-else-if="error" class="cp-state cp-state--error">
      <p>{{ error }}</p>
      <button type="button" class="cp-btn" @click="load">Try again</button>
    </div>
    <div v-else-if="!visibleProfiles.length" class="cp-state">
      <p class="cp-state__title">No citizen profiles yet</p>
      <p v-if="canCreate">Add the first one with “New profile”.</p>
    </div>

    <div v-else class="cp-table-wrap">
      <table class="cp-table">
        <thead>
          <tr>
            <th class="c-no" scope="col">No</th>
            <th class="c-name" scope="col">Citizen</th>
            <th class="c-country" scope="col">Country</th>
            <th class="c-share" scope="col">Share</th>
            <th class="c-owner" scope="col">Owner</th>
            <th v-for="col in columns" :key="col.key" class="c-acc" scope="col" :title="col.label">
              {{ col.short }}
            </th>
            <th v-if="showActions" class="c-actions" scope="col"></th>
          </tr>
        </thead>
        <tbody v-for="band in groupedProfiles" :key="band.code" class="cp-group">
          <tr class="cp-band">
            <th :colspan="columnCount" scope="rowgroup">
              <span class="cp-band__inner">
                <span class="cp-band__name">{{ band.name }}</span>
                <span class="cp-band__meta">
                  {{ band.profiles.length }} {{ band.profiles.length === 1 ? 'profile' : 'profiles' }}
                </span>
              </span>
            </th>
          </tr>
          <tr v-for="(profile, i) in band.profiles" :key="profile._id">
            <td class="c-no">{{ i + 1 }}</td>
            <td class="c-name">
              <router-link class="cp-name-link" :to="{ name: 'CitizenProfileDetail', params: { id: profile._id } }">
                <span class="cp-photo" :class="{ 'is-empty': !photoUrl(profile) }">
                  <img v-if="photoUrl(profile)" :src="photoUrl(profile)" alt="" loading="lazy" />
                  <span v-else aria-hidden="true">&#128100;</span>
                </span>
                <span class="cp-name">{{ profile.name }}</span>
              </router-link>
              <span v-if="profile.status === 'archived'" class="cp-tag">Archived</span>
            </td>
            <td class="c-country">
              <span v-if="profile.countryCode" :title="countryName(profile.countryCode)">
                {{ countryFlag(profile.countryCode) }} {{ profile.countryCode }}
              </span>
              <span v-else class="cp-muted">—</span>
            </td>
            <td class="c-share">{{ profile.sharePercent ? `${profile.sharePercent}%` : '—' }}</td>
            <td class="c-owner">
              <span class="cp-owner">
                <UserAvatar :name="ownerName(profile)" :profile-image="profile.ownerUserId?.avatarUrl" :size="22" :tooltip="false" />
                <span class="cp-owner__name">{{ ownerName(profile) }}</span>
                <span v-if="isBossProfile(profile)" class="cp-tag cp-tag--boss">Boss</span>
              </span>
            </td>
            <td v-for="col in columns" :key="col.key" class="c-acc">
              <button
                v-if="accountOf(profile, col.key)"
                type="button"
                class="cp-acc cp-acc--link"
                :class="accountClass(accountOf(profile, col.key))"
                :title="accountTitle(col, accountOf(profile, col.key)) + ' — open details'"
                @click="openAccount(profile, col.key)"
              >
                <span class="cp-acc__dot" aria-hidden="true"></span>
                <span class="cp-acc__text">{{ accountText(col, accountOf(profile, col.key)) }}</span>
              </button>
              <span v-else class="cp-muted">·</span>
            </td>
            <td v-if="showActions" class="c-actions">
              <button v-if="profile.canWrite" type="button" class="cp-icon-btn" title="Edit" @click="openEdit(profile)">✎</button>
              <button
                v-if="profile.canAdminister"
                type="button"
                class="cp-icon-btn cp-icon-btn--danger"
                title="Delete"
                @click="remove(profile)"
              >
                🗑
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="cp-legend">
      Click an account to open its details ·
      <span class="cp-acc is-big"><span class="cp-acc__dot"></span><span class="cp-acc__text">Big</span></span> big profile, or one with reviews ·
      <span class="cp-acc is-new"><span class="cp-acc__dot"></span><span class="cp-acc__text">New</span></span> new profile ·
      Upwork and Freelancer accounts show their review count.
    </p>

    <CitizenProfileModal
      v-if="editorOpen"
      :profile="editing"
      :owners="owners"
      @close="editorOpen = false"
      @saved="onSaved"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';
import UserAvatar from '../../components/UserAvatar.vue';
import CitizenProfileModal from '../../components/Profiles/CitizenProfileModal.vue';
import { PROFILE_PLATFORMS, JOB_PROFILE_KINDS } from '../../constants/profiles';
import { countryFlag, countryName } from '../../constants/countries';
import { listCitizenProfiles, deleteCitizenProfile, citizenImageUrl } from '../../services/citizenProfiles';
import { fetchGroups } from '../../services/admin';
import { fetchUsers } from '../../services/users';
import { excludeSuperAdmin } from '../../utils/userFilters';
import { normalizeRole, ROLES } from '../../constants/roles';

const router = useRouter();
const store = useStore();
const currentUser = computed(() => store.state.auth?.user || null);
const isSuperAdmin = computed(() => normalizeRole(currentUser.value?.role) === ROLES.SUPER_ADMIN);

const profiles = ref([]);
const groups = ref([]);
const owners = ref([]);
const canCreate = ref(false);
const loading = ref(false);
const error = ref('');

const groupFilter = ref('all');
const statusFilter = ref('active');
const search = ref('');

const editorOpen = ref(false);
const editing = ref(null);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await listCitizenProfiles({
      group: groupFilter.value,
      status: statusFilter.value,
    });
    profiles.value = res?.data?.profiles || [];
    canCreate.value = !!res?.data?.canCreate;
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || 'Could not load citizen profiles.';
    profiles.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await load();
  try {
    const [groupRes, userRes] = await Promise.all([fetchGroups(), fetchUsers({ limit: 1000 })]);
    groups.value = groupRes?.data?.groups || groupRes?.groups || [];
    // A group boss may only hand profiles to their own group; a super admin to anyone.
    const all = excludeSuperAdmin(userRes?.data?.users || []);
    const scoped = isSuperAdmin.value ? all : all.filter((u) => u.group === currentUser.value?.group);
    owners.value = scoped.map((u) => ({
      id: String(u.id || u._id),
      name: u.name || u.email,
      group: u.group || '',
      avatarUrl: u.avatarUrl || '',
      workingRole: u.workingRole || '',
    }));
  } catch {
    groups.value = [];
    owners.value = [];
  }
});

watch([groupFilter, statusFilter], load);

const JOB_COLUMNS = JOB_PROFILE_KINDS.map((k) => ({ ...k, short: k.label, reviews: false }));

/**
 * The eleven platform columns, plus the job ones only when a job member's
 * profile is on screen — so a normal team never carries two empty columns.
 */
const columns = computed(() => {
  const hasJobAccount = visibleProfiles.value.some((p) =>
    (p.accounts || []).some((a) => JOB_COLUMNS.some((c) => c.key === a.platform)),
  );
  return hasJobAccount ? [...PROFILE_PLATFORMS, ...JOB_COLUMNS] : [...PROFILE_PLATFORMS];
});

const visibleProfiles = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return profiles.value;
  return profiles.value.filter((p) => `${p.name} ${ownerName(p)}`.toLowerCase().includes(q));
});

const ownerName = (profile) => profile.ownerUserId?.name || profile.ownerUserId?.email || 'Unassigned';
const isBossProfile = (profile) =>
  normalizeRole(profile.ownerUserId?.role, profile.ownerUserId?.degree) === ROLES.GROUP_BOSS;

const groupOrder = computed(() => {
  const order = new Map();
  groups.value.forEach((g, i) => order.set(g.code, g.sortOrder ?? i));
  return order;
});

const columnCount = computed(() => 5 + columns.value.length + (showActions.value ? 1 : 0));

/**
 * One block per group, in the groups' own order. Inside a group the boss's
 * profiles come first, then the rest by owner, each owner's profiles by name.
 */
const groupedProfiles = computed(() => {
  const bands = new Map();
  for (const profile of visibleProfiles.value) {
    const code = profile.group || '';
    if (!bands.has(code)) {
      bands.set(code, {
        code,
        name: groups.value.find((g) => g.code === code)?.name || code || 'No group',
        profiles: [],
      });
    }
    bands.get(code).profiles.push(profile);
  }

  const rank = (profile) => (isBossProfile(profile) ? 0 : 1);
  for (const band of bands.values()) {
    band.profiles.sort(
      (a, b) =>
        rank(a) - rank(b) ||
        ownerName(a).localeCompare(ownerName(b)) ||
        String(a.name).localeCompare(String(b.name)),
    );
  }

  return [...bands.values()].sort(
    (a, b) => (groupOrder.value.get(a.code) ?? 99) - (groupOrder.value.get(b.code) ?? 99) || a.code.localeCompare(b.code),
  );
});
const photoUrl = (profile) => citizenImageUrl(profile.photoFileId);

/** Any row this user can act on gives the table its actions column. */
const showActions = computed(() => visibleProfiles.value.some((p) => p.canWrite || p.canAdminister));

/** Clicking an account opens the profile with that account already expanded. */
const openAccount = (profile, platform) =>
  router.push({ name: 'CitizenProfileDetail', params: { id: profile._id }, query: { account: platform } });
const accountOf = (profile, key) => (profile.accounts || []).find((a) => a.platform === key) || null;

/** Green when the account is established or has reviews; grey while it is new. */
const isEstablished = (account) => account.size === 'big' || (Number(account.reviewCount) || 0) > 0;
const accountClass = (account) => (isEstablished(account) ? 'is-big' : 'is-new');

/** Reviewed accounts show their review count; the rest just say Big or New. */
const accountText = (platform, account) => {
  const reviews = Number(account.reviewCount) || 0;
  if (platform.reviews && reviews > 0) return String(reviews);
  return isEstablished(account) ? 'Big' : 'New';
};

const accountTitle = (platform, account) => {
  const state = isEstablished(account) ? 'Big profile' : 'New profile';
  const reviews =
    platform.reviews && account.reviewCount !== null && account.reviewCount !== undefined
      ? ` · ${account.reviewCount} review${account.reviewCount === 1 ? '' : 's'}`
      : platform.reviews
        ? ' · no reviews yet'
        : '';
  return `${platform.label}: ${state}${reviews}`;
};

function openCreate() {
  editing.value = null;
  editorOpen.value = true;
}

function openEdit(profile) {
  editing.value = profile;
  editorOpen.value = true;
}

async function onSaved() {
  editorOpen.value = false;
  editing.value = null;
  await load();
}

async function remove(profile) {
  if (!window.confirm(`Delete the citizen profile “${profile.name}”?`)) return;
  try {
    await deleteCitizenProfile(profile._id);
    await load();
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || 'Could not delete the profile.';
  }
}
</script>

<style scoped>
.cp-page {
  --cp-no-width: 48px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: min(1600px, 100%);
  margin: 0 auto;
  min-width: 0;
}

.cp-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-lg) var(--spacing-xl);
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.cp-header h1 {
  margin: 0 0 var(--spacing-xs);
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.cp-sub {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.cp-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
}

.cp-field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.cp-field__label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cp-select,
.cp-search {
  padding: 7px 10px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.cp-btn {
  padding: 7px 14px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}

.cp-btn--primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--text-inverse);
}

.cp-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-3xl) var(--spacing-lg);
  border: 1px dashed var(--border-medium);
  border-radius: var(--radius-lg);
  color: var(--text-tertiary);
}

.cp-state p {
  margin: 0;
}

.cp-state__title {
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.cp-state--error {
  border-color: #dc2626;
  color: #dc2626;
}

.cp-spinner {
  width: 26px;
  height: 26px;
  border: 3px solid var(--border-light);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: cp-spin 0.8s linear infinite;
}

@keyframes cp-spin {
  to { transform: rotate(360deg); }
}

.cp-table-wrap {
  max-height: calc(100vh - var(--topbar-height, 64px) - 120px);
  overflow: auto;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  box-shadow: var(--shadow-sm);
}

.cp-table {
  width: 100%;
  min-width: 1080px;
  overflow: visible;
  border: 0;
  border-radius: 0;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.cp-table th,
.cp-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-light);
  background: inherit;
  white-space: nowrap;
  font-size: 13px;
  color: inherit;
  text-transform: none;
  letter-spacing: normal;
  text-align: left;
}

.cp-table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #14365f;
  color: #c9d8ec;
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

[data-theme='dark'] .cp-table thead th {
  background: #0b1322;
  color: #b6c3d6;
}

.cp-table tbody tr {
  background: var(--bg-primary);
}

.cp-band th {
  padding: 6px 12px;
  background: color-mix(in srgb, var(--color-primary) 8%, var(--bg-primary));
  border-bottom: 1px solid var(--border-light);
  text-align: left;
}

.cp-band__inner {
  /* The band spans the whole table, so its label sticks to the left edge
     and stays readable while the account columns scroll. */
  position: sticky;
  left: 12px;
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
}

.cp-band__name {
  font-size: 12px;
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.cp-band__meta {
  font-size: 11px;
  color: var(--text-tertiary);
}

.cp-tag--boss {
  background: color-mix(in srgb, var(--color-primary) 16%, var(--bg-primary));
  color: var(--color-primary);
}

.cp-table tbody tr:nth-child(even) {
  background: color-mix(in srgb, var(--text-primary) 2.5%, var(--bg-primary));
}

.cp-table tbody tr:hover {
  background: color-mix(in srgb, var(--color-primary) 7%, var(--bg-primary));
}

.c-no {
  position: sticky;
  left: 0;
  z-index: 1;
  width: var(--cp-no-width);
  min-width: var(--cp-no-width);
  max-width: var(--cp-no-width);
  text-align: center !important;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.c-name {
  position: sticky;
  left: var(--cp-no-width);
  z-index: 1;
  min-width: 215px;
  box-shadow: 1px 0 0 var(--border-light);
}

.cp-table thead th.c-no,
.cp-table thead th.c-name {
  z-index: 3;
}

.cp-name-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: inherit;
  text-decoration: none;
}

.cp-name-link:hover .cp-name {
  color: var(--color-primary);
  text-decoration: underline;
}

.cp-photo {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
}

.cp-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cp-photo.is-empty {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--text-tertiary);
}

.cp-name {
  font-weight: var(--font-weight-medium);
}

.c-country,
.c-share {
  width: 90px;
}

.c-share {
  font-variant-numeric: tabular-nums;
}

.c-owner {
  min-width: 170px;
}

.cp-owner {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.cp-owner__name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.c-acc {
  width: 76px;
  text-align: center !important;
}

.c-actions {
  width: 84px;
  text-align: right !important;
}

.cp-acc {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
}

.cp-acc__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.cp-acc--link {
  border: 0;
  font-family: inherit;
  cursor: pointer;
}

.cp-acc--link:hover {
  outline: 1px solid currentColor;
}

.cp-acc.is-big {
  background: color-mix(in srgb, #1f7a4d 14%, var(--bg-primary));
  color: #1f7a4d;
}

.cp-acc.is-new {
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
}

[data-theme='dark'] .cp-acc.is-big {
  background: color-mix(in srgb, #4ade80 18%, var(--bg-primary));
  color: #4ade80;
}

.cp-muted {
  color: var(--text-tertiary);
}

.cp-tag {
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
  font-size: 11px;
}

.cp-icon-btn {
  padding: 3px 7px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
}

.cp-icon-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.cp-icon-btn--danger:hover {
  border-color: #dc2626;
  color: #dc2626;
}

.cp-legend {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.cp-legend .cp-acc {
  margin: 0 2px;
}
</style>
