<template>
  <div
    class="report-view"
    :class="{
      'report-composer-page': kindPeriodLayout && (!useDocumentLayout || useKindReadLayout),
      'report-history-compare-host': useKindReadLayout,
      'report-history-edit-host': embeddedFromHistory && !useDocumentLayout
    }"
  >
    <div class="report-card" :class="{ 'report-card--document': useDocumentLayout || useKindReadLayout }">
      <div v-if="report">
        <div v-if="rejectReasonText" class="reject-warning">
          <strong>Rejected Reason</strong>
          <p>{{ rejectReasonText }}</p>
        </div>
        <ReportKindReadPage
          v-if="useKindReadLayout"
          :read-view="kindReadView"
          :period="period"
          :user-id="String(report.userId || authStore.user?.id || '')"
          :anchor-date="date"
          :document-kind="documentKind"
          :status-text="statusText"
          :status-class="statusClass"
          :meta-line="`${authStore.user?.name || 'Member'}${authStore.user?.group ? ` · ${authStore.user.group}` : ''}`"
          :show-summary="documentKind === 'report' && period === 'daily'"
        >
          <template #actions>
            <ReportToolbarExportPrint @export-doc="handleExportDoc" @print="handlePrint" />
            <button
              v-if="showActions"
              type="button"
              class="btn btn-neutral"
              title="Switch to edit panel"
              @click="viewMode = 'edit'"
            >
              Edit
            </button>
          </template>
        </ReportKindReadPage>

        <ReportDocumentPage
          v-else-if="useDocumentLayout"
          :report="report"
          :period="period"
          :date-key="date"
          :status-text="statusText"
          :status-class="statusClass"
          :omit-carry-section="false"
          :side-by-side-core-sections="false"
          :meta-line="`${authStore.user?.name || 'Member'}${authStore.user?.group ? ` · ${authStore.user.group}` : ''}`"
        >
          <template #actions>
            <ReportToolbarExportPrint @export-doc="handleExportDoc" @print="handlePrint" />
            <button
              v-if="showActions"
              type="button"
              class="btn btn-neutral"
              title="Switch to edit panel"
              @click="viewMode = 'edit'"
            >
              Edit
            </button>
          </template>
        </ReportDocumentPage>

        <div v-else class="report-body report-composer-body">
          <header class="report-header">
            <div class="header-left">
              <h2 class="document-title">{{ composerPageTitle }}</h2>
            </div>
            <div class="header-right">
              <div v-if="state === 6" class="status-badge status-approved" role="status">
                <span class="status-badge__label">Approved</span>
              </div>
              <div v-if="state === 5" class="status-badge status-awaiting" role="status">
                <span class="status-badge__label">Awaiting team approval</span>
              </div>
              <div v-if="state === 2" class="status-badge status-pending" role="status">
                <span class="status-badge__label">Pending</span>
              </div>
              <div v-if="[3, 4].includes(state)" class="status-badge status-rejected" role="status">
                <span class="status-badge__label">Rejected</span>
              </div>
              <div class="header-actions">
                <button
                  v-if="showActions"
                  type="button"
                  class="btn btn-secondary"
                  title="Save draft"
                  @click="saveReport"
                >
                  Save Draft
                </button>
                <button
                  v-if="showActions"
                  type="button"
                  class="btn btn-primary"
                  :disabled="financeBlocksSubmit"
                  :title="financeBlocksSubmit ? financeBlockReason : 'Submit for review'"
                  @click="submitReport"
                >
                  Submit
                </button>
                <button
                  type="button"
                  class="btn btn-neutral"
                  title="Back to document view"
                  @click="viewMode = 'document'"
                >
                  View
                </button>
              </div>
            </div>
          </header>

          <PlanTicketsComposer
            v-if="usePlanTicketsComposer"
            :period="period"
            :anchor-date="date"
            :saved-doc="savedPlanDoc"
            :previous-plan-doc="previousPlanDoc"
            :user-id="String(authStore.user?.id || '')"
            :editable="isEditable"
            @update:sections="onPlanSectionsUpdate"
            @finance-status="onFinanceStatus"
          />

          <ReportTicketsComposer
            v-else-if="useReportTicketsComposer"
            :period="period"
            :anchor-date="date"
            :saved-doc="report"
            :plan-docs="loadedPlanDocs"
            :user-id="String(report?.userId || authStore.user?.id || '')"
            :editable="isEditable"
            :validation-errors="reportTicketValidation"
            @update:sections="onReportSectionsUpdate"
          />

          <div v-else class="sections-list">
            <template v-if="kindPeriodLayout">
              <ReportSectionCard
                v-for="index in coreSectionIndexes"
                :key="index"
                :title="report.sections[index].title"
                :model-value="report.sections[index].notes"
                :editable="sectionNotesEditable(index)"
                :readonly-title="true"
                :show-remove="false"
                :composer-label="sectionComposerDisplay(index).label"
                :composer-subtitle="sectionComposerDisplay(index).subtitle"
                :section-hint="sectionComposerDisplay(index).hint"
                :composer-size="true"
                :title-placeholder="sectionPlaceholders(index).title"
                :notes-placeholder="sectionPlaceholders(index).notes"
                @update:title="(v) => updateSectionTitle(index, v)"
                @update:model-value="(v) => updateSectionNotes(index, v)"
              />
              <ReportSectionCard
                v-for="index in extraSectionIndexes"
                :key="index"
                :title="report.sections[index].title"
                :model-value="report.sections[index].notes"
                :editable="sectionNotesEditable(index)"
                :readonly-title="false"
                :show-remove="sectionShowRemove(index)"
                :title-placeholder="sectionPlaceholders(index).title"
                :notes-placeholder="sectionPlaceholders(index).notes"
                @update:title="(v) => updateSectionTitle(index, v)"
                @update:model-value="(v) => updateSectionNotes(index, v)"
                @remove="removeSectionAt(index)"
              />
            </template>
            <template v-else>
              <ReportSectionCard
                v-for="(section, index) in report.sections"
                :key="index"
                :title="section.title"
                :model-value="section.notes"
                :editable="sectionNotesEditable(index)"
                :readonly-title="false"
                :show-remove="showActions && report.sections.length > 1"
                :title-placeholder="sectionPlaceholders(index).title"
                :notes-placeholder="sectionPlaceholders(index).notes"
                @update:title="(v) => updateSectionTitle(index, v)"
                @update:model-value="(v) => updateSectionNotes(index, v)"
                @remove="removeSectionAt(index)"
              />
            </template>
          </div>
          <button
            v-if="showActions && !usePlanTicketsComposer && !useReportTicketsComposer"
            type="button"
            class="btn-add-section"
            title="Add section"
            @click="addSection"
          >
            + Add Section
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../composables/useAuth';
import { getDocumentsByUser, updateDocument } from '../services/periodDocuments';
import { DOCUMENT_KIND, getDocumentKindFromRoute, isPlanKind } from '../constants/documentKind';
import {
  getReportPeriod,
  normalizeDateForPeriod,
  getReportDocumentTitleParts,
  REPORT_PERIODS,
  getReportSectionPlaceholders,
  getKindComposerPageTitle,
  getKindSectionDisplay,
  rebuildKindSections,
  buildKindDocumentReadView,
  sectionsFromKindReadView,
  sectionsForReportPersistence,
  sectionsForDocumentBody
} from '../utils/reportPeriod';
import { buildReportExportHtml, exportReportAsDoc, printReportHtml } from '../utils/reportDocumentExport';
import { useToast } from 'vue-toastification';
import { useReportHistorySidebarRefresh } from '../composables/useReportHistorySidebarRefresh';
import ReportSectionCard from '../components/reports/ReportSectionCard.vue';
import PlanTicketsComposer from '../components/reports/PlanTicketsComposer.vue';
import { findLatestPlanDoc } from '../utils/planTickets';
import { validateReportTicketSections } from '../utils/reportTickets';
import ReportTicketsComposer from '../components/reports/ReportTicketsComposer.vue';
import ReportDocumentPage from '../components/reports/ReportDocumentPage.vue';
import ReportKindReadPage from '../components/reports/ReportKindReadPage.vue';
import ReportToolbarExportPrint from '../components/reports/ReportToolbarExportPrint.vue';

const props = defineProps({
  p_id: { type: String, default: '' }
});

const toast = useToast();
const refreshReportHistorySidebar = useReportHistorySidebarRefresh();
const authStore = useAuthStore();
const route = useRoute();
const period = computed(() => getReportPeriod(route.meta?.reportPeriod));
const documentKind = computed(() => getDocumentKindFromRoute(route));
const kindPeriodLayout = computed(
  () =>
    period.value === REPORT_PERIODS.DAILY ||
    period.value === REPORT_PERIODS.WEEKLY ||
    period.value === REPORT_PERIODS.MONTHLY
);
/** Embedded in report history side panel (specific report id); default three sections must stay read-only in edit view. */
const embeddedFromHistory = computed(() => Boolean(String(props.p_id || '').trim()));

const report = ref(null);
const kindReadView = ref(null);
const reportTicketValidation = ref([]);
const state = ref(0);
const date = ref(new Date().toLocaleDateString('en-CA'));
const viewMode = ref('edit');

const STORAGE_KEY = computed(() => `${period.value}_titles_${authStore.user?.id || 'anon'}`);

const showActions = computed(() => [0, 1, 2, 3, 4].includes(state.value));
const isEditable = computed(() => [0, 1, 2, 3, 4].includes(state.value));
/** Same as report history: read-only workflow states always use document layout, not disabled editors. */
const useDocumentLayout = computed(() => !isEditable.value || viewMode.value === 'document');
const useKindReadLayout = computed(
  () => kindPeriodLayout.value && embeddedFromHistory.value && useDocumentLayout.value
);
const isPlanMode = computed(() => kindPeriodLayout.value && isPlanKind(documentKind.value));
const usePlanTicketsComposer = computed(
  () => isPlanMode.value && !useDocumentLayout.value && !useKindReadLayout.value
);
const useReportTicketsComposer = computed(
  () =>
    kindPeriodLayout.value &&
    !isPlanMode.value &&
    !useDocumentLayout.value &&
    !useKindReadLayout.value
);
const savedPlanDoc = ref(null);
const loadedPlanDocs = ref([]);
const previousPlanDoc = computed(() => {
  if (!isPlanMode.value) return null;
  return findLatestPlanDoc(loadedPlanDocs.value, date.value, period.value);
});
const documentTitleParts = computed(() =>
  getReportDocumentTitleParts(date.value, period.value)
);
const composerPageTitle = computed(() => getKindComposerPageTitle(period.value, documentKind.value));
const coreSectionIndexes = computed(() => [0]);
const extraSectionIndexes = computed(() => {
  const len = report.value?.sections?.length ?? 0;
  if (!kindPeriodLayout.value || len <= 1) return [];
  return Array.from({ length: len - 1 }, (_, i) => i + 1);
});
const rejectReasonText = computed(() => String(report.value?.rejectReason || '').trim());

const statusText = computed(() => {
  if (state.value === 6) return 'Approved';
  if (state.value === 5) return 'Awaiting team approval';
  if (state.value === 2) return 'Pending';
  if ([3, 4].includes(state.value)) return 'Rejected';
  if (state.value === 1) return 'Draft';
  return '';
});

const statusClass = computed(() => {
  if (state.value === 6) return 'status-approved';
  if (state.value === 5) return 'status-awaiting';
  if (state.value === 2) return 'status-pending';
  if ([3, 4].includes(state.value)) return 'status-rejected';
  if (state.value === 1) return 'status-draft';
  return '';
});

const reportFileBase = computed(() =>
  `report-${period.value}-${String(date.value || '').replaceAll('/', '-')}`
);

function buildExportHtml() {
  const metaLine = `${authStore.user?.name || 'Member'}${authStore.user?.group ? ` · ${authStore.user.group}` : ''}`;
  if (useKindReadLayout.value && kindReadView.value) {
    const rv = kindReadView.value;
    const sections = sectionsFromKindReadView(rv);
    return buildReportExportHtml({
      title: getKindComposerPageTitle(period.value, documentKind.value),
      range: documentTitleParts.value?.range || '',
      metaLine,
      sections,
      period: period.value,
      dateKey: date.value,
      sideBySide: false
    });
  }
  return buildReportExportHtml({
    title: documentTitleParts.value?.primary || 'Report',
    range: documentTitleParts.value?.range || '',
    metaLine,
    sections: sectionsForDocumentBody(report.value?.sections || [], kindPeriodLayout.value),
    period: period.value,
    dateKey: date.value,
    sideBySide: false
  });
}

function handleExportDoc() {
  if (!report.value) return;
  exportReportAsDoc({ fileName: reportFileBase.value, html: buildExportHtml() });
}

function handlePrint() {
  if (!report.value) return;
  const ok = printReportHtml(buildExportHtml());
  if (!ok) toast.error('Popup blocked. Please allow popups for printing.');
}

function sectionNotesEditable(index) {
  if (!isEditable.value) return false;
  return true;
}

function sectionShowRemove(index) {
  if (!showActions.value) return false;
  if (kindPeriodLayout.value) return index >= 1;
  return (report.value?.sections?.length ?? 0) > 1;
}

function updateSectionTitle(index, value) {
  if (kindPeriodLayout.value && index < 1) return;
  if (report.value?.sections?.[index]) {
    report.value.sections[index].title = value;
  }
}

function updateSectionNotes(index, value) {
  if (report.value?.sections?.[index]) {
    report.value.sections[index].notes = value;
  }
}

function addSection() {
  if (!report.value?.sections) return;
  report.value.sections.push({ title: 'New Section', notes: '' });
}

function removeSectionAt(index) {
  if (!report.value?.sections) return;
  if (kindPeriodLayout.value && index < 1) return;
  if (!kindPeriodLayout.value && report.value.sections.length <= 1) return;
  report.value.sections.splice(index, 1);
}

function sectionPlaceholders(index) {
  return getReportSectionPlaceholders(period.value, index, {
    kindPeriodLayout: kindPeriodLayout.value
  });
}

function sectionComposerDisplay(index) {
  if (!kindPeriodLayout.value || index !== 0) {
    return { label: '', subtitle: '', hint: '' };
  }
  const display = getKindSectionDisplay(period.value, documentKind.value, date.value);
  if (!showActions.value) {
    return { ...display, hint: '' };
  }
  return display;
}

function saveTitlesToStorage() {
  if (!report.value || kindPeriodLayout.value) return;
  const titles = report.value.sections.map((s) => s.title);
  localStorage.setItem(STORAGE_KEY.value, JSON.stringify(titles));
}

function onPlanSectionsUpdate(sections) {
  if (!report.value) return;
  report.value.sections = sections;
}

function onReportSectionsUpdate(sections) {
  if (!report.value) return;
  report.value.sections = sections;
  reportTicketValidation.value = [];
}

async function loadReport() {
  try {
    const [docRes, planRes] = await Promise.all([
      getDocumentsByUser(period.value, authStore.user.id, documentKind.value),
      getDocumentsByUser(period.value, authStore.user.id, DOCUMENT_KIND.PLAN)
    ]);
    const list = docRes.data || [];
    const planDocs = planRes.data || [];
    loadedPlanDocs.value = planDocs;
    if (!list.length && !props.p_id) return;

    let selectedReport = null;
    if (props.p_id && props.p_id !== '') {
      selectedReport = list.find((item) => item._id === props.p_id);
    } else {
      selectedReport = list.find(
        (item) => item.date.split('T')[0] === normalizeDateForPeriod(date.value, period.value)
      );
    }
    if (!selectedReport) return;

    const anchor = selectedReport.date.split('T')[0];
    date.value = anchor;
    if (kindPeriodLayout.value) {
      kindReadView.value = buildKindDocumentReadView(
        selectedReport,
        period.value,
        anchor,
        documentKind.value
      );
      if (isPlanKind(documentKind.value)) {
        savedPlanDoc.value = selectedReport;
      }
      report.value = {
        ...selectedReport,
        sections: selectedReport.sections?.length ? [...selectedReport.sections] : []
      };
    } else {
      kindReadView.value = null;
      report.value = selectedReport;
    }
    state.value = selectedReport.state;
    const canEdit = [0, 1, 2, 3, 4].includes(selectedReport.state);
    if (embeddedFromHistory.value && canEdit) viewMode.value = 'document';
    else viewMode.value = canEdit ? 'edit' : 'document';
  } catch {
    toast.error('Failed to load report');
  }
}

async function saveReport() {
  try {
    await updateDocument(
      period.value,
      authStore.user.id,
      authStore.user.name,
      authStore.user.group,
      normalizeDateForPeriod(date.value, period.value),
      {
        sections: sectionsForReportPersistence(report.value.sections, kindPeriodLayout.value),
        state: 1
      },
      documentKind.value
    );
    toast.success('Saved successfully');
    await loadReport();
    refreshReportHistorySidebar?.();
  } catch {
    toast.error('Save failed');
  }
}

/**
 * The income / outcome block reports whether Finance Management has a target
 * for this period; without one the plan may not be submitted (the server
 * refuses it too).
 */
const financeStatus = ref(null);
const onFinanceStatus = (status) => {
  financeStatus.value = status || null;
};
const financeBlocksSubmit = computed(
  () => !!usePlanTicketsComposer.value && !!financeStatus.value?.missing,
);
const financeBlockReason = computed(() =>
  period.value === 'weekly'
    ? 'This week has no financial plan yet — ask your team boss to set it in Finance Management.'
    : 'This month has no financial plan yet — ask your team boss to set it in Finance Management.',
);

async function submitReport() {
  if (financeBlocksSubmit.value) {
    toast.warning(financeBlockReason.value);
    return;
  }

  if (useReportTicketsComposer.value) {
    const result = validateReportTicketSections(report.value?.sections);
    reportTicketValidation.value = result.errors;
    if (!result.ok) {
      toast.warning(result.summary);
      return;
    }
  }
  try {
    await updateDocument(
      period.value,
      authStore.user.id,
      authStore.user.name,
      authStore.user.group,
      normalizeDateForPeriod(date.value, period.value),
      {
        sections: sectionsForReportPersistence(report.value.sections, kindPeriodLayout.value),
        state: 2
      },
      documentKind.value
    );
    toast.success('Submitted successfully');
    saveTitlesToStorage();
    await loadReport();
    refreshReportHistorySidebar?.();
  } catch {
    toast.error('Submit failed');
  }
}

watch(() => props.p_id, loadReport);
watch(documentKind, loadReport);
watch(() => route.name, loadReport);
onMounted(loadReport);
</script>

<style scoped>
.report-view {
  width: 100%;
  max-width: min(1320px, 100%);
  margin: 0 auto;
  padding: 8px 12px;
  padding-left: max(12px, env(safe-area-inset-left));
  padding-right: max(12px, env(safe-area-inset-right));
  box-sizing: border-box;
}

.report-card {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
  padding: 14px;
  position: relative;
  min-height: 240px;
}

.report-card--document {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  min-height: 52px;
  margin-bottom: 10px;
  padding: 8px 0 14px;
  border-bottom: 1px solid var(--border-light);
}

.header-left {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  min-width: 0;
}

.header-right {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  padding: 6px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
}

.document-title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.15em;
  font-size: clamp(1.25rem, 2.2vw, 1.5rem);
  font-weight: 650;
  line-height: 1.2;
  margin: 0;
  padding: 0;
  color: var(--text-primary);
  letter-spacing: -0.025em;
}

.document-title-range {
  font-size: 0.72em;
  font-weight: 500;
  color: var(--text-tertiary);
  letter-spacing: 0;
}

/* Matches ReportDocumentPage (.rdoc__status). */
.status-badge {
  --edit-status-dot: #64748b;
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

.status-badge::before {
  content: '';
  flex-shrink: 0;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--edit-status-dot);
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.95),
    0 1px 3px rgba(15, 23, 42, 0.2);
}

.status-badge__label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-badge.status-approved {
  color: #14532d;
  border-color: rgba(22, 163, 74, 0.45);
  background: linear-gradient(160deg, #ecfdf5 0%, #d1fae5 55%, #bbf7d0 100%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.7) inset,
    0 3px 10px rgba(22, 163, 74, 0.14),
    0 8px 24px rgba(22, 163, 74, 0.08);
}

.status-badge.status-approved::before {
  background: linear-gradient(145deg, #86efac, #15803d);
}

.status-badge.status-pending {
  color: #1e3a8a;
  border-color: rgba(37, 99, 235, 0.42);
  background: linear-gradient(160deg, #eff6ff 0%, #dbeafe 50%, #bfdbfe 100%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.75) inset,
    0 3px 12px rgba(37, 99, 235, 0.18),
    0 10px 28px rgba(37, 99, 235, 0.1);
}

.status-badge.status-pending::before {
  background: linear-gradient(145deg, #93c5fd, #1d4ed8);
  animation: editHeaderStatusPulse 2.4s ease-in-out infinite;
}

@keyframes editHeaderStatusPulse {
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

.status-badge.status-rejected {
  color: #7f1d1d;
  border-color: rgba(220, 38, 38, 0.4);
  background: linear-gradient(160deg, #fef2f2 0%, #fee2e2 55%, #fecaca 100%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.65) inset,
    0 3px 10px rgba(220, 38, 38, 0.12),
    0 8px 22px rgba(220, 38, 38, 0.08);
}

.status-badge.status-rejected::before {
  background: linear-gradient(145deg, #fca5a5, #b91c1c);
}

.status-badge.status-awaiting {
  color: #78350f;
  border-color: rgba(217, 119, 6, 0.4);
  background: linear-gradient(160deg, #fffbeb 0%, #fef3c7 55%, #fde68a 100%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.7) inset,
    0 3px 10px rgba(217, 119, 6, 0.14),
    0 8px 22px rgba(245, 158, 11, 0.1);
}

.status-badge.status-awaiting::before {
  background: linear-gradient(145deg, #fcd34d, #b45309);
  animation: editHeaderStatusWarmPulse 2.6s ease-in-out infinite;
}

@keyframes editHeaderStatusWarmPulse {
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

.report-body {
  position: relative;
}

.reject-warning {
  margin: 0 0 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #fdba74;
  background: #fff7ed;
  color: #9a3412;
}

.reject-warning strong {
  font-size: 0.78rem;
}

.reject-warning p {
  margin: 4px 0 0;
  font-size: 0.82rem;
  white-space: pre-wrap;
}

.btn-add-section {
  display: block;
  width: 100%;
  padding: 12px 20px;
  margin-top: var(--spacing-md);
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-primary);
  background: rgba(99, 102, 241, 0.08);
  border: 1px dashed var(--color-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-section:hover {
  background: rgba(99, 102, 241, 0.15);
}

.sections-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.btn {
  height: 34px;
  padding: 0 14px;
  font-size: 0.82rem;
  font-weight: 650;
  border-radius: 9px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid #dbe4ef;
  line-height: 1;
  letter-spacing: 0.01em;
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.02);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: #1e40af;
  border-color: #1e40af;
}

.btn-secondary {
  background: var(--bg-primary);
  color: #334155;
  border-color: #dbe4ef;
}

.btn-secondary:hover {
  border-color: #cbd5e1;
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.btn-neutral {
  background: var(--bg-primary);
  color: #334155;
  border-color: #dbe4ef;
}

.btn-neutral:hover {
  border-color: #cbd5e1;
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

@media (max-width: 768px) {
  .report-view {
    padding: 6px 10px;
  }

  .report-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .header-right {
    justify-content: space-between;
  }

  .header-actions {
    margin-left: auto;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .report-card {
    padding: 12px;
  }
}

@media (max-width: 480px) {
  .report-view {
    padding: 4px 8px;
  }

  .header-actions {
    width: 100%;
    justify-content: stretch;
  }

  .header-actions .btn {
    flex: 1 1 calc(50% - 4px);
    min-height: 44px;
    text-align: center;
  }
}
</style>
