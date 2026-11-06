<template>
  <div class="pv-page">
    <!-- ========== STICKY TOP BAR ========== -->
    <header class="pv-bar pv-bar--top">
      <div class="pv-bar__inner">
        <router-link :to="{ name: 'Profiles' }" class="pv-bar__back" aria-label="Back">
          <span aria-hidden="true">←</span>
          <span class="pv-bar__back-label">All profiles</span>
        </router-link>
        <div class="pv-bar__spacer"></div>
        <div class="pv-bar__actions">
          <button v-if="permissions.canEditAny" type="button" class="btn btn--ghost" @click="goEdit">
            <span aria-hidden="true">✏️</span> Edit
          </button>
          <button v-if="permissions.canDelete" type="button" class="btn btn--danger" @click="confirmDelete = true">
            <span aria-hidden="true">🗑</span> Delete
          </button>
        </div>
      </div>
    </header>

    <main class="pv-canvas">
      <div v-if="loading" class="pv-state">Loading profile…</div>
      <div v-else-if="error" class="pv-state pv-state--error">{{ error }}</div>
      <div v-else-if="!profile" class="pv-state">Profile not found.</div>

      <template v-else>
        <!-- ========== HERO ========== -->
        <section class="pv-hero">
          <div class="pv-hero__avatar">
            <img
              v-if="profile.pictureFileId && profile.pictureFileId._id"
              :src="resolveFileUrl(profile.pictureFileId._id)"
              :alt="profile.name"
            />
            <span v-else class="pv-hero__avatar-fallback">{{ initials(profile.name) }}</span>
          </div>
          <div class="pv-hero__main">
            <div class="pv-eyebrow">Client record</div>
            <h1 class="pv-hero__name">
              {{ profile.name }}
              <span class="pv-hero__flag" :title="countryName(profile.countryCode)">
                <img
                  v-if="countryFlagUrl(profile.countryCode, 40)"
                  :src="countryFlagUrl(profile.countryCode, 40)"
                  :alt="countryName(profile.countryCode) || profile.countryCode"
                />
                <span v-else>🏳️</span>
              </span>
            </h1>
            <div class="pv-hero__meta">
              <span class="pv-pill" :class="`pv-pill--status-${profile.status}`">
                <span class="pv-pill__dot"></span>{{ profile.status }}
              </span>
              <span v-for="wr in profile.workingRoles" :key="wr" class="pv-pill pv-pill--accent">
                {{ WORKING_ROLE_ICONS[wr] }} {{ WORKING_ROLE_LABELS[wr] }}
              </span>
              <span class="pv-pill pv-pill--score">
                <span class="pv-pill__stars">
                  <span
                    v-for="n in 5"
                    :key="n"
                    :class="['pv-pill__star', { 'pv-pill__star--on': profile.statusScore >= n }]"
                  >★</span>
                </span>
                <strong>{{ profile.statusScore }}/5</strong>
              </span>
            </div>
          </div>
          <div class="pv-hero__funds">
            <div class="pv-fund">
              <div class="pv-fund__label">Incoming</div>
              <div class="pv-fund__value">{{ fmtCurrency(profile.totalIncomingFund) }}</div>
            </div>
            <div class="pv-fund">
              <div class="pv-fund__label">Given</div>
              <div class="pv-fund__value">{{ fmtCurrency(profile.totalGivenFund) }}</div>
            </div>
            <div class="pv-fund pv-fund--profit">
              <div class="pv-fund__label">Profit</div>
              <div class="pv-fund__value">{{ fmtCurrency(profile.totalProfitFund) }}</div>
            </div>
          </div>
        </section>

        <!-- ========== BASE INFORMATION ========== -->
        <section class="pv-card">
          <header class="pv-card__head">
            <div class="pv-card__icon pv-card__icon--blue">🪪</div>
            <div class="pv-card__title">
              <h2>Base Information</h2>
              <p>Identity, location, work role state and finances.</p>
            </div>
          </header>
          <div class="pv-card__body">
            <dl class="pv-grid pv-grid--4">
              <div><dt>Country</dt><dd>
                <span v-if="profile.countryCode" class="pv-country-cell">
                  <img
                    v-if="countryFlagUrl(profile.countryCode, 40)"
                    :src="countryFlagUrl(profile.countryCode, 40)"
                    :alt="countryName(profile.countryCode) || profile.countryCode"
                    class="pv-country-cell__flag"
                  />
                  <span v-else>{{ countryFlag(profile.countryCode) }}</span>
                  <span>{{ countryName(profile.countryCode) || profile.countryCode }}</span>
                </span>
                <span v-else class="pv-muted">—</span>
              </dd></div>
              <div><dt>Age</dt><dd>{{ profile.age ?? '—' }}</dd></div>
              <div><dt>Sex</dt><dd>{{ profile.sex || '—' }}</dd></div>
              <div class="pv-span2"><dt>Address</dt><dd>{{ profile.address || '—' }}</dd></div>
              <div><dt>Created</dt><dd>{{ formatDate(profile.createdAt) }}</dd></div>
              <div><dt>Updated</dt><dd>{{ formatDate(profile.updatedAt) }}</dd></div>
            </dl>

            <div class="pv-divider"></div>

            <dl class="pv-grid pv-grid--2">
              <div><dt>Status score</dt><dd>
                <div class="pv-stars">
                  <span
                    v-for="n in 5"
                    :key="n"
                    :class="['pv-star', { 'pv-star--on': profile.statusScore >= n }]"
                  >★</span>
                  <strong class="pv-stars__value">{{ profile.statusScore }}/5</strong>
                </div>
              </dd></div>
              <div><dt>Work role state</dt><dd>
                <span v-if="!profile.workingRoles.length" class="pv-muted">—</span>
                <span v-else class="pv-chip-row">
                  <span v-for="wr in profile.workingRoles" :key="wr" class="pv-pill pv-pill--accent">
                    {{ WORKING_ROLE_ICONS[wr] }} {{ WORKING_ROLE_LABELS[wr] }}
                  </span>
                </span>
              </dd></div>
            </dl>

            <div class="pv-divider"></div>

            <dl class="pv-grid pv-grid--2">
              <div><dt>Profile owner</dt><dd>
                <div v-if="profile.ownerUserId" class="pv-owner">
                  <div class="pv-owner__avatar">{{ initials(profile.ownerUserId.name) }}</div>
                  <div class="pv-owner__id">
                    <strong>{{ profile.ownerUserId.name }}</strong>
                    <span class="pv-muted">{{ profile.ownerUserId.email }}</span>
                  </div>
                </div>
                <span v-else class="pv-muted">—</span>
              </dd></div>
              <div><dt>Hunting owner <span class="pv-lock-tag">🔒 immutable</span></dt><dd>
                <div v-if="profile.huntingOwnerId" class="pv-owner">
                  <div class="pv-owner__avatar">{{ initials(profile.huntingOwnerId.name) }}</div>
                  <div class="pv-owner__id">
                    <strong>{{ profile.huntingOwnerId.name }}</strong>
                    <span class="pv-muted">{{ profile.huntingOwnerId.email }}</span>
                  </div>
                </div>
                <span v-else class="pv-muted">—</span>
              </dd></div>
              <div><dt>Call support</dt><dd>
                <div v-if="profile.callSupportEnabled" class="pv-callsupport">
                  <span class="pv-pill pv-pill--ok">📞 Active</span>
                  <span v-if="profile.callerUserId" class="pv-muted">
                    Caller: <strong>{{ profile.callerUserId.name }}</strong>
                  </span>
                </div>
                <span v-else class="pv-muted">Disabled</span>
              </dd></div>
            </dl>

            <div v-if="profile.comment" class="pv-comment">
              <div class="pv-eyebrow">Comment</div>
              <p class="pv-pre">{{ profile.comment }}</p>
            </div>
          </div>
        </section>

        <!-- ========== CONTACT INFORMATION ========== -->
        <section v-if="permissions.canViewContact" class="pv-card">
          <header class="pv-card__head">
            <div class="pv-card__icon pv-card__icon--violet">📞</div>
            <div class="pv-card__title">
              <h2>Contact Information</h2>
              <p>Channels we use to reach this client.</p>
            </div>
            <span class="pv-badge pv-badge--private">Private</span>
          </header>
          <div class="pv-card__body">
            <dl class="pv-grid pv-grid--2">
              <div><dt>Email</dt><dd>{{ profile.email || '—' }}</dd></div>
              <div><dt>Phone</dt><dd>{{ profile.phone || '—' }}</dd></div>
              <div><dt>LinkedIn</dt><dd>
                <a v-if="profile.linkedinUrl" :href="profile.linkedinUrl" target="_blank" rel="noopener" class="pv-link">{{ profile.linkedinUrl }}</a>
                <span v-else class="pv-muted">—</span>
              </dd></div>
              <div><dt>GitHub</dt><dd>
                <a v-if="profile.githubUrl" :href="profile.githubUrl" target="_blank" rel="noopener" class="pv-link">{{ profile.githubUrl }}</a>
                <span v-else class="pv-muted">—</span>
              </dd></div>
              <div class="pv-span2"><dt>Website</dt><dd>
                <a v-if="profile.websiteUrl" :href="profile.websiteUrl" target="_blank" rel="noopener" class="pv-link">{{ profile.websiteUrl }}</a>
                <span v-else class="pv-muted">—</span>
              </dd></div>
            </dl>

            <div v-if="profile.contactHandles && profile.contactHandles.length" class="pv-handles">
              <div class="pv-eyebrow">Messaging handles</div>
              <ul>
                <li v-for="(h, i) in profile.contactHandles" :key="`h-${i}`">
                  <span
                    class="pv-handle-chip"
                    :style="{ background: CONTACT_HANDLE_ACCENTS[h.platform] || CONTACT_HANDLE_ACCENTS.custom }"
                  >
                    <span class="pv-handle-chip__icon">
                      <img
                        v-if="CONTACT_HANDLE_ICON_URLS[h.platform]"
                        :src="CONTACT_HANDLE_ICON_URLS[h.platform]"
                        :alt="CONTACT_HANDLE_LABELS[h.platform] || h.platform"
                      />
                      <span v-else>{{ CONTACT_HANDLE_ICONS[h.platform] || CONTACT_HANDLE_ICONS.custom }}</span>
                    </span>
                    {{ CONTACT_HANDLE_LABELS[h.platform] || h.platform }}{{ h.platform === 'custom' && h.customLabel ? ` · ${h.customLabel}` : '' }}
                  </span>
                  <code>{{ h.handle }}</code>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <!-- ========== CONTRACT INFORMATION ========== -->
        <section v-if="permissions.canViewContract" class="pv-card">
          <header class="pv-card__head">
            <div class="pv-card__icon pv-card__icon--green">📑</div>
            <div class="pv-card__title">
              <h2>Contract Information</h2>
              <p>How revenue is shared with the client and within the team.</p>
            </div>
            <span class="pv-badge pv-badge--private">Private</span>
          </header>
          <div class="pv-card__body">
            <dl class="pv-grid pv-grid--2">
              <div><dt>Client share</dt><dd>
                <div class="pv-pct-display">
                  <div class="pv-pct-bar"><div class="pv-pct-fill" :style="{ width: profile.clientSharePercent + '%' }"></div></div>
                  <strong>{{ profile.clientSharePercent }}%</strong>
                </div>
              </dd></div>
              <div><dt>Internal hiring split</dt><dd>
                <div class="pv-pct-display">
                  <div class="pv-pct-bar"><div class="pv-pct-fill pv-pct-fill--violet" :style="{ width: profile.internalHiringSharePercent + '%' }"></div></div>
                  <strong>{{ profile.internalHiringSharePercent }}%</strong>
                </div>
              </dd></div>
            </dl>
          </div>
        </section>

        <!-- ========== WORKING ROLE TABS ========== -->
        <section v-if="visibleTabs.length" class="pv-card pv-card--tabs">
          <header class="pv-card__head">
            <div class="pv-card__icon pv-card__icon--amber">🤝</div>
            <div class="pv-card__title">
              <h2>Working Roles</h2>
              <p>Devices and manager group, per role.</p>
            </div>
          </header>

          <nav class="pv-tabs" role="tablist">
            <button
              v-for="t in visibleTabs"
              :key="t.role"
              type="button"
              class="pv-tab"
              :class="{ 'pv-tab--active': activeTabRole === t.role }"
              :aria-selected="activeTabRole === t.role"
              role="tab"
              @click="activeTabRole = t.role"
            >
              <span class="pv-tab__icon">{{ WORKING_ROLE_ICONS[t.role] }}</span>
              <span>{{ WORKING_ROLE_LABELS[t.role] }}</span>
              <span v-if="(t.devices || []).length || (t.managers || []).length" class="pv-tab__badge">
                {{ (t.devices || []).length + (t.managers || []).length }}
              </span>
            </button>
          </nav>

          <div v-if="activeTab" class="pv-tab__panel">
            <!-- Tab meta: Start time -->
            <div v-if="activeTab.startedAt" class="pv-tab-meta">
              <div class="pv-tab-meta__cell">
                <span class="pv-eyebrow">Started</span>
                <strong>📅 {{ formatStartDate(activeTab.startedAt) }}</strong>
                <span class="pv-muted">·  {{ relativeFromDate(activeTab.startedAt) }}</span>
              </div>
            </div>

            <!-- Devices -->
            <div class="pv-sub">
              <header class="pv-sub__head">
                <h3>💻 Devices</h3>
                <button
                  v-if="canRevealActiveTab && activeTabHasRemote"
                  class="btn btn--reveal btn--xs"
                  :disabled="revealing"
                  @click="revealActiveTab"
                >
                  {{ revealing ? 'Revealing…' : (revealedTabsMap[activeTabRole] ? '🔓 Re-fetch' : '🔓 Reveal credentials') }}
                </button>
              </header>
              <p v-if="!(activeTab.devices || []).length" class="pv-empty">No devices in this tab.</p>

              <article v-for="d in (activeTab.devices || [])" :key="d._id" class="pv-device">
                <header class="pv-device__head">
                  <strong>{{ d.detail || 'Device' }}</strong>
                  <span class="pv-pill pv-pill--value">${{ fmtAmount(d.price) }}</span>
                  <span class="pv-pill" :class="d.buyerType === 'user' ? 'pv-pill--accent' : ''">
                    {{ d.buyerType === 'user' ? `Team: ${d.buyerUserId?.name || '—'}` : 'Client paid' }}
                  </span>
                </header>
                <div v-if="d.notes" class="pv-device__notes">{{ d.notes }}</div>

                <div v-if="d.remoteEnabled" class="pv-device__remote">
                  <div class="pv-device__remote-head">
                    <span class="pv-eyebrow">Remote access</span>
                    <span class="pv-pill pv-pill--soft">{{ remoteToolLabel(d) }}</span>
                  </div>
                  <div v-if="revealedDevice(d._id)" class="pv-device__creds">
                    <div><span class="pv-cred-key">ID</span><code>{{ revealedDevice(d._id).remoteId || '—' }}</code></div>
                    <div><span class="pv-cred-key">Pass</span><code>{{ revealedDevice(d._id).remotePassword || '—' }}</code></div>
                  </div>
                  <div v-else class="pv-device__creds pv-muted">
                    <span v-if="d.hasRemoteId">•••• id stored</span>
                    <span v-if="d.hasRemotePassword"> · •••• password</span>
                    <span v-if="!d.hasRemoteId && !d.hasRemotePassword">— credentials not stored</span>
                  </div>
                </div>
              </article>
            </div>

            <div class="pv-divider"></div>

            <!-- Platform credentials -->
            <div v-if="(activeTab.platformCredentials || []).length" class="pv-sub">
              <h3>🔑 Platform Credentials <span class="pv-lock">🔒</span></h3>
              <article
                v-for="c in activeTab.platformCredentials"
                :key="c._id"
                class="pv-cred"
              >
                <header class="pv-cred__head">
                  <strong>{{ c.platform || 'Untitled credential' }}</strong>
                  <span
                    class="pv-cred-status"
                    :style="credStatusStyle(c.status)"
                  >{{ PLATFORM_CREDENTIAL_STATUS_LABELS[c.status || DEFAULT_PLATFORM_CREDENTIAL_STATUS] }}</span>
                  <span v-if="c.hint" class="pv-muted">{{ c.hint }}</span>
                  <button
                    v-if="c.viewerCanReveal && (c.hasGmail || c.hasPassword)"
                    type="button"
                    class="btn btn--reveal btn--xs"
                    :disabled="revealingCredId === c._id"
                    @click="revealCred(c)"
                  >{{
                    revealedCreds[c._id]
                      ? '🔓 Re-fetch'
                      : (revealingCredId === c._id ? 'Revealing…' : '🔓 Reveal')
                  }}</button>
                  <span v-else-if="c.hasGmail || c.hasPassword" class="pv-pill pv-pill--soft">🔒 No reveal access</span>
                  <span v-else class="pv-pill pv-pill--soft">— no credentials stored</span>
                </header>
                <div v-if="revealedCreds[c._id]" class="pv-cred__body">
                  <div><span class="pv-cred-key">Gmail</span><code>{{ revealedCreds[c._id].gmail || '—' }}</code></div>
                  <div><span class="pv-cred-key">Pass</span><code>{{ revealedCreds[c._id].password || '—' }}</code></div>
                </div>
                <div v-else class="pv-cred__body pv-muted">
                  <span v-if="c.hasGmail">•••• gmail stored</span>
                  <span v-if="c.hasPassword"> · •••• password</span>
                </div>
                <p v-if="c.notes" class="pv-cred__notes">{{ c.notes }}</p>
                <div v-if="c.allowedMembers && c.allowedMembers.length" class="pv-cred__acl">
                  <span class="pv-eyebrow">Access</span>
                  <span class="pv-cred__acl-count">
                    {{ c.allowedMembers.filter(m => m.isActive).length }} active · {{ c.allowedMembers.length }} listed
                  </span>
                </div>
              </article>
            </div>

            <div v-if="(activeTab.platformCredentials || []).length" class="pv-divider"></div>

            <!-- Transactions -->
            <div v-if="(activeTab.transactions || []).length" class="pv-sub">
              <h3>💰 Transactions</h3>
              <div class="pv-tx-table">
                <div class="pv-tx-table__head">
                  <span>Date</span>
                  <span>Description</span>
                  <span class="pv-tx-table__num">Income</span>
                  <span class="pv-tx-table__num">Given</span>
                  <span class="pv-tx-table__num">Profit</span>
                </div>
                <div v-for="tx in activeTab.transactions" :key="tx._id" class="pv-tx-row">
                  <span class="pv-tx-row__date">{{ tx.date || formatShortDate(tx.createdAt) }}</span>
                  <span class="pv-tx-row__desc">{{ tx.description || '—' }}</span>
                  <span class="pv-tx-row__num">${{ fmtAmount(tx.income) }}</span>
                  <span class="pv-tx-row__num">${{ fmtAmount(tx.given) }}</span>
                  <span class="pv-tx-row__num pv-tx-row__num--profit">${{ fmtAmount(tx.profit) }}</span>
                </div>
                <div v-if="activeTab.subtotals" class="pv-tx-row pv-tx-row--total">
                  <span>Subtotal</span>
                  <span></span>
                  <span class="pv-tx-row__num">${{ fmtAmount(activeTab.subtotals.incoming) }}</span>
                  <span class="pv-tx-row__num">${{ fmtAmount(activeTab.subtotals.given) }}</span>
                  <span class="pv-tx-row__num pv-tx-row__num--profit">${{ fmtAmount(activeTab.subtotals.profit) }}</span>
                </div>
              </div>
            </div>

            <div v-if="(activeTab.transactions || []).length" class="pv-divider"></div>

            <!-- Managers -->
            <div class="pv-sub">
              <h3>👥 Manager Group</h3>
              <p v-if="!(activeTab.managers || []).length" class="pv-empty">No managers assigned to this tab.</p>
              <ul v-else class="pv-mgrs">
                <li
                  v-for="m in (activeTab.managers || [])"
                  :key="m._id"
                  class="pv-mgr"
                  :class="{ 'pv-mgr--inactive': !m.isActive }"
                >
                  <div class="pv-mgr__avatar">
                    <img v-if="m.userId && m.userId.avatarUrl" :src="m.userId.avatarUrl" :alt="m.userId.name" />
                    <span v-else>{{ initials(m.userId && m.userId.name) }}</span>
                  </div>
                  <div class="pv-mgr__info">
                    <strong>{{ (m.userId && m.userId.name) || '—' }}</strong>
                    <span class="pv-muted">{{ (m.userId && m.userId.email) || '' }}</span>
                  </div>
                  <span v-if="m.isActive" class="pv-pill pv-pill--ok">
                    <span class="pv-pill__dot"></span>Active
                  </span>
                  <span v-else class="pv-pill">Inactive</span>
                </li>
              </ul>
            </div>

            <div v-if="activeTab.notes" class="pv-comment">
              <div class="pv-eyebrow">Notes</div>
              <p class="pv-pre">{{ activeTab.notes }}</p>
            </div>
          </div>
        </section>
      </template>
    </main>

    <!-- Delete confirm -->
    <div v-if="confirmDelete" class="pv-confirm" @mousedown.self="confirmDelete = false">
      <div class="pv-confirm__box">
        <h3>Delete profile?</h3>
        <p>This permanently removes <strong>{{ profile?.name }}</strong>. Cannot be undone.</p>
        <div class="pv-confirm__actions">
          <button class="btn btn--ghost" :disabled="deleting" @click="confirmDelete = false">Cancel</button>
          <button class="btn btn--danger" :disabled="deleting" @click="doDelete">
            {{ deleting ? 'Deleting…' : 'Delete profile' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  WORKING_ROLE_LABELS,
  WORKING_ROLE_ICONS,
  CONTACT_HANDLE_LABELS,
  CONTACT_HANDLE_ICONS,
  CONTACT_HANDLE_ICON_URLS,
  CONTACT_HANDLE_ACCENTS,
  REMOTE_TOOL_LABELS,
  CURRENCY_SYMBOLS,
  PLATFORM_CREDENTIAL_STATUSES,
  DEFAULT_PLATFORM_CREDENTIAL_STATUS,
  PLATFORM_CREDENTIAL_STATUS_LABELS,
  PLATFORM_CREDENTIAL_STATUS_ACCENTS,
} from '../../constants/profiles.js';
import { countryFlag, countryFlagUrl, countryName } from '../../constants/countries.js';
import {
  getProfile,
  deleteProfile,
  revealTabDevices,
  revealPlatformCredential,
} from '../../services/profiles';

const props = defineProps({
  id: { type: String, required: true },
});

const router = useRouter();

const profile = ref(null);
const permissions = ref({
  canView: true, canEditAny: false, canDelete: false,
  canViewContact: false, canViewContract: false, tabs: {},
});
const loading = ref(false);
const error = ref(null);
const confirmDelete = ref(false);
const deleting = ref(false);

const revealedTabsMap = reactive({});
const revealing = ref(false);
const revealedCreds = reactive({});      // { [credentialId]: { gmail, password } }
const revealingCredId = ref(null);
const activeTabRole = ref('');

const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const resolveFileUrl = (id) => `${apiBase}/files/${id}/download`;

const visibleTabs = computed(() => (profile.value?.workingRoleTabs || []));
const activeTab = computed(() => visibleTabs.value.find((t) => t.role === activeTabRole.value) || null);
const canRevealActiveTab = computed(() => !!(activeTabRole.value && permissions.value.tabs?.[activeTabRole.value]?.canEdit));
const activeTabHasRemote = computed(() => (activeTab.value?.devices || []).some(
  (d) => d.remoteEnabled && (d.hasRemoteId || d.hasRemotePassword)
));

const revealedDevice = (id) => {
  const arr = revealedTabsMap[activeTabRole.value];
  if (!arr) return null;
  return arr.find((d) => String(d._id) === String(id)) || null;
};

const remoteToolLabel = (d) => {
  if (d.remoteTool === 'custom') return d.remoteToolCustomName || 'Custom tool';
  return REMOTE_TOOL_LABELS[d.remoteTool] || 'Remote';
};

/** Tint the credential status chip from its accent colour (mirrors the form). */
const credStatusStyle = (status) => {
  const key = PLATFORM_CREDENTIAL_STATUSES.includes(status)
    ? status
    : DEFAULT_PLATFORM_CREDENTIAL_STATUS;
  const accent = PLATFORM_CREDENTIAL_STATUS_ACCENTS[key];
  return { color: accent, borderColor: accent, background: `${accent}1f` };
};

const initials = (name) => String(name || '?')
  .trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();

const formatDate = (iso) => iso ? new Date(iso).toLocaleString() : '—';
const formatShortDate = (iso) => iso ? new Date(iso).toISOString().slice(0, 10) : '';
const fmtAmount = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const formatStartDate = (ymd) => {
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};
const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const relativeFromDate = (ymd) => {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return '';
  const then = Date.UTC(y, m - 1, d);
  const diffDays = Math.round((then - Date.now()) / 86400000);
  if (Math.abs(diffDays) < 30) return RTF.format(diffDays, 'day');
  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 18) return RTF.format(diffMonths, 'month');
  return RTF.format(Math.round(diffDays / 365), 'year');
};

const fmtCurrency = (n, currencyOverride) => {
  const cur = currencyOverride || profile.value?.currency || 'USD';
  const sym = CURRENCY_SYMBOLS[cur] || (cur + ' ');
  const num = Number(n) || 0;
  return `${sym}${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const load = async () => {
  loading.value = true;
  error.value = null;
  try {
    const res = await getProfile(props.id);
    profile.value = res?.data?.profile || null;
    permissions.value = res?.data?.permissions || permissions.value;
    const tabs = profile.value?.workingRoleTabs || [];
    if (tabs.length && !activeTabRole.value) activeTabRole.value = tabs[0].role;
  } catch (err) {
    error.value = err?.response?.data?.message || 'Failed to load profile';
  } finally {
    loading.value = false;
  }
};

const revealActiveTab = async () => {
  if (!activeTabRole.value) return;
  revealing.value = true;
  try {
    const res = await revealTabDevices(props.id, activeTabRole.value);
    revealedTabsMap[activeTabRole.value] = res?.data?.devices || [];
  } catch (err) {
    error.value = err?.response?.data?.message || 'Failed to reveal credentials';
  } finally {
    revealing.value = false;
  }
};

const revealCred = async (c) => {
  if (!activeTabRole.value || !c || !c._id) return;
  revealingCredId.value = c._id;
  try {
    const res = await revealPlatformCredential(props.id, activeTabRole.value, c._id);
    revealedCreds[c._id] = {
      gmail: res?.data?.gmail || '',
      password: res?.data?.password || '',
    };
  } catch (err) {
    error.value = err?.response?.data?.message || 'Failed to reveal credential';
  } finally {
    revealingCredId.value = null;
  }
};

const goEdit = () => router.push({ name: 'ProfileEdit', params: { id: props.id } });

const doDelete = async () => {
  deleting.value = true;
  try {
    await deleteProfile(props.id);
    router.push({ name: 'Profiles' });
  } catch (err) {
    error.value = err?.response?.data?.message || 'Failed to delete';
    deleting.value = false;
    confirmDelete.value = false;
  }
};

onMounted(load);
watch(() => props.id, load);
</script>

<style scoped>
.pv-page {
  --pv-surface: var(--bg-primary, #ffffff);
  --pv-surface-alt: var(--bg-secondary, #f8fafc);
  --pv-border: var(--border-light, #e5e7eb);
  --pv-border-strong: var(--border-medium, #cbd5e1);
  --pv-text: var(--text-primary, #0f172a);
  --pv-text-2: var(--text-secondary, #475569);
  --pv-text-3: var(--text-tertiary, #94a3b8);
  --pv-primary: var(--color-primary, #2563eb);
  --pv-primary-soft: var(--color-primary-soft, rgba(37, 99, 235, 0.08));
  --pv-success: #047857;
  --pv-warning: #b45309;
  --pv-violet: #6d28d9;
  --pv-danger: var(--color-error, #ef4444);
  --pv-radius: 14px;
  --pv-radius-sm: 8px;
  --pv-radius-lg: 18px;
  --pv-shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04);

  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--pv-surface-alt);
}

.pv-bar {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--pv-surface);
  border-bottom: 1px solid var(--pv-border);
}
.pv-bar__inner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  max-width: 1100px;
  margin: 0 auto;
}
.pv-bar__back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: var(--pv-radius-sm);
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
  color: var(--pv-text-2);
}
.pv-bar__back:hover { background: var(--pv-surface-alt); color: var(--pv-text); }
.pv-bar__title { display: flex; flex-direction: column; flex: 1; min-width: 0; line-height: 1.2; }
.pv-bar__eyebrow {
  font-size: 0.66rem; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--pv-text-3);
}
.pv-bar__name {
  font-size: 0.95rem; font-weight: 700;
  color: var(--pv-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pv-bar__actions { display: flex; gap: 8px; }

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: var(--pv-radius-sm);
  border: 1px solid transparent;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  white-space: nowrap;
}
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn--ghost { background: var(--pv-surface); border-color: var(--pv-border-strong); color: var(--pv-text); }
.btn--ghost:hover:not(:disabled) { background: var(--pv-surface-alt); }
.btn--reveal { background: #fff7ed; border-color: #fbbf24; color: var(--pv-warning); }
.btn--reveal:hover:not(:disabled) { background: #fef3c7; }
.btn--danger { background: var(--pv-danger); color: #fff; }
.btn--danger:hover:not(:disabled) { background: #b91c1c; }
.btn--xs { padding: 5px 10px; font-size: 0.76rem; }

.pv-canvas {
  flex: 1;
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 16px 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pv-state {
  background: var(--pv-surface);
  border: 1px dashed var(--pv-border-strong);
  border-radius: var(--pv-radius);
  padding: 36px;
  text-align: center;
  color: var(--pv-text-2);
  font-size: 0.92rem;
}
.pv-state--error { color: #b91c1c; border-color: rgba(239, 68, 68, 0.5); }

/* ============ HERO ============ */
.pv-hero {
  display: grid;
  grid-template-columns: 110px 1fr auto;
  gap: 18px;
  align-items: center;
  padding: 18px;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.04), rgba(99, 102, 241, 0.07));
  border: 1px solid var(--pv-border);
  border-radius: var(--pv-radius-lg);
  box-shadow: var(--pv-shadow-sm);
}
.pv-hero__avatar {
  width: 110px; height: 110px;
  border-radius: 16px; overflow: hidden;
  background: linear-gradient(135deg, #dbeafe, #e0e7ff);
  display: flex; align-items: center; justify-content: center;
  border: 3px solid #fff;
  box-shadow: var(--pv-shadow-sm);
}
.pv-hero__avatar img { width: 100%; height: 100%; object-fit: cover; }
.pv-hero__avatar-fallback { font-size: 2rem; font-weight: 800; color: var(--pv-primary); letter-spacing: -0.02em; }

.pv-eyebrow {
  font-size: 0.7rem; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--pv-text-3);
}
.pv-hero__name {
  margin: 4px 0 8px;
  font-size: clamp(1.4rem, 2.6vw, 1.75rem);
  font-weight: 800; color: var(--pv-text);
  letter-spacing: -0.01em;
  display: flex; align-items: center; gap: 10px;
}
.pv-hero__flag {
  font-size: 1.4rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 20px;
}
.pv-hero__flag img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 3px;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.15);
  display: block;
}
.pv-country-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.pv-country-cell__flag {
  width: 22px;
  height: 16px;
  object-fit: cover;
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.1);
  flex-shrink: 0;
}
.pv-hero__meta { display: flex; flex-wrap: wrap; gap: 6px; }

.pv-hero__funds { display: flex; gap: 8px; }
.pv-fund {
  background: var(--pv-surface);
  border: 1px solid var(--pv-border);
  border-radius: var(--pv-radius);
  padding: 10px 14px;
  min-width: 100px;
  text-align: right;
}
.pv-fund--profit {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(34, 197, 94, 0.04));
  border-color: rgba(34, 197, 94, 0.45);
}
.pv-fund__label {
  font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--pv-text-3); font-weight: 700;
}
.pv-fund__value {
  margin-top: 2px;
  font-size: 1.05rem; font-weight: 800;
  color: var(--pv-text);
  font-variant-numeric: tabular-nums;
}

/* ============ CARD ============ */
.pv-card {
  background: var(--pv-surface);
  border: 1px solid var(--pv-border);
  border-radius: var(--pv-radius-lg);
  box-shadow: var(--pv-shadow-sm);
  overflow: hidden;
}
.pv-card__head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--pv-border);
}
.pv-card__icon {
  width: 36px; height: 36px;
  border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 1.05rem;
  flex-shrink: 0;
}
.pv-card__icon--blue   { background: var(--pv-primary-soft); color: var(--pv-primary); }
.pv-card__icon--violet { background: rgba(139, 92, 246, 0.12); color: var(--pv-violet); }
.pv-card__icon--green  { background: rgba(16, 185, 129, 0.12); color: var(--pv-success); }
.pv-card__icon--amber  { background: rgba(245, 158, 11, 0.12); color: var(--pv-warning); }
.pv-card__title { flex: 1; min-width: 0; line-height: 1.3; }
.pv-card__title h2 {
  margin: 0;
  font-size: 1.02rem; font-weight: 700;
  color: var(--pv-text); letter-spacing: -0.01em;
}
.pv-card__title p {
  margin: 2px 0 0;
  font-size: 0.8rem; color: var(--pv-text-2);
}
.pv-card__body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.pv-card--tabs .pv-card__body { padding-top: 0; }

.pv-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 9px; border-radius: 999px;
  font-size: 0.66rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
  flex-shrink: 0;
}
.pv-badge--private { background: rgba(245, 158, 11, 0.16); color: var(--pv-warning); }

/* ============ GRID / DATA ============ */
.pv-grid { display: grid; gap: 12px 18px; margin: 0; }
.pv-grid--2 { grid-template-columns: repeat(2, 1fr); }
.pv-grid--4 { grid-template-columns: repeat(4, 1fr); }
.pv-grid > div { min-width: 0; }
.pv-grid dt {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--pv-text-3);
  font-weight: 700;
  margin-bottom: 4px;
  display: inline-flex; align-items: center; gap: 6px;
}
.pv-grid dd {
  margin: 0;
  font-size: 0.9rem;
  color: var(--pv-text);
  word-break: break-word;
}
.pv-span2 { grid-column: span 2; }

.pv-divider { height: 1px; background: var(--pv-border); margin: 4px 0; }
.pv-muted { color: var(--pv-text-3); }

.pv-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 9px; border-radius: 999px;
  font-size: 0.74rem; font-weight: 600;
  background: rgba(148, 163, 184, 0.18);
  color: var(--pv-text-2);
}
.pv-pill__dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.pv-pill--accent { background: var(--pv-primary-soft); color: var(--pv-primary); border: 1px solid rgba(37, 99, 235, 0.2); }
.pv-pill--score { background: rgba(99, 102, 241, 0.14); color: #4338ca; }
.pv-pill--value { background: rgba(34, 197, 94, 0.14); color: var(--pv-success); font-variant-numeric: tabular-nums; }
.pv-pill--ok { background: rgba(34, 197, 94, 0.16); color: var(--pv-success); }
.pv-pill--soft { background: var(--pv-surface-alt); color: var(--pv-text-2); border: 1px solid var(--pv-border); }
.pv-pill--status-active { background: rgba(34, 197, 94, 0.15); color: var(--pv-success); }
.pv-pill--status-archived { background: rgba(148, 163, 184, 0.2); color: var(--pv-text-3); }

.pv-lock-tag {
  font-size: 0.6rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
  background: rgba(148, 163, 184, 0.16);
  color: var(--pv-text-3);
  padding: 1px 6px; border-radius: 999px;
}

.pv-chip-row { display: inline-flex; flex-wrap: wrap; gap: 4px; }

/* Stars (status score 0–5) */
.pv-stars { display: inline-flex; align-items: center; gap: 2px; }
.pv-star {
  font-size: 1.15rem; line-height: 1;
  color: rgba(148, 163, 184, 0.45);
}
.pv-star--on { color: #f59e0b; }
.pv-stars__value {
  margin-left: 10px;
  font-size: 0.86rem; font-weight: 700;
  color: var(--pv-text);
  font-variant-numeric: tabular-nums;
}
.pv-pill__stars { display: inline-flex; gap: 1px; line-height: 1; }
.pv-pill__star { color: rgba(148, 163, 184, 0.45); font-size: 0.78rem; }
.pv-pill__star--on { color: #f59e0b; }

/* Transactions table */
/* Platform credentials */
.pv-cred {
  display: flex; flex-direction: column; gap: 6px;
  padding: 12px;
  background: var(--pv-surface);
  border: 1px solid var(--pv-border);
  border-radius: var(--pv-radius);
  margin-bottom: 8px;
}
.pv-cred__head {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.pv-cred__head strong { font-size: 0.92rem; color: var(--pv-text); }
.pv-cred-status {
  padding: 2px 9px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: .02em;
  white-space: nowrap;
}
.pv-cred__body { display: flex; flex-direction: column; gap: 2px; font-size: 0.86rem; }
.pv-cred__body div { display: flex; align-items: center; gap: 8px; }
.pv-cred__body code { background: rgba(148, 163, 184, 0.16); padding: 2px 8px; border-radius: 4px; }
.pv-cred__notes {
  margin: 4px 0 0; font-size: 0.84rem; color: var(--pv-text-2);
}
.pv-cred__acl {
  display: flex; align-items: center; gap: 8px;
  padding-top: 6px;
  border-top: 1px dashed var(--pv-border);
}
.pv-cred__acl-count { font-size: 0.76rem; color: var(--pv-text-3); }

.pv-tx-table {
  display: flex; flex-direction: column;
  border: 1px solid var(--pv-border);
  border-radius: var(--pv-radius);
  overflow: hidden;
  background: var(--pv-surface);
  font-size: 0.86rem;
}
.pv-tx-table__head,
.pv-tx-row {
  display: grid;
  grid-template-columns: 110px 1fr 110px 110px 110px;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
}
.pv-tx-table__head {
  background: var(--pv-surface-alt);
  border-bottom: 1px solid var(--pv-border);
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
  color: var(--pv-text-3);
}
.pv-tx-table__num { text-align: right; }
.pv-tx-row + .pv-tx-row { border-top: 1px solid var(--pv-border); }
.pv-tx-row__date { color: var(--pv-text-2); font-variant-numeric: tabular-nums; }
.pv-tx-row__desc { color: var(--pv-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pv-tx-row__num { text-align: right; font-variant-numeric: tabular-nums; color: var(--pv-text); }
.pv-tx-row__num--profit { color: var(--pv-success); font-weight: 700; }
.pv-tx-row--total {
  background: var(--pv-surface-alt);
  border-top: 2px solid var(--pv-border-strong);
  font-weight: 700;
  color: var(--pv-text);
}

/* Owner card */
.pv-owner {
  display: flex; align-items: center; gap: 10px;
}
.pv-owner__avatar {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: var(--pv-primary-soft);
  color: var(--pv-primary);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 0.74rem; font-weight: 700;
}
.pv-owner__id { display: flex; flex-direction: column; min-width: 0; }
.pv-owner__id strong { font-size: 0.9rem; color: var(--pv-text); }
.pv-owner__id span { font-size: 0.76rem; }

.pv-callsupport { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* Comment */
.pv-comment { display: flex; flex-direction: column; gap: 4px; }
.pv-pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 0.88rem;
  color: var(--pv-text);
  background: var(--pv-surface-alt);
  padding: 10px 12px;
  border-radius: var(--pv-radius-sm);
  border: 1px solid var(--pv-border);
}

/* Handles */
.pv-handles { display: flex; flex-direction: column; gap: 6px; }
.pv-handles ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.pv-handles li { display: flex; align-items: center; gap: 8px; font-size: 0.88rem; }
.pv-handles code { background: rgba(148, 163, 184, 0.16); padding: 2px 8px; border-radius: 4px; font-size: 0.85rem; }

.pv-handle-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px 3px 4px;
  border-radius: 999px;
  color: #fff;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.15);
}
.pv-handle-chip__icon {
  width: 22px; height: 22px;
  border-radius: 50%;
  background: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 0.78rem;
  padding: 2px;
  overflow: hidden;
  color: var(--pv-text-2);
}
.pv-handle-chip__icon img {
  width: 100%; height: 100%;
  object-fit: contain;
  display: block;
}
.pv-link { color: var(--pv-primary); text-decoration: none; }
.pv-link:hover { text-decoration: underline; }

/* Percent display */
.pv-pct-display { display: flex; align-items: center; gap: 10px; }
.pv-pct-bar {
  flex: 1;
  height: 8px;
  background: rgba(148, 163, 184, 0.18);
  border-radius: 999px;
  overflow: hidden;
  max-width: 320px;
}
.pv-pct-fill {
  height: 100%;
  background: linear-gradient(90deg, #60a5fa, var(--pv-primary));
  border-radius: 999px;
}
.pv-pct-fill--violet {
  background: linear-gradient(90deg, #a78bfa, var(--pv-violet));
}
.pv-pct-display strong {
  font-size: 1rem;
  font-weight: 800;
  color: var(--pv-text);
  font-variant-numeric: tabular-nums;
}

/* ============ TABS ============ */
.pv-tabs {
  display: flex;
  gap: 4px;
  padding: 0 20px;
  border-bottom: 1px solid var(--pv-border);
  overflow-x: auto;
  background: var(--pv-surface-alt);
}
.pv-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border: none;
  background: transparent;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--pv-text-2);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
}
.pv-tab:hover { color: var(--pv-text); }
.pv-tab--active {
  color: var(--pv-primary);
  border-bottom-color: var(--pv-primary);
}
.pv-tab__icon { font-size: 1rem; line-height: 1; }
.pv-tab__badge {
  display: inline-flex; align-items: center;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.2);
  color: var(--pv-text-3);
  font-size: 0.7rem; font-weight: 700;
}
.pv-tab--active .pv-tab__badge {
  background: var(--pv-primary-soft);
  color: var(--pv-primary);
}

.pv-tab__panel {
  display: flex; flex-direction: column; gap: 16px;
  padding: 20px;
}

.pv-tab-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 14px;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.06), rgba(99, 102, 241, 0.04));
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: var(--pv-radius);
}
.pv-tab-meta__cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--pv-text);
}
.pv-tab-meta__cell strong { font-weight: 700; }

.pv-sub { display: flex; flex-direction: column; gap: 10px; }
.pv-sub__head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px;
}
.pv-sub h3 { margin: 0; font-size: 0.96rem; font-weight: 700; color: var(--pv-text); }

.pv-empty {
  margin: 0; padding: 14px;
  font-style: italic; color: var(--pv-text-3);
  background: var(--pv-surface-alt);
  border: 1px dashed var(--pv-border);
  border-radius: var(--pv-radius-sm);
  font-size: 0.86rem;
  text-align: center;
}

/* Device */
.pv-device {
  background: var(--pv-surface-alt);
  border: 1px solid var(--pv-border);
  border-radius: var(--pv-radius);
  padding: 14px;
  display: flex; flex-direction: column; gap: 10px;
}
.pv-device__head { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.pv-device__head strong { font-size: 0.96rem; color: var(--pv-text); }
.pv-device__notes { font-size: 0.86rem; color: var(--pv-text-2); }
.pv-device__remote {
  padding: 10px 12px;
  background: var(--pv-surface);
  border: 1px solid var(--pv-border);
  border-radius: var(--pv-radius-sm);
  display: flex; flex-direction: column; gap: 6px;
}
.pv-device__remote-head { display: flex; align-items: center; gap: 8px; }
.pv-device__creds { display: flex; flex-direction: column; gap: 4px; font-size: 0.86rem; }
.pv-device__creds div { display: flex; align-items: center; gap: 8px; }
.pv-cred-key {
  display: inline-block;
  width: 40px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--pv-text-3);
}
.pv-device code { background: rgba(148, 163, 184, 0.16); padding: 2px 8px; border-radius: 4px; }

/* Managers */
.pv-mgrs { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.pv-mgr {
  display: flex; align-items: center; gap: 10px;
  background: var(--pv-surface-alt);
  border: 1px solid var(--pv-border);
  border-radius: var(--pv-radius);
  padding: 10px 12px;
}
.pv-mgr--inactive { opacity: 0.6; }
.pv-mgr__avatar {
  width: 36px; height: 36px;
  border-radius: 50%; overflow: hidden;
  background: var(--pv-primary-soft);
  color: var(--pv-primary);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 0.82rem;
}
.pv-mgr__avatar img { width: 100%; height: 100%; object-fit: cover; }
.pv-mgr__info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.pv-mgr__info strong { font-size: 0.9rem; color: var(--pv-text); }
.pv-mgr__info span { font-size: 0.76rem; }

/* Confirm modal */
.pv-confirm {
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 1100;
}
.pv-confirm__box {
  max-width: 420px;
  background: var(--pv-surface);
  border-radius: var(--pv-radius);
  padding: 20px;
  box-shadow: 0 12px 40px rgba(2, 8, 23, 0.32);
}
.pv-confirm__box h3 { margin: 0 0 8px; }
.pv-confirm__box p { margin: 0 0 16px; font-size: 0.9rem; color: var(--pv-text-2); }
.pv-confirm__actions { display: flex; justify-content: flex-end; gap: 8px; }

/* ============ RESPONSIVE ============ */
@media (max-width: 1024px) {
  .pv-hero { grid-template-columns: 96px 1fr; }
  .pv-hero__funds { grid-column: 1 / -1; justify-content: flex-start; }
  .pv-grid--4 { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 768px) {
  .pv-bar__inner { padding: 8px 12px; gap: 8px; }
  .pv-bar__back-label { display: none; }
  .pv-canvas { padding: 16px 12px 32px; }
  .pv-hero { padding: 14px; gap: 14px; }
  .pv-hero__avatar { width: 80px; height: 80px; }
  .pv-hero__avatar-fallback { font-size: 1.6rem; }
  .pv-card__head { padding: 14px 16px; gap: 10px; }
  .pv-card__body { padding: 16px; }
  .pv-card__icon { width: 32px; height: 32px; }
  .pv-card__title h2 { font-size: 0.96rem; }
  .pv-card__title p { font-size: 0.76rem; }
  .pv-grid--2, .pv-grid--4 { grid-template-columns: 1fr; }
  .pv-span2 { grid-column: span 1; }
  .pv-tabs { padding: 0 12px; }
  .pv-tab { padding: 10px 12px; font-size: 0.84rem; }
  .pv-tab__panel { padding: 16px; }
  .pv-hero__funds { width: 100%; flex-wrap: wrap; }
  .pv-fund { flex: 1; min-width: 90px; text-align: left; }

  .pv-tx-table__head,
  .pv-tx-row {
    grid-template-columns: 1fr 1fr 1fr;
    font-size: 0.78rem;
  }
  .pv-tx-table__head span:nth-child(1),
  .pv-tx-row__date { grid-column: 1 / 4; padding-bottom: 4px; border-bottom: 1px dashed var(--pv-border); }
  .pv-tx-table__head span:nth-child(2),
  .pv-tx-row__desc { grid-column: 1 / 4; padding-bottom: 4px; }
}
@media (max-width: 480px) {
  .pv-hero { grid-template-columns: 1fr; text-align: center; }
  .pv-hero__avatar { margin: 0 auto; }
  .pv-hero__meta { justify-content: center; }
  .pv-hero__name { justify-content: center; }
}
</style>
