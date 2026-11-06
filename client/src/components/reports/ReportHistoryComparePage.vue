<template>
  <div class="rhdoc">
    <header class="rhdoc__toolbar">
      <div class="rhdoc__statusWrap">
        <div
          v-if="statusText"
          class="rhdoc__status"
          :class="statusClass"
          role="status"
        >
          <span class="rhdoc__statusLabel">{{ statusText }}</span>
        </div>
      </div>
      <div class="rhdoc__actions">
        <slot name="actions" />
      </div>
    </header>

    <div class="rhdoc__titleBlock">
      <h2 class="rhdoc__title">{{ pageTitle }}</h2>
      <div v-if="metaLine" class="rhdoc__meta">{{ metaLine }}</div>
    </div>

    <hr class="rhdoc__sep" />

    <ReportHistoryMemberSummaryBar
      :user-id="userId"
      :anchor-date="anchorDate"
      :period="period"
    />

    <div v-if="compare" class="rhdoc__compare">
      <div class="rhdoc__compare-row">
        <article class="rhdoc__panel">
          <h3 class="rhdoc__panelTitle">{{ compare.periodPlan.label }}</h3>
          <p class="rhdoc__panelHint">{{ planSourceHint }}</p>
          <div
            v-if="hasHtml(compare.periodPlan.notes)"
            class="rhdoc__panelBody"
            v-html="compare.periodPlan.notes"
          />
          <p v-else class="rhdoc__panelEmpty">—</p>
        </article>

        <article class="rhdoc__panel" :class="{ 'rhdoc__panel--pending': compare.workResult.pending }">
          <h3 class="rhdoc__panelTitle">{{ compare.workResult.label }}</h3>
          <p class="rhdoc__panelHint">{{ workResultHint }}</p>
          <div
            v-if="compare.workResult.pending"
            class="rhdoc__panelPending"
            role="status"
          >
            <span class="rhdoc__pendingBadge">Not submitted yet</span>
            <p class="rhdoc__pendingText">
              This period's work result has not been submitted. It will appear here once the member files their report.
            </p>
          </div>
          <div
            v-else-if="hasHtml(compare.workResult.notes)"
            class="rhdoc__panelBody"
            v-html="compare.workResult.notes"
          />
          <p v-else class="rhdoc__panelEmpty">—</p>
        </article>
      </div>

      <section
        v-for="(extra, idx) in compare.extras"
        :key="`extra-${idx}`"
        class="rhdoc__extra"
      >
        <h3 class="rhdoc__panelTitle">{{ extra.title || `Section ${idx + 1}` }}</h3>
        <div
          v-if="hasHtml(extra.notes)"
          class="rhdoc__panelBody"
          v-html="extra.notes"
        />
        <p v-else class="rhdoc__panelEmpty">—</p>
      </section>
    </div>
    <p v-else class="rhdoc__empty">No content</p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import {
  getReportComposerPageTitle,
  REPORT_PERIODS
} from '../../utils/reportPeriod';
import ReportHistoryMemberSummaryBar from './ReportHistoryMemberSummaryBar.vue';

const props = defineProps({
  compare: { type: Object, default: null },
  period: { type: String, default: 'daily' },
  userId: { type: String, default: '' },
  anchorDate: { type: String, default: '' },
  statusText: { type: String, default: '' },
  statusClass: { type: String, default: '' },
  metaLine: { type: String, default: '' }
});

const pageTitle = computed(() => getReportComposerPageTitle(props.period));

const planSourceHint = computed(() => {
  if (props.period === REPORT_PERIODS.WEEKLY) {
    return 'From the previous week’s submitted plan';
  }
  if (props.period === REPORT_PERIODS.MONTHLY) {
    return 'From the previous month’s submitted plan';
  }
  return 'From the previous day’s submitted plan';
});

const workResultHint = computed(() => {
  if (props.compare?.workResult?.pending) {
    return 'Work result not submitted for this period yet';
  }
  return 'Work result submitted with this period’s report';
});

function hasHtml(notes) {
  const raw = String(notes || '').trim();
  if (!raw) return false;
  const text = raw.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim();
  return text.length > 0;
}
</script>

<style scoped>
.rhdoc {
  width: 100%;
  max-width: min(1240px, 100%);
  margin: 0 auto;
  padding: clamp(14px, 2vw, 22px);
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.rhdoc__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.rhdoc__status {
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.85rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.rhdoc__status.status-approved {
  color: #14532d;
  background: #ecfdf5;
  border: 1px solid rgba(22, 163, 74, 0.35);
}

.rhdoc__status.status-pending {
  color: #1e3a8a;
  background: #eff6ff;
  border: 1px solid rgba(37, 99, 235, 0.35);
}

.rhdoc__status.status-rejected {
  color: #7f1d1d;
  background: #fef2f2;
  border: 1px solid rgba(220, 38, 38, 0.35);
}

.rhdoc__status.status-draft {
  color: #334155;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.rhdoc__status.status-awaiting {
  color: #78350f;
  background: #fffbeb;
  border: 1px solid rgba(217, 119, 6, 0.35);
}

.rhdoc__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 6px;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  background: var(--bg-tertiary);
}

.rhdoc__actions :deep(.btn) {
  height: 34px;
  padding: 0 14px;
  border-radius: 9px;
  border: 1px solid var(--border-medium);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.82rem;
  font-weight: 650;
  line-height: 1;
}

.rhdoc__actions :deep(.btn-primary) {
  background: var(--color-primary-dark);
  color: var(--text-inverse);
  border-color: var(--color-primary-dark);
}

.rhdoc__actions :deep(.btn-danger) {
  background: color-mix(in srgb, var(--color-error) 14%, var(--bg-primary));
  color: var(--color-error);
  border-color: color-mix(in srgb, var(--color-error) 35%, var(--border-light));
}

.rhdoc__actions :deep(.btn-neutral) {
  background: var(--bg-primary);
  color: var(--text-secondary);
  border-color: var(--border-medium);
}

.rhdoc__actions :deep(.report-toolbar-icon-btn) {
  width: 34px;
  min-width: 34px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.rhdoc__actions :deep(.report-toolbar-icon-btn__icon) {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: block;
}

.rhdoc__titleBlock {
  margin-bottom: 0;
}

.rhdoc__title {
  margin: 0;
  font-size: clamp(1.2rem, 2vw, 1.45rem);
  font-weight: 650;
  color: var(--text-primary);
  letter-spacing: -0.025em;
}

.rhdoc__meta {
  margin-top: 4px;
  font-size: 0.8125rem;
  color: var(--text-tertiary);
}

.rhdoc__sep {
  border: 0;
  border-top: 1px solid var(--border-light);
  margin: 12px 0 16px;
}

.rhdoc__toolbar,
.rhdoc__titleBlock,
.rhdoc__sep {
  flex-shrink: 0;
}

.rhdoc__compare {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 1rem;
}

.rhdoc__compare-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  align-items: stretch;
  flex: 1;
  min-height: calc(100vh - 260px);
}

.rhdoc__panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 14px 16px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.rhdoc__panel .rhdoc__panelTitle {
  flex-shrink: 0;
}

.rhdoc__panel .rhdoc__panelHint {
  flex-shrink: 0;
}

.rhdoc__panelTitle {
  margin: 0 0 4px;
  font-size: 1.125rem;
  font-weight: 650;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.rhdoc__panelHint {
  margin: 0 0 12px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-tertiary);
  line-height: 1.35;
}

.rhdoc__panelBody {
  flex: 1;
  overflow: auto;
  color: var(--text-secondary);
  line-height: 1.65;
  font-size: 0.9375rem;
  word-break: break-word;
}

.rhdoc__panelBody :deep(p) {
  margin: 0 0 0.75rem;
}

.rhdoc__panelBody :deep(p:last-child) {
  margin-bottom: 0;
}

.rhdoc__panelBody :deep(ul),
.rhdoc__panelBody :deep(ol) {
  padding-left: 1.2rem;
  margin: 0.25rem 0 0.75rem;
}

.rhdoc__panelBody :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  border: 1px solid var(--border-light);
}

.rhdoc__panelBody :deep(a) {
  color: var(--color-primary);
  text-decoration: underline;
}

.rhdoc__panelBody :deep(strong),
.rhdoc__panelBody :deep(b) {
  color: inherit;
  font-weight: 700;
}

.rhdoc__panelEmpty {
  flex: 1;
  margin: 0;
  color: var(--text-tertiary);
  font-weight: 600;
}

.rhdoc__panel--pending {
  border-style: dashed;
  background: color-mix(in srgb, var(--bg-secondary) 88%, var(--bg-tertiary));
}

.rhdoc__panelPending {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 10px;
  padding: 8px 2px 4px;
}

.rhdoc__pendingBadge {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #334155;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.rhdoc__pendingText {
  margin: 0;
  max-width: 36ch;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-tertiary);
}

.rhdoc__extra {
  padding: 14px 6px 4px;
  border-top: 1px solid var(--border-light);
}

.rhdoc__empty {
  padding: 2rem;
  text-align: center;
  color: var(--text-tertiary);
}

@media (max-width: 900px) {
  .rhdoc__compare-row {
    grid-template-columns: 1fr;
    min-height: calc(100vh - 300px);
  }

  .rhdoc__panel {
    min-height: min(360px, 45vh);
  }
}
</style>
