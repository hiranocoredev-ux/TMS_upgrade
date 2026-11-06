<template>
  <div class="report-doc-composer">
    <p v-if="loading" class="report-doc-composer__state" role="status">Loading report tickets…</p>
    <p v-else-if="loadError" class="report-doc-composer__error" role="alert">{{ loadError }}</p>
    <div v-else-if="noPlan" class="report-doc-composer__empty">
      <p><strong>No plan submitted for this period.</strong></p>
      <p>
        Submit your {{ period }} plan first. Your plan tickets will appear here so you can record
        work results for each item.
      </p>
    </div>
    <template v-else>
      <div class="report-doc-sections sections-list">
        <FinanceTicketCard
          v-if="hasFinanceTicket"
          class="report-doc-finance"
          :period="period"
          :anchor-date="anchorDate"
          :user-id="userId"
          mode="report"
          :editable="editable"
          :label="financeLabel"
          :model-value="financeNotes"
          @update:model-value="updateFinanceNotes"
          @status="onFinanceStatus"
        />

        <ReportTicketCard
          v-for="(ticket, index) in tickets"
          :key="ticketKey(ticket, index)"
          :title="formatTicketSequenceLabel(index + (hasFinanceTicket ? 1 : 0), ticket.title)"
          :plan-notes="ticket.planNotes"
          :model-value="ticket.notes"
          :checked="ticket.checked"
          :percent="ticket.percent"
          :editable="editable"
          :collapsed-by-default="false"
          :field-errors="errorsForIndex(index)"
          @update:model-value="(v) => updateNotes(index, v)"
          @update:checked="(v) => updateChecked(index, v)"
          @update:percent="(v) => updatePercent(index, v)"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue';
import ReportTicketCard from './ReportTicketCard.vue';
import FinanceTicketCard from './FinanceTicketCard.vue';
import { FINANCE_TICKET_TITLES, isFinanceTicketTitle } from '../../services/reportFinance';
import {
  buildReportTicketSections,
  reportTicketRowsToSections,
  findSubmittedPlanDoc,
  reportTicketFieldErrors
} from '../../utils/reportTickets';
import { formatTicketSequenceLabel } from '../../utils/planTickets';

const props = defineProps({
  period: { type: String, default: 'daily' },
  anchorDate: { type: String, default: '' },
  savedDoc: { type: Object, default: null },
  planDocs: { type: Array, default: () => [] },
  editable: { type: Boolean, default: true },
  validationErrors: { type: Array, default: () => [] },
  /** Whose figures the finance block reads; defaults to the signed-in user. */
  userId: { type: String, default: '' }
});

/** Monthly and weekly reports open with the income / outcome result. */
const hasFinanceTicket = computed(() => props.period === 'monthly' || props.period === 'weekly');
const financeLabel = computed(() => `1. ${FINANCE_TICKET_TITLES.report}`);
const financeNotes = ref('');
/** The achieved % the finance block reports, stored with the section. */
const financePercent = ref(null);

function onFinanceStatus(status) {
  financePercent.value = status?.percent ?? null;
  emitSections();
  emit('finance-status', status);
}

function errorsForIndex(index) {
  return reportTicketFieldErrors(props.validationErrors, index + (hasFinanceTicket.value ? 1 : 0));
}

const emit = defineEmits(['update:sections', 'finance-status']);

const loading = ref(false);
const loadError = ref('');
const tickets = ref([]);
const noPlan = ref(false);

function ticketKey(ticket, index) {
  return `${ticket.title}-${index}`;
}

function emitSections() {
  const sections = reportTicketRowsToSections(tickets.value);
  if (hasFinanceTicket.value) {
    // Saved as the report's first section, the way the plan saves its own.
    sections.unshift({
      title: FINANCE_TICKET_TITLES.report,
      notes: financeNotes.value || '',
      // Computed, not filled in — kept so history can read the result back.
      ...(financePercent.value === null ? {} : { percent: financePercent.value }),
    });
  }
  emit('update:sections', sections);
}

function updateFinanceNotes(value) {
  financeNotes.value = value;
  emitSections();
}

/** The plan's own finance block is shown by the card, not as a ticket to report on. */
function stripFinanceSection(doc) {
  if (!hasFinanceTicket.value || !doc) return doc;
  const sections = Array.isArray(doc.sections) ? doc.sections : [];
  return { ...doc, sections: sections.filter((s) => !isFinanceTicketTitle(s?.title)) };
}

/** Lifts the saved finance description out of a document, leaving the rest. */
function takeFinanceNotes(doc) {
  if (!hasFinanceTicket.value || !doc) return doc;
  const sections = Array.isArray(doc.sections) ? doc.sections : [];
  const found = sections.find((s) => isFinanceTicketTitle(s?.title));
  financeNotes.value = found?.notes != null ? String(found.notes) : financeNotes.value;
  return { ...doc, sections: sections.filter((s) => !isFinanceTicketTitle(s?.title)) };
}

function updateNotes(index, value) {
  if (!tickets.value[index]) return;
  tickets.value[index].notes = value;
  emitSections();
}

function updateChecked(index, value) {
  if (!tickets.value[index]) return;
  tickets.value[index].checked = value;
  emitSections();
}

function updatePercent(index, value) {
  if (!tickets.value[index]) return;
  tickets.value[index].percent = value;
  emitSections();
}

function mergeTickets() {
  loading.value = true;
  loadError.value = '';
  try {
    const submittedPlan = findSubmittedPlanDoc(props.planDocs, props.anchorDate, props.period);
    const planDoc = stripFinanceSection(submittedPlan);
    const planRows = planDoc?.sections?.length;
    noPlan.value = !submittedPlan;
    tickets.value = buildReportTicketSections(
      takeFinanceNotes(props.savedDoc),
      planDoc,
      props.period,
      props.anchorDate
    );
    emitSections();
  } catch (e) {
    loadError.value = e?.message || 'Failed to build report tickets';
    tickets.value = [];
  } finally {
    loading.value = false;
  }
}

watch(
  () => [
    props.period,
    props.anchorDate,
    props.savedDoc?._id,
    props.savedDoc?.state,
    props.planDocs?.length
  ],
  mergeTickets
);

onMounted(mergeTickets);
</script>

<style scoped>
.report-doc-composer {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.report-doc-sections {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  width: 100%;
}

.report-doc-composer__state,
.report-doc-composer__error,
.report-doc-composer__empty {
  margin: 0;
  font-size: 0.875rem;
  padding: 1.5rem 1rem;
  text-align: center;
  border-radius: 10px;
  border: 1px dashed var(--border-medium);
  background: var(--bg-secondary);
  color: var(--text-tertiary);
}

.report-doc-composer__error {
  color: #b91c1c;
  border-color: #fecaca;
  background: #fef2f2;
}

.report-doc-composer__empty p {
  margin: 0 0 0.5rem;
}

.report-doc-composer__empty p:last-child {
  margin-bottom: 0;
}
</style>
