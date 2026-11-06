<template>
  <div class="rdoc" :class="{ 'rdoc--side-by-side': useSideBySideCore }">
    <header class="rdoc__toolbar">
      <div class="rdoc__statusWrap">
        <div
          v-if="statusText"
          class="rdoc__status"
          :class="statusClass"
          role="status"
        >
          <span class="rdoc__statusLabel">{{ statusText }}</span>
        </div>
      </div>
      <div class="rdoc__actions">
        <slot name="actions" />
      </div>
    </header>

    <div class="rdoc__titleBlock">
      <h2 class="rdoc__title">
        {{ titleParts.primary }}<span
          v-if="titleParts.range"
          class="rdoc__titleRange"
        > ({{ titleParts.range }})</span>
      </h2>
      <div v-if="metaLine" class="rdoc__meta">{{ metaLine }}</div>
    </div>

    <hr class="rdoc__sep" />

    <div v-if="useSideBySideCore && sideBySide" class="rdoc__compare">
      <div class="rdoc__compare-row">
        <article class="rdoc__panel">
          <h3 class="rdoc__panelTitle">{{ sideBySide.workResult.label }}</h3>
          <p class="rdoc__panelHint">{{ workResultHint }}</p>
          <div
            v-if="hasHtml(sideBySide.workResult.notes)"
            class="rdoc__panelBody"
            v-html="sideBySide.workResult.notes"
          />
          <p v-else class="rdoc__panelEmpty">—</p>
        </article>
        <article class="rdoc__panel">
          <h3 class="rdoc__panelTitle">{{ sideBySide.nextPlan.label }}</h3>
          <p class="rdoc__panelHint">{{ nextPlanHint }}</p>
          <div
            v-if="hasHtml(sideBySide.nextPlan.notes)"
            class="rdoc__panelBody"
            v-html="sideBySide.nextPlan.notes"
          />
          <p v-else class="rdoc__panelEmpty">—</p>
        </article>
      </div>
      <section
        v-for="(extra, idx) in sideBySide.extras"
        :key="`extra-${idx}`"
        class="rdoc__extra"
      >
        <h3 class="rdoc__panelTitle">{{ extra.title || `Section ${idx + 1}` }}</h3>
        <div
          v-if="hasHtml(extra.notes)"
          class="rdoc__panelBody"
          v-html="extra.notes"
        />
        <p v-else class="rdoc__panelEmpty">—</p>
      </section>
    </div>
    <div v-else-if="sections.length" class="rdoc__body">
      <section v-for="(s, idx) in sections" :key="idx" class="rdoc__section">
        <h3 class="rdoc__sectionTitle">{{ s.title || `Section ${idx + 1}` }}</h3>
        <div
          class="rdoc__sectionContent"
          v-html="s.notes || ''"
        />
        <div v-if="!s.notes" class="rdoc__sectionEmpty">-</div>
      </section>
    </div>
    <div v-else class="rdoc__empty">No content</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import {
  buildSubmittedReportSideBySide,
  getReportDocumentTitleParts,
  REPORT_PERIODS
} from '../../utils/reportPeriod';

const props = defineProps({
  report: { type: Object, default: null },
  period: { type: String, default: 'daily' },
  dateKey: { type: String, default: '' },
  statusText: { type: String, default: '' },
  statusClass: { type: String, default: '' },
  metaLine: { type: String, default: '' },
  omitCarrySection: { type: Boolean, default: false },
  /** Daily / weekly / monthly: show work result and next plan side by side. */
  sideBySideCoreSections: { type: Boolean, default: false }
});

const titleParts = computed(() => getReportDocumentTitleParts(props.dateKey, props.period));

const rawSections = computed(() => {
  const raw = props.report?.sections || [];
  if (props.omitCarrySection && raw.length > 1) return raw.slice(1);
  return raw;
});

const useSideBySideCore = computed(
  () => props.sideBySideCoreSections && rawSections.value.length >= 2
);

const sideBySide = computed(() => {
  if (!useSideBySideCore.value) return null;
  return buildSubmittedReportSideBySide(rawSections.value, props.period, props.dateKey);
});

const sections = computed(() => {
  if (useSideBySideCore.value) return [];
  return rawSections.value;
});

const workResultHint = 'Work result for this reporting period';

const nextPlanHint = computed(() => {
  if (props.period === REPORT_PERIODS.WEEKLY) return 'Plan for the next week';
  if (props.period === REPORT_PERIODS.MONTHLY) return 'Plan for the next month';
  return 'Plan for the next day';
});

function hasHtml(notes) {
  const raw = String(notes || '').trim();
  if (!raw) return false;
  const text = raw.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim();
  return text.length > 0;
}
</script>

<style scoped>
.rdoc {
  width: 100%;
  max-width: min(1240px, 100%);
  margin: 0 auto;
  padding: clamp(14px, 2vw, 22px);
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
  box-sizing: border-box;
}

.rdoc--side-by-side {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.rdoc__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.rdoc__titleBlock {
  min-width: 0;
  width: 100%;
}

.rdoc__title {
  margin: 0;
  padding: 0;
  font-size: clamp(1.3rem, 2.2vw, 2rem);
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  word-break: break-word;
}

.rdoc__titleRange {
  font-size: 0.7em;
  font-weight: 700;
  color: var(--text-secondary);
}

.rdoc__meta {
  margin-top: 4px;
  font-size: 0.82rem;
  color: var(--text-secondary);
  line-height: 1.35;
}

.rdoc__statusWrap {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  min-width: 0;
}

.rdoc__status {
  --rdoc-status-dot: #64748b;
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  max-width: 100%;
  padding: 0.55rem 1.15rem 0.55rem 0.85rem;
  border-radius: 9999px;
  border: 1.5px solid transparent;
  font-size: clamp(0.78rem, 1.35vw, 0.9rem);
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.15;
  white-space: nowrap;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.65) inset,
    0 2px 8px rgba(15, 23, 42, 0.06);
}

.rdoc__status::before {
  content: '';
  flex-shrink: 0;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--rdoc-status-dot);
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.95),
    0 1px 3px rgba(15, 23, 42, 0.2);
}

.rdoc__statusLabel {
  overflow: hidden;
  text-overflow: ellipsis;
}

.rdoc__status.status-approved {
  color: #14532d;
  border-color: rgba(22, 163, 74, 0.45);
  background: linear-gradient(160deg, #ecfdf5 0%, #d1fae5 55%, #bbf7d0 100%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.7) inset,
    0 3px 10px rgba(22, 163, 74, 0.14),
    0 8px 24px rgba(22, 163, 74, 0.08);
}

.rdoc__status.status-approved::before {
  background: linear-gradient(145deg, #86efac, #15803d);
}

.rdoc__status.status-pending {
  color: #1e3a8a;
  border-color: rgba(37, 99, 235, 0.42);
  background: linear-gradient(160deg, #eff6ff 0%, #dbeafe 50%, #bfdbfe 100%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.75) inset,
    0 3px 12px rgba(37, 99, 235, 0.18),
    0 10px 28px rgba(37, 99, 235, 0.1);
}

.rdoc__status.status-pending::before {
  background: linear-gradient(145deg, #93c5fd, #1d4ed8);
  animation: rdocStatusPulse 2.4s ease-in-out infinite;
}

@keyframes rdocStatusPulse {
  0%,
  100% {
    box-shadow:
      0 0 0 2px rgba(255, 255, 255, 0.95),
      0 0 0 0 rgba(37, 99, 235, 0.45);
  }
  50% {
    box-shadow:
      0 0 0 2px rgba(255, 255, 255, 0.95),
      0 0 0 7px rgba(37, 99, 235, 0);
  }
}

.rdoc__status.status-rejected {
  color: #7f1d1d;
  border-color: rgba(220, 38, 38, 0.4);
  background: linear-gradient(160deg, #fef2f2 0%, #fee2e2 55%, #fecaca 100%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.65) inset,
    0 3px 10px rgba(220, 38, 38, 0.12),
    0 8px 22px rgba(220, 38, 38, 0.08);
}

.rdoc__status.status-rejected::before {
  background: linear-gradient(145deg, #fca5a5, #b91c1c);
}

.rdoc__status.status-draft {
  --rdoc-status-dot: #64748b;
  color: #334155;
  border-color: rgba(100, 116, 139, 0.35);
  background: linear-gradient(160deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.8) inset,
    0 2px 8px rgba(15, 23, 42, 0.05);
}

.rdoc__status.status-draft::before {
  background: linear-gradient(145deg, #cbd5e1, #475569);
}

.rdoc__status.status-awaiting {
  color: #78350f;
  border-color: rgba(217, 119, 6, 0.4);
  background: linear-gradient(160deg, #fffbeb 0%, #fef3c7 55%, #fde68a 100%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.7) inset,
    0 3px 10px rgba(217, 119, 6, 0.14),
    0 8px 22px rgba(245, 158, 11, 0.1);
}

.rdoc__status.status-awaiting::before {
  background: linear-gradient(145deg, #fcd34d, #b45309);
  animation: rdocStatusWarmPulse 2.6s ease-in-out infinite;
}

@keyframes rdocStatusWarmPulse {
  0%,
  100% {
    box-shadow:
      0 0 0 2px rgba(255, 255, 255, 0.95),
      0 0 0 0 rgba(217, 119, 6, 0.4);
  }
  50% {
    box-shadow:
      0 0 0 2px rgba(255, 255, 255, 0.95),
      0 0 0 6px rgba(217, 119, 6, 0);
  }
}

.rdoc__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  padding: 6px;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  background: var(--bg-tertiary);
}

.rdoc__sep {
  border: 0;
  border-top: 1px solid var(--border-light);
  margin: 10px 0 14px;
}

.rdoc__toolbar,
.rdoc__titleBlock,
.rdoc__sep {
  flex-shrink: 0;
}

.rdoc__actions :deep(.btn) {
  height: 34px;
  padding: 0 14px;
  border-radius: 9px;
  border: 1px solid var(--border-medium);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.82rem;
  font-weight: 650;
  line-height: 1;
  letter-spacing: 0.01em;
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.02);
  transition: all 0.15s ease;
}

.rdoc__actions :deep(.btn:hover) {
  transform: translateY(-1px);
  border-color: var(--border-dark);
  box-shadow: var(--shadow-sm);
}

.rdoc__actions :deep(.btn:active) {
  transform: translateY(0);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

.rdoc__actions :deep(.btn-primary) {
  background: var(--color-primary-dark);
  color: var(--text-inverse);
  border-color: var(--color-primary-dark);
}

.rdoc__actions :deep(.btn-primary:hover) {
  filter: brightness(1.08);
  border-color: var(--color-primary-dark);
}

.rdoc__actions :deep(.btn-danger) {
  background: color-mix(in srgb, var(--color-error) 14%, var(--bg-primary));
  color: var(--color-error);
  border-color: color-mix(in srgb, var(--color-error) 35%, var(--border-light));
}

.rdoc__actions :deep(.btn-danger:hover) {
  background: color-mix(in srgb, var(--color-error) 22%, var(--bg-primary));
  border-color: var(--color-error);
}

.rdoc__actions :deep(.btn-neutral),
.rdoc__actions :deep(.btn-secondary) {
  background: var(--bg-primary);
  color: var(--text-secondary);
  border-color: var(--border-medium);
}

.rdoc__actions :deep(.report-toolbar-icon-btn) {
  width: 34px;
  min-width: 34px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.rdoc__actions :deep(.report-toolbar-icon-btn__icon) {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.rdoc__compare {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 1rem;
}

.rdoc__compare-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  align-items: stretch;
  flex: 1;
  min-height: min(420px, 55vh);
}

.rdoc__panel {
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

.rdoc__panelTitle {
  margin: 0 0 4px;
  font-size: 1.125rem;
  font-weight: 650;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  flex-shrink: 0;
}

.rdoc__panelHint {
  margin: 0 0 12px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-tertiary);
  line-height: 1.35;
  flex-shrink: 0;
}

.rdoc__panelBody {
  flex: 1;
  overflow: auto;
  color: var(--text-secondary);
  line-height: 1.65;
  font-size: 0.9375rem;
  word-break: break-word;
}

.rdoc__panelBody :deep(p) {
  margin: 0 0 0.75rem;
}

.rdoc__panelBody :deep(p:last-child) {
  margin-bottom: 0;
}

.rdoc__panelBody :deep(ul),
.rdoc__panelBody :deep(ol) {
  padding-left: 1.2rem;
  margin: 0.25rem 0 0.75rem;
}

.rdoc__panelBody :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  border: 1px solid var(--border-light);
}

.rdoc__panelBody :deep(a) {
  color: var(--color-primary);
  text-decoration: underline;
}

.rdoc__panelBody :deep(strong),
.rdoc__panelBody :deep(b) {
  color: inherit;
  font-weight: 700;
}

.rdoc__panelEmpty {
  flex: 1;
  margin: 0;
  color: var(--text-tertiary);
  font-weight: 600;
}

.rdoc__extra {
  padding: 14px 6px 4px;
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
}

.rdoc__body {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.rdoc__section {
  padding: 14px 6px 18px;
  border-bottom: 1px solid var(--border-light);
}

.rdoc__section:last-child {
  border-bottom: none;
}

.rdoc__sectionTitle {
  margin: 0 0 14px;
  font-size: clamp(1rem, 1.5vw, 1.1rem);
  font-weight: 750;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.rdoc__sectionContent {
  color: var(--text-secondary);
  line-height: 1.65;
  font-size: 0.95rem;
  word-break: break-word;
}

.rdoc__sectionContent :deep(p) {
  margin: 0 0 0.75rem;
}
.rdoc__sectionContent :deep(p:last-child) {
  margin-bottom: 0;
}
.rdoc__sectionContent :deep(ul),
.rdoc__sectionContent :deep(ol) {
  padding-left: 1.2rem;
  margin: 0.25rem 0 0.75rem;
}
.rdoc__sectionContent :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 10px;
  border: 1px solid var(--border-light);
}
.rdoc__sectionContent :deep(a) {
  color: var(--color-primary);
  text-decoration: underline;
}

.rdoc__sectionContent :deep(strong),
.rdoc__sectionContent :deep(b) {
  color: inherit;
  font-weight: 700;
}

.rdoc__sectionEmpty {
  color: var(--text-tertiary);
  font-weight: 600;
}

.rdoc__empty {
  color: var(--text-tertiary);
  text-align: center;
  padding: 22px 16px;
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .rdoc__status.status-pending::before,
  .rdoc__status.status-awaiting::before {
    animation: none;
  }
}

@media (max-width: 900px) {
  .rdoc__compare-row {
    grid-template-columns: 1fr;
    min-height: min(360px, 45vh);
  }

  .rdoc__panel {
    min-height: min(320px, 40vh);
  }
}

@media (max-width: 640px) {
  .rdoc {
    padding: 12px;
    border-radius: 12px;
  }

  .rdoc__status {
    padding: 0.5rem 1rem 0.5rem 0.75rem;
    font-size: clamp(0.72rem, 3.2vw, 0.82rem);
  }

  .rdoc__toolbar {
    align-items: stretch;
  }

  .rdoc__actions {
    justify-content: flex-start;
    width: 100%;
    padding: 4px;
  }

  .rdoc__actions :deep(.btn:not(.report-toolbar-icon-btn)) {
    flex: 1 1 calc(50% - 6px);
    min-width: 104px;
  }

  .rdoc__actions :deep(.report-toolbar-icon-btn) {
    flex: 0 0 auto;
  }
}
</style>

<style>
[data-theme='dark'] .rdoc__sectionContent span[style*='#111827'],
[data-theme='dark'] .rdoc__sectionContent span[style*='#1f2937'],
[data-theme='dark'] .rdoc__sectionContent span[style*='#0f172a'],
[data-theme='dark'] .rdoc__sectionContent span[style*='#334155'],
[data-theme='dark'] .rdoc__sectionContent span[style*='#475569'],
[data-theme='dark'] .rdoc__panelBody span[style*='#111827'],
[data-theme='dark'] .rdoc__panelBody span[style*='#1f2937'],
[data-theme='dark'] .rdoc__panelBody span[style*='#0f172a'],
[data-theme='dark'] .rdoc__panelBody span[style*='#334155'],
[data-theme='dark'] .rdoc__panelBody span[style*='#475569'] {
  color: var(--text-secondary) !important;
}

[data-theme='dark'] .rdoc__sectionContent li,
[data-theme='dark'] .rdoc__panelBody li {
  color: inherit;
}

[data-theme='dark'] .rdoc__sectionContent :where(ul, ol),
[data-theme='dark'] .rdoc__panelBody :where(ul, ol) {
  color: var(--text-secondary);
}
</style>

