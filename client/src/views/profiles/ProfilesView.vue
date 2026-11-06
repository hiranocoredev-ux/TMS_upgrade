<template>
  <div class="profiles-view">
    <header class="page-header">
      <div class="page-header__title">
        <h1>{{ headerTitle }}</h1>
        <p class="page-header__subtitle">{{ headerSubtitle }}</p>
      </div>
      <div class="page-header__actions">
        <div class="view-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            class="view-toggle__btn"
            :class="{ 'view-toggle__btn--active': viewMode === 'cards' }"
            :aria-pressed="viewMode === 'cards'"
            title="Card view"
            @click="setViewMode('cards')"
          >
            <span class="view-toggle__ic" aria-hidden="true">▦</span> Cards
          </button>
          <button
            type="button"
            class="view-toggle__btn"
            :class="{ 'view-toggle__btn--active': viewMode === 'list' }"
            :aria-pressed="viewMode === 'list'"
            title="List view"
            @click="setViewMode('list')"
          >
            <span class="view-toggle__ic" aria-hidden="true">☰</span> List
          </button>
        </div>
        <button
          v-if="canManage"
          type="button"
          class="btn btn-primary"
          @click="openCreate"
        >
          <span aria-hidden="true">+</span> New profile
        </button>
      </div>
    </header>

    <section class="filters">
      <div class="filters__row">
        <div class="filters__field filters__field--grow">
          <label>Search</label>
          <input
            v-model="filters.search"
            type="search"
            placeholder="Name, email, phone, tag…"
            @input="onFilterChange"
          />
        </div>
        <div class="filters__field">
          <label>Status</label>
          <select v-model="filters.status" @change="onFilterChange">
            <option value="">All statuses</option>
            <option v-for="s in PROFILE_STATUSES" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="filters__field">
          <label>Country</label>
          <select v-model="filters.country" @change="onFilterChange">
            <option value="">Any</option>
            <option v-for="c in COUNTRIES" :key="c.code" :value="c.code">
              {{ countryFlag(c.code) }} {{ c.name }}
            </option>
          </select>
        </div>
        <div class="filters__field">
          <label>Work Role</label>
          <select v-model="filters.workingRole" @change="onFilterChange">
            <option value="">Any</option>
            <option v-for="wr in PROFILE_WORK_ROLE_VALUES" :key="wr" :value="wr">
              {{ WORKING_ROLE_ICONS[wr] }} {{ WORKING_ROLE_LABELS[wr] }}
            </option>
          </select>
        </div>
      </div>
    </section>

    <div v-if="loading" class="state state--loading">Loading profiles…</div>
    <div v-else-if="error" class="state state--error">
      {{ error }}
      <button class="btn btn-ghost" @click="loadProfiles">Retry</button>
    </div>
    <div v-else-if="!profiles.length" class="state state--empty">
      <p>No profiles match your filters.</p>
      <button v-if="canManage" class="btn btn-primary" @click="openCreate">
        Create the first profile
      </button>
    </div>

    <!-- LIST (table) view -->
    <div v-else-if="viewMode === 'list'" class="ptable-wrap">
      <table class="ptable">
        <thead>
          <tr>
            <th class="ptable__no">#</th>
            <th>Client</th>
            <th>Country</th>
            <th class="ptable__num">Share&nbsp;%</th>
            <th>Owner</th>
            <th>Manager</th>
            <th>Comm tools</th>
            <th>Freelancing</th>
            <th>Freelancing owner</th>
            <th>AI Training</th>
            <th>Job</th>
            <th>Review</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(p, idx) in profiles"
            :key="p._id"
            class="ptable__row"
            :class="{ 'ptable__row--archived': p.status === 'archived' }"
            @click="openDetail(p)"
          >
            <td class="ptable__no">{{ idx + 1 }}</td>

            <!-- Client -->
            <td>
              <div class="ptable__name">
                <span class="ptable__avatar">
                  <img
                    v-if="p.pictureFileId && p.pictureFileId._id"
                    :src="resolveFileUrl(p.pictureFileId._id)"
                    :alt="p.name"
                  />
                  <span v-else class="ptable__avatar-fallback">{{ initials(p.name) }}</span>
                </span>
                <span class="ptable__nametext">{{ p.name }}</span>
              </div>
            </td>

            <!-- Country -->
            <td>
              <span class="ptable__country" :title="countryName(p.countryCode)">
                <img
                  v-if="countryFlagUrl(p.countryCode, 40)"
                  :src="countryFlagUrl(p.countryCode, 40)"
                  :alt="countryName(p.countryCode) || p.countryCode"
                  class="ptable__flag"
                  loading="lazy"
                />
                <span>{{ p.countryCode ? (countryName(p.countryCode) || p.countryCode) : '—' }}</span>
              </span>
            </td>

            <!-- Client share % -->
            <td class="ptable__num">
              <span v-if="p.clientSharePercent != null" class="ptable__share">{{ p.clientSharePercent }}%</span>
              <span v-else class="ptable__muted">—</span>
            </td>

            <!-- Owner -->
            <td><span class="ptable__person">{{ ownerName(p) }}</span></td>

            <!-- Manager (across all role tabs) -->
            <td>
              <span v-if="allManagers(p).length" class="ptable__person">{{ allManagers(p).join(', ') }}</span>
              <span v-else class="ptable__muted">—</span>
            </td>

            <!-- Communication tools -->
            <td>
              <div class="ptable__tools">
                <span
                  v-for="pl in commTools(p)"
                  :key="pl"
                  class="ptable__tool"
                  :title="CONTACT_HANDLE_LABELS[pl] || pl"
                >
                  <img v-if="CONTACT_HANDLE_ICON_URLS[pl]" :src="CONTACT_HANDLE_ICON_URLS[pl]" :alt="pl" />
                  <span v-else class="ptable__tool-emoji">{{ CONTACT_HANDLE_ICONS[pl] || '🔗' }}</span>
                </span>
                <span v-if="!commTools(p).length" class="ptable__muted">—</span>
              </div>
            </td>

            <!-- Freelancing status (derived: active + platforms) -->
            <td>
              <div class="ptable__role-cell">
                <template v-if="roleActive(p, WR.FREELANCING)">
                  <span class="ptable__badge ptable__badge--on">Active</span>
                  <span
                    v-for="pl in platformsFor(p, WR.FREELANCING)"
                    :key="`${pl.platform}|${pl.status}`"
                    class="ptable__plat"
                  >
                    {{ pl.platform }}
                    <span class="ptable__plat-status" :style="credStatusStyle(pl.status)">
                      {{ credStatusLabel(pl.status) }}
                    </span>
                  </span>
                </template>
                <span v-else class="ptable__muted">Not using</span>
              </div>
            </td>

            <!-- Freelancing owner (freelancing tab managers) -->
            <td>
              <span v-if="managersFor(p, WR.FREELANCING).length" class="ptable__person">
                {{ managersFor(p, WR.FREELANCING).join(', ') }}
              </span>
              <span v-else class="ptable__muted">—</span>
            </td>

            <!-- AI Training status (derived: platforms + owner) -->
            <td>
              <div class="ptable__role-cell">
                <template v-if="roleActive(p, WR.AI_TRAINING)">
                  <span class="ptable__badge ptable__badge--on">Active</span>
                  <span
                    v-for="pl in platformsFor(p, WR.AI_TRAINING)"
                    :key="`${pl.platform}|${pl.status}`"
                    class="ptable__plat"
                  >
                    {{ pl.platform }}
                    <span class="ptable__plat-status" :style="credStatusStyle(pl.status)">
                      {{ credStatusLabel(pl.status) }}
                    </span>
                  </span>
                  <span v-if="managersFor(p, WR.AI_TRAINING).length" class="ptable__owner-line">
                    👤 {{ managersFor(p, WR.AI_TRAINING).join(', ') }}
                  </span>
                </template>
                <span v-else class="ptable__muted">Not using</span>
              </div>
            </td>

            <!-- Job status -->
            <td>
              <span v-if="roleActive(p, WR.JOB_WORKING)" class="ptable__badge ptable__badge--on">Active</span>
              <span v-else class="ptable__muted">—</span>
            </td>

            <!-- Client review (no field yet) -->
            <td><span class="ptable__muted" title="No review field yet">—</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- CARD (grid) view -->
    <div v-else class="cards-grid">
      <article
        v-for="p in profiles"
        :key="p._id"
        class="pc"
        :class="{ 'pc--archived': p.status === 'archived' }"
        @click="openDetail(p)"
      >
        <!-- Country flag ribbon (decorative top band) -->
        <div class="pc__ribbon">
          <span class="pc__ribbon-flag" :title="countryName(p.countryCode)">
            <img
              v-if="countryFlagUrl(p.countryCode, 40)"
              :src="countryFlagUrl(p.countryCode, 40)"
              :alt="countryName(p.countryCode) || p.countryCode"
              loading="lazy"
            />
            <span v-else>🌐</span>
          </span>
          <span v-if="p.countryCode" class="pc__ribbon-country">
            {{ countryName(p.countryCode) || p.countryCode }}
          </span>
          <span v-else class="pc__ribbon-country pc__ribbon-country--muted">No country set</span>
        </div>

        <!-- Avatar + identity -->
        <header class="pc__head">
          <div class="pc__avatar">
            <img
              v-if="p.pictureFileId && p.pictureFileId._id"
              :src="resolveFileUrl(p.pictureFileId._id)"
              :alt="p.name"
            />
            <span v-else class="pc__avatar-fallback">{{ initials(p.name) }}</span>
          </div>
          <div class="pc__id">
            <h3 class="pc__name">{{ p.name }}</h3>
            <div class="pc__status-row">
              <span class="pc__status" :class="`pc__status--${p.status}`">
                <span class="pc__status-dot"></span>{{ p.status }}
              </span>
            </div>
          </div>
        </header>

        <!-- Score + Profit metrics -->
        <div class="pc__metrics">
          <div class="pc__metric">
            <div class="pc__metric-label">Score</div>
            <div class="pc__stars">
              <span
                v-for="n in 5"
                :key="n"
                class="pc__star"
                :class="{ 'pc__star--on': (p.statusScore || 0) >= n }"
              >★</span>
              <span class="pc__stars-value">{{ p.statusScore || 0 }}/5</span>
            </div>
          </div>
          <div class="pc__metric pc__metric--profit">
            <div class="pc__metric-label">Total profit</div>
            <div class="pc__profit">{{ fmtCurrency(p.totalProfitFund, p.currency) }}</div>
          </div>
        </div>

        <!-- Platform accounts + lifecycle status, per revenue-earning role -->
        <div v-if="cardPlatformRoles(p).length" class="pc__platforms">
          <div v-for="row in cardPlatformRoles(p)" :key="row.role" class="pc__plat-row">
            <span class="pc__plat-role" :title="WORKING_ROLE_LABELS[row.role]">
              {{ WORKING_ROLE_ICONS[row.role] }}
            </span>
            <div class="pc__plat-list">
              <span
                v-for="pl in row.platforms"
                :key="`${pl.platform}|${pl.status}`"
                class="pc__plat"
                :title="`${pl.platform} — ${credStatusLabel(pl.status)}`"
              >
                <span class="pc__plat-name">{{ pl.platform }}</span>
                <span class="pc__plat-status" :style="credStatusStyle(pl.status)">
                  {{ credStatusLabel(pl.status) }}
                </span>
              </span>
            </div>
          </div>
        </div>

        <!-- Active working roles -->
        <footer class="pc__footer">
          <div class="pc__roles">
            <span
              v-for="wr in (p.workingRoles || [])"
              :key="wr"
              class="pc__role-chip"
              :title="WORKING_ROLE_LABELS[wr]"
            >
              <span class="pc__role-icon">{{ WORKING_ROLE_ICONS[wr] }}</span>
              <span>{{ WORKING_ROLE_LABELS[wr] }}</span>
            </span>
            <span v-if="!(p.workingRoles || []).length" class="pc__roles-empty">No active role</span>
          </div>
        </footer>
      </article>
    </div>

  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../composables/useAuth';
import { canManageProfiles } from '../../utils/permissions';
import {
  PROFILE_STATUSES,
  PROFILE_WORK_ROLE_VALUES,
  WORKING_ROLE_LABELS,
  WORKING_ROLE_ICONS,
  WORKING_ROLES,
  CONTACT_HANDLE_LABELS,
  CONTACT_HANDLE_ICON_URLS,
  CONTACT_HANDLE_ICONS,
  CURRENCY_SYMBOLS,
  PLATFORM_CREDENTIAL_STATUSES,
  DEFAULT_PLATFORM_CREDENTIAL_STATUS,
  PLATFORM_CREDENTIAL_STATUS_LABELS,
  PLATFORM_CREDENTIAL_STATUS_ACCENTS,
} from '../../constants/profiles.js';
import { COUNTRIES, countryFlag, countryFlagUrl, countryName } from '../../constants/countries.js';
import { listProfiles } from '../../services/profiles';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const canManage = computed(() => canManageProfiles(authStore.user));

const profiles = ref([]);
const loading = ref(false);
const error = ref(null);

// Display mode for the profile list: 'cards' (grid) or 'list' (rows). Remembered.
const viewMode = ref(localStorage.getItem('profilesViewMode') === 'list' ? 'list' : 'cards');
const setViewMode = (mode) => {
  viewMode.value = mode;
  try { localStorage.setItem('profilesViewMode', mode); } catch { /* ignore */ }
};

const filters = reactive({
  search: '',
  status: '',
  country: '',
  workingRole: '',
});

const headerTitle = 'All Profiles';
const headerSubtitle = 'Every client profile across the team. Use the filters to narrow down.';

const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const resolveFileUrl = (fileId) => `${apiBase}/files/${fileId}/download`;

const initials = (name) => String(name || '?')
  .trim()
  .split(/\s+/)
  .map((s) => s[0])
  .slice(0, 2)
  .join('')
  .toUpperCase();

const fmtCurrency = (n, currency) => {
  const cur = currency || 'USD';
  const sym = CURRENCY_SYMBOLS[cur] || (cur + ' ');
  const num = Number(n) || 0;
  return `${sym}${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

// ── List-table helpers: values derived from the profile + its working-role tabs ──
const WR = WORKING_ROLES;
const personName = (u) => (u && typeof u === 'object' ? (u.name || u.email || '') : '');
const ownerName = (p) => personName(p.ownerUserId) || '—';
const tabFor = (p, role) => (p.workingRoleTabs || []).find((t) => t.role === role) || null;
const roleActive = (p, role) => (p.workingRoles || []).includes(role);

/**
 * Platform credentials on a role tab, as `{ platform, status }` for badge
 * rendering. Deduped on platform+status so an accidental duplicate entry
 * collapses, but two genuinely different accounts on the same platform (say a
 * live Upwork and a dead one) both stay visible.
 */
const platformsFor = (p, role) => {
  const t = tabFor(p, role);
  const seen = new Set();
  const out = [];
  for (const c of (t?.platformCredentials || [])) {
    if (!c || !c.platform) continue;
    const status = PLATFORM_CREDENTIAL_STATUSES.includes(c.status)
      ? c.status
      : DEFAULT_PLATFORM_CREDENTIAL_STATUS;
    const key = `${c.platform}|${status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ platform: c.platform, status });
  }
  return out;
};

/** Tint a credential status badge from its accent colour (mirrors the detail pages). */
const credStatusStyle = (status) => {
  const key = PLATFORM_CREDENTIAL_STATUSES.includes(status)
    ? status
    : DEFAULT_PLATFORM_CREDENTIAL_STATUS;
  const accent = PLATFORM_CREDENTIAL_STATUS_ACCENTS[key];
  return { color: accent, borderColor: accent, background: `${accent}1f` };
};

const credStatusLabel = (status) =>
  PLATFORM_CREDENTIAL_STATUS_LABELS[status] || PLATFORM_CREDENTIAL_STATUS_LABELS[DEFAULT_PLATFORM_CREDENTIAL_STATUS];

/**
 * Freelancing / AI Training rows for the card view — the two roles that carry
 * platform accounts. Only roles the profile is active in AND that actually have
 * credentials get a row, so the card stays compact for clients without any.
 */
const PLATFORM_ROLES = [WORKING_ROLES.FREELANCING, WORKING_ROLES.AI_TRAINING];
const cardPlatformRoles = (p) => PLATFORM_ROLES
  .filter((role) => roleActive(p, role))
  .map((role) => ({ role, platforms: platformsFor(p, role) }))
  .filter((row) => row.platforms.length);

const managersFor = (p, role) => {
  const t = tabFor(p, role);
  return [...new Set(
    (t?.managers || [])
      .filter((m) => m.isActive !== false && m.userId)
      .map((m) => personName(m.userId))
      .filter(Boolean)
  )];
};
const allManagers = (p) => {
  const set = new Set();
  (p.workingRoleTabs || []).forEach((t) =>
    (t.managers || []).forEach((m) => {
      if (m.isActive !== false && m.userId) {
        const n = personName(m.userId);
        if (n) set.add(n);
      }
    })
  );
  return [...set];
};
const commTools = (p) => [...new Set((p.contactHandles || []).map((h) => h.platform).filter(Boolean))];

let filterDebounce;
const onFilterChange = () => {
  clearTimeout(filterDebounce);
  filterDebounce = setTimeout(loadProfiles, 200);
};

const loadProfiles = async () => {
  loading.value = true;
  error.value = null;
  try {
    const res = await listProfiles({
      status: filters.status || undefined,
      country: filters.country || undefined,
      workingRole: filters.workingRole || undefined,
      search: filters.search.trim() || undefined,
      limit: 100,
    });
    profiles.value = res?.data?.profiles || [];
  } catch (err) {
    error.value = err?.response?.data?.message || 'Failed to load profiles';
  } finally {
    loading.value = false;
  }
};

const openCreate = () => {
  router.push({ name: 'ProfileCreate' });
};

const openDetail = (p) => {
  router.push({ name: 'ProfileDetail', params: { id: p._id } });
};

onMounted(loadProfiles);
watch(() => route.fullPath, () => {
  // Reset filters when navigating into the page anew.
  filters.search = '';
  filters.status = '';
  filters.country = '';
  filters.workingRole = '';
});
</script>

<style scoped>
.profiles-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.page-header__title h1 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text-primary);
}

.page-header__subtitle {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.btn-primary {
  background: var(--color-primary, #2563eb);
  color: #fff;
}
.btn-primary:hover { background: var(--color-primary-strong, #1d4ed8); }

.btn-ghost {
  background: transparent;
  border-color: var(--border-medium, #cbd5e1);
  color: var(--text-primary);
}

.filters {
  background: var(--bg-primary);
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 12px;
  padding: 12px 14px;
}

.filters__row {
  display: grid;
  grid-template-columns: 2fr repeat(3, 1fr);
  gap: 12px;
}

.filters__field { display: flex; flex-direction: column; gap: 4px; }
.filters__field--grow { min-width: 0; }
.filters__field label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}
.filters__field input,
.filters__field select {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--border-medium, #cbd5e1);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.84rem;
}
.filters__field input:focus,
.filters__field select:focus {
  outline: none;
  border-color: var(--color-primary, #2563eb);
  box-shadow: 0 0 0 3px var(--color-primary-soft, rgba(37, 99, 235, 0.18));
}

.state {
  padding: 32px;
  text-align: center;
  border-radius: 12px;
  border: 1px dashed var(--border-medium, #cbd5e1);
  color: var(--text-secondary);
}
.state--error { color: var(--color-error, #b91c1c); border-color: var(--color-error, #b91c1c); }
.state--empty { display: flex; flex-direction: column; gap: 12px; align-items: center; }

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 16px;
}

/* View-mode toggle */
.page-header__actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.view-toggle {
  display: inline-flex;
  border: 1px solid var(--border-medium, #cbd5e1);
  border-radius: 10px;
  overflow: hidden;
  background: var(--bg-primary, #fff);
}
.view-toggle__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 7px 12px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-secondary);
  transition: background 0.15s ease, color 0.15s ease;
}
.view-toggle__btn + .view-toggle__btn { border-left: 1px solid var(--border-light, #e2e8f0); }
.view-toggle__btn:hover { color: var(--text-primary); background: var(--bg-secondary, #f8fafc); }
.view-toggle__btn--active { background: var(--color-primary, #2563eb); color: #fff; }
.view-toggle__btn--active:hover { background: var(--color-primary, #2563eb); color: #fff; }
.view-toggle__ic { font-size: 0.95rem; line-height: 1; }

/* ============================================================
   List view — compact table (one profile per row)
============================================================ */
.ptable-wrap {
  overflow-x: auto;
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 12px;
  background: var(--bg-primary, #fff);
}
.ptable {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
}
.ptable thead th {
  text-align: left;
  padding: 10px 14px;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  background: var(--bg-secondary, #f8fafc);
  border-bottom: 1px solid var(--border-light, #e2e8f0);
  white-space: nowrap;
}
.ptable__no { width: 44px; text-align: center; color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
.ptable__num { text-align: right; }
.ptable td.ptable__num { text-align: right; }

.ptable__row { cursor: pointer; transition: background 0.12s ease; }
.ptable__row:hover { background: var(--bg-secondary, #f8fafc); }
.ptable__row + .ptable__row td { border-top: 1px solid var(--border-light, #eef2f7); }
.ptable__row td { padding: 8px 14px; vertical-align: middle; white-space: nowrap; }
.ptable__row--archived { opacity: 0.6; }

.ptable__name { display: flex; align-items: center; gap: 9px; min-width: 0; }
.ptable__avatar {
  width: 30px; height: 30px; border-radius: 8px; overflow: hidden; flex-shrink: 0;
  background: linear-gradient(135deg, #dbeafe, #e0e7ff);
  display: inline-flex; align-items: center; justify-content: center;
}
.ptable__avatar img { width: 100%; height: 100%; object-fit: cover; }
.ptable__avatar-fallback { font-weight: 800; font-size: 0.72rem; color: var(--color-primary, #2563eb); }
.ptable__nametext {
  font-weight: 700; color: var(--text-primary);
  max-width: 220px; overflow: hidden; text-overflow: ellipsis;
}

.ptable__country { display: inline-flex; align-items: center; gap: 7px; color: var(--text-secondary); }
.ptable__flag {
  width: 20px; height: 14px; object-fit: cover; border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.1); flex-shrink: 0;
}

.ptable__stars { display: inline-flex; align-items: center; gap: 1px; }
.ptable__stars .pc__star { font-size: 0.82rem; }

.ptable__profit { font-weight: 800; color: #047857; font-variant-numeric: tabular-nums; }

.ptable__roles { display: inline-flex; align-items: center; gap: 4px; }
.ptable__role { font-size: 1rem; line-height: 1; }
.ptable__roles-empty { color: var(--text-tertiary); }

.ptable__person { color: var(--text-primary); font-weight: 600; }
.ptable__muted { color: var(--text-tertiary); }
.ptable__share { font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }

.ptable__tools { display: inline-flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.ptable__tool { display: inline-flex; align-items: center; }
.ptable__tool img { width: 18px; height: 18px; object-fit: contain; border-radius: 4px; display: block; }
.ptable__tool-emoji { font-size: 1rem; line-height: 1; }

.ptable__role-cell {
  display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px;
  white-space: normal; max-width: 220px;
}
.ptable__badge {
  display: inline-flex; align-items: center; padding: 1px 7px; border-radius: 999px;
  font-size: 0.68rem; font-weight: 700;
}
.ptable__badge--on { background: rgba(34, 197, 94, 0.15); color: #047857; }
.ptable__plat {
  display: inline-flex; align-items: center; padding: 1px 7px; border-radius: 999px;
  font-size: 0.7rem; font-weight: 600;
  background: var(--color-primary-soft, rgba(37, 99, 235, 0.12));
  color: var(--color-primary, #2563eb);
  border: 1px solid rgba(37, 99, 235, 0.18);
}
.ptable__plat-status {
  margin-left: 5px;
  padding: 0 5px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: .02em;
  white-space: nowrap;
}
.ptable__owner-line { flex-basis: 100%; font-size: 0.7rem; color: var(--text-secondary); }

/* ============================================================
   Profile Card (.pc) — production-grade
============================================================ */
.pc {
  position: relative;
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}
.pc::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 14px;
  pointer-events: none;
  box-shadow: inset 0 -1px 0 rgba(15, 23, 42, 0.04);
}
.pc:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px -8px rgba(15, 23, 42, 0.18), 0 4px 12px -4px rgba(15, 23, 42, 0.08);
  border-color: rgba(37, 99, 235, 0.5);
}
.pc--archived { opacity: 0.7; }
.pc--archived::after {
  content: 'ARCHIVED';
  position: absolute;
  top: 8px;
  right: -28px;
  transform: rotate(35deg);
  background: rgba(148, 163, 184, 0.85);
  color: #fff;
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  padding: 3px 36px;
  z-index: 2;
}

/* Top country ribbon */
.pc__ribbon {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(99, 102, 241, 0.06) 100%);
  border-bottom: 1px solid var(--border-light, #e2e8f0);
}
.pc__ribbon-flag {
  font-size: 1.2rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 16px;
  flex-shrink: 0;
}
.pc__ribbon-flag img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.1);
  display: block;
}
.pc__ribbon-country {
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.pc__ribbon-country--muted { color: var(--text-tertiary); font-style: italic; }
.pc__ribbon-spacer { flex: 1; }

/* Avatar + name */
.pc__head {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 14px 14px 10px;
}
.pc__avatar {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  overflow: hidden;
  background: linear-gradient(135deg, #dbeafe, #e0e7ff);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.1);
}
.pc__avatar img { width: 100%; height: 100%; object-fit: cover; }
.pc__avatar-fallback {
  font-weight: 800;
  font-size: 1.2rem;
  color: var(--color-primary, #2563eb);
  letter-spacing: -0.02em;
}
.pc__id { flex: 1; min-width: 0; }
.pc__name {
  margin: 0;
  font-size: 1.08rem;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.01em;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pc__status-row { margin-top: 4px; }
.pc__status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px 2px 6px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: capitalize;
}
.pc__status-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: currentColor;
}
.pc__status--active { background: rgba(34, 197, 94, 0.15); color: #047857; }
.pc__status--archived { background: rgba(148, 163, 184, 0.2); color: var(--text-tertiary); }

/* Metrics row */
.pc__metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 0 14px 12px;
}
.pc__metric {
  background: var(--bg-secondary, #f8fafc);
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 10px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pc__metric--profit {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(34, 197, 94, 0.02));
  border-color: rgba(34, 197, 94, 0.35);
}
.pc__metric-label {
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}
.pc__stars {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  line-height: 1;
}
.pc__star {
  font-size: 0.95rem;
  color: rgba(148, 163, 184, 0.45);
  line-height: 1;
}
.pc__star--on { color: #f59e0b; }
.pc__stars-value {
  margin-left: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
.pc__profit {
  font-size: 1rem;
  font-weight: 800;
  color: #047857;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}

/* Platform accounts + lifecycle status */
.pc__platforms {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 14px 12px;
}
.pc__plat-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}
.pc__plat-role {
  flex: 0 0 auto;
  font-size: 0.85rem;
  line-height: 1.5;
}
.pc__plat-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}
.pc__plat {
  display: inline-flex;
  align-items: center;
  padding: 1px 4px 1px 7px;
  border-radius: 999px;
  background: var(--color-primary-soft, rgba(37, 99, 235, 0.12));
  border: 1px solid rgba(37, 99, 235, 0.18);
}
.pc__plat-name {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--color-primary, #2563eb);
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pc__plat-status {
  margin-left: 5px;
  padding: 0 5px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: .02em;
  white-space: nowrap;
}

/* Footer: active roles */
.pc__footer {
  padding: 10px 14px 14px;
  border-top: 1px dashed var(--border-light, #e2e8f0);
}
.pc__roles {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  min-height: 24px;
  align-items: center;
}
.pc__role-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--color-primary-soft, rgba(37, 99, 235, 0.12));
  color: var(--color-primary, #2563eb);
  font-size: 0.7rem;
  font-weight: 600;
  border: 1px solid rgba(37, 99, 235, 0.18);
}
.pc__role-icon { font-size: 0.85rem; line-height: 1; }
.pc__roles-empty {
  font-size: 0.7rem;
  color: var(--text-tertiary);
  font-style: italic;
}

@media (max-width: 768px) {
  .filters__row {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
