<template>
  <div class="ps-view">
    <header class="ps-header">
      <div>
        <h1>Profiles Summarize</h1>
        <p class="ps-subtitle">Counts, working-role mix, country footprint, and what changed recently.</p>
      </div>
      <button type="button" class="ps-btn ps-btn--ghost" @click="load" :disabled="loading">
        {{ loading ? 'Refreshing…' : '↻ Refresh' }}
      </button>
    </header>

    <div v-if="loading && !summary" class="ps-state">Loading summary…</div>
    <div v-else-if="error" class="ps-state ps-state--error">
      {{ error }}
      <button class="ps-btn ps-btn--ghost" @click="load">Retry</button>
    </div>

    <template v-else-if="summary">
      <!-- Top-level KPIs -->
      <section class="ps-kpis">
        <article class="ps-kpi ps-kpi--accent">
          <div class="ps-kpi__label">Total profiles</div>
          <div class="ps-kpi__value">{{ summary.total }}</div>
          <div class="ps-kpi__hint">
            <span class="ps-pill ps-pill--ok">{{ summary.byStatus.active }} active</span>
            <span class="ps-pill">{{ summary.byStatus.archived }} archived</span>
          </div>
        </article>
        <article class="ps-kpi">
          <div class="ps-kpi__label">Total incoming</div>
          <div class="ps-kpi__value">${{ fmtAmount(summary.funds.incoming) }}</div>
          <div class="ps-kpi__hint">All transactions across all profiles</div>
        </article>
        <article class="ps-kpi">
          <div class="ps-kpi__label">Total given</div>
          <div class="ps-kpi__value">${{ fmtAmount(summary.funds.given) }}</div>
          <div class="ps-kpi__hint">Client share applied</div>
        </article>
        <article class="ps-kpi ps-kpi--profit">
          <div class="ps-kpi__label">Total profit</div>
          <div class="ps-kpi__value">${{ fmtAmount(summary.funds.profit) }}</div>
          <div class="ps-kpi__hint">Net team profit</div>
        </article>
      </section>

      <div class="ps-grid">
        <!-- Working roles breakdown -->
        <section class="ps-card">
          <header class="ps-card__head">
            <h3>Working roles</h3>
            <span class="ps-card__hint">Profiles with each role tag (a profile can have multiple).</span>
          </header>
          <div v-if="!workingRolesTotal" class="ps-empty">No working roles assigned yet.</div>
          <ul v-else class="ps-bar-list">
            <li v-for="r in summary.byWorkingRole" :key="r.role" class="ps-bar">
              <div class="ps-bar__label">
                <span class="ps-bar__icon">{{ WORKING_ROLE_ICONS[r.role] || '•' }}</span>
                <span>{{ WORKING_ROLE_LABELS[r.role] || r.role }}</span>
              </div>
              <div class="ps-bar__track">
                <div
                  class="ps-bar__fill"
                  :style="{ width: barWidth(r.count, workingRolesMax) + '%' }"
                ></div>
              </div>
              <div class="ps-bar__count">{{ r.count }}</div>
            </li>
          </ul>
        </section>

        <!-- Top countries -->
        <section class="ps-card">
          <header class="ps-card__head">
            <h3>Top countries</h3>
            <span class="ps-card__hint">By number of profiles.</span>
          </header>
          <div v-if="!summary.topCountries.length" class="ps-empty">No country data yet.</div>
          <ul v-else class="ps-country-list">
            <li v-for="c in summary.topCountries" :key="c.code" class="ps-country">
              <span class="ps-country__flag">
                <img
                  v-if="countryFlagUrl(c.code)"
                  :src="countryFlagUrl(c.code)"
                  alt=""
                  @error="onFlagError"
                />
              </span>
              <span class="ps-country__name">{{ countryName(c.code) || c.code }}</span>
              <span class="ps-country__bar">
                <span
                  class="ps-country__fill"
                  :style="{ width: barWidth(c.count, countriesMax) + '%' }"
                ></span>
              </span>
              <span class="ps-country__count">{{ c.count }}</span>
            </li>
          </ul>
        </section>
      </div>

      <!-- Profile Network — visible to all users -->
      <section class="ps-card pn-card" v-if="summary.recent && summary.recent.length">
        <header class="ps-card__head">
          <h3>Profile network</h3>
          <span class="ps-card__hint">Hover any avatar for details. Click the profile to open it.</span>
        </header>
        <div class="pn-grid">
          <article v-for="p in summary.recent" :key="`net-${p._id}`" class="pn-tree">

            <!-- TOP: hunting owner + optional caller -->
            <div class="pn-tree__top">
              <div class="pn-avatar pn-avatar--owner pn-tt">
                <img v-if="p.owner && p.owner.avatarUrl" :src="p.owner.avatarUrl" :alt="p.owner.name" />
                <span v-else>{{ initials(p.owner ? p.owner.name : '?') }}</span>
                <span class="pn-avatar__badge">★</span>
                <div class="pn-tip">
                  <div class="pn-tip__tag">Hunting owner</div>
                  <div class="pn-tip__name">{{ p.owner ? p.owner.name : '—' }}</div>
                  <div v-if="p.owner && p.owner.email" class="pn-tip__sub">{{ p.owner.email }}</div>
                </div>
              </div>
              <div v-if="p.callSupportEnabled" class="pn-avatar pn-avatar--caller pn-tt">
                <template v-if="p.caller">
                  <img v-if="p.caller.avatarUrl" :src="p.caller.avatarUrl" :alt="p.caller.name" />
                  <span v-else>{{ initials(p.caller.name) }}</span>
                </template>
                <span v-else>📞</span>
                <span class="pn-avatar__badge pn-avatar__badge--call">📞</span>
                <div class="pn-tip">
                  <div class="pn-tip__tag">Call support</div>
                  <div class="pn-tip__name">{{ p.caller ? p.caller.name : 'Enabled (no caller)' }}</div>
                  <div v-if="p.caller && p.caller.email" class="pn-tip__sub">{{ p.caller.email }}</div>
                </div>
              </div>
            </div>

            <!-- Connector: top → profile -->
            <div class="pn-vlink pn-vlink--top" aria-hidden="true">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                <template v-if="p.callSupportEnabled">
                  <path d="M38,0 C38,60 50,60 50,100" />
                  <path d="M62,0 C62,60 50,60 50,100" />
                  <circle cx="38" cy="0" r="2.4" class="pn-vlink__dot" />
                  <circle cx="62" cy="0" r="2.4" class="pn-vlink__dot" />
                </template>
                <template v-else>
                  <path d="M50,0 L50,100" />
                  <circle cx="50" cy="0" r="2.4" class="pn-vlink__dot" />
                </template>
                <circle cx="50" cy="100" r="2.4" class="pn-vlink__dot" />
              </svg>
            </div>

            <!-- MID: profile avatar -->
            <div class="pn-tree__mid">
              <button
                type="button"
                class="pn-avatar pn-avatar--profile pn-tt"
                @click="goProfile(p._id)"
                :title="`Open ${p.name}`"
              >
                <img
                  v-if="p.pictureFileId && p.pictureFileId._id"
                  :src="resolveFileUrl(p.pictureFileId._id)"
                  :alt="p.name"
                />
                <span v-else>{{ initials(p.name) }}</span>
                <span class="pn-avatar__country" v-if="p.countryCode">
                  <img
                    v-if="countryFlagUrl(p.countryCode)"
                    :src="countryFlagUrl(p.countryCode)"
                    alt=""
                    @error="onFlagError"
                  />
                </span>
                <div class="pn-tip pn-tip--wide">
                  <div class="pn-tip__tag">Profile</div>
                  <div class="pn-tip__name">{{ p.name }}</div>
                  <div class="pn-tip__row">
                    <span v-if="p.countryCode" class="pn-tip__country">
                      <img
                        v-if="countryFlagUrl(p.countryCode)"
                        :src="countryFlagUrl(p.countryCode)"
                        alt=""
                        @error="onFlagError"
                      />
                      {{ countryName(p.countryCode) || p.countryCode }}
                    </span>
                    <span
                      class="pn-tip__status"
                      :class="p.status === 'active' ? 'pn-tip__status--active' : 'pn-tip__status--archived'"
                    >{{ p.status }}</span>
                  </div>
                  <div class="pn-tip__stars">
                    <span
                      v-for="n in 5"
                      :key="n"
                      class="ps-mini-star"
                      :class="{ 'ps-mini-star--on': (p.statusScore || 0) >= n }"
                    >★</span>
                  </div>
                </div>
              </button>
              <div class="pn-tree__caption">{{ p.name }}</div>
            </div>

            <!-- Connector: profile → role groups (fan-out, one curve per role) -->
            <div class="pn-vlink pn-vlink--bottom" aria-hidden="true" v-if="p.tabs && p.tabs.length">
              <svg viewBox="0 0 100 60" preserveAspectRatio="none">
                <path
                  v-for="(t, idx) in p.tabs"
                  :key="`flnk-${p._id}-${idx}`"
                  :d="fanDownPath(idx, p.tabs.length)"
                />
                <circle cx="50" cy="0" r="2.4" class="pn-vlink__dot" />
                <circle
                  v-for="(t, idx) in p.tabs"
                  :key="`fdot-${p._id}-${idx}`"
                  :cx="fanEndX(idx, p.tabs.length)"
                  cy="60"
                  r="2.4"
                  class="pn-vlink__dot"
                />
              </svg>
            </div>

            <!-- BOTTOM: working role groups (horizontal split) -->
            <div
              class="pn-tree__bottom"
              v-if="p.tabs && p.tabs.length"
              :style="{ gridTemplateColumns: `repeat(${p.tabs.length}, minmax(0, 1fr))` }"
            >
              <div v-for="t in p.tabs" :key="`grp-${p._id}-${t.role}`" class="pn-group">
                <header class="pn-group__head">
                  <span class="pn-group__icon">{{ WORKING_ROLE_ICONS[t.role] || '•' }}</span>
                  <span class="pn-group__label">{{ WORKING_ROLE_LABELS[t.role] || t.role }}</span>
                </header>

                <!-- Active members of this role -->
                <div class="pn-group__row" v-if="t.members && t.members.length">
                  <span class="pn-group__rowlabel">Members</span>
                  <span class="pn-group__avatars">
                    <span
                      v-for="m in t.members"
                      :key="`mb-${p._id}-${t.role}-${m._id}`"
                      class="pn-avatar pn-avatar--xs pn-avatar--member pn-tt"
                    >
                      <img v-if="m.avatarUrl" :src="m.avatarUrl" :alt="m.name" />
                      <span v-else>{{ initials(m.name) }}</span>
                      <div class="pn-tip pn-tip--sm">
                        <div class="pn-tip__name">{{ m.name }}</div>
                        <div v-if="m.email" class="pn-tip__sub">{{ m.email }}</div>
                      </div>
                    </span>
                  </span>
                </div>

                <!-- Platforms with their allowed users -->
                <div class="pn-group__platforms" v-if="t.platforms && t.platforms.length">
                  <div
                    v-for="(pl, i) in t.platforms"
                    :key="`pl-${p._id}-${t.role}-${i}`"
                    class="pn-plat"
                  >
                    <span
                      class="pn-plat__icon pn-tt"
                      :style="{ borderColor: CONTACT_HANDLE_ACCENTS[pl.platform] || '#cbd5e1' }"
                    >
                      <img
                        v-if="CONTACT_HANDLE_ICON_URLS[pl.platform]"
                        :src="CONTACT_HANDLE_ICON_URLS[pl.platform]"
                        :alt="CONTACT_HANDLE_LABELS[pl.platform] || pl.platform"
                      />
                      <span v-else>{{ CONTACT_HANDLE_ICONS[pl.platform] || '🔗' }}</span>
                      <div class="pn-tip pn-tip--sm">
                        <div class="pn-tip__name">{{ CONTACT_HANDLE_LABELS[pl.platform] || pl.platform }}</div>
                      </div>
                    </span>
                    <span class="pn-plat__name">{{ CONTACT_HANDLE_LABELS[pl.platform] || pl.platform }}</span>
                    <span class="pn-plat__arrow" aria-hidden="true">→</span>
                    <span class="pn-plat__allowed">
                      <template v-if="pl.allowed && pl.allowed.length">
                        <span
                          v-for="au in pl.allowed"
                          :key="`au-${p._id}-${t.role}-${i}-${au._id}`"
                          class="pn-avatar pn-avatar--xs pn-avatar--allowed pn-tt"
                        >
                          <img v-if="au.avatarUrl" :src="au.avatarUrl" :alt="au.name" />
                          <span v-else>{{ initials(au.name) }}</span>
                          <div class="pn-tip pn-tip--sm">
                            <div class="pn-tip__tag">Allowed</div>
                            <div class="pn-tip__name">{{ au.name }}</div>
                            <div v-if="au.email" class="pn-tip__sub">{{ au.email }}</div>
                          </div>
                        </span>
                      </template>
                      <span v-else class="pn-plat__empty">No users allowed</span>
                    </span>
                  </div>
                </div>

                <div
                  v-if="(!t.members || !t.members.length) && (!t.platforms || !t.platforms.length)"
                  class="pn-group__empty"
                >
                  No members or platforms.
                </div>
              </div>
            </div>

          </article>
        </div>
      </section>

      <!-- Recently updated -->
      <section class="ps-card">
        <header class="ps-card__head">
          <h3>Recently updated</h3>
          <span class="ps-card__hint">Most recent {{ summary.recent.length }} change(s).</span>
        </header>
        <div v-if="!summary.recent.length" class="ps-empty">Nothing here yet.</div>
        <table v-else class="ps-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Score</th>
              <th>Country</th>
              <th>Working roles</th>
              <th>Owner</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in summary.recent" :key="p._id">
              <td>
                <div class="ps-name-cell">
                  <div class="ps-avatar">
                    <img
                      v-if="p.pictureFileId && p.pictureFileId._id"
                      :src="resolveFileUrl(p.pictureFileId._id)"
                      :alt="p.name"
                    />
                    <span v-else>{{ initials(p.name) }}</span>
                  </div>
                  <span>{{ p.name }}</span>
                </div>
              </td>
              <td>
                <span class="ps-pill ps-pill--accent">
                  <span v-for="n in 5" :key="n" class="ps-mini-star" :class="{ 'ps-mini-star--on': (p.statusScore || 0) >= n }">★</span>
                </span>
              </td>
              <td>
                <span v-if="p.countryCode" class="ps-country-inline">
                  <img
                    v-if="countryFlagUrl(p.countryCode)"
                    :src="countryFlagUrl(p.countryCode)"
                    alt=""
                    @error="onFlagError"
                  />
                  {{ countryName(p.countryCode) || p.countryCode }}
                </span>
                <span v-else class="ps-muted">—</span>
              </td>
              <td>
                <span v-if="!p.workingRoles.length" class="ps-muted">—</span>
                <span v-else class="ps-chip-row">
                  <span v-for="wr in p.workingRoles" :key="wr" class="ps-chip">
                    {{ WORKING_ROLE_ICONS[wr] }} {{ WORKING_ROLE_LABELS[wr] }}
                  </span>
                </span>
              </td>
              <td>
                <span v-if="p.owner">{{ p.owner.name }}</span>
                <span v-else class="ps-muted">—</span>
              </td>
              <td><span class="ps-muted">{{ formatRelative(p.updatedAt) }}</span></td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  WORKING_ROLE_LABELS,
  WORKING_ROLE_ICONS,
  CONTACT_HANDLE_LABELS,
  CONTACT_HANDLE_ICON_URLS,
  CONTACT_HANDLE_ICONS,
  CONTACT_HANDLE_ACCENTS,
} from '../../constants/profiles.js';
import { countryName, countryFlagUrl } from '../../constants/countries.js';
import { fetchProfileSummary } from '../../services/profiles';

const router = useRouter();
const goProfile = (id) => {
  if (!id) return;
  router.push({ name: 'ProfileDetail', params: { id } });
};
const onFlagError = (event) => {
  const el = event && event.target;
  if (el && el.style) el.style.display = 'none';
};

const fanEndX = (idx, total) => {
  if (total <= 1) return 50;
  return ((idx + 0.5) / total) * 100;
};
const fanDownPath = (idx, total) => {
  const targetX = fanEndX(idx, total);
  return `M50,0 C50,36 ${targetX},24 ${targetX},60`;
};

const summary = ref(null);
const loading = ref(false);
const error = ref(null);

const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const resolveFileUrl = (id) => `${apiBase}/files/${id}/download`;

const workingRolesMax = computed(() => {
  if (!summary.value) return 0;
  return summary.value.byWorkingRole.reduce((m, r) => Math.max(m, r.count), 0);
});
const workingRolesTotal = computed(() => {
  if (!summary.value) return 0;
  return summary.value.byWorkingRole.reduce((s, r) => s + r.count, 0);
});
const countriesMax = computed(() => {
  if (!summary.value) return 0;
  return summary.value.topCountries.reduce((m, c) => Math.max(m, c.count), 0);
});

const barWidth = (count, max) => {
  if (!max) return 0;
  // Minimum 4% so non-zero bars are always visible
  return Math.max(4, Math.round((count / max) * 100));
};

const fmtAmount = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const initials = (name) => String(name || '?')
  .trim()
  .split(/\s+/)
  .map((s) => s[0])
  .slice(0, 2)
  .join('')
  .toUpperCase();

const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const formatRelative = (iso) => {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  const diff = Math.round((t - Date.now()) / 1000);
  const units = [
    { s: 60, name: 'second' },
    { s: 3600, name: 'minute', div: 60 },
    { s: 86400, name: 'hour', div: 3600 },
    { s: 2592000, name: 'day', div: 86400 },
    { s: 31536000, name: 'month', div: 2592000 },
    { s: Infinity, name: 'year', div: 31536000 },
  ];
  const abs = Math.abs(diff);
  for (const u of units) {
    if (abs < u.s) {
      const v = u.div ? Math.round(diff / u.div) : diff;
      return RTF.format(v, u.name);
    }
  }
  return '';
};

const load = async () => {
  loading.value = true;
  error.value = null;
  try {
    const res = await fetchProfileSummary();
    summary.value = res?.data || null;
  } catch (err) {
    error.value = err?.response?.data?.message || 'Failed to load summary';
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>

<style scoped>
.ps-view {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ps-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.ps-header h1 { margin: 0; font-size: 1.4rem; font-weight: 700; color: var(--text-primary); }
.ps-subtitle { margin: 4px 0 0; font-size: 0.85rem; color: var(--text-secondary); }

.ps-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}
.ps-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.ps-btn--ghost {
  background: transparent;
  border-color: var(--border-medium, #cbd5e1);
  color: var(--text-primary);
}
.ps-btn--ghost:hover:not(:disabled) { background: var(--bg-secondary, #f8fafc); }

.ps-state {
  padding: 32px;
  text-align: center;
  border-radius: 12px;
  border: 1px dashed var(--border-medium, #cbd5e1);
  color: var(--text-secondary);
}
.ps-state--error { color: var(--color-error, #b91c1c); border-color: var(--color-error, #b91c1c); }

.ps-kpis {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr 1fr;
  gap: 12px;
}

.ps-kpi {
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ps-kpi--accent {
  border-color: var(--color-primary, #2563eb);
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.06), rgba(37, 99, 235, 0.02));
}
.ps-kpi--profit {
  border-color: rgba(34, 197, 94, 0.45);
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.02));
}
.ps-kpi--profit .ps-kpi__value { color: #047857; }
.ps-mini-star { color: rgba(148, 163, 184, 0.45); font-size: 0.78rem; line-height: 1; }
.ps-mini-star--on { color: #f59e0b; }
.ps-kpi__label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}
.ps-kpi__value {
  font-size: clamp(1.1rem, 2vw, 1.5rem);
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.ps-kpi__hint {
  font-size: 0.78rem;
  color: var(--text-tertiary);
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.ps-pill {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  background: rgba(148, 163, 184, 0.18);
  color: var(--text-secondary);
}
.ps-pill--ok { background: rgba(34, 197, 94, 0.16); color: #047857; }
.ps-pill--type { background: rgba(37, 99, 235, 0.14); color: var(--color-primary, #2563eb); }

.ps-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.ps-card {
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 12px;
  padding: 14px;
}
.ps-card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.ps-card__head h3 { margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--text-primary); }
.ps-card__hint { font-size: 0.74rem; color: var(--text-tertiary); }
.ps-empty {
  padding: 16px;
  text-align: center;
  color: var(--text-tertiary);
  font-style: italic;
  font-size: 0.85rem;
}

.ps-bar-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ps-bar {
  display: grid;
  grid-template-columns: 160px 1fr 44px;
  align-items: center;
  gap: 10px;
  font-size: 0.84rem;
}
.ps-bar__label { display: flex; align-items: center; gap: 6px; color: var(--text-primary); }
.ps-bar__icon { width: 18px; text-align: center; }
.ps-bar__track {
  height: 10px;
  background: rgba(148, 163, 184, 0.18);
  border-radius: 999px;
  overflow: hidden;
}
.ps-bar__fill {
  height: 100%;
  background: linear-gradient(90deg, #60a5fa, #2563eb);
  border-radius: 999px;
  transition: width 0.3s ease;
}
.ps-bar__count {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: var(--text-primary);
}

.ps-country-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.ps-country {
  display: grid;
  grid-template-columns: 24px 1fr 100px 36px;
  align-items: center;
  gap: 10px;
  font-size: 0.84rem;
}
.ps-country__flag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 16px;
  overflow: hidden;
  border-radius: 3px;
  background: rgba(148, 163, 184, 0.15);
}
.ps-country__flag img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.ps-country-inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.ps-country-inline img {
  width: 20px;
  height: 14px;
  object-fit: cover;
  border-radius: 2px;
  flex-shrink: 0;
}
.ps-country__name { color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ps-country__bar {
  height: 8px;
  background: rgba(148, 163, 184, 0.18);
  border-radius: 999px;
  overflow: hidden;
  display: block;
}
.ps-country__fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #34d399, #059669);
  border-radius: 999px;
}
.ps-country__count {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: var(--text-primary);
}

.ps-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}
.ps-table thead th {
  text-align: left;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-light, #e2e8f0);
}
.ps-table tbody td {
  padding: 8px;
  border-bottom: 1px solid var(--border-light, #e2e8f0);
  vertical-align: middle;
}
.ps-table tbody tr:last-child td { border-bottom: none; }

.ps-name-cell { display: flex; align-items: center; gap: 8px; }
.ps-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--color-primary-soft, rgba(37, 99, 235, 0.12));
  color: var(--color-primary, #2563eb);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 700;
  flex-shrink: 0;
}
.ps-avatar img { width: 100%; height: 100%; object-fit: cover; }

.ps-chip-row { display: inline-flex; flex-wrap: wrap; gap: 4px; }
.ps-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--color-primary-soft, rgba(37, 99, 235, 0.12));
  color: var(--color-primary, #2563eb);
  font-size: 0.7rem;
  font-weight: 600;
}
.ps-muted { color: var(--text-tertiary); }

/* ============================================================
   Profile Network — vertical diagram (top → mid → bottom)
============================================================ */
.pn-card { padding: 16px; }

.pn-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(560px, 1fr));
  gap: 14px;
}

.pn-tree {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 14px 14px 16px;
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.55), rgba(255, 255, 255, 0.35));
  min-width: 0;
}

.pn-tree__top {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 14px;
}

.pn-tree__mid {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.pn-tree__caption {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pn-tree__bottom {
  display: grid;
  gap: 10px;
  margin-top: 4px;
  align-items: start;
}

/* ---------- Avatar nodes ---------- */
.pn-avatar {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(148, 163, 184, 0.18);
  color: var(--text-secondary);
  font-size: 0.72rem;
  font-weight: 700;
  border: 2px solid transparent;
  overflow: visible;
  flex-shrink: 0;
}
.pn-avatar > img,
.pn-avatar > span:not(.pn-avatar__badge):not(.pn-avatar__country) {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  object-fit: cover;
}
.pn-avatar--owner { border-color: #f59e0b; background: rgba(245, 158, 11, 0.16); color: #b45309; }
.pn-avatar--caller { border-color: #22c55e; background: rgba(34, 197, 94, 0.16); color: #047857; }
.pn-avatar--member { border-color: #60a5fa; background: rgba(37, 99, 235, 0.14); color: var(--color-primary, #2563eb); }
.pn-avatar--profile {
  width: 54px;
  height: 54px;
  border-color: var(--color-primary, #2563eb);
  background: var(--color-primary-soft, rgba(37, 99, 235, 0.12));
  color: var(--color-primary, #2563eb);
  cursor: pointer;
  padding: 0;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.18);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.pn-avatar--profile:hover {
  transform: translateY(-1px) scale(1.04);
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.28);
}
.pn-avatar--xs {
  width: 24px;
  height: 24px;
  font-size: 0.58rem;
  border-width: 1.5px;
}

.pn-avatar__badge {
  position: absolute;
  bottom: -3px;
  right: -3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #f59e0b;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 700;
  border: 2px solid var(--bg-primary, #fff);
}
.pn-avatar__badge--call { background: #22c55e; font-size: 0.55rem; }
.pn-avatar__country {
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 22px;
  height: 16px;
  border-radius: 3px;
  overflow: hidden;
  border: 2px solid var(--bg-primary, #fff);
  background: var(--bg-primary, #fff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
}
.pn-avatar__country img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 0; }

/* ---------- Vertical connector lines (SVG) ---------- */
.pn-vlink {
  width: 100%;
  display: flex;
  align-items: stretch;
  justify-content: center;
}
.pn-vlink--top { height: 30px; margin: 4px auto 0; }
.pn-vlink--bottom { height: 28px; margin: 4px auto 0; }
.pn-vlink svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}
.pn-vlink svg path {
  fill: none;
  stroke: rgba(99, 102, 241, 0.65);
  stroke-width: 1.5;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}
.pn-vlink__dot {
  fill: rgba(99, 102, 241, 0.85);
  stroke: var(--bg-primary, #fff);
  stroke-width: 1;
}

/* ---------- Tooltips ---------- */
.pn-tt { position: relative; }
.pn-tip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  min-width: 160px;
  max-width: 260px;
  padding: 8px 10px;
  border-radius: 10px;
  background: #0f172a;
  color: #f8fafc;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.28);
  font-size: 0.78rem;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease, transform 0.12s ease;
  z-index: 50;
  text-align: left;
  white-space: normal;
}
.pn-tip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #0f172a;
}
.pn-tt:hover .pn-tip,
.pn-tt:focus-within .pn-tip {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.pn-tip--sm { min-width: 100px; padding: 6px 8px; font-size: 0.72rem; }
.pn-tip--wide { min-width: 220px; }
.pn-tip__tag {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.6;
  margin-bottom: 2px;
}
.pn-tip__name { font-weight: 700; line-height: 1.2; }
.pn-tip__sub { font-size: 0.7rem; opacity: 0.7; margin-top: 2px; word-break: break-all; }
.pn-tip__row { display: flex; gap: 6px; margin-top: 6px; align-items: center; flex-wrap: wrap; }
.pn-tip__country { display: inline-flex; align-items: center; gap: 4px; }
.pn-tip__country img { width: 16px; height: 11px; object-fit: cover; border-radius: 2px; }
.pn-tip__status {
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
}
.pn-tip__status--active { background: rgba(34, 197, 94, 0.25); color: #86efac; }
.pn-tip__status--archived { background: rgba(148, 163, 184, 0.25); color: #cbd5e1; }
.pn-tip__stars { display: flex; gap: 1px; margin-top: 4px; }
.pn-tip__roles { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 6px; }

/* ---------- Working role groups (bottom) ---------- */
.pn-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid rgba(37, 99, 235, 0.22);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.78);
  min-width: 0;
}
.pn-group__head {
  display: flex;
  align-items: center;
  gap: 5px;
  padding-bottom: 5px;
  border-bottom: 1px dashed rgba(148, 163, 184, 0.35);
}
.pn-group__icon { font-size: 0.9rem; }
.pn-group__label {
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pn-group__row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
  flex-wrap: wrap;
}
.pn-group__rowlabel {
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  flex-shrink: 0;
  padding-top: 4px;
}
.pn-group__avatars {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 3px;
  min-width: 0;
}
.pn-group__empty {
  font-style: italic;
  font-size: 0.7rem;
  color: var(--text-tertiary);
}
.pn-group__platforms {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding-top: 2px;
}

.pn-plat {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-wrap: nowrap;
}
.pn-plat__icon {
  position: relative;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1.5px solid #cbd5e1;
  background: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  flex-shrink: 0;
}
.pn-plat__icon img {
  width: 14px;
  height: 14px;
  object-fit: contain;
}
.pn-plat__name {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 1;
  min-width: 0;
}
.pn-plat__arrow {
  color: var(--text-tertiary);
  font-size: 0.8rem;
  flex-shrink: 0;
}
.pn-plat__allowed {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 3px;
  min-width: 0;
  flex-shrink: 0;
  margin-left: auto;
}
.pn-plat__empty {
  font-style: italic;
  font-size: 0.66rem;
  color: var(--text-tertiary);
}
.pn-avatar--allowed {
  border-color: rgba(37, 99, 235, 0.5);
  background: rgba(37, 99, 235, 0.12);
  color: var(--color-primary, #2563eb);
}

.pn-empty-members {
  font-style: italic;
  color: var(--text-tertiary);
  font-size: 0.78rem;
  text-align: center;
  padding: 10px;
  border: 1px dashed var(--border-light, #e2e8f0);
  border-radius: 10px;
}
.ps-chip--xs {
  padding: 0 6px;
  font-size: 0.62rem;
}

@media (max-width: 960px) {
  .ps-kpis { grid-template-columns: 1fr 1fr; }
  .ps-grid { grid-template-columns: 1fr; }
  .pn-grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .ps-kpis { grid-template-columns: 1fr; }
  .ps-bar { grid-template-columns: 110px 1fr 36px; }
  .pn-tree__bottom { grid-template-columns: 1fr !important; }
}
</style>
