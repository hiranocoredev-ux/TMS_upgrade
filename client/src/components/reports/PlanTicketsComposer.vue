<template>
  <div class="plan-doc-composer">
    <p v-if="loading" class="plan-doc-composer__state" role="status">Loading plan sections…</p>
    <p v-else-if="loadError" class="plan-doc-composer__error" role="alert">{{ loadError }}</p>

    <template v-else>
      <p class="plan-doc-composer__intro">
        Write your plan in each section below. Drag the handle on the left to change order. Removed
        sections will not appear on your report or in history. Your section list is remembered from your
        last plan.
      </p>

      <div class="plan-doc-sections sections-list">
        <div v-if="hasFinanceTicket" class="plan-ticket-row plan-ticket-row--pinned">
          <span class="plan-ticket-row__pin" aria-hidden="true" title="Always first">📌</span>
          <div class="plan-ticket-row__card">
            <FinanceTicketCard
              :period="period"
              :anchor-date="anchorDate"
              :user-id="userId"
              mode="plan"
              :editable="editable"
              :label="financeLabel"
              :model-value="financeNotes"
              @update:model-value="updateFinanceNotes"
              @status="onFinanceStatus"
            />
          </div>
        </div>

        <div
          v-for="(ticket, index) in tickets"
          :key="ticket.dragId"
          class="plan-ticket-row"
          :class="rowClass(index)"
          @dragover.prevent="onDragOver(index)"
          @dragleave="onDragLeave(index)"
          @drop.prevent="onDrop(index)"
        >
          <button
            v-if="editable"
            type="button"
            class="plan-ticket-row__handle"
            :draggable="true"
            title="Drag to reorder"
            aria-label="Drag to reorder section"
            @dragstart="onDragStart($event, index)"
            @dragend="onDragEnd"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <circle cx="5.5" cy="4" r="1.2" fill="currentColor" />
              <circle cx="10.5" cy="4" r="1.2" fill="currentColor" />
              <circle cx="5.5" cy="8" r="1.2" fill="currentColor" />
              <circle cx="10.5" cy="8" r="1.2" fill="currentColor" />
              <circle cx="5.5" cy="12" r="1.2" fill="currentColor" />
              <circle cx="10.5" cy="12" r="1.2" fill="currentColor" />
            </svg>
          </button>
          <div class="plan-ticket-row__card">
            <ReportSectionCard
              :title="ticket.title"
              :model-value="ticket.notes"
              :editable="editable"
              :readonly-title="true"
              :show-remove="editable"
              :can-collapse="true"
              :collapsed-by-default="false"
              :composer-label="formatTicketSequenceLabel(index + (hasFinanceTicket ? 1 : 0), ticket.title)"
              :composer-size="true"
              notes-placeholder="Type your plan here…"
              @update:model-value="(v) => updateTicketNotes(index, v)"
              @remove="removeTicket(index)"
            />
          </div>
        </div>
      </div>

      <button
        v-if="editable"
        type="button"
        class="btn-add-section"
        @click="showAddModal = true"
      >
        + Add custom ticket
      </button>
    </template>

    <PlanAddTicketModal
      v-model="showAddModal"
      :removed-defaults="removedDefaults"
      @add="addTicketFromModal"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import ReportSectionCard from './ReportSectionCard.vue';
import PlanAddTicketModal from './PlanAddTicketModal.vue';
import FinanceTicketCard from './FinanceTicketCard.vue';
import { FINANCE_TICKET_TITLES, isFinanceTicketTitle } from '../../services/reportFinance';
import { getPlanTicketTemplates } from '../../services/planTicketTemplates';
import {
  buildPlanTicketSections,
  planTicketRowsToSections,
  savePlanLayoutPreference,
  getRemovedDefaultTemplates,
  formatTicketSequenceLabel,
  normalizeTicketTitle
} from '../../utils/planTickets';

const props = defineProps({
  period: { type: String, default: 'daily' },
  anchorDate: { type: String, default: '' },
  savedDoc: { type: Object, default: null },
  previousPlanDoc: { type: Object, default: null },
  userId: { type: String, default: '' },
  editable: { type: Boolean, default: true }
});

const emit = defineEmits(['update:sections', 'finance-status']);

/** Monthly and weekly plans open with the income / outcome target. */
const hasFinanceTicket = computed(() => props.period === 'monthly' || props.period === 'weekly');
const financeLabel = computed(() => `1. ${FINANCE_TICKET_TITLES.plan}`);
const financeNotes = ref('');

function updateFinanceNotes(value) {
  financeNotes.value = value;
  emitSections();
}

function onFinanceStatus(status) {
  emit('finance-status', status);
}

/** Reads the saved finance description out of a document, and hands back the rest. */
function takeFinanceNotes(doc) {
  if (!hasFinanceTicket.value || !doc) return doc;
  const sections = Array.isArray(doc.sections) ? doc.sections : [];
  const found = sections.find((s) => isFinanceTicketTitle(s?.title));
  financeNotes.value = found?.notes != null ? String(found.notes) : financeNotes.value;
  return { ...doc, sections: sections.filter((s) => !isFinanceTicketTitle(s?.title)) };
}

/** The pinned block is never one of the draggable tickets. */
function withoutFinanceTicket(rows) {
  if (!hasFinanceTicket.value) return rows;
  return (Array.isArray(rows) ? rows : []).filter((row) => !isFinanceTicketTitle(row?.title));
}

const loading = ref(true);
const loadError = ref('');
const tickets = ref([]);
const allTemplates = ref([]);
const showAddModal = ref(false);
const dragFromIndex = ref(null);
const dropTargetIndex = ref(null);

const removedDefaults = computed(() =>
  getRemovedDefaultTemplates(tickets.value, allTemplates.value)
);

function ensureDragIds(list) {
  return (Array.isArray(list) ? list : []).map((t, i) => ({
    ...t,
    dragId:
      t.dragId ||
      `drag-${t.templateId || 'custom'}-${normalizeTicketTitle(t.title)}-${i}-${crypto.randomUUID?.() || Date.now()}`
  }));
}

function rowClass(index) {
  return {
    'plan-ticket-row--dragging': dragFromIndex.value === index,
    'plan-ticket-row--drop-target': dropTargetIndex.value === index && dragFromIndex.value !== index,
    'plan-ticket-row--no-handle': !props.editable
  };
}

function emitSections() {
  const sections = planTicketRowsToSections(tickets.value);
  if (hasFinanceTicket.value) {
    sections.unshift({ title: FINANCE_TICKET_TITLES.plan, notes: financeNotes.value || '' });
  }
  emit('update:sections', sections);
  if (props.userId) {
    savePlanLayoutPreference(props.userId, props.period, tickets.value);
  }
}

function updateTicketNotes(index, value) {
  if (!tickets.value[index]) return;
  tickets.value[index].notes = value;
  emitSections();
}

function removeTicket(index) {
  if (!props.editable || !tickets.value[index]) return;
  tickets.value.splice(index, 1);
  emitSections();
}

function addTicketFromModal(payload) {
  const title = String(payload?.title || '').trim();
  if (!title) return;
  const norm = normalizeTicketTitle(title);
  const exists = tickets.value.some((t) => normalizeTicketTitle(t.title) === norm);
  if (exists) return;
  tickets.value.push({
    dragId: `drag-new-${crypto.randomUUID?.() || Date.now()}`,
    templateId: payload.templateId || null,
    title,
    notes: '',
    isCustom: payload.isCustom !== false && !payload.templateId
  });
  emitSections();
}

function onDragStart(event, index) {
  if (!props.editable) return;
  dragFromIndex.value = index;
  dropTargetIndex.value = index;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(index));
  if (event.dataTransfer.setDragImage && event.currentTarget) {
    const row = event.currentTarget.closest('.plan-ticket-row');
    if (row) event.dataTransfer.setDragImage(row, 24, 20);
  }
}

function onDragEnd() {
  dragFromIndex.value = null;
  dropTargetIndex.value = null;
}

function onDragOver(index) {
  if (!props.editable || dragFromIndex.value === null) return;
  dropTargetIndex.value = index;
}

function onDragLeave(index) {
  if (dropTargetIndex.value === index) dropTargetIndex.value = null;
}

function onDrop(toIndex) {
  const from = dragFromIndex.value;
  if (from === null || !props.editable) {
    onDragEnd();
    return;
  }
  if (from !== toIndex) {
    const list = [...tickets.value];
    const [moved] = list.splice(from, 1);
    list.splice(toIndex, 0, moved);
    tickets.value = list;
    emitSections();
  }
  onDragEnd();
}

async function loadTemplatesAndMerge() {
  loading.value = true;
  loadError.value = '';
  try {
    const res = await getPlanTicketTemplates(props.period);
    const templates = res.data?.data || res.data || [];
    allTemplates.value = templates;
    tickets.value = ensureDragIds(
      withoutFinanceTicket(
        buildPlanTicketSections(takeFinanceNotes(props.savedDoc), templates, props.period, props.anchorDate, {
          previousPlanDoc: props.previousPlanDoc,
          userId: props.userId
        })
      )
    );
    emitSections();
  } catch (e) {
    loadError.value = e?.response?.data?.message || 'Failed to load plan tickets';
    allTemplates.value = [];
    tickets.value = ensureDragIds(
      withoutFinanceTicket(
        buildPlanTicketSections(takeFinanceNotes(props.savedDoc), [], props.period, props.anchorDate, {
          previousPlanDoc: props.previousPlanDoc,
          userId: props.userId
        })
      )
    );
    emitSections();
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
    props.previousPlanDoc?._id,
    props.userId
  ],
  () => {
    loadTemplatesAndMerge();
  }
);

onMounted(loadTemplatesAndMerge);
</script>

<style scoped>
.plan-doc-composer {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.plan-doc-composer__intro {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-tertiary);
  line-height: 1.5;
  max-width: 52rem;
}

.plan-doc-sections {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  width: 100%;
}

.plan-ticket-row {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  position: relative;
  border-radius: 10px;
  transition: box-shadow 0.15s ease, opacity 0.15s ease;
}

.plan-ticket-row--drop-target::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: -2px;
  height: 3px;
  border-radius: 2px;
  background: var(--color-primary, #2563eb);
  pointer-events: none;
}

.plan-ticket-row--dragging {
  opacity: 0.45;
}

.plan-ticket-row--dragging .plan-ticket-row__card {
  border-style: dashed;
}

.plan-ticket-row--no-handle .plan-ticket-row__card {
  width: 100%;
}

.plan-ticket-row__handle {
  flex-shrink: 0;
  margin-top: 0.55rem;
  width: 28px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  cursor: grab;
  touch-action: none;
}

.plan-ticket-row__handle:hover {
  color: #64748b;
  background: #f1f5f9;
  border-color: #e2e8f0;
}

.plan-ticket-row__handle:active {
  cursor: grabbing;
}

.plan-ticket-row__card {
  flex: 1;
  min-width: 0;
}

.plan-doc-composer__state,
.plan-doc-composer__error {
  font-size: 0.875rem;
  margin: 0;
}

.plan-doc-composer__error {
  color: #b91c1c;
}
</style>
