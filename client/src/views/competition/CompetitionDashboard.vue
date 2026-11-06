<template>
  <div class="comp-page">
    <header class="hero">
      <div class="hero__copy">
        <p class="hero__eyebrow">Competition Management</p>
        <h1 class="hero__title">Monthly leaderboard</h1>
        <p class="hero__desc">
          Professional monthly ranking based on finance, worktime, and manual adjustments.
        </p>
      </div>

      <div class="hero__actions">
        <label class="field">
          <span class="field__label">Competition month</span>
          <div class="month-nav">
            <button type="button" class="btn btn--secondary month-nav__btn" @click="moveMonth(-1)">← Prev</button>
            <input v-model="month" type="month" class="field__input month-nav__input" @change="load" />
            <button type="button" class="btn btn--secondary month-nav__btn" @click="moveMonth(1)">Next →</button>
          </div>
        </label>
        <router-link :to="{ name: 'CompetitionRules' }" class="btn btn--secondary">
          Open rules &amp; settings
        </router-link>
      </div>
    </header>

    <div v-if="loading" class="state state--loading">Loading leaderboard…</div>
    <div v-else-if="error" class="state state--error">{{ error }}</div>

    <template v-else>
      <div class="panel-grid">
        <section class="panel">
          <header class="panel__head">
            <h2 class="panel__title">Group Ranking</h2>
            <p class="panel__hint">
              <template v-if="chartDetailMode === 'total'">
                Each bar is the team net total — blue when zero or positive, orange when negative.
              </template>
              <template v-else>
                Stacked: finance (team average), worktime (sum of shortfalls), group bonus, group penalty.
              </template>
            </p>
          </header>

          <div class="chart-card">
            <div class="chart-card__top">
              <span class="chart-card__label">Competition chart</span>
              <span class="chart-card__meta">Top {{ Math.min(10, displayGroups.length) }} teams</span>
            </div>
            <div class="chart-card__canvas" :style="{ height: groupChartHeightPx + 'px' }">
              <canvas
                ref="groupChartCanvas"
                class="chart-canvas"
                :style="{ minWidth: groupChartMinWidthPx + 'px' }"
              />
            </div>
          </div>
        </section>

        <section class="panel">
          <header class="panel__head">
            <h2 class="panel__title">Member Ranking</h2>
            <p class="panel__hint">
              <template v-if="chartDetailMode === 'total'">
                One bar per person: net total only — blue when zero or positive, orange when negative.
              </template>
              <template v-else>
                Four colors: finance, worktime, bonus, penalty. Hover for totals.
              </template>
            </p>
          </header>

          <div class="chart-card chart-card--members">
            <div class="chart-card__top">
              <span class="chart-card__label">Competition chart</span>
              <span class="chart-card__meta">All {{ displayUsers.length }} members</span>
            </div>
            <div class="chart-card__canvas" :style="{ height: memberChartHeightPx + 'px' }">
              <canvas
                ref="memberChartCanvas"
                class="chart-canvas"
                :style="{ minWidth: memberChartMinWidthPx + 'px' }"
              />
            </div>
            <p class="chart-toolbar__caption">
              Applies to both charts · default is simplified total.
            </p>
            <div class="chart-toolbar" role="group" aria-label="Chart detail level">
              <button
                type="button"
                class="segment segment--first"
                :class="{ 'segment--active': chartDetailMode === 'total' }"
                @click="chartDetailMode = 'total'"
              >
                Final score
              </button>
              <button
                type="button"
                class="segment segment--last"
                :class="{ 'segment--active': chartDetailMode === 'breakdown' }"
                @click="chartDetailMode = 'breakdown'"
              >
                Breakdown
              </button>
            </div>
          </div>
        </section>
      </div>

      <footer v-if="chartDetailMode === 'breakdown'" class="legend">
        <span><i class="dot dot--fin" /> Finance score</span>
        <span><i class="dot dot--wt" /> Worktime score</span>
        <span><i class="dot dot--bonus" /> Bonus score</span>
        <span><i class="dot dot--pen" /> Penalty score</span>
      </footer>
      <footer v-else class="legend legend--simple">
        <span><i class="dot dot--total-pos" /> Final score zero or positive</span>
        <span><i class="dot dot--total-neg" /> Final score negative</span>
      </footer>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { currentMonthKey } from '../../utils/businessMonth';
import Chart from 'chart.js/auto';
import { getCompetitionDashboard } from '../../services/competition';
const month = ref(currentMonthKey());
const loading = ref(false);
const error = ref(null);
const users = ref([]);
const groups = ref([]);

// Chart
const groupChartCanvas = ref(null);
let groupChart = null;
const memberChartCanvas = ref(null);
let memberChart = null;

const displayUsers = computed(() => users.value);
const displayGroups = computed(() => groups.value.slice(0, 20));

/** 'total' default: net score (two-tone); 'breakdown': four-component stack */
const chartDetailMode = ref('total');

/** Stacked chart colors: finance, worktime, bonus, penalty */
const COL_FIN = 'rgba(59, 130, 246, 0.9)';
const COL_WT = 'rgba(245, 158, 11, 0.9)';
const COL_BONUS = 'rgba(16, 185, 129, 0.9)';
const COL_PEN = 'rgba(239, 68, 68, 0.9)';

/** Final-score view: positive mass vs negative mass (matches prior blue/orange diverging bars) */
const COL_TOTAL_POS = 'rgba(59, 130, 246, 0.92)';
const COL_TOTAL_NEG = 'rgba(249, 115, 22, 0.92)';

function partsFromRow(row) {
  const finance = Number(row.financeScore) || 0;
  const worktime = Number(row.worktimeScore) || 0;
  const hasSplit =
    row.bonusScore !== undefined &&
    row.bonusScore !== null &&
    row.penaltyScore !== undefined &&
    row.penaltyScore !== null;
  let bonus = 0;
  let penalty = 0;
  if (hasSplit) {
    bonus = Math.max(0, Number(row.bonusScore) || 0);
    penalty = Math.min(0, Number(row.penaltyScore) || 0);
  } else {
    const adj = Number(row.adjustmentScore) || 0;
    if (adj > 0) bonus = adj;
    if (adj < 0) penalty = adj;
  }
  return { finance, worktime, bonus, penalty };
}

function stackedTotalLabelPlugin(pluginId, fontSize = '12px') {
  return {
    id: pluginId,
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      const n = chart.data.labels?.length || 0;
      if (!n) return;
      ctx.save();
      ctx.font = `800 ${fontSize} system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < n; i++) {
        let sum = 0;
        let minY = chartArea.bottom;
        let maxY = chartArea.top;
        chart.data.datasets.forEach((ds, di) => {
          sum += Number(ds.data[i]) || 0;
          const meta = chart.getDatasetMeta(di);
          const el = meta.data[i];
          if (el) {
            minY = Math.min(minY, el.y, el.base);
            maxY = Math.max(maxY, el.y, el.base);
          }
        });
        const text = formatPts(sum);
        const rawY = sum >= 0 ? minY - 10 : maxY + 14;
        const y = Math.max(chartArea.top + 10, Math.min(chartArea.bottom - 10, rawY));
        const x = chart.getDatasetMeta(0).data[i]?.x;
        if (x != null) ctx.fillText(text, x, y);
      }
      ctx.restore();
    },
  };
}

const formatPts = (n) => {
  const x = Number(n) || 0;
  return (x >= 0 ? '+' : '') + x.toFixed(2);
};
const moveMonth = (delta) => {
  if (!/^\d{4}-\d{2}$/.test(month.value)) return;
  const [y, m] = month.value.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + Number(delta || 0));
  month.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  load();
};

const chartGroups = computed(() => displayGroups.value.slice(0, 10));
// Tighter per-bar width to reduce empty gaps, but still scrollable.
const groupChartMinWidthPx = computed(() => Math.max(760, chartGroups.value.length * 70));
const groupChartHeightPx = computed(() => {
  // Make the chart feel full-size (avoid compressed height).
  const n = chartGroups.value.length || 1;
  return Math.max(340, Math.min(540, 280 + n * 18));
});
const shortLabel = (label, max = 10) => {
  const s = String(label || '').trim();
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max)}…` : s;
};
const buildGroupChart = () => {
  if (!groupChartCanvas.value) return;
  if (groupChart) {
    groupChart.destroy();
    groupChart = null;
  }
  if (!chartGroups.value.length) return;

  const rows = chartGroups.value;
  const labels = rows.map((g) => g.groupLabel || g.groupCode || 'Unassigned');

  if (chartDetailMode.value === 'total') {
    const totals = rows.map((r) => Number(r.total) || 0);
    const colors = totals.map((v) => (v >= 0 ? COL_TOTAL_POS : COL_TOTAL_NEG));
    groupChart = new Chart(groupChartCanvas.value, {
      type: 'bar',
      plugins: [
        stackedTotalLabelPlugin('valueLabels', '12px'),
        {
          id: 'zeroLine',
          beforeDraw(chart) {
            const {
              ctx,
              chartArea: { top, bottom, left, right },
              scales: { y },
            } = chart;
            const zero = y.getPixelForValue(0);
            if (!Number.isFinite(zero) || zero < top || zero > bottom) return;
            ctx.save();
            ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(left, zero);
            ctx.lineTo(right, zero);
            ctx.stroke();
            ctx.restore();
          },
        },
      ],
      data: {
        labels,
        datasets: [
          {
            label: 'Final score',
            data: totals,
            backgroundColor: colors,
            borderWidth: 0,
            borderRadius: 8,
            maxBarThickness: 56,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 26, bottom: 14 } },
        animation: { duration: labels.length > 12 ? 0 : 520, easing: 'easeOutCubic' },
        interaction: { mode: 'index', intersect: false },
        datasets: {
          bar: {
            categoryPercentage: 0.92,
            barPercentage: 0.88,
            borderRadius: 6,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: 'rgba(71, 85, 105, 0.95)',
              font: { size: 11, weight: '700' },
              callback(value) {
                const label = this.getLabelForValue(value) || '';
                return shortLabel(label, 10);
              },
              autoSkip: true,
              maxRotation: 0,
              minRotation: 0,
            },
          },
          y: {
            beginAtZero: false,
            grace: '12%',
            grid: { color: 'rgba(148, 163, 184, 0.28)' },
            ticks: { color: 'rgba(71, 85, 105, 0.95)', font: { size: 11, weight: '700' } },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#fff',
            bodyColor: '#e5e7eb',
            displayColors: false,
            callbacks: {
              label: (ctx) => `Final score: ${formatPts(ctx.parsed.y)}`,
            },
          },
        },
      },
    });
    return;
  }

  const fin = rows.map((r) => partsFromRow(r).finance);
  const wt = rows.map((r) => partsFromRow(r).worktime);
  const bon = rows.map((r) => partsFromRow(r).bonus);
  const pen = rows.map((r) => partsFromRow(r).penalty);

  groupChart = new Chart(groupChartCanvas.value, {
    type: 'bar',
    plugins: [stackedTotalLabelPlugin('valueLabels', '12px')],
    data: {
      labels,
      datasets: [
        {
          label: 'Finance',
          data: fin,
          backgroundColor: COL_FIN,
          stack: 'score',
          borderWidth: 0,
          maxBarThickness: 56,
        },
        {
          label: 'Worktime',
          data: wt,
          backgroundColor: COL_WT,
          stack: 'score',
          borderWidth: 0,
          maxBarThickness: 56,
        },
        {
          label: 'Bonus',
          data: bon,
          backgroundColor: COL_BONUS,
          stack: 'score',
          borderWidth: 0,
          maxBarThickness: 56,
        },
        {
          label: 'Penalty',
          data: pen,
          backgroundColor: COL_PEN,
          stack: 'score',
          borderWidth: 0,
          maxBarThickness: 56,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 26, bottom: 14 } },
      animation: { duration: labels.length > 12 ? 0 : 520, easing: 'easeOutCubic' },
      interaction: { mode: 'index', intersect: false },
      datasets: {
        bar: {
          categoryPercentage: 0.92,
          barPercentage: 0.88,
          borderRadius: 6,
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: {
            color: 'rgba(71, 85, 105, 0.95)',
            font: { size: 11, weight: '700' },
            callback(value) {
              const label = this.getLabelForValue(value) || '';
              return shortLabel(label, 10);
            },
            autoSkip: true,
            maxRotation: 0,
            minRotation: 0,
          },
        },
        y: {
          stacked: true,
          beginAtZero: false,
          grace: '12%',
          grid: {
            color: 'rgba(148, 163, 184, 0.28)',
          },
          ticks: {
            color: 'rgba(71, 85, 105, 0.95)',
            font: { size: 11, weight: '700' },
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#fff',
          bodyColor: '#e5e7eb',
          displayColors: true,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatPts(ctx.parsed.y)}`,
            footer: (items) => {
              const sum = items.reduce((a, it) => a + (Number(it.parsed.y) || 0), 0);
              return `Total: ${formatPts(sum)}`;
            },
          },
        },
      },
    },
  });
};

const chartMembers = computed(() => displayUsers.value);
// Tighter per-bar width to reduce empty gaps, but still scrollable.
const memberChartMinWidthPx = computed(() => Math.max(820, chartMembers.value.length * 64));
const memberChartHeightPx = computed(() => {
  const n = chartMembers.value.length || 1;
  return Math.max(380, Math.min(620, 300 + n * 20));
});
const buildMemberChart = () => {
  if (!memberChartCanvas.value) return;
  if (memberChart) {
    memberChart.destroy();
    memberChart = null;
  }
  if (!chartMembers.value.length) return;

  const rows = chartMembers.value;
  const labels = rows.map((u) => u.name);

  if (chartDetailMode.value === 'total') {
    const totals = rows.map((r) => Number(r.total) || 0);
    const colors = totals.map((v) => (v >= 0 ? COL_TOTAL_POS : COL_TOTAL_NEG));
    memberChart = new Chart(memberChartCanvas.value, {
      type: 'bar',
      plugins: [
        stackedTotalLabelPlugin('valueLabelsMembers', '11.5px'),
        {
          id: 'zeroLineMembers',
          beforeDraw(chart) {
            const {
              ctx,
              chartArea: { top, bottom, left, right },
              scales: { y },
            } = chart;
            const zero = y.getPixelForValue(0);
            if (!Number.isFinite(zero) || zero < top || zero > bottom) return;
            ctx.save();
            ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(left, zero);
            ctx.lineTo(right, zero);
            ctx.stroke();
            ctx.restore();
          },
        },
      ],
      data: {
        labels,
        datasets: [
          {
            label: 'Final score',
            data: totals,
            backgroundColor: colors,
            borderWidth: 0,
            borderRadius: 8,
            maxBarThickness: 46,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 26, bottom: 16 } },
        animation: { duration: labels.length > 14 ? 0 : 520, easing: 'easeOutCubic' },
        interaction: { mode: 'index', intersect: false },
        datasets: {
          bar: {
            categoryPercentage: 0.9,
            barPercentage: 0.86,
            borderRadius: 6,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: 'rgba(71, 85, 105, 0.95)',
              font: { size: 10.5, weight: '700' },
              callback(value) {
                const label = this.getLabelForValue(value) || '';
                return shortLabel(label, 9);
              },
              autoSkip: true,
              maxRotation: 0,
              minRotation: 0,
            },
          },
          y: {
            beginAtZero: false,
            grace: '12%',
            grid: { color: 'rgba(148, 163, 184, 0.28)' },
            ticks: { color: 'rgba(71, 85, 105, 0.95)', font: { size: 11, weight: '700' } },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#fff',
            bodyColor: '#e5e7eb',
            displayColors: false,
            callbacks: {
              label: (ctx) => `Final score: ${formatPts(ctx.parsed.y)}`,
            },
          },
        },
      },
    });
    return;
  }

  const fin = rows.map((r) => partsFromRow(r).finance);
  const wt = rows.map((r) => partsFromRow(r).worktime);
  const bon = rows.map((r) => partsFromRow(r).bonus);
  const pen = rows.map((r) => partsFromRow(r).penalty);

  memberChart = new Chart(memberChartCanvas.value, {
    type: 'bar',
    plugins: [stackedTotalLabelPlugin('valueLabelsMembers', '11.5px')],
    data: {
      labels,
      datasets: [
        {
          label: 'Finance',
          data: fin,
          backgroundColor: COL_FIN,
          stack: 'score',
          borderWidth: 0,
          maxBarThickness: 46,
        },
        {
          label: 'Worktime',
          data: wt,
          backgroundColor: COL_WT,
          stack: 'score',
          borderWidth: 0,
          maxBarThickness: 46,
        },
        {
          label: 'Bonus',
          data: bon,
          backgroundColor: COL_BONUS,
          stack: 'score',
          borderWidth: 0,
          maxBarThickness: 46,
        },
        {
          label: 'Penalty',
          data: pen,
          backgroundColor: COL_PEN,
          stack: 'score',
          borderWidth: 0,
          maxBarThickness: 46,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 26, bottom: 16 } },
      animation: { duration: labels.length > 14 ? 0 : 520, easing: 'easeOutCubic' },
      interaction: { mode: 'index', intersect: false },
      datasets: {
        bar: {
          categoryPercentage: 0.9,
          barPercentage: 0.86,
          borderRadius: 6,
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: {
            color: 'rgba(71, 85, 105, 0.95)',
            font: { size: 10.5, weight: '700' },
            callback(value) {
              const label = this.getLabelForValue(value) || '';
              return shortLabel(label, 9);
            },
            autoSkip: true,
            maxRotation: 0,
            minRotation: 0,
          },
        },
        y: {
          stacked: true,
          beginAtZero: false,
          grace: '12%',
          grid: { color: 'rgba(148, 163, 184, 0.28)' },
          ticks: { color: 'rgba(71, 85, 105, 0.95)', font: { size: 11, weight: '700' } },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#fff',
          bodyColor: '#e5e7eb',
          displayColors: true,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatPts(ctx.parsed.y)}`,
            footer: (items) => {
              const sum = items.reduce((a, it) => a + (Number(it.parsed.y) || 0), 0);
              return `Total: ${formatPts(sum)}`;
            },
          },
        },
      },
    },
  });
};

const load = async () => {
  loading.value = true;
  error.value = null;
  try {
    const res = await getCompetitionDashboard({ month: month.value });
    users.value = res.data?.data?.users || [];
    groups.value = res.data?.data?.groups || [];
  } catch (e) {
    error.value = e.response?.data?.message || e.message || 'Failed to load';
    users.value = [];
    groups.value = [];
  } finally {
    loading.value = false;
  }
};

onMounted(load);
watch(month, load);

watch([groups, chartDetailMode], async () => {
  await nextTick();
  buildGroupChart();
  buildMemberChart();
});

onUnmounted(() => {
  if (groupChart) {
    groupChart.destroy();
    groupChart = null;
  }
  if (memberChart) {
    memberChart.destroy();
    memberChart = null;
  }
});
</script>

<style scoped>
.comp-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.25rem 1.5rem 2.4rem;
}

.hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.1rem;
  border: 1px solid color-mix(in srgb, var(--color-primary, #6366f1) 22%, var(--border-light, #e2e8f0));
  background:
    radial-gradient(circle at 10% 0%, color-mix(in srgb, var(--color-primary, #6366f1) 16%, transparent) 0%, transparent 52%),
    linear-gradient(180deg, color-mix(in srgb, var(--color-primary, #6366f1) 6%, var(--bg-primary, #fff)), var(--bg-primary, #fff));
  border-radius: 18px;
  padding: 1.1rem 1.2rem;
  box-shadow: 0 10px 28px rgba(79, 70, 229, 0.08);
}
.hero__eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.11em;
  color: var(--text-secondary, #64748b);
}
.hero__title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 800;
}
.hero__desc {
  margin: 0.45rem 0 0;
  max-width: 58ch;
  color: var(--text-secondary, #64748b);
  line-height: 1.5;
}
.hero__actions {
  display: flex;
  gap: 0.65rem;
  align-items: flex-end;
  flex-wrap: wrap;
}
.field__label {
  display: block;
  font-size: 0.67rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.28rem;
  color: var(--text-secondary, #64748b);
}
.field__input {
  padding: 0.5rem 0.65rem;
  border-radius: 10px;
  border: 1px solid var(--border-medium, #cbd5e1);
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #0f172a);
  min-height: 40px;
}
.month-nav {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 8px;
  align-items: center;
}
.month-nav__btn {
  min-height: 36px;
  padding: 0 0.7rem;
  font-size: 0.78rem;
}
.month-nav__input {
  min-width: 160px;
}
.btn {
  border-radius: 10px;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  font-weight: 700;
  padding: 0 0.9rem;
}
.btn--secondary {
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-medium, #cbd5e1);
  color: var(--text-primary, #0f172a);
}

.state {
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 14px;
  padding: 1.8rem;
  text-align: center;
}
.state--error {
  color: #b91c1c;
}

.panel-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}
.panel {
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 16px;
  padding: 1rem 1.1rem 1.15rem;
}
.panel__head {
  margin-bottom: 0.85rem;
}
.panel__title {
  margin: 0;
  font-size: 1.05rem;
}
.panel__hint {
  margin: 0.3rem 0 0;
  font-size: 0.75rem;
  color: var(--text-secondary, #64748b);
}

.chart-card {
  margin-top: 0.9rem;
  margin-bottom: 0.85rem;
  border-radius: 14px;
  border: 1px solid var(--border-light, #e2e8f0);
  background:
    radial-gradient(circle at 20% 0%, rgba(99, 102, 241, 0.12), transparent 56%),
    var(--bg-primary, #fff);
  padding: 0.8rem 0.85rem 0.9rem;
}
.chart-card__top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 0.55rem;
}
.chart-card__label {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary, #64748b);
}
.chart-card__meta {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary, #64748b);
}
.chart-card__canvas {
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 6px;
}
.chart-toolbar__caption {
  margin: 0.55rem 0 0.4rem;
  font-size: 0.72rem;
  font-weight: 650;
  color: var(--text-secondary, #64748b);
}
.chart-toolbar {
  display: inline-flex;
  align-items: stretch;
  margin-top: 0.05rem;
  border-radius: 10px;
  border: 1px solid var(--border-medium, #cbd5e1);
  overflow: hidden;
  background: var(--bg-primary, #fff);
}
.segment {
  border: none;
  background: transparent;
  padding: 0.5rem 1rem;
  font-weight: 800;
  font-size: 0.78rem;
  cursor: pointer;
  color: var(--text-secondary, #64748b);
}
.segment:not(.segment--last) {
  border-right: 1px solid var(--border-medium, #cbd5e1);
}
.segment--active {
  background: color-mix(in srgb, var(--color-primary, #6366f1) 16%, var(--bg-primary, #fff));
  color: var(--text-primary, #0f172a);
}
.segment:focus-visible {
  outline: 2px solid var(--color-primary, #6366f1);
  outline-offset: 2px;
}
.chart-canvas {
  width: 100% !important;
  height: 100% !important;
  display: block;
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}
.row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
  border-radius: 10px;
  padding: 0.45rem 0.4rem;
}
.row--me {
  background: color-mix(in srgb, var(--color-primary, #6366f1) 10%, transparent);
}
.row__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.rank {
  width: 2rem;
  font-size: 0.72rem;
  color: var(--text-secondary, #64748b);
  font-weight: 800;
}
.name {
  color: var(--text-primary, #0f172a);
  text-decoration: none;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.name:hover {
  color: var(--color-primary, #4f46e5);
}
.chip {
  border-radius: 999px;
  background: var(--bg-tertiary, #f1f5f9);
  color: var(--text-secondary, #64748b);
  font-size: 0.68rem;
  font-weight: 650;
  padding: 2px 8px;
}
.bar {
  height: 12px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--bg-tertiary, #e2e8f0);
  position: relative;
}
.bar--signed {
  height: 14px;
  background: linear-gradient(90deg,
    rgba(239, 68, 68, 0.10) 0%,
    rgba(148, 163, 184, 0.18) 50%,
    rgba(16, 185, 129, 0.12) 100%
  );
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.25);
}
.bar__zero {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  background: rgba(100, 116, 139, 0.55);
}
.bar__fill {
  height: 100%;
  min-width: 2%;
  border-radius: inherit;
  background: linear-gradient(90deg, #4f46e5, #7c3aed);
  position: absolute;
  top: 0;
  bottom: 0;
}
.bar__fill--group {
  background: linear-gradient(90deg, #059669, #10b981);
}
.bar__fill--pos {
  background: linear-gradient(90deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95));
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}
.bar__fill--neg {
  background: linear-gradient(90deg, rgba(239, 68, 68, 0.95), rgba(185, 28, 28, 0.95));
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
.score {
  width: 4.6rem;
  text-align: right;
  font-size: 0.8rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.score--pos { color: rgba(5, 150, 105, 0.98); }
.score--neg { color: rgba(185, 28, 28, 0.98); }
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem;
  margin-top: 1rem;
  font-size: 0.75rem;
  color: var(--text-secondary, #64748b);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 6px;
}
.dot--fin { background: #3b82f6; }
.dot--wt { background: #f59e0b; }
.dot--bonus { background: #10b981; }
.dot--pen { background: #ef4444; }
.dot--total-pos { background: #3b82f6; }
.dot--total-neg { background: #f97316; }

@media (max-width: 880px) {
  .row {
    grid-template-columns: 1fr;
    gap: 6px;
    padding: 0.55rem 0.55rem;
  }
  .score {
    width: auto;
    text-align: left;
  }
}
</style>
