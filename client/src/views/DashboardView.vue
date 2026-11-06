<template>
  <div class="dash-view">
    <!-- ── Section 1: Worktime summarize (same as Worktime Summarize page) ── -->
    <section class="dash-section">
      <div class="dash-section__head">
        <h2 class="dash-section__title">Worktime Summary</h2>
        <p class="dash-section__hint">Each member's tracked &amp; manual time — filter by day, week, month or range.</p>
      </div>
      <div class="dash-section__body">
        <WorkflowView />
      </div>
    </section>

    <!-- ── Section 2: Quarterly profit competition ── -->
    <section class="dash-section">
      <div class="dash-section__body dash-section__body--flush">
        <DashboardFinanceQuarter />
      </div>
    </section>
  </div>
</template>

<script setup>
import WorkflowView from './WorkflowView.vue';
import DashboardFinanceQuarter from '../components/dashboard/DashboardFinanceQuarter.vue';
</script>

<style scoped>
.dash-view {
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
  padding-bottom: 2rem;
}

.dash-section {
  display: flex;
  flex-direction: column;
}
.dash-section__head { margin-bottom: 0.6rem; padding: 0 0.15rem; }
.dash-section__title { margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--text-primary, #111827); }
.dash-section__hint { margin: 0.15rem 0 0; font-size: 0.82rem; color: var(--text-secondary, #6b7280); }

/* Section 1 embeds the full Worktime page component; keep it visually contained. */
.dash-section__body { min-width: 0; }
.dash-section__body--flush { padding: 0; }
</style>
