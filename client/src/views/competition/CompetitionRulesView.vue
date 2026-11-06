<template>
  <div class="rules-page">
    <header class="hero">
      <div>
        <p class="hero__eyebrow">Competition Configuration</p>
        <h1 class="hero__title">Rules &amp; scoring setup</h1>
        <p class="hero__desc">
          Super admins can configure score weights and maintain bonus/penalty rules.
          Other users can review this page in read-only mode.
        </p>
      </div>
      <router-link class="btn btn--secondary" :to="{ name: 'CompetitionDashboard' }">
        Back to leaderboard
      </router-link>
    </header>

    <section class="panel">
      <div class="panel__head">
        <h2 class="panel__title">Weight Settings</h2>
      </div>
      <p class="panel__hint">
        Competition score uses these default weight values.
      </p>
      <form class="form-card" @submit.prevent="saveWeights">
        <div class="grid grid--2">
          <label class="field">
            <span class="field__label">Finance Weight</span>
            <input
              v-model.number="weights.financeWeight"
              type="number"
              min="0"
              step="0.01"
              class="field__input"
              :readonly="!canEdit"
            />
          </label>
          <label class="field">
            <span class="field__label">Worktime Weight</span>
            <input
              v-model.number="weights.worktimeWeight"
              type="number"
              min="0"
              step="0.01"
              class="field__input"
              :readonly="!canEdit"
            />
          </label>
        </div>
        <div class="weight-footer">
          <small class="muted">Last updated: {{ settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : '—' }}</small>
          <button v-if="canEdit" type="submit" class="btn btn--primary" :disabled="savingWeights">
            {{ savingWeights ? 'Saving…' : 'Save Weights' }}
          </button>
        </div>
      </form>
    </section>

    <section class="panel">
      <div class="panel__head">
        <h2 class="panel__title">Event Rules</h2>
        <button
          v-if="canEdit"
          type="button"
          class="btn btn--secondary"
          @click="onToggleRuleForm"
        >
          {{ showRuleForm ? 'Cancel' : 'Add Rule' }}
        </button>
      </div>

      <form v-if="canEdit && showRuleForm" class="form-card" @submit.prevent="createRule">
        <div class="grid grid--3">
          <label class="field">
            <span class="field__label">Event name</span>
            <input
              v-model.trim="newRule.title"
              required
              maxlength="120"
              class="field__input"
              placeholder="e.g. Late report submission"
            />
          </label>
          <label class="field">
            <span class="field__label">Rule type</span>
            <select v-model="newRule.kind" class="field__input">
              <option value="penalty">Penalty (−)</option>
              <option value="bonus">Bonus (+)</option>
            </select>
          </label>
          <label class="field">
            <span class="field__label">Score points</span>
            <input v-model.number="newRule.weightPoints" type="number" step="1" required class="field__input" />
          </label>
        </div>
        <button type="submit" class="btn btn--primary" :disabled="ruleSaving">
          {{ ruleSaving ? 'Creating…' : 'Create Rule' }}
        </button>
      </form>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Event Name</th>
              <th>Type</th>
              <th>Score</th>
              <th v-if="canEdit">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rules" :key="r._id" :class="{ 'table-row--editing': editingRuleId === r._id }">
              <template v-if="editingRuleId === r._id">
                <td>
                  <input
                    v-model.trim="editRule.title"
                    required
                    maxlength="120"
                    class="field__input field__input--compact"
                    placeholder="Event name"
                  />
                </td>
                <td>
                  <select v-model="editRule.kind" class="field__input field__input--compact">
                    <option value="penalty">Penalty (−)</option>
                    <option value="bonus">Bonus (+)</option>
                  </select>
                </td>
                <td>
                  <input
                    v-model.number="editRule.weightPoints"
                    type="number"
                    step="1"
                    required
                    class="field__input field__input--compact"
                  />
                </td>
                <td v-if="canEdit">
                  <div class="rule-row-actions">
                    <button
                      type="button"
                      class="btn-text btn-text--primary"
                      :disabled="ruleSaving"
                      @click="saveRuleEdit"
                    >
                      {{ ruleSaving ? 'Saving…' : 'Save' }}
                    </button>
                    <button type="button" class="btn-text" :disabled="ruleSaving" @click="cancelEditRule">
                      Cancel
                    </button>
                  </div>
                </td>
              </template>
              <template v-else>
                <td>{{ r.title }}</td>
                <td><span class="badge" :class="r.kind">{{ r.kind }}</span></td>
                <td>{{ r.weightPoints }}</td>
                <td v-if="canEdit">
                  <div class="rule-row-actions">
                    <button type="button" class="btn-text btn-text--primary" @click="startEditRule(r)">Edit</button>
                    <button type="button" class="btn-text btn-text--danger" @click="removeRule(r._id)">Delete</button>
                  </div>
                </td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <div class="panel__head">
        <h2 class="panel__title">Worktime Rule Calendar</h2>
      </div>
      <p class="panel__hint">
        Click a date to set worktime scoring rules. Weekend is treated as holiday by default.
      </p>
      <div class="grid grid--2">
        <label class="field field--month">
          <span class="field__label">Month</span>
          <div class="month-nav">
            <button type="button" class="btn btn--secondary month-nav__btn" @click="moveWorktimeMonth(-1)">
              ← Prev
            </button>
            <input v-model="worktimeMonth" type="month" class="field__input month-nav__input" />
            <button type="button" class="btn btn--secondary month-nav__btn" @click="moveWorktimeMonth(1)">
              Next →
            </button>
          </div>
        </label>
      </div>
      <div class="worktime-layout">
        <div class="cal-wrap">
          <div class="cal-week">
            <span v-for="w in ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']" :key="w">{{ w }}</span>
          </div>
          <div class="cal-grid">
            <button
              v-for="c in monthCalendarCells"
              :key="c.date"
              type="button"
              class="cal-day"
              :class="{
                'cal-day--muted': !c.inMonth,
                'cal-day--holiday': c.isHoliday,
                'cal-day--active': dayForm.date === c.date,
              }"
              @click="pickDay(c.date)"
            >
              <strong>{{ c.day }}</strong>
              <small v-if="c.isHoliday" class="day-tag day-tag--holiday">Holiday</small>
              <small v-if="c.users.length" class="day-tag day-tag--reason">
                {{ c.users.length }} user event
              </small>
              <button
                v-if="c.hasNote"
                type="button"
                class="note-btn"
                title="View notes/events"
                @click.stop="showDayNotes(c.date)"
              >
                📝
              </button>
            </button>
          </div>
        </div>

        <div class="rule-editor">
          <h3 class="section-title section-title--tight">Selected Date: {{ dayForm.date || 'Please select a date from calendar' }}</h3>
          <div v-if="dayForm.date && canEdit" class="grid">
            <p class="panel__hint">1) Global Holiday Setting (for all users on this date)</p>
            <label class="field">
              <span class="field__label">Mark as Holiday (No penalty target)</span>
              <input v-model="dayForm.isHoliday" type="checkbox" :disabled="!canEdit" />
            </label>
            <label class="field">
              <span class="field__label">Admin Note</span>
              <input v-model.trim="dayForm.note" class="field__input" :readonly="!canEdit" />
            </label>
            <div class="rule-actions">
              <button v-if="canEdit" type="button" class="btn btn--primary" :disabled="worktimeSaving" @click="saveDayRule">Save Date Rule</button>
              <button v-if="canEdit && selectedDayRule" type="button" class="btn btn--secondary" @click="removeDayRule">Clear Date Rule</button>
            </div>

            <h4 class="section-title section-title--tight">2) User-specific Override</h4>
            <div class="grid grid--2">
              <label class="field">
                <span class="field__label">Override Type</span>
                <select v-model="userDayForm.mode" class="field__input" :disabled="!canEdit">
                  <option value="holiday">Personal Holiday (Target = 0)</option>
                  <option value="reduce">Special Reason (Reduce target)</option>
                  <option value="work">Working Day (weekend / holiday, set target)</option>
                </select>
              </label>
              <label class="field">
                <span class="field__label">Select Users (Multi-select)</span>
                <input
                  v-model.trim="userSearch"
                  class="field__input"
                  placeholder="Search by user name or group..."
                  :readonly="!canEdit"
                />
                <div class="user-multiselect">
                  <label
                    v-for="u in filteredWorktimeUsers"
                    :key="u._id"
                    class="user-option"
                  >
                    <input
                      v-model="selectedUserIds"
                      type="checkbox"
                      :value="u._id"
                      :disabled="!canEdit"
                    />
                    <UserAvatar :name="u.name" :profile-image="u.avatarUrl || ''" :size="22" :tooltip="false" />
                    <span>{{ u.name }} <small>· {{ u.group || 'No Group' }}</small></span>
                  </label>
                </div>
              </label>
              <label class="field">
                <span class="field__label">{{ userDayMinutesLabel }}</span>
                <input
                  v-model.number="userDayForm.reduceMinutes"
                  type="number"
                  min="0"
                  max="1440"
                  class="field__input"
                  :readonly="!canEdit || userDayForm.mode === 'holiday'"
                  :placeholder="userDayMinutesHint"
                />
              </label>
              <label class="field field--full">
                <span class="field__label">Reason / Note</span>
                <input v-model.trim="userDayForm.note" class="field__input" :readonly="!canEdit" />
              </label>
            </div>
            <div class="rule-actions">
              <button v-if="canEdit" type="button" class="btn btn--primary" :disabled="worktimeSaving || !selectedUserIds.length" @click="saveUserDayRule">Apply User Override</button>
            </div>
            <ul class="user-rule-list">
              <li v-for="r in selectedDayUserRules" :key="r._id">
                <span>
                  {{ r.user?.name || 'User' }}
                  · {{ userRuleSummary(r) }}
                  <span v-if="r.source === 'summarize_weekend'" class="auto-tag" title="Set automatically from the weekly Summarize">auto</span>
                  <template v-if="r.note"> · {{ r.note }}</template>
                </span>
                <button v-if="canEdit" type="button" class="btn-text btn-text--danger" @click="removeUserDayRule(r.user?._id || r.userId)">Delete</button>
              </li>
              <li v-if="!selectedDayUserRules.length" class="muted">No user-specific override for this date.</li>
            </ul>
          </div>
          <div v-else-if="dayForm.date" class="read-only-events">
            <p class="panel__hint">Event list for selected date</p>
            <ul class="event-list">
              <li v-for="e in selectedDateEvents" :key="e.key" class="event-item">
                <div class="event-item__head">
                  <template v-if="e.type === 'user'">
                    <UserAvatar :name="e.userName" :profile-image="e.avatarUrl || ''" :size="26" :tooltip="false" />
                    <strong>{{ e.userName }}</strong>
                  </template>
                  <template v-else>
                    <span class="event-item__global-icon">🌐</span>
                    <strong>Global Rule</strong>
                  </template>
                  <span class="event-pill" :class="e.kind">{{ e.kindLabel }}</span>
                </div>
                <p class="event-item__line">{{ e.reasonText }}</p>
                <p class="event-item__line event-item__line--result">{{ e.resultText }}</p>
                <p v-if="e.note" class="event-item__note">Note: {{ e.note }}</p>
              </li>
              <li v-if="!selectedDateEvents.length" class="muted">No events for this date.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { currentMonthKey } from '../../utils/businessMonth';
import UserAvatar from '../../components/UserAvatar.vue';
import {
  getCompetitionSettings,
  putCompetitionSettings,
  getRuleDefinitions,
  createRuleDefinition,
  updateRuleDefinition,
  deleteRuleDefinition,
  getCompetitionWorktimeRules,
  upsertCompetitionWorktimeDayRule,
  deleteCompetitionWorktimeDayRule,
  upsertCompetitionWorktimeUserDayRule,
  deleteCompetitionWorktimeUserDayRule,
} from '../../services/competition';
import { useAuthStore } from '../../composables/useAuth';
import { hasAnyRole } from '../../utils/permissions';
import { ROLES } from '../../constants/roles';

const auth = useAuthStore();
const canEdit = computed(() =>
  hasAnyRole(auth.user, [ROLES.SUPER_ADMIN])
);

const rules = ref([]);
const settings = ref({ financeWeight: 1, worktimeWeight: 1, updatedAt: null });
const weights = reactive({ financeWeight: 1, worktimeWeight: 1 });
const savingWeights = ref(false);
const worktimeMonth = ref(currentMonthKey());
const dayRules = ref([]);
const userDayRules = ref([]);
const worktimeUsers = ref([]);
const dayForm = reactive({ date: '', isHoliday: false, note: '' });
const userDayForm = reactive({ mode: 'holiday', reduceMinutes: 0, note: '' });
const selectedUserIds = ref([]);
const userSearch = ref('');
const worktimeSaving = ref(false);
const showRuleForm = ref(false);
const editingRuleId = ref(null);
const newRule = reactive({
  title: '',
  kind: 'penalty',
  weightPoints: 10,
});
const editRule = reactive({
  title: '',
  kind: 'penalty',
  weightPoints: 10,
});
const ruleSaving = ref(false);

const load = async () => {
  try {
    const sRes = await getCompetitionSettings();
    const s = sRes.data?.data || {};
    settings.value = {
      financeWeight: Number(s.financeWeight) || 0,
      worktimeWeight: Number(s.worktimeWeight) || 0,
      updatedAt: s.updatedAt || null,
    };
    weights.financeWeight = settings.value.financeWeight;
    weights.worktimeWeight = settings.value.worktimeWeight;

    const rRes = await getRuleDefinitions();
    rules.value = rRes.data?.data?.rules || [];
    const wRes = await getCompetitionWorktimeRules({ month: worktimeMonth.value });
    dayRules.value = wRes.data?.data?.dayRules || [];
    userDayRules.value = wRes.data?.data?.userRules || [];
    worktimeUsers.value = wRes.data?.data?.users || [];
  } catch {
    rules.value = [];
  }
};

const selectedDayRule = computed(() => dayRules.value.find((x) => x.date === dayForm.date) || null);
const selectedDayUserRules = computed(() =>
  userDayRules.value.filter((x) => x.date === dayForm.date)
);
const selectedDateEvents = computed(() => {
  if (!dayForm.date) return [];
  const out = [];
  const dayRule = dayRules.value.find((x) => x.date === dayForm.date);
  if (dayRule?.isHoliday) {
    out.push({
      key: `day-${dayForm.date}`,
      type: 'global',
      kind: 'holiday',
      kindLabel: 'Holiday',
      reasonText: 'This date is marked as a global holiday for all users.',
      resultText: 'Target result: 0 minutes for all users.',
      note: dayRule.note || '',
    });
  } else if (dayRule?.note) {
    out.push({
      key: `day-note-${dayForm.date}`,
      type: 'global',
      kind: 'note',
      kindLabel: 'Note',
      reasonText: 'Global note is set for this date.',
      resultText: 'Target result: default target rules are used.',
      note: dayRule.note || '',
    });
  }
  selectedDayUserRules.value.forEach((r) => {
    out.push({
      key: `u-${r._id}`,
      type: 'user',
      userName: r.user?.name || 'User',
      avatarUrl: r.user?.avatarUrl || '',
      kind: r.kind === 'holiday' ? 'holiday' : r.kind === 'work' ? 'work' : 'reason',
      kindLabel: r.kind === 'holiday' ? 'Personal Holiday' : r.kind === 'work' ? 'Working Day' : 'Special Reason',
      reasonText:
        r.kind === 'holiday'
          ? 'User has personal holiday on this date.'
          : r.kind === 'work'
            ? r.source === 'summarize_weekend'
              ? 'Weekly Summarize was under the threshold, so this weekend day is a working day for this user.'
              : 'This date is a working day for this user, even on a weekend or holiday.'
            : `Target is reduced by ${r.reduceMinutes || 0} minutes for this user.`,
      resultText:
        r.kind === 'holiday'
          ? 'Target result: 0 minutes for this user.'
          : `Target result: ${r.targetMinutes} minutes for this user.`,
      note: r.note || '',
    });
  });
  return out;
});
/** How one user-day rule reads in the list. */
const userRuleSummary = (r) => {
  if (r.kind === 'holiday') return 'Holiday (0m)';
  if (r.kind === 'work') return `Working day → target ${r.targetMinutes}m`;
  return `Reduce ${r.reduceMinutes || 0}m → target ${r.targetMinutes}m`;
};

const userDayMinutesLabel = computed(() => {
  if (userDayForm.mode === 'holiday') return 'Target for Selected Users';
  if (userDayForm.mode === 'work') return 'Target Minutes for the Working Day';
  return 'Reduce Target by Minutes';
});

const userDayMinutesHint = computed(() => {
  if (userDayForm.mode === 'holiday') return 'Holiday uses target 0 automatically';
  if (userDayForm.mode === 'work') return 'e.g. 720 = 12 hours';
  return 'e.g. 120 = reduce by 2 hours';
});

const filteredWorktimeUsers = computed(() => {
  const q = userSearch.value.trim().toLowerCase();
  if (!q) return worktimeUsers.value;
  return worktimeUsers.value.filter((u) =>
    `${u.name} ${u.group || ''}`.toLowerCase().includes(q)
  );
});
const monthCalendarCells = computed(() => {
  if (!/^\d{4}-\d{2}$/.test(worktimeMonth.value)) return [];
  const [yy, mm] = worktimeMonth.value.split('-').map(Number);
  const first = new Date(yy, mm - 1, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const out = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const inMonth = d.getMonth() === first.getMonth();
    const wd = d.getDay();
    const defaultWeekend = wd === 0 || wd === 6;
    const rule = dayRules.value.find((x) => x.date === date);
    const users = userDayRules.value.filter((x) => x.date === date);
    const isHoliday = rule ? !!rule.isHoliday : defaultWeekend;
    out.push({
      date,
      day: d.getDate(),
      inMonth,
      rule,
      users,
      isHoliday,
      hasNote: !!(rule?.note || users.some((u) => u.note)),
    });
  }
  return out;
});

const pickDay = (date) => {
  dayForm.date = date;
  const r = dayRules.value.find((x) => x.date === date);
  const d = new Date(`${date}T00:00:00`);
  const weekday = d.getDay();
  const weekendDefaultHoliday = weekday === 0 || weekday === 6;
  dayForm.isHoliday = r ? !!r.isHoliday : weekendDefaultHoliday;
  dayForm.note = r?.note || '';
};

const saveDayRule = async () => {
  if (!canEdit.value || !dayForm.date) return;
  worktimeSaving.value = true;
  try {
    await upsertCompetitionWorktimeDayRule({
      month: worktimeMonth.value,
      date: dayForm.date,
      isHoliday: !!dayForm.isHoliday,
      note: dayForm.note || '',
    });
    await load();
  } finally {
    worktimeSaving.value = false;
  }
};

const removeDayRule = async () => {
  if (!canEdit.value || !dayForm.date) return;
  await deleteCompetitionWorktimeDayRule(worktimeMonth.value, dayForm.date);
  await load();
};

const saveUserDayRule = async () => {
  if (!canEdit.value || !dayForm.date || !selectedUserIds.value.length) return;
  worktimeSaving.value = true;
  try {
    for (const userId of selectedUserIds.value) {
      await upsertCompetitionWorktimeUserDayRule({
        month: worktimeMonth.value,
        date: dayForm.date,
        userId,
        kind: userDayForm.mode,
        reduceMinutes: userDayForm.mode === 'reduce' ? Math.max(0, Number(userDayForm.reduceMinutes) || 0) : 0,
        // A working day carries its own target instead of a reduction.
        ...(userDayForm.mode === 'work'
          ? { targetMinutes: Math.max(1, Math.min(1440, Number(userDayForm.reduceMinutes) || 0)) }
          : {}),
        note: userDayForm.note || '',
      });
    }
    userDayForm.note = '';
    userDayForm.reduceMinutes = 0;
    userDayForm.mode = 'holiday';
    selectedUserIds.value = [];
    await load();
  } finally {
    worktimeSaving.value = false;
  }
};

const removeUserDayRule = async (userId) => {
  if (!canEdit.value || !dayForm.date) return;
  await deleteCompetitionWorktimeUserDayRule(worktimeMonth.value, dayForm.date, userId);
  await load();
};

watch(worktimeMonth, () => {
  dayForm.date = '';
  selectedUserIds.value = [];
  load();
});

const showDayNotes = (date) => {
  pickDay(date);
};

const moveWorktimeMonth = (delta) => {
  if (!/^\d{4}-\d{2}$/.test(worktimeMonth.value)) return;
  const [y, m] = worktimeMonth.value.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + Number(delta || 0));
  worktimeMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const saveWeights = async () => {
  if (!canEdit.value) return;
  savingWeights.value = true;
  try {
    await putCompetitionSettings({
      financeWeight: Number(weights.financeWeight),
      worktimeWeight: Number(weights.worktimeWeight),
    });
    await load();
  } finally {
    savingWeights.value = false;
  }
};

const onToggleRuleForm = () => {
  if (!showRuleForm.value) cancelEditRule();
  showRuleForm.value = !showRuleForm.value;
};

const cancelEditRule = () => {
  editingRuleId.value = null;
};

const startEditRule = (rule) => {
  showRuleForm.value = false;
  editingRuleId.value = rule._id;
  editRule.title = rule.title || '';
  editRule.kind = rule.kind || 'penalty';
  editRule.weightPoints = Number(rule.weightPoints) || 0;
};

const createRule = async () => {
  if (!newRule.title) return;
  ruleSaving.value = true;
  try {
    await createRuleDefinition({
      kind: newRule.kind,
      title: newRule.title,
      weightPoints: newRule.weightPoints,
      description: '',
    });
    Object.assign(newRule, { title: '', weightPoints: 10, kind: 'penalty' });
    showRuleForm.value = false;
    await load();
  } finally {
    ruleSaving.value = false;
  }
};

const saveRuleEdit = async () => {
  if (!editingRuleId.value || !editRule.title) return;
  const points = Number(editRule.weightPoints);
  if (!Number.isFinite(points) || points === 0) return;
  ruleSaving.value = true;
  try {
    await updateRuleDefinition(editingRuleId.value, {
      kind: editRule.kind,
      title: editRule.title,
      weightPoints: points,
    });
    cancelEditRule();
    await load();
  } finally {
    ruleSaving.value = false;
  }
};

const removeRule = async (id) => {
  if (!confirm('Delete rule definition?')) return;
  if (editingRuleId.value === id) cancelEditRule();
  await deleteRuleDefinition(id);
  await load();
};

onMounted(load);
</script>

<style scoped>
.rules-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.25rem 1.4rem 2.5rem;
}
.hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}
.hero__eyebrow {
  margin: 0 0 0.3rem;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-secondary, #64748b);
}
.hero__title {
  margin: 0;
  font-size: 1.65rem;
  font-weight: 800;
}
.hero__desc {
  margin: 0.45rem 0 0;
  max-width: 62ch;
  color: var(--text-secondary, #64748b);
  line-height: 1.5;
}

.panel {
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 16px;
  padding: 1rem 1.1rem 1.15rem;
  margin-bottom: 1rem;
}
.panel__head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
}
.panel__title {
  margin: 0;
  font-size: 1.08rem;
  font-weight: 800;
}
.panel__hint {
  margin: 0.35rem 0 0.95rem;
  font-size: 0.8rem;
  color: var(--text-secondary, #64748b);
}

.grid {
  display: grid;
  gap: 12px;
}
.grid--2 {
  grid-template-columns: repeat(2, 1fr);
}
.grid--3 {
  grid-template-columns: repeat(3, 1fr);
}
@media (max-width: 760px) {
  .grid--2, .grid--3 {
    grid-template-columns: 1fr;
  }
}

.field__label {
  display: block;
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary, #64748b);
  margin-bottom: 0.25rem;
}
.field__input {
  width: 100%;
  padding: 0.5rem 0.62rem;
  border-radius: 10px;
  border: 1px solid var(--border-medium, #cbd5e1);
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #0f172a);
  box-sizing: border-box;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  border: 1px solid transparent;
  min-height: 40px;
  padding: 0 0.95rem;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
}
.btn--primary {
  background: #4f46e5;
  color: #fff;
}
.btn--secondary {
  background: var(--bg-primary, #fff);
  border-color: var(--border-medium, #cbd5e1);
  color: var(--text-primary, #0f172a);
}

.form-card {
  background: color-mix(in srgb, var(--color-primary, #6366f1) 6%, transparent);
  border: 1px dashed color-mix(in srgb, var(--color-primary, #6366f1) 35%, #cbd5e1);
  border-radius: 12px;
  padding: 0.9rem;
  margin-bottom: 0.9rem;
}
.weight-footer {
  margin-top: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.muted {
  color: var(--text-secondary, #64748b);
  font-size: 0.78rem;
}
.worktime-layout {
  display: grid;
  grid-template-columns: minmax(0, 720px) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  margin-top: 0.65rem;
}
.cal-wrap {
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 12px;
  padding: 0.6rem;
  max-width: 720px;
  background: linear-gradient(180deg, #ffffff, #fafbff);
}
.cal-week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  margin-bottom: 6px;
}
.cal-week span {
  text-align: center;
  font-size: 0.62rem;
  text-transform: uppercase;
  color: var(--text-secondary, #64748b);
  font-weight: 700;
}
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}
.cal-day {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  min-height: 66px;
  padding: 0.32rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  cursor: pointer;
  transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease;
}
.cal-day:hover {
  transform: translateY(-1px);
  border-color: #c7d2fe;
}
.cal-day strong { font-size: 0.8rem; font-weight: 800; color: #0f172a; }
.cal-day small { font-size: 0.62rem; color: #64748b; }
.cal-day--muted { opacity: 0.45; }
.cal-day--holiday {
  background: linear-gradient(180deg, #fffbeb, #fef3c7);
  border-color: #f59e0b;
  box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.28);
}
.cal-day--active { border-color: #4f46e5; box-shadow: 0 0 0 1px #6366f1 inset, 0 4px 12px rgba(79, 70, 229, 0.16); }
.day-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: 0.03em;
}
.day-tag--holiday {
  background: #fff7ed;
  color: #9a3412;
  border: 1px solid #fdba74;
}
.day-tag--reason {
  background: #eef2ff;
  color: #3730a3;
  border: 1px solid #c7d2fe;
}
.note-btn {
  margin-top: 2px;
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 999px;
  width: 20px;
  height: 20px;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
}
.rule-editor {
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 12px;
  background: var(--bg-secondary, #f8fafc);
  padding: 0.8rem;
}
.field--month {
  max-width: 460px;
  min-width: 360px;
}
.month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 12px;
  padding: 6px;
  width: 100%;
  box-sizing: border-box;
}
.month-nav__btn {
  min-height: 38px;
  min-width: 78px;
  padding: 0 0.82rem;
  font-size: 0.78rem;
  font-weight: 800;
  border-radius: 10px;
  border: 1px solid #a5b4fc;
  background: #ffffff;
  color: #3730a3;
  transition: all .15s ease;
}
.month-nav__btn:hover {
  background: #e0e7ff;
  border-color: #818cf8;
  color: #312e81;
  transform: translateY(-1px);
}
.month-nav__input {
  min-width: 0;
  flex: 1;
  border-color: #a5b4fc;
  background: #fff;
  font-weight: 700;
}
.rule-actions {
  margin-top: 0.5rem;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.user-rule-list {
  list-style: none;
  margin: 0.8rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.user-rule-list li {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.5rem 0.6rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.read-only-events {
  margin-top: 0.25rem;
}
.event-list {
  list-style: none;
  margin: 0.45rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.event-item {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  padding: 0.55rem 0.62rem;
}
.event-item__head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.event-item__global-icon {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #eef2ff;
}
.event-pill {
  margin-left: auto;
  font-size: 0.62rem;
  font-weight: 800;
  border-radius: 999px;
  padding: 2px 8px;
}
.event-pill.holiday { background: #fef3c7; color: #92400e; }
.event-pill.reason { background: #eef2ff; color: #3730a3; }
.event-pill.note { background: #f1f5f9; color: #475569; }
.event-pill.work { background: #dcfce7; color: #166534; }

/* A rule the weekly Summarize set by itself. */
.auto-tag {
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  background: #e0e7ff;
  color: #3730a3;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.event-item__line {
  margin: 0.3rem 0 0;
  color: #334155;
  font-size: 0.8rem;
}
.event-item__line--result {
  font-weight: 800;
  color: #0f172a;
}
.event-item__note {
  margin: 0.28rem 0 0;
  font-size: 0.76rem;
  color: #64748b;
}
.user-multiselect {
  margin-top: 0.45rem;
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 10px;
  background: #fff;
  max-height: 220px;
  overflow: auto;
  padding: 0.35rem;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.user-option {
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  padding: 0.32rem 0.4rem;
}
.user-option:hover {
  background: #f8fafc;
}
.user-option span {
  font-size: 0.83rem;
}
.user-option small {
  color: #64748b;
}

.table-wrap {
  overflow-x: auto;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
}
.table th, .table td {
  text-align: left;
  padding: 9px 8px;
  border-bottom: 1px solid #f1f5f9;
}
.badge {
  font-size: 0.63rem;
  font-weight: 750;
  padding: 3px 8px;
  border-radius: 999px;
  text-transform: uppercase;
}
.badge.penalty {
  background: #fef2f2;
  color: #991b1b;
}
.badge.bonus {
  background: #ecfdf5;
  color: #065f46;
}

.section-title {
  margin: 1.25rem 0 0.5rem;
  font-size: 0.95rem;
  font-weight: 800;
}
.section-title--tight {
  margin-top: 0.2rem;
  margin-bottom: 0.55rem;
}
.ledger {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ledger-row {
  display: grid;
  grid-template-columns: auto auto minmax(150px, 1fr) minmax(130px, 1fr) auto auto;
  gap: 8px;
  align-items: center;
  font-size: 0.8rem;
  padding: 0.42rem 0.5rem;
  border-radius: 10px;
  background: var(--bg-secondary, #f8fafc);
}
@media (max-width: 900px) {
  .ledger-row {
    grid-template-columns: 1fr;
  }
}
.ledger-row__time {
  color: var(--text-secondary, #64748b);
  font-variant-numeric: tabular-nums;
}
.ledger-row__scope {
  color: var(--text-secondary, #64748b);
}
.ledger-row__pts {
  font-weight: 800;
}

.pill {
  display: inline-flex;
  font-size: 0.62rem;
  font-weight: 750;
  padding: 2px 8px;
  border-radius: 999px;
}
.pill.penalty {
  background: #fef2f2;
  color: #991b1b;
}
.pill.bonus {
  background: #ecfdf5;
  color: #065f46;
}

.btn-text {
  background: none;
  border: none;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
}
.btn-text--danger {
  color: #dc2626;
}
.btn-text--primary {
  color: #4f46e5;
}
.rule-row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.field__input--compact {
  min-width: 0;
  padding: 0.38rem 0.5rem;
  font-size: 0.84rem;
}
.table-row--editing td {
  background: color-mix(in srgb, var(--color-primary, #6366f1) 5%, #fff);
  vertical-align: middle;
}
@media (max-width: 960px) {
  .worktime-layout {
    grid-template-columns: 1fr;
  }
  .field--month {
    max-width: 100%;
    min-width: 0;
  }
}
</style>
