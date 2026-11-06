<template>
  <div class="hist-page">
    <header class="hero">
      <div>
        <p class="hero__eyebrow">Competition History</p>
        <h1 class="hero__title">Bonus & Penalty History</h1>
      </div>
      <div class="hero__actions">
        <label class="field">
          <span class="field__label">Month</span>
          <div class="month-nav">
            <button type="button" class="icon-btn" @click="moveMonth(-1)">← Prev</button>
            <input v-model="month" type="month" class="field__input month-nav__input" />
            <button type="button" class="icon-btn" @click="moveMonth(1)">Next →</button>
          </div>
        </label>
        <label class="field">
          <span class="field__label">Search member</span>
          <input v-model.trim="searchTerm" class="field__input" placeholder="Name / group" />
        </label>
      </div>
    </header>

    <section class="panel">
      <header class="panel__head">
        <h2 class="panel__title">Groups</h2>
      </header>
      <div class="cards">
        <article v-for="g in filteredGroups" :key="`g-${g.groupCode}`" class="card">
          <div class="card__top">
            <h3>{{ g.groupLabel || g.groupCode || 'Unassigned' }}</h3>
            <div class="card__actions">
              <button class="icon-btn" @click="openGroup(g)" title="View details">Details</button>
              <button
                v-if="canAdmin"
                class="icon-btn icon-btn--primary"
                @click="openAddModal('group', g)"
                title="Add score"
              >
                + Score
              </button>
            </div>
          </div>
          <div class="score-grid">
            <div class="score-item score-item--hero">
              <span class="score-item__label">Total</span>
              <span class="score-item__value score-item__value--total">{{ signed(g.scoreTotal) }}</span>
            </div>
            <div class="score-item">
              <span class="score-item__label">Working Time Score</span>
              <span class="score-item__value">{{ signed(g.worktimeScore) }}</span>
            </div>
            <div class="score-item">
              <span class="score-item__label">Finance Score</span>
              <span class="score-item__value">{{ signed(g.financeScore) }}</span>
            </div>
            <div class="score-item score-item--compact">
              <span class="score-item__label">Bonus</span>
              <span class="score-item__value score-item__value--bonus">+{{ fixed2(g.bonusPoints) }}</span>
            </div>
            <div class="score-item score-item--compact">
              <span class="score-item__label">Penalty</span>
              <span class="score-item__value score-item__value--penalty">{{ fixed2(g.penaltyPoints) }}</span>
            </div>
          </div>
          <p class="time">Last added: <strong>{{ g.lastAt ? formatDateTime(g.lastAt) : 'No entries' }}</strong></p>
        </article>
      </div>
    </section>

    <section class="panel">
      <header class="panel__head">
        <h2 class="panel__title">Members</h2>
      </header>
      <div class="member-groups">
        <section v-for="g in groupedUsers" :key="`member-group-${g.group}`" class="member-group">
          <header class="member-group__head">
            <h3 class="member-group__title">{{ g.group || 'Unassigned' }}</h3>
            <span class="member-group__count">{{ g.users.length }} members</span>
          </header>
          <div class="cards">
            <article v-for="u in g.users" :key="`u-${u.userId}`" class="card">
          <div class="card__top">
            <div class="user-head">
              <UserAvatar :name="u.name" :profile-image="u.avatarUrl || ''" :size="34" :tooltip="false" />
              <div>
                <h3>{{ u.name }}</h3>
                <span class="tag">{{ isGroupBossUser(u) ? 'Group Boss' : (u.group || '—') }}</span>
              </div>
            </div>
            <div class="card__actions">
              <button class="icon-btn" @click="openUser(u)" title="View details">Details</button>
              <button
                v-if="canAdmin"
                class="icon-btn icon-btn--primary"
                @click="openAddModal('user', u)"
                title="Add score"
              >
                + Score
              </button>
            </div>
          </div>
          <div class="score-grid">
            <div class="score-item score-item--hero">
              <span class="score-item__label">Total</span>
              <span class="score-item__value score-item__value--total">{{ signed(u.scoreTotal) }}</span>
            </div>
            <div class="score-item">
              <span class="score-item__label">Working Time Score</span>
              <span class="score-item__value">{{ signed(u.worktimeScore) }}</span>
            </div>
            <div class="score-item">
              <span class="score-item__label">Finance Score</span>
              <span class="score-item__value">{{ signed(u.financeScore) }}</span>
            </div>
            <div class="score-item score-item--compact">
              <span class="score-item__label">Bonus</span>
              <span class="score-item__value score-item__value--bonus">+{{ fixed2(u.bonusPoints) }}</span>
            </div>
            <div class="score-item score-item--compact">
              <span class="score-item__label">Penalty</span>
              <span class="score-item__value score-item__value--penalty">{{ fixed2(u.penaltyPoints) }}</span>
            </div>
          </div>
          <p class="time">Last added: <strong>{{ u.lastAt ? formatDateTime(u.lastAt) : 'No entries' }}</strong></p>
            </article>
          </div>
        </section>
      </div>
    </section>

    <teleport to="body">
      <div v-if="showModal" class="modal-mask" @click.self="closeModal">
        <div class="modal">
          <h3 class="modal__title">Add bonus / penalty · {{ modal.targetName || 'Target' }}</h3>
          <p class="modal__subtitle">Select an event rule. Points and type are applied automatically from that rule.</p>
          <div class="grid">
            <label class="field">
              <span class="field__label">Event date</span>
              <input
                v-model="modal.eventDate"
                type="date"
                class="field__input"
                :min="monthDateMin"
                :max="monthDateMax"
                required
              />
            </label>
            <label class="field">
              <span class="field__label">Event time</span>
              <input v-model="modal.eventTime" type="time" step="60" class="field__input" />
            </label>
            <label class="field field--full">
              <span class="field__label">Event rule</span>
              <select v-model="modal.ruleDefinitionId" class="field__input">
                <option value="" disabled>Select rule</option>
                <option v-for="r in rules" :key="r._id" :value="r._id">
                  {{ r.title }} · {{ r.kind }} · {{ signed(r.kind === 'penalty' ? -Math.abs(r.weightPoints) : Math.abs(r.weightPoints)) }}
                </option>
              </select>
            </label>
            <article class="rule-preview">
              <span class="field__label">Applied points</span>
              <strong>{{ selectedRuleSignedPoints }}</strong>
            </article>
            <label class="field field--full">
              <span class="field__label">Note (optional)</span>
              <textarea
                v-model.trim="modal.note"
                class="field__input field__input--textarea"
                rows="3"
                placeholder="Write a short reason for this event..."
              />
            </label>
          </div>
          <footer class="modal__footer">
            <button class="btn btn--ghost" @click="closeModal">Cancel</button>
            <button
              class="btn btn--primary"
              :disabled="saving || !modal.ruleDefinitionId || !modal.eventDate"
              @click="submitModal"
            >
              {{ saving ? 'Saving…' : 'Apply Rule' }}
            </button>
          </footer>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { currentMonthKey } from '../../utils/businessMonth';
import { useRouter } from 'vue-router';
import UserAvatar from '../../components/UserAvatar.vue';
import { useAuthStore } from '../../composables/useAuth';
import { hasAnyRole } from '../../utils/permissions';
import { ROLES } from '../../constants/roles';
import {
  createCompetitionAdjustment,
  getCompetitionDashboard,
  getCompetitionHistorySummary,
  getRuleDefinitions,
} from '../../services/competition';
import {
  defaultEventDateForMonth,
  defaultEventTime,
  eventFieldsToPayload,
  lastDayOfMonth,
} from '../../utils/competitionEventDate';

const auth = useAuthStore();
const router = useRouter();
const canAdmin = computed(() => hasAnyRole(auth.user, [ROLES.SUPER_ADMIN]));

const month = ref(currentMonthKey());
const searchTerm = ref('');
const groups = ref([]);
const users = ref([]);
const rules = ref([]);
const loading = ref(false);
const saving = ref(false);

const showModal = ref(false);
const modal = reactive({
  scope: 'group',
  groupCode: '',
  userId: '',
  targetName: '',
  ruleDefinitionId: '',
  note: '',
  eventDate: '',
  eventTime: defaultEventTime(),
});

const monthDateMin = computed(() => `${month.value}-01`);
const monthDateMax = computed(() => lastDayOfMonth(month.value));

const fixed2 = (n) => (Number(n) || 0).toFixed(2);
const signed = (n) => {
  const v = Number(n) || 0;
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
};
const moveMonth = (delta) => {
  if (!/^\d{4}-\d{2}$/.test(month.value)) return;
  const [y, m] = month.value.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + Number(delta || 0));
  month.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const formatDateTime = (d) =>
  new Date(d).toLocaleString([], { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });

const needle = computed(() => searchTerm.value.trim().toLowerCase());
const filteredUsers = computed(() => {
  if (!needle.value) return users.value;
  return users.value.filter((u) =>
    `${u.name} ${u.group || ''}`.toLowerCase().includes(needle.value)
  );
});
const filteredGroups = computed(() => {
  if (!needle.value) return groups.value;
  return groups.value.filter((g) => `${g.groupLabel || g.groupCode || ''}`.toLowerCase().includes(needle.value));
});
const isGroupBossUser = (u) => {
  const role = String(u.role || '').toUpperCase();
  const degree = String(u.degree || '').toUpperCase();
  return role === 'GROUP_BOSS' || role === 'BOSS' || degree === 'TEAM_BOSS';
};
const groupedUsers = computed(() => {
  const m = new Map();
  for (const u of filteredUsers.value) {
    const key = String(u.group || '').trim();
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(u);
  }
  const groupsSorted = [...m.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([group, arr]) => ({
      group,
      users: [...arr].sort((a, b) => {
        const bossA = isGroupBossUser(a) ? 1 : 0;
        const bossB = isGroupBossUser(b) ? 1 : 0;
        if (bossA !== bossB) return bossB - bossA;
        return String(a.name || '').localeCompare(String(b.name || ''));
      }),
    }));
  return groupsSorted;
});
const selectedRule = computed(() => rules.value.find((r) => String(r._id) === String(modal.ruleDefinitionId)) || null);
const selectedRuleSignedPoints = computed(() => {
  const r = selectedRule.value;
  if (!r) return 'Select a rule';
  return signed(r.kind === 'penalty' ? -Math.abs(r.weightPoints) : Math.abs(r.weightPoints));
});

const load = async () => {
  loading.value = true;
  try {
    const [historyRes, dashboardRes] = await Promise.all([
      getCompetitionHistorySummary({ month: month.value }),
      getCompetitionDashboard({ month: month.value }),
    ]);
    const groupCards = historyRes.data?.data?.groupCards || [];
    const userCards = historyRes.data?.data?.userCards || [];
    const dashGroups = dashboardRes.data?.data?.groups || [];
    const dashUsers = dashboardRes.data?.data?.users || [];
    const groupMap = new Map(dashGroups.map((g) => [String(g.groupCode || ''), g]));
    const userMap = new Map(dashUsers.map((u) => [String(u.userId || ''), u]));

    groups.value = groupCards.map((g) => {
      const score = groupMap.get(String(g.groupCode || '')) || {};
      return {
        ...g,
        scoreTotal: Number(score.total) || 0,
        worktimeScore: Number(score.worktimeScore) || 0,
        financeScore: Number(score.financeScore) || 0,
      };
    });
    users.value = userCards.map((u) => {
      const score = userMap.get(String(u.userId || '')) || {};
      return {
        ...u,
        scoreTotal: Number(score.total) || 0,
        worktimeScore: Number(score.worktimeScore) || 0,
        financeScore: Number(score.financeScore) || 0,
      };
    });
    if (canAdmin.value) {
      const r = await getRuleDefinitions();
      rules.value = (r.data?.data?.rules || []).filter((x) => x.isActive);
    }
  } finally {
    loading.value = false;
  }
};

const openGroup = (g) => {
  router.push({ name: 'CompetitionDetail', query: { month: month.value, groupCode: g.groupCode || '' } });
};
const openUser = (u) => {
  router.push({ name: 'CompetitionDetail', query: { month: month.value, userId: u.userId } });
};

const openAddModal = (scope, target) => {
  modal.scope = scope;
  modal.ruleDefinitionId = '';
  modal.note = '';
  modal.eventDate = defaultEventDateForMonth(month.value);
  modal.eventTime = defaultEventTime();
  if (scope === 'group') {
    modal.groupCode = target.groupCode || '';
    modal.userId = '';
    modal.targetName = target.groupLabel || target.groupCode || 'Unassigned';
  } else {
    modal.userId = target.userId || '';
    modal.groupCode = '';
    modal.targetName = target.name || 'Unknown member';
  }
  showModal.value = true;
};
const closeModal = () => {
  showModal.value = false;
};
const submitModal = async () => {
  if (!modal.ruleDefinitionId || !modal.eventDate) return;
  saving.value = true;
  try {
    const payload = {
      month: month.value,
      scope: modal.scope,
      description: modal.note || '',
      ruleDefinitionId: modal.ruleDefinitionId,
      ...eventFieldsToPayload(modal.eventDate, modal.eventTime),
    };
    if (modal.scope === 'group') payload.groupCode = modal.groupCode || '';
    else payload.userId = modal.userId;
    await createCompetitionAdjustment(payload);
    await load();
    closeModal();
  } finally {
    saving.value = false;
  }
};

watch(month, () => {
  load();
});
onMounted(load);
</script>

<style scoped>
.hist-page { max-width: 1220px; margin: 0 auto; padding: 1.2rem 1.4rem 2.4rem; }
.hero { display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:1rem; margin-bottom:1rem; }
.hero__eyebrow { margin:0 0 .28rem; font-size:.68rem; font-weight:800; text-transform:uppercase; letter-spacing:.1em; color:#64748b; }
.hero__title { margin:0; font-size:1.8rem; font-weight:900; }
.hero__actions { display:flex; gap:.75rem; align-items:flex-end; flex-wrap:wrap; }

.panel { background: var(--bg-primary,#fff); border:1px solid var(--border-light,#e2e8f0); border-radius:16px; padding:1rem 1.1rem; margin-bottom:1rem; }
.panel__head { display:flex; justify-content:space-between; align-items:baseline; gap:.8rem; margin-bottom:.6rem; }
.panel__title { margin:0; font-size:1.05rem; font-weight:800; }
.panel__hint { margin:0; font-size:.78rem; color:#64748b; }

.field__label { display:block; font-size:.66rem; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#64748b; margin-bottom:.25rem; }
.field__input { width:100%; box-sizing:border-box; padding:.52rem .62rem; border:1px solid #cbd5e1; border-radius:10px; background:#fff; color:#0f172a; }
.month-nav { display:grid; grid-template-columns:auto 1fr auto; gap:8px; align-items:center; }
.month-nav__input { min-width: 160px; }
.field__input--textarea { resize: vertical; min-height: 96px; font-family: inherit; }

.cards { display:grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap:.8rem; align-items:stretch; }
.member-groups { display:flex; flex-direction:column; gap:1rem; }
.member-group__head { display:flex; justify-content:space-between; align-items:center; margin-bottom:.5rem; }
.member-group__title { margin:0; font-size:.88rem; font-weight:900; text-transform:uppercase; letter-spacing:.04em; color:#334155; }
.member-group__count { font-size:.72rem; font-weight:700; color:#64748b; }
.card {
  background:#fff;
  border:1px solid #e2e8f0;
  border-radius:14px;
  padding:.78rem .88rem;
  box-shadow:0 8px 20px rgba(15,23,42,.04);
  display:flex;
  flex-direction:column;
  min-height: 286px;
}
.card__top {
  display:flex;
  justify-content:space-between;
  gap:.65rem;
  align-items:flex-start;
  min-height: 44px;
}
.card__top h3 {
  margin:0;
  font-size:.96rem;
  font-weight:800;
  line-height:1.2;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
  text-overflow:ellipsis;
}
.card__actions { display:flex; gap:.45rem; }
.user-head { display:flex; gap:.55rem; align-items:center; min-width:0; }
.user-head > div { min-width:0; }
.tag { display:inline-flex; margin-top:.18rem; font-size:.65rem; font-weight:700; border-radius:999px; padding:2px 8px; background:#f1f5f9; color:#64748b; }
.score-grid {
  margin-top: .62rem;
  display: grid;
  gap: .46rem .6rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  min-height: 132px;
}
.score-item {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  padding: .42rem .5rem;
}
.score-item--hero {
  grid-column: 1 / -1;
  background: linear-gradient(135deg, #eef2ff, #f8fafc);
  border-color: #c7d2fe;
}
.score-item--compact { background: #fff; }
.score-item__label {
  display: block;
  font-size: .63rem;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: #64748b;
  font-weight: 800;
}
.score-item__value {
  display: block;
  margin-top: .15rem;
  font-size: 1.03rem;
  line-height: 1.2;
  color: #0f172a;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}
.score-item__value--total { font-size: 1.44rem; color: #312e81; }
.score-item__value--bonus { color: #059669; }
.score-item__value--penalty { color: #dc2626; }
.num { font-weight:800; font-size:.78rem; }
.num--total { color:#334155; }
.time {
  margin:.62rem 0 0;
  font-size:.73rem;
  color:#64748b;
  margin-top:auto;
  border-top:1px solid #f1f5f9;
  padding-top:.45rem;
}

.icon-btn { border:1px solid #cbd5e1; background:#fff; color:#334155; border-radius:8px; padding:.28rem .55rem; font-size:.72rem; font-weight:700; cursor:pointer; }
.icon-btn--primary { border-color:#6366f1; color:#4338ca; background:#eef2ff; }


.modal-mask { position:fixed; inset:0; background:rgba(15,23,42,.5); display:flex; align-items:center; justify-content:center; z-index:2000; padding:1rem; }
.modal { width:min(760px, 100%); background:linear-gradient(180deg,#ffffff,#f8fafc); border-radius:18px; border:1px solid #dbe7ff; padding:1rem 1.05rem; box-shadow:0 28px 54px rgba(15,23,42,.32); }
.modal__title { margin:0 0 .75rem; font-size:1.05rem; font-weight:800; }
.modal__subtitle { margin:-.42rem 0 .8rem; color:#64748b; font-size:.78rem; }
.grid { display:grid; gap:12px; grid-template-columns: 1fr 1fr; }
.field--full { grid-column:1 / -1; }
.modal__footer { margin-top:.85rem; display:flex; justify-content:flex-end; gap:.6rem; }
.rule-preview {
  border:1px solid #c7d2fe;
  border-radius:12px;
  background:#eef2ff;
  padding:.5rem .62rem;
  display:flex;
  flex-direction:column;
  justify-content:center;
}
.rule-preview strong {
  margin-top:.12rem;
  color:#312e81;
  font-size:1.18rem;
  font-weight:900;
}

.btn { border:1px solid transparent; border-radius:10px; min-height:40px; padding:0 .95rem; font-weight:700; cursor:pointer; }
.btn--primary { background:#4f46e5; color:#fff; }
.btn--ghost { background:#fff; color:#334155; border-color:#cbd5e1; }

@media (max-width: 980px) {
  .grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 720px) {
  .hist-page { padding:1rem .95rem 2rem; }
  .hero__title { font-size:1.45rem; }
  .cards { grid-template-columns: 1fr; }
  .card { min-height: 0; }
  .score-grid { grid-template-columns: 1fr; }
  .score-grid { min-height: 0; }
  .score-item--hero { grid-column: auto; }
  .grid { grid-template-columns: 1fr; }
  .modal__footer { flex-direction:column; }
}
</style>
