<template>
  <div class="nav-submenu report-nav-submenu">
    <div
      v-for="period in REPORT_NAV_PERIODS"
      :key="period.key"
      class="report-period-group"
    >
      <button type="button" class="period-header" @click="togglePeriod(period.key)">
        <span>{{ period.label }}</span>
        <span class="nav-arrow period-arrow" :class="{ open: openPeriods[period.key] }">▼</span>
      </button>
      <div v-show="openPeriods[period.key]" class="period-links">
        <div class="report-kind-block">
          <p class="report-kind-heading">Plans</p>
          <nav class="report-kind-links" :aria-label="`${period.label} plans`">
            <router-link
              v-if="isAdmin"
              :to="{ name: period.plans.all }"
              class="nav-item nav-subitem nav-subitem-compact"
            >
              <span>All teams</span>
            </router-link>
            <router-link
              v-if="isAdmin"
              :to="{ name: period.plans.templates }"
              class="nav-item nav-subitem nav-subitem-compact"
            >
              <span>Plan tickets</span>
            </router-link>
            <template v-else>
              <router-link
                :to="{ name: period.plans.submit }"
                class="nav-item nav-subitem nav-subitem-compact"
              >
                <span>Submit</span>
              </router-link>
              <router-link
                :to="{ name: period.plans.history }"
                class="nav-item nav-subitem nav-subitem-compact"
              >
                <span>History</span>
              </router-link>
              <router-link
                v-if="isBoss"
                :to="{ name: period.plans.group }"
                class="nav-item nav-subitem nav-subitem-compact"
              >
                <span>Team review</span>
              </router-link>
            </template>
          </nav>
        </div>
        <div class="report-kind-block">
          <p class="report-kind-heading">Reports</p>
          <nav class="report-kind-links" :aria-label="`${period.label} reports`">
            <router-link
              v-if="isAdmin"
              :to="{ name: period.reports.all }"
              class="nav-item nav-subitem nav-subitem-compact"
            >
              <span>All teams</span>
            </router-link>
            <template v-else>
              <router-link
                :to="{ name: period.reports.submit }"
                class="nav-item nav-subitem nav-subitem-compact"
              >
                <span>Submit</span>
              </router-link>
              <router-link
                :to="{ name: period.reports.history }"
                class="nav-item nav-subitem nav-subitem-compact"
              >
                <span>History</span>
              </router-link>
              <router-link
                v-if="isBoss"
                :to="{ name: period.reports.group }"
                class="nav-item nav-subitem nav-subitem-compact"
              >
                <span>Team review</span>
              </router-link>
            </template>
          </nav>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue';
import { useRoute } from 'vue-router';

defineProps({
  isAdmin: { type: Boolean, default: false },
  isBoss: { type: Boolean, default: false }
});

const route = useRoute();

const REPORT_NAV_PERIODS = [
  {
    key: 'daily',
    label: 'Daily',
    plans: {
      all: 'allPlans',
      templates: 'planTicketTemplatesDaily',
      submit: 'dailyplan',
      history: 'planHistory',
      group: 'groupPlanHistory'
    },
    reports: { all: 'all', submit: 'dailyreport', history: 'reportHistory', group: 'groupReportHistory' }
  },
  {
    key: 'weekly',
    label: 'Weekly',
    plans: {
      all: 'allPlansWeekly',
      templates: 'planTicketTemplatesWeekly',
      submit: 'weeklyplan',
      history: 'weeklyPlanHistory',
      group: 'groupWeeklyPlanHistory'
    },
    reports: {
      all: 'allWeekly',
      submit: 'weeklyreport',
      history: 'weeklyReportHistory',
      group: 'groupWeeklyReportHistory'
    }
  },
  {
    key: 'monthly',
    label: 'Monthly',
    plans: {
      all: 'allPlansMonthly',
      templates: 'planTicketTemplatesMonthly',
      submit: 'monthlyplan',
      history: 'monthlyPlanHistory',
      group: 'groupMonthlyPlanHistory'
    },
    reports: {
      all: 'allMonthly',
      submit: 'monthlyreport',
      history: 'monthlyReportHistory',
      group: 'groupMonthlyReportHistory'
    }
  }
];

const openPeriods = reactive({
  daily: true,
  weekly: false,
  monthly: false
});

function togglePeriod(key) {
  openPeriods[key] = !openPeriods[key];
}

function syncOpenPeriodFromRoute() {
  const p = String(route.meta?.reportPeriod || 'daily');
  if (['daily', 'weekly', 'monthly'].includes(p)) {
    openPeriods.daily = p === 'daily';
    openPeriods.weekly = p === 'weekly';
    openPeriods.monthly = p === 'monthly';
  }
}

watch(() => route.meta?.reportPeriod, syncOpenPeriodFromRoute, { immediate: true });
watch(() => route.name, syncOpenPeriodFromRoute);
</script>

<style scoped>
.report-nav-submenu {
  margin: 4px 8px 0;
  padding: 6px;
  border-radius: 8px;
  background: var(--shell-submenu-bg);
  border: 1px solid var(--shell-submenu-border);
}

.report-period-group {
  margin: 4px 2px;
  border-radius: 8px;
  border: 1px solid var(--shell-period-border);
  background: var(--shell-period-bg);
  overflow: hidden;
}

.period-header {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--shell-nav-text);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  font-size: 0.76rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
}

.period-header:hover {
  background: rgba(148, 163, 184, 0.12);
}

.period-arrow {
  font-size: 0.65rem;
  opacity: 0.75;
  transition: transform 0.15s ease;
}

.period-arrow.open {
  transform: rotate(180deg);
}

.period-links {
  padding: 2px 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.report-kind-block {
  padding: 6px 4px 4px;
  border-radius: 6px;
  background: var(--shell-kind-block-bg);
}

.report-kind-heading {
  margin: 0 6px 5px;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--shell-kind-heading);
}

.report-kind-links {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.report-kind-links :deep(a.nav-item) {
  margin: 0;
  padding: 7px 10px 7px 12px !important;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.25;
  border-radius: 6px;
  border: 1px solid transparent;
  color: var(--shell-nav-text) !important;
  text-decoration: none;
}

.report-kind-links :deep(a.nav-item:hover) {
  background: var(--shell-nav-hover-bg);
  color: var(--shell-nav-active-text) !important;
}

.report-kind-links :deep(a.nav-item.router-link-active) {
  background: var(--shell-nav-active-bg);
  border-color: var(--shell-nav-active-border);
  color: var(--shell-nav-active-text) !important;
  font-weight: 600;
}

.nav-subitem-compact {
  margin: 0;
}
</style>
