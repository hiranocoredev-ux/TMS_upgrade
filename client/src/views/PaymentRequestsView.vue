<script setup>
import { ref, computed, watch } from 'vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '../composables/useAuth';
import { normalizeRole, ROLES, canManageAllFinance, canViewAllFinance } from '../constants/roles';
import * as financeApi from '../services/finance';

const toast = useToast();
const authStore = useAuthStore();

const role = computed(() => normalizeRole(authStore.user?.role, authStore.user?.degree));
const isSuperAdmin = computed(() => role.value === ROLES.SUPER_ADMIN);
const isGroupBoss = computed(() => role.value === ROLES.GROUP_BOSS);
const isGroupMember = computed(() => role.value === ROLES.GROUP_MEMBER);
/** Super admin and finance manager handle boss → platform requests, as do flagged approvers. */
const handlesAllFinance = computed(() => canManageAllFinance(authStore.user?.role, authStore.user?.degree));
/** Admin (SYSTEM_ADMIN): views every request read-only (platform inbox), never handles or submits. */
const isReadOnlyAdmin = computed(() => role.value === ROLES.SYSTEM_ADMIN);
const viewsAllFinance = computed(() => canViewAllFinance(authStore.user?.role, authStore.user?.degree));
const canUsePlatformInbox = computed(
  () => viewsAllFinance.value || authStore.user?.paymentRequestApprover === true,
);
/** May change a request status (Review button). */
const canHandleRequests = computed(() => !isReadOnlyAdmin.value);

const activeScope = ref(viewsAllFinance.value ? 'platform_inbox' : 'my');
const requests = ref([]);
const loading = ref(false);
const error = ref('');

const newForm = ref({
  amount: '',
  currency: 'USD',
  reason: '',
  untilDate: '',
});

const actionModal = ref({
  open: false,
  request: null,
  status: 'DISCUSSING',
  comment: '',
});

const canSubmit = computed(() => isGroupMember.value || isGroupBoss.value);

const flowHint = computed(() => {
  if (isGroupMember.value) return 'Sent to your group boss for review.';
  if (isGroupBoss.value) return 'Sent to super admin or payment approvers.';
  return '';
});

const tabs = computed(() => {
  const t = [];
  // Super admin and finance manager handle requests (Admin only views them); they don't submit any.
  if (!viewsAllFinance.value) {
    t.push({ key: 'my', label: 'My requests', scope: 'my', desc: 'Your submissions' });
  }
  if (isGroupBoss.value) {
    t.push({ key: 'team', label: 'Team inbox', scope: 'team_inbox', desc: 'From your members' });
  }
  if (canUsePlatformInbox.value) {
    t.push({ key: 'platform', label: 'Boss → platform', scope: 'platform_inbox', desc: 'Group boss requests' });
  }
  return t;
});

const setTab = (key) => {
  const tab = tabs.value.find((x) => x.key === key);
  if (!tab) return;
  activeScope.value = tab.scope;
};

const currentTabKey = computed(() => {
  const hit = tabs.value.find((t) => t.scope === activeScope.value);
  return hit?.key || 'my';
});

const load = async () => {
  loading.value = true;
  error.value = '';
  try {
    const res = await financeApi.fetchPaymentRequests(activeScope.value);
    requests.value = res?.data?.requests || [];
  } catch (e) {
    error.value = e.response?.data?.message || e.message || 'Failed to load';
    requests.value = [];
  } finally {
    loading.value = false;
  }
};

watch(activeScope, () => {
  load();
}, { immediate: true });

const formatMoney = (n, c) =>
  `${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${c || 'USD'}`;

const formatDate = (d) => {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return String(d);
  return x.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateTime = (d) => {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return String(d);
  return x.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const flowLabel = (ft) => (ft === 'BOSS_TO_PLATFORM' ? 'Boss → platform' : 'Member → boss');

const statusClass = (s) => {
  const m = {
    PENDING: 'pr-pill--pending',
    DISCUSSING: 'pr-pill--discuss',
    ACCEPTED: 'pr-pill--ok',
    REJECTED: 'pr-pill--no',
  };
  return m[s] || '';
};

const listSectionTitle = computed(() => {
  if (activeScope.value === 'team_inbox') return 'Team requests';
  if (activeScope.value === 'platform_inbox') return 'Platform queue';
  return 'My submissions';
});

const openRequestsCount = computed(() =>
  requests.value.filter((r) => r.status !== 'ACCEPTED' && r.status !== 'REJECTED').length,
);

const submitNew = async () => {
  if (!canSubmit.value) return;
  const amount = Number(newForm.value.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    toast.warning('Enter a valid amount greater than 0.');
    return;
  }
  if (!String(newForm.value.reason || '').trim()) {
    toast.warning('Reason is required.');
    return;
  }
  if (!newForm.value.untilDate) {
    toast.warning('Pick the date you need this by.');
    return;
  }
  try {
    await financeApi.createPaymentRequest({
      amount,
      currency: (newForm.value.currency || 'USD').trim().toUpperCase(),
      reason: newForm.value.reason.trim(),
      untilDate: newForm.value.untilDate,
    });
    newForm.value = { amount: '', currency: 'USD', reason: '', untilDate: '' };
    await load();
  } catch {
    /* axios interceptor */
  }
};

const inboxScope = computed(() => activeScope.value === 'team_inbox' || activeScope.value === 'platform_inbox');

const openAction = (req) => {
  if (!canHandleRequests.value) return;
  actionModal.value = {
    open: true,
    request: req,
    status: 'DISCUSSING',
    comment: '',
  };
};

const closeAction = () => {
  actionModal.value = { open: false, request: null, status: 'DISCUSSING', comment: '' };
};

const submitAction = async () => {
  const r = actionModal.value.request;
  if (!r?.id) return;
  const st = actionModal.value.status;
  const comment = actionModal.value.comment.trim();
  if (st === 'REJECTED' && !comment) {
    toast.warning('A comment is required to reject.');
    return;
  }
  try {
    await financeApi.updatePaymentRequestStatus(r.id, { status: st, comment });
    closeAction();
    await load();
  } catch {
    /* axios interceptor */
  }
};
</script>

<template>
  <div class="pr-shell">
    <div class="pr-inner">
      <header class="pr-hero">
        <div class="pr-hero__text">
          <p class="pr-eyebrow">Finance</p>
          <h1 class="pr-title">Payment requests</h1>
          <p class="pr-lead">
            Members request payment from their <strong>group boss</strong>. Bosses escalate to
            <strong>super admin</strong> or <strong>payment approvers</strong>. Use
            <em>Discussing</em> while clarifying, then <em>Accept</em> or <em>Reject</em> (reject requires a note).
          </p>
        </div>
        <div v-if="inboxScope && !loading && requests.length" class="pr-hero__stat" aria-live="polite">
          <span class="pr-hero__stat-value">{{ openRequestsCount }}</span>
          <span class="pr-hero__stat-label">open in view</span>
        </div>
      </header>

      <nav v-if="tabs.length > 1" class="pr-seg" role="tablist" aria-label="Request views">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          role="tab"
          class="pr-seg__btn"
          :class="{ 'pr-seg__btn--active': currentTabKey === t.key }"
          :aria-selected="currentTabKey === t.key"
          @click="setTab(t.key)"
        >
          <span class="pr-seg__label">{{ t.label }}</span>
          <span class="pr-seg__hint">{{ t.desc }}</span>
        </button>
      </nav>

      <div v-if="error" class="pr-alert pr-alert--err" role="alert">
        <span class="pr-alert__icon" aria-hidden="true">!</span>
        <span>{{ error }}</span>
      </div>

      <div class="pr-grid" :class="{ 'pr-grid--solo': !canSubmit }">
        <aside v-if="canSubmit" class="pr-aside">
          <div class="pr-panel pr-panel--form">
            <div class="pr-panel__head">
              <div class="pr-panel__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                  <path
                    d="M12 3v18M16 7.5a4 4 0 0 0-4-2.5c-2.21 0-4 1.34-4 3s1.79 3 4 3 4 1.34 4 3-1.79 3-4 3a4 4 0 0 1-4-2.5"
                    stroke="currentColor"
                    stroke-width="1.75"
                    stroke-linecap="round"
                  />
                </svg>
              </div>
              <div>
                <h2 class="pr-panel__title">New request</h2>
                <p class="pr-panel__sub">{{ flowHint }}</p>
              </div>
            </div>

            <div class="pr-fields">
              <div class="pr-row2">
                <label class="pr-f">
                  <span class="pr-f__l">Amount</span>
                  <input
                    v-model="newForm.amount"
                    class="pr-input pr-input--lg"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    inputmode="decimal"
                  />
                </label>
                <label class="pr-f pr-f--narrow">
                  <span class="pr-f__l">Currency</span>
                  <select v-model="newForm.currency" class="pr-input pr-input--select">
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                  </select>
                </label>
              </div>
              <label class="pr-f">
                <span class="pr-f__l">Reason</span>
                <textarea
                  v-model="newForm.reason"
                  class="pr-input pr-textarea"
                  rows="3"
                  placeholder="What is this payment for? Be specific."
                />
              </label>
              <label class="pr-f">
                <span class="pr-f__l">Needed by</span>
                <input v-model="newForm.untilDate" class="pr-input" type="date" />
              </label>
            </div>

            <div class="pr-panel__foot">
              <button type="button" class="pr-btn pr-btn--primary" @click="submitNew">
                Submit request
              </button>
            </div>
          </div>
        </aside>

        <main class="pr-main">
          <div class="pr-panel pr-panel--list">
            <div class="pr-panel__head pr-panel__head--row">
              <div>
                <h2 class="pr-panel__title">{{ listSectionTitle }}</h2>
                <p class="pr-panel__sub">
                  {{ inboxScope ? (canHandleRequests ? 'Review and update status for each row.' : 'Read-only view of every request.') : 'Track status of your submissions.' }}
                </p>
              </div>
            </div>

            <div v-if="loading" class="pr-skeleton-wrap" aria-busy="true">
              <div v-for="n in 4" :key="n" class="pr-skeleton" />
            </div>

            <div v-else-if="!requests.length" class="pr-empty">
              <div class="pr-empty__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none">
                  <path
                    d="M9 12h6M12 9v6M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
              </div>
              <p class="pr-empty__title">Nothing here yet</p>
              <p class="pr-empty__text">When requests exist for this view, they will appear as cards below.</p>
            </div>

            <ul v-else class="pr-cards" role="list">
              <li v-for="r in requests" :key="r.id" class="pr-cardx" role="listitem">
                <div class="pr-cardx__main">
                  <div class="pr-cardx__top">
                    <span class="pr-pill pr-pill--flow">{{ flowLabel(r.flowType) }}</span>
                    <span class="pr-pill" :class="statusClass(r.status)">{{ r.status }}</span>
                  </div>
                  <p class="pr-cardx__amount">{{ formatMoney(r.amount, r.currency) }}</p>
                  <p class="pr-cardx__reason">{{ r.reason }}</p>
                  <div class="pr-cardx__meta">
                    <span class="pr-meta"><strong>From</strong> {{ r.requester?.name || '—' }}</span>
                    <span class="pr-meta"><strong>Submitted</strong> {{ formatDateTime(r.createdAt) }}</span>
                    <span class="pr-meta"><strong>Needed by</strong> {{ formatDate(r.untilDate) }}</span>
                  </div>
                  <p v-if="r.resolverComment" class="pr-cardx__note">
                    <span class="pr-cardx__note-label">Last note</span>
                    {{ r.resolverComment }}
                  </p>
                </div>
                <div v-if="inboxScope" class="pr-cardx__side">
                  <button
                    v-if="canHandleRequests && r.status !== 'ACCEPTED' && r.status !== 'REJECTED'"
                    type="button"
                    class="pr-btn pr-btn--soft"
                    @click="openAction(r)"
                  >
                    Review
                  </button>
                  <span v-else-if="r.status === 'ACCEPTED' || r.status === 'REJECTED'" class="pr-cardx__done">Closed</span>
                  <span v-else class="pr-cardx__done">Open</span>
                </div>
              </li>
            </ul>
          </div>
        </main>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="actionModal.open" class="pr-dim" @click.self="closeAction">
        <div class="pr-dialog" role="dialog" aria-modal="true" aria-labelledby="pr-dlg-title">
          <button type="button" class="pr-dialog__close" aria-label="Close" @click="closeAction">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
          <h3 id="pr-dlg-title" class="pr-dialog__title">Update request</h3>
          <p class="pr-dialog__sum">
            {{ formatMoney(actionModal.request.amount, actionModal.request.currency) }}
          </p>
          <p class="pr-dialog__reason">{{ actionModal.request.reason }}</p>

          <label class="pr-f">
            <span class="pr-f__l">New status</span>
            <select v-model="actionModal.status" class="pr-input pr-input--select">
              <option value="DISCUSSING">Discussing</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </label>
          <label class="pr-f">
            <span class="pr-f__l">Comment</span>
            <textarea
              v-model="actionModal.comment"
              class="pr-input pr-textarea"
              rows="3"
              placeholder="Required when rejecting; optional otherwise."
            />
          </label>
          <div class="pr-dialog__actions">
            <button type="button" class="pr-btn pr-btn--ghost" @click="closeAction">Cancel</button>
            <button type="button" class="pr-btn pr-btn--primary" @click="submitAction">Save</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.pr-shell {
  min-height: calc(100vh - 120px);
  background: linear-gradient(
    165deg,
    color-mix(in srgb, var(--color-primary, #6366f1) 6%, var(--bg-secondary, #f8fafc)) 0%,
    var(--bg-secondary, #f1f5f9) 38%,
    var(--bg-primary, #ffffff) 72%
  );
  padding: clamp(16px, 3vw, 32px) clamp(14px, 2.5vw, 28px) 48px;
}

.pr-inner {
  max-width: 1180px;
  margin: 0 auto;
}

.pr-hero {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 28px;
}

.pr-hero__text {
  max-width: 640px;
}

.pr-eyebrow {
  margin: 0 0 6px;
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-primary, #6366f1);
}

.pr-title {
  margin: 0 0 10px;
  font-size: clamp(1.5rem, 2.4vw, 1.85rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.15;
  color: var(--text-primary, #0f172a);
}

.pr-lead {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--text-secondary, #64748b);
}

.pr-lead strong {
  color: var(--text-primary, #334155);
  font-weight: 700;
}

.pr-lead em {
  font-style: normal;
  font-weight: 700;
  color: var(--color-primary-dark, #4338ca);
}

.pr-hero__stat {
  flex-shrink: 0;
  text-align: center;
  padding: 14px 22px;
  border-radius: 16px;
  background: var(--bg-primary, #fff);
  border: 1px solid color-mix(in srgb, var(--color-primary, #6366f1) 22%, transparent);
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.06);
}

.pr-hero__stat-value {
  display: block;
  font-size: 1.75rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--color-primary-dark, #4338ca);
  line-height: 1;
}

.pr-hero__stat-label {
  display: block;
  margin-top: 6px;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-tertiary, #94a3b8);
}

/* Segmented tabs */
.pr-seg {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 5px;
  margin-bottom: 24px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--bg-primary, #fff) 65%, var(--bg-tertiary, #e2e8f0));
  border: 1px solid var(--border-light, #e2e8f0);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

.pr-seg__btn {
  flex: 1 1 140px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px 14px 11px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}

.pr-seg__btn:hover {
  background: color-mix(in srgb, var(--bg-primary, #fff) 80%, transparent);
  color: var(--text-primary, #0f172a);
}

.pr-seg__btn--active {
  background: var(--bg-primary, #ffffff);
  color: var(--text-primary, #0f172a);
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.08);
}

.pr-seg__label {
  font-size: 0.875rem;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.pr-seg__hint {
  font-size: 0.6875rem;
  font-weight: 600;
  opacity: 0.85;
}

.pr-alert {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  margin-bottom: 18px;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
}

.pr-alert--err {
  border: 1px solid color-mix(in srgb, var(--color-error, #ef4444) 35%, transparent);
  background: color-mix(in srgb, var(--color-error, #ef4444) 8%, var(--bg-primary, #fff));
  color: var(--color-error, #b91c1c);
}

.pr-alert__icon {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-error, #ef4444) 18%, transparent);
  font-size: 0.75rem;
  font-weight: 900;
}

.pr-grid {
  display: grid;
  grid-template-columns: minmax(280px, 380px) 1fr;
  gap: clamp(18px, 2.5vw, 28px);
  align-items: start;
}

.pr-grid--solo {
  grid-template-columns: 1fr;
}

.pr-panel {
  border-radius: 18px;
  border: 1px solid var(--border-light, #e2e8f0);
  background: var(--bg-primary, #ffffff);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.8) inset,
    0 14px 40px -18px rgba(15, 23, 42, 0.12);
  overflow: hidden;
}

.pr-panel--form {
  position: sticky;
  top: 16px;
}

.pr-panel--list {
  min-height: 200px;
}

.pr-panel__head {
  display: flex;
  gap: 14px;
  padding: 18px 20px 16px;
  border-bottom: 1px solid var(--border-light, #f1f5f9);
  background: linear-gradient(180deg, var(--bg-tertiary, #f8fafc) 0%, var(--bg-primary, #fff) 100%);
}

.pr-panel__head--row {
  align-items: flex-start;
}

.pr-panel__icon {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: var(--color-primary-dark, #4338ca);
  background: color-mix(in srgb, var(--color-primary, #6366f1) 12%, var(--bg-primary, #fff));
  border: 1px solid color-mix(in srgb, var(--color-primary, #6366f1) 22%, transparent);
}

.pr-panel__title {
  margin: 0 0 4px;
  font-size: 1.0625rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text-primary, #0f172a);
}

.pr-panel__sub {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: var(--text-secondary, #64748b);
}

.pr-fields {
  padding: 18px 20px 8px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pr-row2 {
  display: grid;
  grid-template-columns: 1fr 120px;
  gap: 12px;
}

.pr-f {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pr-f--narrow {
  min-width: 0;
}

.pr-f__l {
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-tertiary, #94a3b8);
}

.pr-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-medium, #cbd5e1);
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #0f172a);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.pr-input:hover {
  border-color: var(--border-dark, #94a3b8);
}

.pr-input:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--color-primary, #6366f1) 55%, var(--border-medium, #cbd5e1));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary, #6366f1) 16%, transparent);
}

.pr-input--lg {
  font-size: 1.125rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.pr-input--select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M3 4.5L6 8l3-3.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
}

.pr-textarea {
  resize: vertical;
  min-height: 88px;
  line-height: 1.45;
}

.pr-panel__foot {
  padding: 0 20px 20px;
}

.pr-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;
  transition: transform 0.12s ease, filter 0.12s ease, background 0.15s ease;
}

.pr-btn:active {
  transform: scale(0.98);
}

.pr-btn--primary {
  width: 100%;
  background: linear-gradient(165deg, var(--color-primary, #6366f1) 0%, color-mix(in srgb, var(--color-primary, #6366f1) 88%, #1e1b4b) 100%);
  color: #fff;
  box-shadow: 0 4px 14px color-mix(in srgb, var(--color-primary, #6366f1) 35%, transparent);
}

.pr-btn--primary:hover {
  filter: brightness(1.05);
}

.pr-btn--ghost {
  background: var(--bg-primary, #fff);
  border-color: var(--border-medium, #cbd5e1);
  color: var(--text-secondary, #475569);
}

.pr-btn--ghost:hover {
  background: var(--bg-tertiary, #f1f5f9);
}

.pr-btn--soft {
  padding: 8px 14px;
  font-size: 0.8125rem;
  background: color-mix(in srgb, var(--color-primary, #6366f1) 10%, var(--bg-primary, #fff));
  border: 1px solid color-mix(in srgb, var(--color-primary, #6366f1) 35%, transparent);
  color: var(--color-primary-dark, #4338ca);
}

.pr-btn--soft:hover {
  background: color-mix(in srgb, var(--color-primary, #6366f1) 16%, var(--bg-primary, #fff));
}

.pr-skeleton-wrap {
  padding: 16px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pr-skeleton {
  height: 96px;
  border-radius: 14px;
  background: linear-gradient(
    90deg,
    var(--bg-tertiary, #f1f5f9) 0%,
    color-mix(in srgb, var(--bg-primary, #fff) 55%, var(--bg-tertiary, #f1f5f9)) 50%,
    var(--bg-tertiary, #f1f5f9) 100%
  );
  background-size: 200% 100%;
  animation: pr-sh 1.1s ease-in-out infinite;
}

@keyframes pr-sh {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.pr-empty {
  padding: 48px 24px;
  text-align: center;
}

.pr-empty__icon {
  margin: 0 auto 14px;
  color: var(--text-tertiary, #cbd5e1);
}

.pr-empty__title {
  margin: 0 0 6px;
  font-size: 1rem;
  font-weight: 800;
  color: var(--text-primary, #334155);
}

.pr-empty__text {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary, #94a3b8);
  max-width: 320px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.5;
}

.pr-cards {
  list-style: none;
  margin: 0;
  padding: 8px 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pr-cardx {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 16px 16px 18px;
  border-radius: 14px;
  border: 1px solid var(--border-light, #ebeef2);
  background: linear-gradient(135deg, var(--bg-primary, #fff) 0%, color-mix(in srgb, var(--bg-secondary, #f8fafc) 55%, var(--bg-primary, #fff)) 100%);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.pr-cardx:hover {
  border-color: color-mix(in srgb, var(--color-primary, #6366f1) 22%, var(--border-light, #e2e8f0));
  box-shadow: 0 8px 28px -12px rgba(15, 23, 42, 0.1);
}

.pr-cardx__main {
  flex: 1;
  min-width: 0;
}

.pr-cardx__top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.pr-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.625rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.pr-pill--flow {
  background: var(--bg-tertiary, #f1f5f9);
  color: var(--text-secondary, #64748b);
  border: 1px solid var(--border-light, #e2e8f0);
}

.pr-pill--pending {
  background: #fef3c7;
  color: #92400e;
}
.pr-pill--discuss {
  background: #e0e7ff;
  color: #3730a3;
}
.pr-pill--ok {
  background: #d1fae5;
  color: #065f46;
}
.pr-pill--no {
  background: #fee2e2;
  color: #991b1b;
}

.pr-cardx__amount {
  margin: 0 0 8px;
  font-size: 1.35rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  color: var(--text-primary, #0f172a);
}

.pr-cardx__reason {
  margin: 0 0 12px;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-secondary, #475569);
}

.pr-cardx__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  font-size: 0.75rem;
  color: var(--text-tertiary, #94a3b8);
}

.pr-meta strong {
  font-weight: 700;
  color: var(--text-secondary, #64748b);
  margin-right: 4px;
}

.pr-cardx__note {
  margin: 12px 0 0;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: var(--text-secondary, #475569);
  background: color-mix(in srgb, var(--bg-tertiary, #f1f5f9) 80%, var(--bg-primary, #fff));
  border: 1px solid var(--border-light, #e8ecf1);
}

.pr-cardx__note-label {
  display: block;
  font-size: 0.625rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary, #94a3b8);
  margin-bottom: 4px;
}

.pr-cardx__side {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 100px;
}

.pr-cardx__done {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-tertiary, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* Modal */
.pr-dim {
  position: fixed;
  inset: 0;
  z-index: 10050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.pr-dialog {
  position: relative;
  width: min(440px, 100%);
  padding: 22px 22px 20px;
  border-radius: 18px;
  border: 1px solid var(--border-light, #e2e8f0);
  background: var(--bg-primary, #fff);
  box-shadow: 0 24px 60px -20px rgba(15, 23, 42, 0.35);
}

.pr-dialog__close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.pr-dialog__close:hover {
  background: var(--bg-tertiary, #f1f5f9);
  color: var(--text-primary, #0f172a);
}

.pr-dialog__title {
  margin: 0 32px 6px 0;
  font-size: 1.125rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.pr-dialog__sum {
  margin: 0 0 8px;
  font-size: 1.25rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--color-primary-dark, #4338ca);
}

.pr-dialog__reason {
  margin: 0 0 18px;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-secondary, #64748b);
}

.pr-dialog .pr-f {
  margin-bottom: 14px;
}

.pr-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}

.pr-dialog__actions .pr-btn--primary {
  width: auto;
}

@media (max-width: 900px) {
  .pr-grid {
    grid-template-columns: 1fr;
  }
  .pr-panel--form {
    position: static;
  }
}

@media (max-width: 560px) {
  .pr-row2 {
    grid-template-columns: 1fr;
  }
  .pr-hero__stat {
    width: 100%;
  }
}
</style>
