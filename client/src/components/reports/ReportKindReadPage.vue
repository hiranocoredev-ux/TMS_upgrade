<template>
  <div class="rkdoc">
    <header class="rkdoc__toolbar">
      <div class="rkdoc__statusWrap">
        <div
          v-if="statusText"
          class="rkdoc__status"
          :class="statusClass"
          role="status"
        >
          <span class="rkdoc__statusLabel">{{ statusText }}</span>
        </div>
      </div>
      <div class="rkdoc__actions">
        <slot name="actions" />
      </div>
    </header>

    <div class="rkdoc__titleBlock">
      <h2 class="rkdoc__title">
        {{ titleParts.primary }}<span v-if="titleParts.range" class="rkdoc__titleRange"> ({{ titleParts.range }})</span>
      </h2>
      <div v-if="metaLine" class="rkdoc__meta">{{ metaLine }}</div>
    </div>

    <hr class="rkdoc__sep" />

    <ReportHistoryMemberSummaryBar
      v-if="showSummary && userId && anchorDate"
      :user-id="userId"
      :anchor-date="anchorDate"
      :period="period"
      :ticket-progress-average="ticketProgressAverage"
      :show-ticket-progress="showTicketProgressInSummary"
      :ticket-count="displayTickets.length"
    />

    <div v-if="readView" class="rkdoc__body">
      <div v-if="readView.pending" class="rkdoc__pending" role="status">
        <span class="rkdoc__pendingBadge">Not submitted yet</span>
        <p class="rkdoc__pendingText">{{ pendingText }}</p>
      </div>

      <div v-else-if="isReportTicketView" class="rkdoc__ticket-stack">
        <template v-for="(ticket, idx) in displayTickets" :key="`rt-${idx}-${ticket.title}`">
          <FinanceTicketCard
            v-if="isFinanceTicket(ticket)"
            class="rkdoc__finance"
            :period="period"
            :anchor-date="anchorDate || readView?.anchorDate"
            :user-id="userId"
            :mode="financeMode"
            :editable="false"
            :label="formatTicketSequenceLabel(idx, ticket.title)"
            :model-value="ticket.notes"
          />
        </template>
        <ReportTicketCard
          v-for="(ticket, idx) in displayTickets"
          v-show="!isFinanceTicket(ticket)"
          :key="`rt-${idx}-${ticket.title}`"
          :title="formatTicketSequenceLabel(idx, ticket.title)"
          :plan-notes="ticket.planNotes"
          :model-value="ticket.notes"
          :checked="ticket.checked"
          :percent="ticket.percent"
          :editable="false"
          :can-collapse="false"
        />
      </div>

      <template v-else-if="displayTickets.length">
        <FinanceTicketCard
          v-for="(ticket, idx) in displayTickets.filter(isFinanceTicket)"
          :key="`fin-${idx}`"
          class="rkdoc__finance"
          :period="period"
          :anchor-date="anchorDate || readView?.anchorDate"
          :user-id="userId"
          :mode="financeMode"
          :editable="false"
          :label="formatTicketSequenceLabel(0, ticket.title)"
          :model-value="ticket.notes"
        />
        <section
          v-for="(ticket, idx) in displayTickets"
          v-show="!isFinanceTicket(ticket)"
          :key="`ticket-${idx}-${ticket.title}`"
          class="rkdoc__ticket"
        >
          <h3 class="rkdoc__panelTitle">{{ formatTicketSequenceLabel(idx, ticket.title) }}</h3>
          <div
            v-if="hasHtml(ticket.notes)"
            class="rkdoc__panelBody"
            v-html="ticket.notes"
          />
          <p v-else class="rkdoc__panelEmpty">—</p>
        </section>
      </template>

      <template v-else-if="readView.main">
        <article class="rkdoc__panel">
          <h3 class="rkdoc__panelTitle">{{ readView.main.label }}</h3>
          <p class="rkdoc__panelHint">{{ panelHint }}</p>
          <div
            v-if="hasHtml(readView.main.notes)"
            class="rkdoc__panelBody"
            v-html="readView.main.notes"
          />
          <p v-else class="rkdoc__panelEmpty">—</p>
        </article>

        <section
          v-for="(extra, idx) in readView.extras || []"
          :key="`extra-${idx}`"
          class="rkdoc__extra"
        >
          <h3 class="rkdoc__panelTitle">{{ extra.title || `Section ${idx + 1}` }}</h3>
          <div
            v-if="hasHtml(extra.notes)"
            class="rkdoc__panelBody"
            v-html="extra.notes"
          />
          <p v-else class="rkdoc__panelEmpty">—</p>
        </section>
      </template>
    </div>
    <p v-else class="rkdoc__empty">No content</p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { getReportDocumentTitleParts } from '../../utils/reportPeriod';
import { isPlanKind } from '../../constants/documentKind';
import { formatTicketSequenceLabel } from '../../utils/planTickets';
import { averageTicketPercentFromTickets } from '../../utils/reportTickets';
import ReportHistoryMemberSummaryBar from './ReportHistoryMemberSummaryBar.vue';
import ReportTicketCard from './ReportTicketCard.vue';
import FinanceTicketCard from './FinanceTicketCard.vue';
import { isFinanceTicketTitle } from '../../utils/financeTicket';

const props = defineProps({
  readView: { type: Object, default: null },
  period: { type: String, default: 'daily' },
  userId: { type: String, default: '' },
  anchorDate: { type: String, default: '' },
  documentKind: { type: String, default: 'report' },
  statusText: { type: String, default: '' },
  statusClass: { type: String, default: '' },
  metaLine: { type: String, default: '' },
  showSummary: { type: Boolean, default: true }
});

const titleParts = computed(() =>
  getReportDocumentTitleParts(props.anchorDate || props.readView?.anchorDate, props.period)
);

/**
 * The income / outcome block is shown with its figures — target, result and the
 * transactions behind them — wherever a document is read: history, a boss's
 * review, or the member's own document view.
 */
const isFinanceTicket = (ticket) =>
  (props.period === 'monthly' || props.period === 'weekly') && isFinanceTicketTitle(ticket?.title);

const financeMode = computed(() => (props.documentKind === 'plan' ? 'plan' : 'report'));

const displayTickets = computed(() => {
  const list = props.readView?.tickets;
  return Array.isArray(list) ? list : [];
});

const isReportTicketView = computed(
  () => !isPlanKind(props.documentKind) && displayTickets.value.length > 0
);

const showTicketProgressInSummary = computed(
  () =>
    isReportTicketView.value &&
    !props.readView?.pending &&
    ticketProgressAverage.value != null
);

const ticketProgressAverage = computed(() => {
  if (!isReportTicketView.value || props.readView?.pending) return null;
  return averageTicketPercentFromTickets(displayTickets.value);
});

const panelHint = computed(() => {
  if (isPlanKind(props.documentKind)) {
    return 'Plan for this period';
  }
  return 'Work result for this period';
});

const pendingText = computed(() => {
  if (isPlanKind(props.documentKind)) {
    return 'No plan has been submitted for this period yet.';
  }
  return 'No work result has been submitted for this period yet.';
});

function hasHtml(notes) {
  const raw = String(notes || '').trim();
  if (!raw) return false;
  return raw.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim().length > 0;
}
</script>

<style scoped>
.rkdoc {
  width: 100%;
  max-width: min(1320px, 100%);
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

.rkdoc__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.rkdoc__title {
  margin: 0;
  font-size: clamp(1.2rem, 2vw, 1.45rem);
  font-weight: 650;
  color: var(--text-primary);
}

.rkdoc__titleRange {
  font-size: 0.85em;
  font-weight: 600;
  color: var(--text-secondary);
}

.rkdoc__meta {
  margin-top: 4px;
  font-size: 0.8125rem;
  color: var(--text-tertiary);
}

.rkdoc__sep {
  border: 0;
  border-top: 1px solid var(--border-light);
  margin: 12px 0 16px;
}

.rkdoc__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.rkdoc__ticket-stack {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  width: 100%;
}

.rkdoc__panel,
.rkdoc__ticket {
  padding: 14px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
}

.rkdoc__panel {
  flex: 1;
  min-height: min(360px, 50vh);
}

.rkdoc__panelTitle {
  margin: 0 0 4px;
  font-size: 1.125rem;
  font-weight: 650;
  color: var(--text-primary);
}

.rkdoc__panelHint {
  margin: 0 0 12px;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.rkdoc__panelBody {
  color: var(--text-secondary);
  line-height: 1.65;
  font-size: 0.9375rem;
  word-break: break-word;
}

.rkdoc__panelBody :deep(p) {
  margin: 0 0 0.75rem;
}

.rkdoc__panelEmpty {
  color: var(--text-tertiary);
  font-weight: 600;
}

.rkdoc__pending {
  padding: 12px 4px;
}

.rkdoc__pendingBadge {
  display: inline-flex;
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #334155;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.rkdoc__pendingText {
  margin: 10px 0 0;
  font-size: 0.875rem;
  color: var(--text-tertiary);
}

.rkdoc__extra {
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
}

.rkdoc__empty {
  text-align: center;
  color: var(--text-tertiary);
  padding: 2rem;
}

.rkdoc__status {
  display: inline-flex;
  padding: 0.4rem 0.85rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.rkdoc__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 6px;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  background: var(--bg-tertiary);
}
</style>
