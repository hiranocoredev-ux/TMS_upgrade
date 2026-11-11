<template>
  <div class="page">
    <header class="hero">
      <div>
        <p class="hero__eyebrow">Competition Detail</p>
        <h1 class="hero__title">{{ pageTitle }}</h1>
        <p v-if="isGroupView" class="hero__meta">
          {{ groupMembers.length }} members · Group + member bonus/penalty ledger
        </p>
      </div>
      <div class="hero__actions">
        <div class="month-nav">
          <button type="button" class="btn btn--ghost month-nav__btn" @click="moveMonth(-1)">← Prev</button>
          <input v-model="monthInput" type="month" class="field__input month-nav__input" @change="onMonthChange" />
          <button type="button" class="btn btn--ghost month-nav__btn" @click="moveMonth(1)">Next →</button>
        </div>
        <router-link class="btn btn--ghost" :to="{ name: 'CompetitionHistory', query: { month } }">
          Back to history
        </router-link>
      </div>
    </header>

    <div v-if="loading" class="state">Loading detail...</div>
    <div v-else-if="error" class="state state--error">{{ error }}</div>

    <template v-else>
      <section class="summary-grid">
        <article class="sum-card sum-card--total">
          <span>Total Score</span>
          <strong>{{ signed(summary.total) }}</strong>
        </article>
        <article class="sum-card">
          <span>Finance Score</span>
          <strong>{{ signed(summary.finance) }}</strong>
        </article>
        <article class="sum-card">
          <span>Working Time Score</span>
          <strong>{{ signed(summary.worktime) }}</strong>
        </article>
        <article class="sum-card">
          <span>Bonus</span>
          <strong class="sum-card__bonus">{{ signed(summary.bonus) }}</strong>
        </article>
        <article class="sum-card">
          <span>Penalty</span>
          <strong class="sum-card__penalty">{{ signed(summary.penalty) }}</strong>
        </article>
      </section>

      <section class="layout" :class="{ 'layout--group': isGroupView }">
        <div class="calendar-wrap">
          <div class="weekday-row">
            <span v-for="w in weekdays" :key="w">{{ w }}</span>
          </div>
          <div class="calendar-grid">
            <article
              v-for="cell in calendarCells"
              :key="cell.key"
              class="day"
              :class="{ 'day--muted': !cell.inMonth, 'day--active': activeDate === cell.dateKey }"
              @click="cell.inMonth && selectDate(cell.dateKey)"
            >
              <header class="day__head">
                <strong>{{ cell.day }}</strong>
                <small v-if="cell.worktime !== 0" class="day__wt">{{ signed(cell.worktime) }}</small>
              </header>
              <div class="chips">
                <span v-if="cell.isHoliday" class="chip chip--holiday">Holiday</span>
                <span v-if="cell.bonus !== 0" class="chip chip--bonus">B {{ signed(cell.bonus) }}</span>
                <span v-if="cell.penalty !== 0" class="chip chip--penalty">P {{ signed(cell.penalty) }}</span>
                <span v-if="cell.events.length" class="chip">{{ cell.events.length }} events</span>
              </div>
            </article>
          </div>
        </div>

        <aside class="event-panel" :class="{ 'event-panel--group': isGroupView }">
          <header class="event-panel__head">
            <div>
              <h3>{{ activeDate || 'Select a date' }}</h3>
              <p v-if="isGroupView && activeDate" class="event-panel__sub">
                {{ activeDay.entries.length }} event{{ activeDay.entries.length === 1 ? '' : 's' }} recorded
              </p>
            </div>
            <div v-if="canAdmin && activeDate" class="event-panel__toolbar">
              <template v-if="isGroupView">
                <button type="button" class="btn btn--secondary btn--sm" @click="openAddModal('group')">
                  + Group
                </button>
                <button
                  type="button"
                  class="btn btn--primary btn--sm"
                  :disabled="!groupMembers.length"
                  @click="openAddModal('user')"
                >
                  + Member
                </button>
              </template>
              <button v-else type="button" class="btn btn--primary btn--sm" @click="openAddModal()">
                + Add
              </button>
            </div>
          </header>

          <div v-if="isGroupView && activeDate" class="day-stats">
            <article class="day-stat">
              <span>Day total</span>
              <strong>{{ signed(activeDay.totalPoints) }}</strong>
            </article>
            <article class="day-stat day-stat--group">
              <span>Group</span>
              <strong>{{ signed(groupDayTotals.points) }}</strong>
              <small>{{ groupDayGroupEntries.length }} evt</small>
            </article>
            <article class="day-stat day-stat--members">
              <span>Members</span>
              <strong>{{ signed(memberDayTotals.points) }}</strong>
              <small>{{ groupDayMemberEntries.length }} evt</small>
            </article>
          </div>
          <p v-else class="event-panel__sum">
            Daily total: <strong>{{ signed(activeDay.totalPoints) }}</strong>
            · Worktime: <strong>{{ signed(activeDay.worktime) }}</strong>
          </p>

          <template v-if="isGroupView">
            <section v-if="groupDayGroupEntries.length" class="event-section">
              <h4 class="event-section__title">
                <span class="owner-icon owner-icon--group">G</span>
                Group total
                <span class="event-section__badge">{{ groupDayGroupEntries.length }}</span>
              </h4>
              <ul class="event-list event-list--cards">
                <li v-for="e in groupDayGroupEntries" :key="e._id">
                  <article class="event-card" :class="`event-card--${e.kind}`">
                    <header class="event-card__head">
                      <div class="event-card__owner">
                        <span class="owner-badge owner-badge--group">Group total</span>
                        <span class="pill" :class="e.kind">{{ e.kind }}</span>
                      </div>
                      <strong class="event-card__points">{{ signed(e.points) }}</strong>
                    </header>
                    <h5 class="event-card__title">{{ e.title || '(no title)' }}</h5>
                    <p class="event-card__note">{{ e.description || 'No note provided.' }}</p>
                    <footer class="event-card__foot">
                      <small>{{ formatDateTime(e.createdAt) }}</small>
                      <div v-if="canAdmin" class="event-card__actions">
                        <button type="button" class="btn-text" @click="openEditModal(e)">Edit</button>
                        <button type="button" class="btn-text btn-text--danger" @click="removeEntry(e._id)">Delete</button>
                      </div>
                    </footer>
                  </article>
                </li>
              </ul>
            </section>

            <section v-if="groupDayMemberEntries.length" class="event-section">
              <h4 class="event-section__title">
                <span class="owner-icon owner-icon--member">M</span>
                Members
                <span class="event-section__badge">{{ groupDayMemberEntries.length }}</span>
              </h4>
              <ul class="event-list event-list--cards">
                <li v-for="e in groupDayMemberEntries" :key="e._id">
                  <article class="event-card" :class="`event-card--${e.kind}`">
                    <header class="event-card__head">
                      <div class="event-card__owner">
                        <UserAvatar
                          :name="e.targetName"
                          :profile-image="e.avatarUrl || ''"
                          :size="28"
                          :tooltip="false"
                        />
                        <div class="event-card__owner-text">
                          <strong>{{ e.targetName }}</strong>
                          <span v-if="e.isGroupBoss" class="owner-badge owner-badge--boss">Group Boss</span>
                          <span v-else class="owner-badge owner-badge--member">Member</span>
                        </div>
                        <span class="pill" :class="e.kind">{{ e.kind }}</span>
                      </div>
                      <strong class="event-card__points">{{ signed(e.points) }}</strong>
                    </header>
                    <h5 class="event-card__title">{{ e.title || '(no title)' }}</h5>
                    <p class="event-card__note">{{ e.description || 'No note provided.' }}</p>
                    <footer class="event-card__foot">
                      <small>{{ formatDateTime(e.createdAt) }}</small>
                      <div v-if="canAdmin" class="event-card__actions">
                        <button type="button" class="btn-text" @click="openEditModal(e)">Edit</button>
                        <button type="button" class="btn-text btn-text--danger" @click="removeEntry(e._id)">Delete</button>
                      </div>
                    </footer>
                  </article>
                </li>
              </ul>
            </section>

            <p v-if="!activeDay.entries.length" class="event-list__empty">
              No group or member bonus/penalty on this date.
            </p>
          </template>

          <template v-else>
            <ul class="event-list event-list--cards">
              <li v-for="e in activeDay.entries" :key="e._id">
                <article class="event-card" :class="`event-card--${e.kind}`">
                  <header class="event-card__head">
                    <div class="event-card__owner">
                      <span class="pill" :class="e.kind">{{ e.kind }}</span>
                    </div>
                    <strong class="event-card__points">{{ signed(e.points) }}</strong>
                  </header>
                  <h5 class="event-card__title">{{ e.title || '(no title)' }}</h5>
                  <p class="event-card__note">{{ e.description || 'No note provided.' }}</p>
                  <footer class="event-card__foot">
                    <small>{{ formatDateTime(e.createdAt) }}</small>
                    <div v-if="canAdmin" class="event-card__actions">
                      <button type="button" class="btn-text" @click="openEditModal(e)">Edit</button>
                      <button type="button" class="btn-text btn-text--danger" @click="removeEntry(e._id)">Delete</button>
                    </div>
                  </footer>
                </article>
              </li>
              <li v-if="!activeDay.entries.length" class="event-list__empty">No bonus/penalty event on this date.</li>
            </ul>
          </template>
        </aside>
      </section>
    </template>

    <teleport to="body">
      <div v-if="showModal" class="modal-mask" @click.self="closeModal">
        <div class="modal">
          <h3 class="modal__title">
            {{ modalMode === 'edit' ? 'Edit' : 'Add' }} bonus / penalty · {{ pageTitle }}
          </h3>
          <p class="modal__subtitle">Select an event rule. Points and type are applied from that rule.</p>
          <p v-if="modalMode === 'edit' && modalOwnerLabel" class="modal__owner">
            Owner: <strong>{{ modalOwnerLabel }}</strong>
          </p>
          <div class="modal-grid">
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
            <label v-if="isGroupView && modalMode === 'add'" class="field field--full">
              <span class="field__label">Apply to</span>
              <select v-model="modal.targetKey" class="field__input">
                <option value="group">Group total — {{ pageTitle }}</option>
                <option
                  v-for="m in groupMembers"
                  :key="m.userId"
                  :value="`user:${m.userId}`"
                >
                  {{ m.name }}{{ m.isGroupBoss ? ' · Group Boss' : '' }}
                </option>
              </select>
            </label>
            <label class="field">
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
            <button type="button" class="btn btn--ghost" @click="closeModal">Cancel</button>
            <button
              type="button"
              class="btn btn--primary"
              :disabled="
                modalSaving ||
                !modal.ruleDefinitionId ||
                !modal.eventDate ||
                (isGroupView && modalMode === 'add' && !modal.targetKey)
              "
              @click="submitModal"
            >
              {{ modalSaving ? 'Saving…' : modalMode === 'edit' ? 'Save Changes' : 'Apply Rule' }}
            </button>
          </footer>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import UserAvatar from '../../components/UserAvatar.vue';
import { useAuthStore } from '../../composables/useAuth';
import { hasAnyRole } from '../../utils/permissions';
import { ROLES } from '../../constants/roles';
import {
  createCompetitionAdjustment,
  updateCompetitionAdjustment,
  deleteCompetitionAdjustment,
  getCompetitionGroupDetail,
  getCompetitionHistoryDetail,
  getCompetitionWorktimeRules,
  getCompetitionUserDetail,
  getRuleDefinitions,
} from '../../services/competition';
import {
  defaultEventTime,
  eventAtToFormFields,
  eventFieldsToPayload,
  lastDayOfMonth,
} from '../../utils/competitionEventDate';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const canAdmin = computed(() => hasAnyRole(auth.user, [ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN]));

const loading = ref(false);
const error = ref('');
const historyDetail = ref(null);
const userPayload = ref(null);
const groupPayload = ref(null);
const worktimeRules = ref({ dayRules: [], userRules: [] });
const monthInput = ref('');
const activeDate = ref('');
const rules = ref([]);
const showModal = ref(false);
const modalMode = ref('add');
const modalSaving = ref(false);
const modal = reactive({
  adjustmentId: '',
  ruleDefinitionId: '',
  note: '',
  targetKey: 'group',
  eventDate: '',
  eventTime: defaultEventTime(),
});

const monthDateMin = computed(() => `${month.value}-01`);
const monthDateMax = computed(() => lastDayOfMonth(month.value));
const groupMembers = ref([]);

const month = computed(() => String(route.query.month || new Date().toISOString().slice(0, 7)));
const userId = computed(() => String(route.query.userId || ''));
const groupCode = computed(() => String(route.query.groupCode || ''));
const scope = computed(() => (userId.value ? 'user' : 'group'));
const isGroupView = computed(() => scope.value === 'group');

const pageTitle = computed(() => {
  if (scope.value === 'user') return historyDetail.value?.title || userPayload.value?.user?.name || 'User detail';
  return historyDetail.value?.title || groupPayload.value?.detail?.groupLabel || 'Group detail';
});

const weekdayData = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekdays = weekdayData;

const dayMap = computed(() => {
  const m = new Map();
  for (const d of historyDetail.value?.daily || []) m.set(d.date, d);
  return m;
});
const dayRuleMap = computed(() => {
  const m = new Map();
  for (const r of worktimeRules.value?.dayRules || []) m.set(String(r.date), r);
  return m;
});
const userRuleMap = computed(() => {
  const m = new Map();
  for (const r of worktimeRules.value?.userRules || []) {
    const uid = String(r.user?._id || r.userId || '');
    m.set(`${uid}|${String(r.date)}`, r);
  }
  return m;
});

const worktimeMap = computed(() => {
  const m = new Map();
  if (scope.value === 'user') {
    for (const d of userPayload.value?.breakdown?.daily || []) {
      m.set(d.date, Number(d.dayScore) || 0);
    }
  }
  return m;
});

const summary = computed(() => {
  const detailSum = historyDetail.value?.summary || {};
  const scoreSummary =
    scope.value === 'user'
      ? userPayload.value?.summary || {}
      : groupPayload.value?.detail?.summary || {};
  return {
    total: Number(scoreSummary.total) || Number(detailSum.totalPoints) || 0,
    finance: Number(scoreSummary.financeScore) || 0,
    worktime: Number(scoreSummary.worktimeScore) || 0,
    bonus: Number(detailSum.bonusPoints) || 0,
    penalty: Number(detailSum.penaltyPoints) || 0,
  };
});

const calendarCells = computed(() => {
  const [y, m] = month.value.split('-').map(Number);
  const first = new Date(y, (m || 1) - 1, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateKey = d.toISOString().slice(0, 10);
    const inMonth = d.getMonth() === first.getMonth();
    const day = dayMap.value.get(dateKey) || { entries: [], totalPoints: 0, bonusPoints: 0, penaltyPoints: 0 };
    const weekendHoliday = d.getDay() === 0 || d.getDay() === 6;
    const dr = dayRuleMap.value.get(dateKey);
    const globalHoliday = dr ? !!dr.isHoliday : weekendHoliday;
    const personalHoliday =
      scope.value === 'user' && userId.value
        ? (() => {
            const ur = userRuleMap.value.get(`${String(userId.value)}|${dateKey}`);
            return ur ? (String(ur.kind || '') === 'holiday' || Number(ur.targetMinutes) === 0) : false;
          })()
        : false;
    cells.push({
      key: `${dateKey}-${i}`,
      dateKey,
      inMonth,
      day: d.getDate(),
      events: day.entries || [],
      total: Number(day.totalPoints) || 0,
      bonus: Number(day.bonusPoints) || 0,
      penalty: Number(day.penaltyPoints) || 0,
      worktime: Number(worktimeMap.value.get(dateKey)) || 0,
      isHoliday: globalHoliday || personalHoliday,
    });
  }
  return cells;
});

const activeDay = computed(() => {
  const d = dayMap.value.get(activeDate.value) || { entries: [], totalPoints: 0 };
  return {
    ...d,
    worktime: Number(worktimeMap.value.get(activeDate.value)) || 0,
  };
});

const groupDayGroupEntries = computed(() =>
  isGroupView.value ? (activeDay.value.entries || []).filter((e) => e.ownerType === 'group') : []
);
const groupDayMemberEntries = computed(() =>
  isGroupView.value ? (activeDay.value.entries || []).filter((e) => e.ownerType === 'user') : []
);

const sumPoints = (entries) =>
  (entries || []).reduce((acc, e) => acc + (Number(e.points) || 0), 0);

const groupDayTotals = computed(() => ({ points: sumPoints(groupDayGroupEntries.value) }));
const memberDayTotals = computed(() => ({ points: sumPoints(groupDayMemberEntries.value) }));

const modalOwnerLabel = computed(() => {
  if (modalMode.value !== 'edit') return '';
  if (modal.targetKey === 'group') return `${pageTitle.value} (Group total)`;
  const id = String(modal.targetKey || '').replace(/^user:/, '');
  const m = groupMembers.value.find((u) => String(u.userId) === id);
  return m ? `${m.name}${m.isGroupBoss ? ' · Group Boss' : ''}` : '';
});

const signed = (n) => {
  const v = Number(n) || 0;
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
};
const formatDateTime = (d) =>
  new Date(d).toLocaleString([], { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });

const selectedRule = computed(() =>
  rules.value.find((r) => String(r._id) === String(modal.ruleDefinitionId)) || null
);
const selectedRuleSignedPoints = computed(() => {
  const r = selectedRule.value;
  if (!r) return 'Select a rule';
  return signed(r.kind === 'penalty' ? -Math.abs(r.weightPoints) : Math.abs(r.weightPoints));
});

const loadRules = async () => {
  if (!canAdmin.value) {
    rules.value = [];
    return;
  }
  const r = await getRuleDefinitions();
  rules.value = (r.data?.data?.rules || []).filter((x) => x.isActive);
};

const defaultMemberTargetKey = () => {
  const boss = groupMembers.value.find((m) => m.isGroupBoss);
  const first = groupMembers.value[0];
  const pick = boss || first;
  return pick ? `user:${pick.userId}` : 'group';
};

const setModalEventFields = (dateStr, timeStr) => {
  modal.eventDate = dateStr || '';
  modal.eventTime = timeStr || defaultEventTime();
};

const openAddModal = (preset = 'group') => {
  modalMode.value = 'add';
  modal.adjustmentId = '';
  modal.ruleDefinitionId = '';
  modal.note = '';
  modal.targetKey = preset === 'user' ? defaultMemberTargetKey() : 'group';
  setModalEventFields(activeDate.value || `${month.value}-01`, defaultEventTime());
  showModal.value = true;
};

const openEditModal = (entry) => {
  modalMode.value = 'edit';
  modal.adjustmentId = entry._id;
  modal.ruleDefinitionId = entry.ruleDefinitionId || '';
  modal.note = entry.description || '';
  modal.targetKey =
    entry.ownerType === 'group' || entry.scope === 'group'
      ? 'group'
      : `user:${entry.userId || ''}`;
  const { eventDate, eventTime } = eventAtToFormFields(entry.eventAt || entry.createdAt);
  setModalEventFields(eventDate, eventTime);
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
};

const submitModal = async () => {
  if (!modal.ruleDefinitionId || !modal.eventDate) return;
  modalSaving.value = true;
  const eventPayload = eventFieldsToPayload(modal.eventDate, modal.eventTime);
  try {
    if (modalMode.value === 'edit') {
      await updateCompetitionAdjustment(modal.adjustmentId, {
        ruleDefinitionId: modal.ruleDefinitionId,
        description: modal.note || '',
        ...eventPayload,
      });
    } else {
      const payload = {
        month: month.value,
        description: modal.note || '',
        ruleDefinitionId: modal.ruleDefinitionId,
        ...eventPayload,
      };
      if (isGroupView.value) {
        if (modal.targetKey === 'group' || !String(modal.targetKey).startsWith('user:')) {
          payload.scope = 'group';
          payload.groupCode = groupCode.value;
        } else {
          payload.scope = 'user';
          payload.userId = String(modal.targetKey).replace(/^user:/, '');
        }
      } else {
        payload.scope = 'user';
        payload.userId = userId.value;
      }
      await createCompetitionAdjustment(payload);
    }
    const keepDate = activeDate.value;
    await load(keepDate);
    closeModal();
  } finally {
    modalSaving.value = false;
  }
};

const removeEntry = async (id) => {
  if (!confirm('Remove this bonus/penalty entry?')) return;
  const keepDate = activeDate.value;
  await deleteCompetitionAdjustment(id);
  await load(keepDate);
};

const selectDate = (dateKey) => {
  activeDate.value = dateKey;
};

const onMonthChange = () => {
  router.replace({ query: { ...route.query, month: monthInput.value } });
};
const moveMonth = (delta) => {
  if (!/^\d{4}-\d{2}$/.test(monthInput.value)) return;
  const [y, m] = monthInput.value.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + Number(delta || 0));
  monthInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  onMonthChange();
};

const load = async (keepDate) => {
  loading.value = true;
  error.value = '';
  userPayload.value = null;
  groupPayload.value = null;
  historyDetail.value = null;
  try {
    const historyReq = getCompetitionHistoryDetail(
      scope.value === 'user'
        ? { month: month.value, scope: 'user', userId: userId.value }
        : { month: month.value, scope: 'group', groupCode: groupCode.value }
    );
    const scoreReq =
      scope.value === 'user'
        ? getCompetitionUserDetail({ month: month.value, userId: userId.value })
        : getCompetitionGroupDetail({ month: month.value, groupCode: groupCode.value });

    const [historyRes, scoreRes] = await Promise.all([historyReq, scoreReq]);
    historyDetail.value = historyRes.data?.data || { daily: [], summary: {}, members: [] };
    groupMembers.value = historyDetail.value?.members || [];
    if (scope.value === 'user') userPayload.value = scoreRes.data?.data || null;
    else groupPayload.value = scoreRes.data?.data || null;
    const wr = await getCompetitionWorktimeRules({ month: month.value });
    worktimeRules.value = wr.data?.data || { dayRules: [], userRules: [] };
    await loadRules();

    monthInput.value = month.value;
    const daily = historyDetail.value?.daily || [];
    const preferred = keepDate || activeDate.value;
    const hasPreferred = preferred && daily.some((d) => d.date === preferred);
    if (hasPreferred) {
      activeDate.value = preferred;
    } else {
      const withEvents = daily.find((d) => d.entries?.length);
      activeDate.value = withEvents?.date || `${month.value}-01`;
    }
  } catch (e) {
    error.value = e.response?.data?.message || e.message || 'Failed to load detail';
  } finally {
    loading.value = false;
  }
};

watch(() => [route.query.month, route.query.userId, route.query.groupCode], load, { immediate: true });
</script>

<style scoped>
.page { max-width: 1280px; margin: 0 auto; padding: 1.2rem 1.4rem 2.4rem; }
.hero { display:flex; justify-content:space-between; align-items:flex-end; gap:1rem; flex-wrap:wrap; margin-bottom:1rem; }
.hero__eyebrow { margin:0 0 .2rem; font-size:.68rem; font-weight:800; text-transform:uppercase; letter-spacing:.09em; color:#64748b; }
.hero__title { margin:0; font-size:1.62rem; font-weight:900; }
.hero__meta { margin:.35rem 0 0; font-size:.82rem; color:#64748b; max-width:52ch; }
.hero__actions { display:flex; gap:.6rem; align-items:flex-end; flex-wrap:wrap; }

.field__input { padding:.52rem .62rem; border:1px solid #cbd5e1; border-radius:10px; background:#fff; color:#0f172a; }
.month-nav { display:grid; grid-template-columns:auto 1fr auto; gap:8px; align-items:center; }
.month-nav__btn { min-height:36px; padding:0 .7rem; font-size:.78rem; }
.month-nav__input { min-width:160px; }
.btn { border:1px solid #cbd5e1; border-radius:10px; min-height:40px; padding:0 .9rem; display:inline-flex; align-items:center; text-decoration:none; color:#0f172a; font-weight:700; background:#fff; cursor:pointer; }
.btn--ghost { background:#fff; }
.btn--primary { background:#4f46e5; color:#fff; border-color:#4f46e5; }
.btn--secondary { background:#fff; color:#334155; border-color:#cbd5e1; }
.btn--sm { min-height:32px; padding:0 .65rem; font-size:.74rem; }

.state { background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:1.2rem; text-align:center; }
.state--error { color:#b91c1c; }

.summary-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:.7rem; margin-bottom:1rem; }
.sum-card { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:.65rem .75rem; }
.sum-card span { display:block; font-size:.67rem; color:#64748b; text-transform:uppercase; letter-spacing:.06em; font-weight:800; margin-bottom:.2rem; }
.sum-card strong { font-size:1.2rem; font-weight:900; color:#0f172a; font-variant-numeric:tabular-nums; }
.sum-card--total { background:linear-gradient(135deg,#eef2ff,#fff); border-color:#c7d2fe; }
.sum-card--total strong { font-size:1.5rem; color:#312e81; }
.sum-card__bonus { color:#059669; }
.sum-card__penalty { color:#dc2626; }

.layout { display:grid; grid-template-columns: 1.45fr .9fr; gap:.9rem; align-items:start; }
.layout--group { grid-template-columns: 1.05fr 1.35fr; }
.calendar-wrap { background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:.8rem; }
.weekday-row { display:grid; grid-template-columns:repeat(7,1fr); gap:6px; margin-bottom:6px; }
.weekday-row span { font-size:.68rem; font-weight:800; color:#64748b; text-align:center; text-transform:uppercase; letter-spacing:.06em; }
.calendar-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:6px; }
.day { min-height:98px; border:1px solid #e2e8f0; border-radius:10px; padding:.35rem; cursor:pointer; background:#fff; }
.day:hover { border-color:#a5b4fc; box-shadow:0 0 0 1px #c7d2fe inset; }
.day--muted { opacity:.42; background:#f8fafc; }
.day--active { border-color:#6366f1; box-shadow:0 0 0 1px #6366f1 inset; }
.day__head { display:flex; justify-content:space-between; align-items:center; margin-bottom:.3rem; }
.day__head strong { font-size:.82rem; }
.day__wt { font-size:.64rem; color:#b45309; font-weight:800; }
.chips { display:flex; flex-wrap:wrap; gap:4px; }
.chip { font-size:.62rem; padding:2px 7px; border-radius:999px; background:#f1f5f9; color:#334155; font-weight:700; }
.chip--holiday { background:#fffbeb; color:#9a3412; border:1px solid #fdba74; }
.chip--bonus { background:#ecfdf5; color:#065f46; }
.chip--penalty { background:#fef2f2; color:#991b1b; }

.event-panel { background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:.85rem; }
.event-panel--group { background:linear-gradient(180deg,#fff 0%,#f8fafc 100%); }
.event-panel__head { display:flex; justify-content:space-between; align-items:flex-start; gap:.65rem; margin-bottom:.5rem; }
.event-panel__head h3 { margin:0; font-size:1rem; font-weight:900; }
.event-panel__sub { margin:.2rem 0 0; font-size:.72rem; color:#64748b; }
.event-panel__toolbar { display:flex; gap:6px; flex-wrap:wrap; }
.event-panel__sum { margin:0 0 .7rem; font-size:.76rem; color:#64748b; }
.day-stats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin-bottom:.75rem; }
.day-stat { border:1px solid #e2e8f0; border-radius:10px; background:#f8fafc; padding:.45rem .55rem; }
.day-stat span { display:block; font-size:.62rem; text-transform:uppercase; letter-spacing:.05em; color:#64748b; font-weight:800; }
.day-stat strong { display:block; margin-top:.12rem; font-size:1rem; font-weight:900; font-variant-numeric:tabular-nums; }
.day-stat small { display:block; margin-top:.1rem; font-size:.64rem; color:#94a3b8; }
.day-stat--group { border-color:#c7d2fe; background:#eef2ff; }
.day-stat--group strong { color:#312e81; }
.day-stat--members { border-color:#bbf7d0; background:#f0fdf4; }
.day-stat--members strong { color:#065f46; }
.event-section { margin-bottom:.85rem; }
.event-section__title { margin:0 0 .5rem; display:flex; align-items:center; gap:8px; font-size:.78rem; font-weight:900; text-transform:uppercase; letter-spacing:.05em; color:#475569; }
.event-section__badge { margin-left:auto; font-size:.64rem; padding:2px 8px; border-radius:999px; background:#e2e8f0; color:#334155; }
.owner-icon { width:22px; height:22px; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; font-size:.68rem; font-weight:900; }
.owner-icon--group { background:#eef2ff; color:#4338ca; }
.owner-icon--member { background:#ecfdf5; color:#047857; }
.event-list { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:.55rem; }
.event-list--cards { gap:.65rem; }
.event-list--cards > li { border:none; padding:0; background:transparent; }
.event-card { border:1px solid #e2e8f0; border-radius:12px; padding:.62rem .68rem; background:#fff; box-shadow:0 4px 14px rgba(15,23,42,.04); }
.event-card--bonus { border-left:3px solid #10b981; }
.event-card--penalty { border-left:3px solid #ef4444; }
.event-card__head { display:flex; justify-content:space-between; align-items:flex-start; gap:.5rem; margin-bottom:.35rem; }
.event-card__owner { display:flex; align-items:center; gap:8px; flex-wrap:wrap; min-width:0; }
.event-card__owner-text { display:flex; flex-direction:column; gap:2px; min-width:0; }
.event-card__owner-text strong { font-size:.78rem; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px; }
.event-card__points { font-size:1.02rem; font-weight:900; font-variant-numeric:tabular-nums; color:#0f172a; flex-shrink:0; }
.event-card__title { margin:0 0 .2rem; font-size:.82rem; font-weight:800; color:#0f172a; }
.event-card__note { margin:0; font-size:.74rem; color:#64748b; line-height:1.45; }
.event-card__foot { margin-top:.45rem; padding-top:.4rem; border-top:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center; gap:8px; }
.event-card__foot small { font-size:.68rem; color:#94a3b8; }
.event-card__actions { display:flex; gap:10px; }
.owner-badge { display:inline-flex; align-items:center; font-size:.6rem; font-weight:800; text-transform:uppercase; letter-spacing:.04em; border-radius:999px; padding:2px 8px; }
.owner-badge--group { background:#eef2ff; color:#4338ca; border:1px solid #c7d2fe; }
.owner-badge--boss { background:#fef3c7; color:#92400e; border:1px solid #fcd34d; }
.owner-badge--member { background:#f1f5f9; color:#475569; }
.btn-text { background:none; border:none; font-size:.72rem; font-weight:700; cursor:pointer; padding:0; color:#4f46e5; }
.btn-text--danger { color:#dc2626; }
.field__label { display:block; font-size:.66rem; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#64748b; margin-bottom:.25rem; }
.field__input--textarea { resize:vertical; min-height:96px; font-family:inherit; width:100%; box-sizing:border-box; }
.field--full { grid-column:1 / -1; }
.modal-mask { position:fixed; inset:0; background:rgba(15,23,42,.5); display:flex; align-items:center; justify-content:center; z-index:2000; padding:1rem; }
.modal { width:min(760px,100%); background:linear-gradient(180deg,#fff,#f8fafc); border-radius:18px; border:1px solid #dbe7ff; padding:1rem 1.05rem; box-shadow:0 28px 54px rgba(15,23,42,.32); }
.modal__title { margin:0 0 .75rem; font-size:1.05rem; font-weight:800; }
.modal__subtitle { margin:-.42rem 0 .8rem; color:#64748b; font-size:.78rem; }
.modal__owner { margin:-.35rem 0 .75rem; font-size:.8rem; color:#475569; }
.modal__owner strong { color:#312e81; }
.modal-grid { display:grid; gap:12px; grid-template-columns:1.2fr .8fr; }
.modal__footer { margin-top:.85rem; display:flex; justify-content:flex-end; gap:.6rem; }
.rule-preview { border:1px solid #c7d2fe; border-radius:12px; background:#eef2ff; padding:.5rem .62rem; display:flex; flex-direction:column; justify-content:center; }
.rule-preview strong { margin-top:.12rem; color:#312e81; font-size:1.18rem; font-weight:900; }
.pill { display:inline-flex; align-self:flex-start; font-size:.58rem; font-weight:800; text-transform:uppercase; border-radius:999px; padding:2px 6px; }
.pill.penalty { background:#fef2f2; color:#991b1b; }
.pill.bonus { background:#ecfdf5; color:#065f46; }
.event-list__empty { color:#64748b; font-size:.8rem; background:#fff !important; }

@media (max-width: 1080px) {
  .layout, .layout--group { grid-template-columns: 1fr; }
}
@media (max-width: 760px) {
  .page { padding:1rem .92rem 2rem; }
  .hero__title { font-size:1.38rem; }
  .day { min-height:84px; }
  .modal-grid { grid-template-columns:1fr; }
  .modal__footer { flex-direction:column; }
  .day-stats { grid-template-columns:1fr; }
  .event-card__owner-text strong { max-width:100%; }
}
</style>
