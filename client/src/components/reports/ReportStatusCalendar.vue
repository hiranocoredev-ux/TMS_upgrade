<template>
  <div class="rsc" :class="{ 'rsc--compact': compact }">
    <!-- Daily: month day-grid -->
    <template v-if="granularity === 'daily'">
      <div class="rsc__toolbar">
        <button type="button" class="rsc__nav" aria-label="Previous month" @click="shiftMonth(-1)">
          <span class="rsc__navInner" aria-hidden="true">‹</span>
        </button>
        <span class="rsc__title">{{ monthTitle }}</span>
        <button type="button" class="rsc__nav" aria-label="Next month" @click="shiftMonth(1)">
          <span class="rsc__navInner" aria-hidden="true">›</span>
        </button>
      </div>
      <div class="rsc__weekdays" aria-hidden="true">
        <span v-for="w in weekdayLabels" :key="w">{{ w }}</span>
      </div>
      <div class="rsc__grid rsc__grid--days">
        <button
          v-for="cell in dayCells"
          :key="cell.key"
          type="button"
          class="rsc__cell"
          :class="{
            'rsc__cell--muted': !cell.inMonth,
            'rsc__cell--today': cell.isToday,
            'rsc__cell--selected': cell.key === selectedKey
          }"
          :disabled="cell.key > maxDateKey"
          @click="pickDay(cell)"
        >
          <span class="rsc__num">{{ cell.dayNum }}</span>
          <span v-if="cell.dot" class="rsc__dot" :class="`rsc__dot--${cell.dot}`" aria-hidden="true" />
        </button>
      </div>
    </template>

    <!-- Weekly: weeks overlapping visible month -->
    <template v-else-if="granularity === 'weekly'">
      <div class="rsc__toolbar">
        <button type="button" class="rsc__nav" aria-label="Previous month" @click="shiftMonth(-1)">
          <span class="rsc__navInner" aria-hidden="true">‹</span>
        </button>
        <span class="rsc__title">{{ monthTitle }}</span>
        <button type="button" class="rsc__nav" aria-label="Next month" @click="shiftMonth(1)">
          <span class="rsc__navInner" aria-hidden="true">›</span>
        </button>
      </div>
      <ul class="rsc__weeklist">
        <li v-for="w in weekRows" :key="w.mondayKey">
          <button
            type="button"
            class="rsc__weekbtn"
            :class="{ 'is-selected': w.mondayKey === selectedPeriodKey }"
            @click="pickWeek(w.mondayKey)"
          >
            <span class="rsc__weeklabel">{{ w.label }}</span>
            <span v-if="w.dot" class="rsc__dot" :class="`rsc__dot--${w.dot}`" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </template>

    <!-- Monthly report: 12 months for visible year -->
    <template v-else-if="granularity === 'monthly'">
      <div class="rsc__toolbar">
        <button type="button" class="rsc__nav" aria-label="Previous year" @click="shiftYear(-1)">
          <span class="rsc__navInner" aria-hidden="true">‹</span>
        </button>
        <span class="rsc__title">{{ visibleYear }}</span>
        <button type="button" class="rsc__nav" aria-label="Next year" @click="shiftYear(1)">
          <span class="rsc__navInner" aria-hidden="true">›</span>
        </button>
      </div>
      <div class="rsc__grid rsc__grid--months">
        <button
          v-for="m in monthTiles"
          :key="m.anchor"
          type="button"
          class="rsc__monthcell"
          :class="{ 'is-selected': m.anchor === selectedPeriodKey }"
          @click="pickMonth(m.anchor)"
        >
          <span class="rsc__mon">{{ m.short }}</span>
          <span v-if="m.dot" class="rsc__dot" :class="`rsc__dot--${m.dot}`" aria-hidden="true" />
        </button>
      </div>
    </template>

    <p class="rsc__legend">
      <template v-if="palette === 'member'">
        <span class="rsc__leg"><span class="rsc__dot rsc__dot--green" /> Report saved</span>
      </template>
      <template v-else>
        <span class="rsc__leg"><span class="rsc__dot rsc__dot--green" /> All members</span>
        <span class="rsc__leg"><span class="rsc__dot rsc__dot--yellow" /> Partial</span>
        <span class="rsc__leg"><span class="rsc__dot rsc__dot--red" /> Missing</span>
      </template>
    </p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { REPORT_PERIODS, normalizeDateForPeriod } from '../../utils/reportPeriod';
import { resolveGroupCellDot, todayDateKey } from '../../utils/reportCalendarDots';

const props = defineProps({
  /** daily | weekly | monthly */
  granularity: {
    type: String,
    default: 'daily',
    validator: (v) => ['daily', 'weekly', 'monthly'].includes(v)
  },
  /** member = green only; group = traffic lights */
  palette: { type: String, default: 'member', validator: (v) => ['member', 'group'].includes(v) },
  dots: { type: Object, default: () => ({}) },
  /** For group palette: expected roster size (for red on empty days) */
  rosterSize: { type: Number, default: 0 },
  modelValue: { type: String, default: '' },
  /** Start calendar on this month YYYY-MM (defaults from modelValue or today) */
  anchorMonth: { type: String, default: '' },
  compact: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

const maxDateKey = todayDateKey();

const visibleYearMonth = ref('');
const visibleYear = ref(new Date().getFullYear());

function parseYm(str) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(str || '').trim());
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]) - 1 };
}

function ymFromDateKey(dk) {
  const raw = String(dk || '').split('T')[0];
  const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!p) return null;
  return `${p[1]}-${p[2]}`;
}

function initVisibleMonth() {
  const fromProp = parseYm(props.anchorMonth);
  const fromModel = ymFromDateKey(props.modelValue);
  const key = fromProp ? `${fromProp.y}-${String(fromProp.mo + 1).padStart(2, '0')}` : fromModel;
  if (key) {
    visibleYearMonth.value = key;
    visibleYear.value = Number(key.slice(0, 4));
    return;
  }
  const t = new Date();
  visibleYearMonth.value = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
  visibleYear.value = t.getFullYear();
}

initVisibleMonth();

watch(
  () => props.anchorMonth,
  () => initVisibleMonth(),
  { immediate: false }
);

watch(
  () => props.modelValue,
  () => {
    const ym = ymFromDateKey(props.modelValue);
    if (ym && props.granularity === 'daily') visibleYearMonth.value = ym;
    if (props.granularity === 'weekly') {
      const raw = String(props.modelValue || '').split('T')[0];
      const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
      if (ymd) {
        // Keep week picker anchored to the "main" month of the selected week (Thursday).
        // Example: 3/30-4/5 remains under April instead of jumping back to March.
        const monday = new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T12:00:00`);
        const anchor = new Date(monday);
        anchor.setDate(monday.getDate() + 3);
        visibleYearMonth.value = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}`;
      }
    }
    if (props.granularity === 'monthly') {
      const raw = String(props.modelValue || '').split('T')[0];
      const y = /^(\d{4})-/.exec(raw);
      if (y) visibleYear.value = Number(y[1]);
    }
  }
);

const weekdayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const selectedKey = computed(() => String(props.modelValue || '').split('T')[0]);

const selectedPeriodKey = computed(() => {
  const raw = String(props.modelValue || '').split('T')[0];
  if (!raw) return '';
  if (props.granularity === 'weekly') return normalizeDateForPeriod(raw, REPORT_PERIODS.WEEKLY);
  if (props.granularity === 'monthly') return normalizeDateForPeriod(raw, REPORT_PERIODS.MONTHLY);
  return raw;
});

const monthTitle = computed(() => {
  const p = parseYm(visibleYearMonth.value);
  if (!p) return '';
  const d = new Date(p.y, p.mo, 1);
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(d);
});

function shiftMonth(delta) {
  const p = parseYm(visibleYearMonth.value);
  if (!p) return;
  const d = new Date(p.y, p.mo + delta, 1);
  visibleYearMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shiftYear(delta) {
  visibleYear.value += delta;
}

function toOrdinalWord(n) {
  return ({
    1: 'First',
    2: 'Second',
    3: 'Third',
    4: 'Fourth',
    5: 'Fifth',
    6: 'Sixth'
  }[Number(n)] || `${n}th`);
}

function fmtMonthDayShort(dateObj) {
  return `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
}

function dotForDay(dateKey) {
  if (props.palette === 'member') {
    return props.dots[dateKey] === 'green' ? 'green' : '';
  }
  return resolveGroupCellDot(props.dots, dateKey, props.rosterSize, maxDateKey);
}

const dayCells = computed(() => {
  const p = parseYm(visibleYearMonth.value);
  if (!p) return [];
  const y = p.y;
  const mo = p.mo;
  const first = new Date(y, mo, 1);
  const last = new Date(y, mo + 1, 0);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = last.getDate();
  const cells = [];
  const total = startPad + daysInMonth;
  const rows = Math.ceil(total / 7) * 7;

  for (let i = 0; i < rows; i++) {
    const dayNum = i - startPad + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      const adj = new Date(y, mo, dayNum);
      const ky = adj.toLocaleDateString('en-CA');
      cells.push({
        key: ky,
        dayNum: adj.getDate(),
        inMonth: false,
        isToday: ky === maxDateKey,
        dot: ky <= maxDateKey ? dotForDay(ky) : ''
      });
      continue;
    }
    const dk = `${y}-${String(mo + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    cells.push({
      key: dk,
      dayNum,
      inMonth: true,
      isToday: dk === maxDateKey,
      dot: dk <= maxDateKey ? dotForDay(dk) : ''
    });
  }
  return cells;
});

function pickDay(cell) {
  if (!cell?.key || cell.key > maxDateKey) return;
  emit('update:modelValue', cell.key);
}

const weekRows = computed(() => {
  const p = parseYm(visibleYearMonth.value);
  if (!p) return [];
  const y = p.y;
  const mo = p.mo;
  const first = new Date(y, mo, 1);
  const last = new Date(y, mo + 1, 0);
  const seen = new Set();
  const rows = [];

  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    const dk = d.toLocaleDateString('en-CA');
    const mon = normalizeDateForPeriod(dk, REPORT_PERIODS.WEEKLY);
    if (seen.has(mon)) continue;
    seen.add(mon);
    const md = new Date(`${mon}T12:00:00`);
    const end = new Date(md);
    end.setDate(md.getDate() + 6);
    const benchmarkWednesday = new Date(md);
    benchmarkWednesday.setDate(md.getDate() + 2);
    // Assign each week to exactly one month by Wednesday ownership.
    // If Wednesday is not in the visible month, skip this week here.
    if (benchmarkWednesday.getMonth() !== mo || benchmarkWednesday.getFullYear() !== y) continue;
    let dot = '';
    if (props.palette === 'member') {
      dot = props.dots[mon] === 'green' ? 'green' : '';
    } else {
      dot = resolveGroupCellDot(props.dots, mon, props.rosterSize, maxDateKey);
    }
    rows.push({
      mondayKey: mon,
      rangeStart: fmtMonthDayShort(md),
      rangeEnd: fmtMonthDayShort(end),
      dot
    });
  }
  const monthName = new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date(y, mo, 1));
  return rows.map((row, idx) => ({
    ...row,
    label: `${monthName} ${toOrdinalWord(idx + 1)} Week (${row.rangeStart}-${row.rangeEnd})`
  }));
});

function pickWeek(mondayKey) {
  emit('update:modelValue', mondayKey);
}

const monthTiles = computed(() => {
  const y = visibleYear.value;
  const short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const tiles = [];
  for (let mo = 0; mo < 12; mo++) {
    const anchor = `${y}-${String(mo + 1).padStart(2, '0')}-01`;
    let dot = '';
    if (props.palette === 'member') {
      dot = props.dots[anchor] === 'green' ? 'green' : '';
    } else {
      dot = resolveGroupCellDot(props.dots, anchor, props.rosterSize, maxDateKey);
    }
    const todayM = normalizeDateForPeriod(maxDateKey, REPORT_PERIODS.MONTHLY);
    if (anchor > todayM) dot = '';
    tiles.push({ anchor, short: short[mo], dot });
  }
  return tiles;
});

function pickMonth(anchor) {
  emit('update:modelValue', anchor);
}
</script>

<style scoped>
.rsc {
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: var(--radius-md, 10px);
  padding: 10px;
  background: var(--bg-primary, #fff);
}

.rsc__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.rsc__nav {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  border: 1px solid var(--border-medium, #cbd5e1);
  background: var(--bg-secondary, #f8fafc);
  border-radius: 8px;
  width: 2rem;
  height: 2rem;
  min-width: 2rem;
  min-height: 2rem;
  flex-shrink: 0;
  cursor: pointer;
  /* Avoid text metrics on the <button> affecting inner alignment */
  font-size: 0;
  line-height: 0;
  text-align: center;
  appearance: none;
  -webkit-appearance: none;
  -webkit-tap-highlight-color: transparent;
}

.rsc__navInner {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 1.2rem;
  line-height: 1;
}

.rsc__nav:hover {
  border-color: var(--color-primary, #2563eb);
}

.rsc__title {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-width: 0;
  min-height: 2rem;
  font-weight: 700;
  font-size: 0.9rem;
  line-height: 1.2;
  color: var(--text-primary, #0f172a);
}

.rsc__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 4px;
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--text-tertiary, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.rsc__grid--days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.rsc__cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  min-height: 2.35rem;
  padding: 4px 2px 6px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--bg-secondary, #f8fafc);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
}

.rsc__cell:hover:not(:disabled) {
  border-color: var(--color-primary-soft, rgba(37, 99, 235, 0.35));
}

.rsc__cell--muted {
  opacity: 0.38;
  cursor: default;
}

.rsc__cell--today {
  outline: 1px solid var(--color-primary, #2563eb);
}

.rsc__cell--selected {
  background: rgba(37, 99, 235, 0.12);
  border-color: rgba(37, 99, 235, 0.45);
}

.rsc__cell:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.rsc__num {
  line-height: 1.2;
}

.rsc__dot {
  display: block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-top: auto;
}

.rsc__dot--green {
  background: #16a34a;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.9);
}

.rsc__dot--yellow {
  background: #eab308;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.9);
}

.rsc__dot--red {
  background: #dc2626;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.9);
}

.rsc__weeklist {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 220px;
  overflow: auto;
}

.rsc__weekbtn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border-light, #e2e8f0);
  background: var(--bg-secondary, #f8fafc);
  cursor: pointer;
  font-size: 0.78rem;
  text-align: left;
}

.rsc__weekbtn.is-selected {
  border-color: rgba(37, 99, 235, 0.45);
  background: rgba(37, 99, 235, 0.08);
}

.rsc__weeklabel {
  flex: 1;
  min-width: 0;
  color: var(--text-primary, #0f172a);
}

.rsc__grid--months {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.rsc__monthcell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 6px;
  border-radius: 8px;
  border: 1px solid var(--border-light, #e2e8f0);
  background: var(--bg-secondary, #f8fafc);
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 700;
}

.rsc__monthcell.is-selected {
  border-color: rgba(37, 99, 235, 0.45);
  background: rgba(37, 99, 235, 0.1);
}

.rsc__mon {
  color: var(--text-primary, #0f172a);
}

.rsc__legend {
  margin: 10px 0 0;
  padding-top: 8px;
  border-top: 1px solid var(--border-light, #e2e8f0);
  font-size: 0.68rem;
  color: var(--text-secondary, #475569);
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.rsc__leg {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.rsc--compact .rsc__weeklist {
  max-height: 160px;
}
</style>
