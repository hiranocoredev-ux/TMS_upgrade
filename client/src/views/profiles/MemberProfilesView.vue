<template>
  <div class="mp-page">
    <header class="mp-header">
      <div>
        <h1>Member's Summarize</h1>
        <p class="mp-sub">The same profiles, counted per team member: how many accounts each one holds and how many are established.</p>
      </div>
      <div class="mp-tools">
        <label class="mp-field">
          <span class="mp-field__label">Group</span>
          <select v-model="groupFilter" class="mp-select">
            <option value="all">All groups</option>
            <option v-for="g in groups" :key="g.code" :value="g.code">{{ g.name }}</option>
          </select>
        </label>
        <input v-model.trim="search" class="mp-search" type="search" placeholder="Search member…" aria-label="Search member" />
        <button type="button" class="mp-btn" @click="exportCsv">Export CSV</button>
      </div>
    </header>

    <div v-if="loading" class="mp-state"><span class="mp-spinner" aria-hidden="true"></span><p>Loading members…</p></div>
    <div v-else-if="error" class="mp-state mp-state--error">
      <p>{{ error }}</p>
      <button type="button" class="mp-btn" @click="load">Try again</button>
    </div>

    <template v-else>
      <section v-for="table in tables" :key="table.key" class="mp-section">
        <header class="mp-section__head">
          <h2>{{ table.title }}</h2>
          <span class="mp-count">{{ table.rows.length }} {{ table.rows.length === 1 ? 'member' : 'members' }} · {{ table.profileCount }} profiles</span>
        </header>

        <p v-if="!table.rows.length" class="mp-empty">No members in this role yet.</p>

        <div v-else class="mp-table-wrap">
          <table class="mp-table" :class="{ 'is-narrow': table.columns.length <= 4 }">
            <thead>
              <tr>
                <th class="c-no" scope="col">No</th>
                <th class="c-member" scope="col">Member</th>
                <th class="c-group" scope="col">Group</th>
                <th class="c-num" scope="col">Profiles</th>
                <th class="c-num" scope="col">Share</th>
                <th v-for="col in table.columns" :key="col.key" class="c-acc" scope="col" :title="col.label">{{ col.short }}</th>
              </tr>
            </thead>
            <tbody v-for="band in table.bands" :key="band.code">
              <tr class="mp-band">
                <th :colspan="5 + table.columns.length" scope="rowgroup">
                  <span class="mp-band__inner">
                    <span class="mp-band__name">{{ band.name }}</span>
                    <span class="mp-band__meta">
                      {{ band.rows.length }} {{ band.rows.length === 1 ? 'member' : 'members' }} ·
                      {{ band.profileCount }} profiles
                    </span>
                  </span>
                </th>
              </tr>
              <template v-for="(row, i) in band.rows" :key="row.id">
                <tr class="mp-row" :class="{ 'is-open': openMembers.has(row.id) }" @click="toggle(row.id)">
                  <td class="c-no">{{ i + 1 }}</td>
                  <td class="c-member">
                    <span class="mp-member">
                      <span class="mp-caret" :class="{ 'is-open': openMembers.has(row.id) }" aria-hidden="true">▸</span>
                      <UserAvatar :name="row.name" :profile-image="row.avatarUrl" :size="24" :tooltip="false" />
                      <span class="mp-member__name">{{ row.name }}</span>
                      <span v-if="row.isBoss" class="mp-tag">Boss</span>
                    </span>
                  </td>
                  <td class="c-group">{{ groupName(row.group) }}</td>
                  <td class="c-num">{{ row.profiles.length || '—' }}</td>
                  <td class="c-num">{{ row.sharePercent ? `${round(row.sharePercent)}%` : '—' }}</td>
                  <td v-for="col in table.columns" :key="col.key" class="c-acc">
                    <span v-if="row.tally[col.key]" class="mp-tally" :title="tallyTitle(col, row.tally[col.key])">
                      <span v-if="row.tally[col.key].big" class="mp-acc is-big">{{ bigText(col, row.tally[col.key]) }}</span>
                      <span v-if="row.tally[col.key].fresh" class="mp-acc is-new">{{ row.tally[col.key].fresh }}</span>
                    </span>
                    <span v-else class="mp-muted">·</span>
                  </td>
                </tr>
                <tr v-if="openMembers.has(row.id)" :key="`${row.id}-detail`" class="mp-detail-row">
                  <td :colspan="5 + table.columns.length">
                    <p v-if="!row.profiles.length" class="mp-detail-empty">No citizen profiles assigned yet.</p>
                    <table v-else class="mp-detail">
                      <thead>
                        <tr>
                          <th scope="col">Citizen</th>
                          <th scope="col">Country</th>
                          <th scope="col">Share</th>
                          <th v-for="col in table.columns" :key="col.key" :title="col.label">{{ col.short }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="profile in row.profiles" :key="profile._id">
                          <td>{{ profile.name }}</td>
                          <td>
                            <span v-if="profile.countryCode">{{ countryFlag(profile.countryCode) }} {{ profile.countryCode }}</span>
                            <span v-else class="mp-muted">—</span>
                          </td>
                          <td>{{ profile.sharePercent ? `${profile.sharePercent}%` : '—' }}</td>
                          <td v-for="col in table.columns" :key="col.key" class="c-acc">
                            <span v-if="accountOf(profile, col.key)" class="mp-acc" :class="accountClass(accountOf(profile, col.key))">
                              {{ accountText(col, accountOf(profile, col.key)) }}
                            </span>
                            <span v-else class="mp-muted">·</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </template>
            </tbody>
            <tfoot>
              <tr>
                <th class="c-no" scope="row"></th>
                <th class="c-member">Total</th>
                <th class="c-group"></th>
                <th class="c-num">{{ table.profileCount }}</th>
                <th class="c-num"></th>
                <th v-for="col in table.columns" :key="col.key" class="c-acc">
                  <span class="mp-tally">
                    <span v-if="table.totals[col.key].big" class="mp-acc is-big">{{ table.totals[col.key].big }}</span>
                    <span v-if="table.totals[col.key].fresh" class="mp-acc is-new">{{ table.totals[col.key].fresh }}</span>
                    <span v-if="!table.totals[col.key].big && !table.totals[col.key].fresh" class="mp-muted">·</span>
                  </span>
                </th>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <p class="mp-legend">
        <span class="mp-acc is-big">2</span> established accounts (big profile or with reviews) ·
        <span class="mp-acc is-new">1</span> new accounts · Upwork and Freelancer show total reviews in the tooltip.
        Click a member to see their profiles.
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import UserAvatar from '../../components/UserAvatar.vue';
import { PROFILE_PLATFORMS, JOB_PROFILE_KINDS, WORKING_ROLES } from '../../constants/profiles';
import { countryFlag } from '../../constants/countries';
import { listCitizenProfiles } from '../../services/citizenProfiles';
import { fetchGroups } from '../../services/admin';
import { fetchUsers } from '../../services/users';
import { excludeSuperAdmin } from '../../utils/userFilters';
import { normalizeRole, ROLES } from '../../constants/roles';

const PLATFORM_COLUMNS = PROFILE_PLATFORMS.map((p) => ({ ...p }));
const JOB_COLUMNS = JOB_PROFILE_KINDS.map((k) => ({ ...k, short: k.label, reviews: false }));

const profiles = ref([]);
const members = ref([]);
const groups = ref([]);
const loading = ref(false);
const error = ref('');

const groupFilter = ref('all');
const search = ref('');
const openMembers = ref(new Set());

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [profileRes, userRes] = await Promise.all([
      listCitizenProfiles({ status: 'active' }),
      fetchUsers({ limit: 1000 }),
    ]);
    profiles.value = profileRes?.data?.profiles || [];
    members.value = excludeSuperAdmin(userRes?.data?.users || []).map((u) => ({
      id: String(u.id || u._id),
      name: u.name || u.email,
      group: u.group || '',
      avatarUrl: u.avatarUrl || '',
      workingRole: u.workingRole || '',
      isBoss: normalizeRole(u.role, u.degree) === ROLES.GROUP_BOSS,
    }));
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || 'Could not load member profiles.';
    profiles.value = [];
    members.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await load();
  try {
    const res = await fetchGroups();
    groups.value = res?.data?.groups || res?.groups || [];
  } catch {
    groups.value = [];
  }
});

watch(groupFilter, () => {
  openMembers.value = new Set();
});

const groupName = (code) => groups.value.find((g) => g.code === code)?.name || code || '—';

/** Groups keep their own order; a group without a sortOrder falls to the end. */
const groupOrder = computed(() => {
  const order = new Map();
  groups.value.forEach((g, i) => order.set(g.code, g.sortOrder ?? i));
  return order;
});
const accountOf = (profile, key) => (profile.accounts || []).find((a) => a.platform === key) || null;

/** Green when the account is established or carries reviews; grey while it is new. */
const isEstablished = (account) => account.size === 'big' || (Number(account.reviewCount) || 0) > 0;
const accountClass = (account) => (isEstablished(account) ? 'is-big' : 'is-new');

/** Reviewed accounts show their review count; the rest just say Big or New. */
const accountText = (column, account) => {
  const reviews = Number(account.reviewCount) || 0;
  if (column.reviews && reviews > 0) return String(reviews);
  return isEstablished(account) ? 'Big' : 'New';
};

const bigText = (column, tally) =>
  column.reviews && tally.reviews > 0 ? `${tally.big} · ${tally.reviews}★` : String(tally.big);

const tallyTitle = (column, tally) => {
  const parts = [];
  if (tally.big) parts.push(`${tally.big} established`);
  if (tally.fresh) parts.push(`${tally.fresh} new`);
  if (column.reviews && tally.reviews) parts.push(`${tally.reviews} reviews total`);
  return `${column.label}: ${parts.join(' · ')}`;
};

const round = (n) => Math.round((Number(n) || 0) * 10) / 10;

/** Profiles grouped by the member who owns them. */
const profilesByOwner = computed(() => {
  const map = new Map();
  for (const profile of profiles.value) {
    const ownerId = String(profile.ownerUserId?._id || profile.ownerUserId || '');
    if (!ownerId) continue;
    if (!map.has(ownerId)) map.set(ownerId, []);
    map.get(ownerId).push(profile);
  }
  for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return map;
});

/** One row per member: their profiles, total share and per-platform tallies. */
const memberRows = computed(() => {
  const q = search.value.trim().toLowerCase();
  return members.value
    .filter((m) => groupFilter.value === 'all' || m.group === groupFilter.value)
    .filter((m) => !q || m.name.toLowerCase().includes(q))
    .map((member) => {
      const owned = profilesByOwner.value.get(member.id) || [];
      const tally = {};
      let sharePercent = 0;
      for (const profile of owned) {
        sharePercent += Number(profile.sharePercent) || 0;
        for (const account of profile.accounts || []) {
          const cell = tally[account.platform] || (tally[account.platform] = { big: 0, fresh: 0, reviews: 0 });
          if (isEstablished(account)) cell.big += 1;
          else cell.fresh += 1;
          cell.reviews += Number(account.reviewCount) || 0;
        }
      }
      return { ...member, profiles: owned, tally, sharePercent };
    })
    .sort(
      (a, b) =>
        (groupOrder.value.get(a.group) ?? 99) - (groupOrder.value.get(b.group) ?? 99) ||
        String(a.group).localeCompare(String(b.group)) ||
        Number(b.isBoss) - Number(a.isBoss) ||
        a.name.localeCompare(b.name),
    );
});

/** The rows of one table, cut into blocks by group (already in group order). */
const bandsOf = (rows) => {
  const bands = [];
  for (const row of rows) {
    const last = bands[bands.length - 1];
    if (last && last.code === row.group) last.rows.push(row);
    else bands.push({ code: row.group, name: groupName(row.group), rows: [row] });
  }
  return bands.map((band) => ({
    ...band,
    profileCount: band.rows.reduce((sum, row) => sum + row.profiles.length, 0),
  }));
};

const sumTotals = (rows, columns) => {
  const totals = {};
  for (const col of columns) totals[col.key] = { big: 0, fresh: 0, reviews: 0 };
  for (const row of rows) {
    for (const col of columns) {
      const cell = row.tally[col.key];
      if (!cell) continue;
      totals[col.key].big += cell.big;
      totals[col.key].fresh += cell.fresh;
      totals[col.key].reviews += cell.reviews;
    }
  }
  return totals;
};

/**
 * Two tables, because the two working roles hold different accounts. A member
 * without a working role still shows up wherever their profiles point, so no
 * profile is ever hidden.
 */
const tables = computed(() => {
  const rows = memberRows.value;
  const jobKeys = new Set(JOB_COLUMNS.map((c) => c.key));
  const isJob = (row) =>
    row.workingRole === WORKING_ROLES.JOB_WORKING ||
    (!row.workingRole && Object.keys(row.tally).some((key) => jobKeys.has(key)));
  const hasProfiles = (row) => row.profiles.length > 0;
  const canHold = (row) => row.workingRole === WORKING_ROLES.NORMAL_WORKING || row.workingRole === WORKING_ROLES.JOB_WORKING;

  const jobRows = rows.filter((r) => isJob(r) && (canHold(r) || hasProfiles(r)));
  const normalRows = rows.filter((r) => !isJob(r) && (r.workingRole === WORKING_ROLES.NORMAL_WORKING || hasProfiles(r)));

  return [
    { key: 'normal', title: 'Normal working', columns: PLATFORM_COLUMNS, rows: normalRows },
    { key: 'job', title: 'Job working', columns: JOB_COLUMNS, rows: jobRows },
  ].map((table) => ({
    ...table,
    bands: bandsOf(table.rows),
    profileCount: table.rows.reduce((sum, row) => sum + row.profiles.length, 0),
    totals: sumTotals(table.rows, table.columns),
  }));
});

function toggle(memberId) {
  const next = new Set(openMembers.value);
  if (next.has(memberId)) next.delete(memberId);
  else next.add(memberId);
  openMembers.value = next;
}

function exportCsv() {
  const lines = [];
  for (const table of tables.value) {
    lines.push([table.title]);
    lines.push(['No', 'Member', 'Group', 'Profiles', 'Share %', ...table.columns.map((c) => c.label)]);
    table.rows.forEach((row, i) => {
      lines.push([
        i + 1,
        row.name,
        groupName(row.group),
        row.profiles.length,
        round(row.sharePercent),
        ...table.columns.map((col) => {
          const cell = row.tally[col.key];
          if (!cell) return '';
          return `${cell.big} big / ${cell.fresh} new`;
        }),
      ]);
    });
    lines.push([]);
  }
  const csv = lines
    .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'members-profiles.csv';
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<style scoped>
.mp-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: min(1600px, 100%);
  margin: 0 auto;
  min-width: 0;
}

.mp-header {
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

.mp-header h1 {
  margin: 0 0 var(--spacing-xs);
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.mp-sub {
  margin: 0;
  max-width: 62ch;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.mp-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
}

.mp-field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.mp-field__label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.mp-select,
.mp-search {
  padding: 7px 10px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.mp-btn {
  padding: 7px 14px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}

.mp-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.mp-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-3xl) var(--spacing-lg);
  border: 1px dashed var(--border-medium);
  border-radius: var(--radius-lg);
  color: var(--text-tertiary);
}

.mp-state p {
  margin: 0;
}

.mp-state--error {
  border-color: #dc2626;
  color: #dc2626;
}

.mp-spinner {
  width: 26px;
  height: 26px;
  border: 3px solid var(--border-light);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: mp-spin 0.8s linear infinite;
}

@keyframes mp-spin {
  to { transform: rotate(360deg); }
}

.mp-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.mp-section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.mp-section__head h2 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.mp-count {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.mp-empty {
  margin: 0;
  padding: var(--spacing-lg);
  border: 1px dashed var(--border-light);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.mp-table-wrap {
  overflow: auto;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  box-shadow: var(--shadow-sm);
}

.mp-table {
  width: 100%;
  min-width: 1020px;
  overflow: visible;
  border: 0;
  border-radius: 0;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.mp-table.is-narrow {
  width: auto;
  min-width: 0;
}

.mp-table th,
.mp-table td {
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

.mp-table thead th {
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

[data-theme='dark'] .mp-table thead th {
  background: #0b1322;
  color: #b6c3d6;
}

.mp-table tfoot th {
  position: sticky;
  bottom: 0;
  z-index: 2;
  background: color-mix(in srgb, var(--color-primary) 10%, var(--bg-primary));
  border-top: 2px solid color-mix(in srgb, var(--color-primary) 40%, var(--border-medium));
  font-weight: var(--font-weight-bold);
}

.mp-band th {
  padding: 6px 12px;
  background: color-mix(in srgb, var(--color-primary) 8%, var(--bg-primary));
  border-bottom: 1px solid var(--border-light);
  text-align: left;
}

.mp-band__inner {
  /* The band spans the whole table, so its label sticks to the left edge
     and stays readable while the account columns scroll. */
  position: sticky;
  left: 12px;
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
}

.mp-band__name {
  font-size: 12px;
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.mp-band__meta {
  font-size: 11px;
  color: var(--text-tertiary);
}

.mp-tag {
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-primary) 16%, var(--bg-primary));
  color: var(--color-primary);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.mp-row {
  cursor: pointer;
}

.mp-row:nth-child(even) {
  background: color-mix(in srgb, var(--text-primary) 2.5%, var(--bg-primary));
}

.mp-row:hover {
  background: color-mix(in srgb, var(--color-primary) 7%, var(--bg-primary));
}

.mp-row.is-open {
  background: color-mix(in srgb, var(--color-primary) 10%, var(--bg-primary));
}

.c-no {
  width: 48px;
  text-align: center !important;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.c-member {
  min-width: 200px;
}

.mp-member {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.mp-caret {
  display: inline-block;
  width: 10px;
  color: var(--text-tertiary);
  transition: transform 0.15s ease;
}

.mp-caret.is-open {
  transform: rotate(90deg);
}

.mp-member__name {
  font-weight: var(--font-weight-medium);
}

.c-group {
  min-width: 120px;
  color: var(--text-secondary);
}

.c-num {
  width: 82px;
  text-align: center !important;
  font-variant-numeric: tabular-nums;
}

.c-acc {
  width: 78px;
  text-align: center !important;
}

.mp-tally {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.mp-acc {
  display: inline-block;
  min-width: 22px;
  padding: 2px 7px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.mp-acc.is-big {
  background: color-mix(in srgb, #1f7a4d 14%, var(--bg-primary));
  color: #1f7a4d;
}

.mp-acc.is-new {
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
}

[data-theme='dark'] .mp-acc.is-big {
  background: color-mix(in srgb, #4ade80 18%, var(--bg-primary));
  color: #4ade80;
}

.mp-muted {
  color: var(--text-tertiary);
}

.mp-detail-row > td {
  padding: 0 !important;
  background: var(--bg-secondary);
}

.mp-detail {
  width: 100%;
  overflow: visible;
  border: 0;
  border-radius: 0;
  border-collapse: separate;
  border-spacing: 0;
  background: var(--bg-secondary);
}

.mp-detail th,
.mp-detail td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-light);
  background: inherit;
  white-space: nowrap;
  font-size: 12px;
  color: inherit;
  text-transform: none;
  letter-spacing: normal;
  text-align: left;
}

.mp-detail thead th {
  position: static;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.mp-detail tbody tr:last-child td {
  border-bottom: 0;
}

.mp-detail-empty {
  margin: 0;
  padding: var(--spacing-md);
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.mp-legend {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.mp-legend .mp-acc {
  margin: 0 2px;
}
</style>
