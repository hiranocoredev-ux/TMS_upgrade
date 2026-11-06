<template>
  <div
    class="report-view"
    :class="{
      'report-composer-page': kindPeriodLayout && (useKindReadLayout || (editableEnabled && canEditReport)),
      'report-history-compare-host': useKindReadLayout,
      'report-history-edit-host':
        (fromHistory || isAllTeamsReview) && editableEnabled && canEditReport
    }"
  >
    <div
      class="report-card"
      :class="{ 'report-card--document': useKindReadLayout || !editableEnabled || !canEditReport }"
    >
      <div v-if="report">
        <div v-if="rejectReasonText" class="reject-warning">
          <strong>Rejected Reason</strong>
          <p>{{ rejectReasonText }}</p>
        </div>
        <ReportKindReadPage
          v-if="useKindReadLayout"
          :read-view="kindReadView"
          :period="period"
          :user-id="String(report.userId || '')"
          :anchor-date="date"
          :document-kind="documentKind"
          :status-text="statusBadge?.text || ''"
          :status-class="statusBadge?.className || ''"
          :meta-line="`${report.username || 'Member'}${report.group ? ` · ${report.group}` : ''}`"
          :show-summary="documentKind === 'report' && period === 'daily'"
        >
          <template #actions>
            <ReportToolbarExportPrint @export-doc="handleExportDoc" @print="handlePrint" />
            <button
              v-if="state === 2 || state === 5"
              type="button"
              class="btn btn-primary"
              title="Final approval"
              @click="approveAsTeamBoss"
            >
              Approve
            </button>
            <button
              v-if="state === 2 || state === 5"
              type="button"
              class="btn btn-danger"
              title="Send back for revision"
              @click="rejectAsTeamBoss"
            >
              Reject
            </button>
            <button
              v-if="canEditReport"
              type="button"
              class="btn btn-neutral"
              title="Switch to edit panel"
              @click="editableEnabled = true"
            >
              Edit
            </button>
          </template>
        </ReportKindReadPage>

        <ReportDocumentPage
          v-else-if="!editableEnabled || !canEditReport"
          :report="report"
          :period="period"
          :date-key="date"
          :status-text="statusBadge?.text || ''"
          :status-class="statusBadge?.className || ''"
          :omit-carry-section="false"
          :side-by-side-core-sections="false"
          :meta-line="`${report.username || 'Member'}${report.group ? ` · ${report.group}` : ''}`"
        >
          <template #actions>
            <ReportToolbarExportPrint @export-doc="handleExportDoc" @print="handlePrint" />
            <button
              v-if="state === 2 || state === 5"
              type="button"
              class="btn btn-primary"
              title="Final approval"
              @click="approveAsTeamBoss"
            >
              Approve
            </button>
            <button
              v-if="state === 2 || state === 5"
              type="button"
              class="btn btn-danger"
              title="Send back for revision"
              @click="rejectAsTeamBoss"
            >
              Reject
            </button>
            <button
              v-if="canEditReport"
              type="button"
              class="btn btn-neutral"
              title="Switch to edit panel"
              @click="editableEnabled = true"
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
              <div
                v-if="statusBadge"
                class="status-badge"
                :class="statusBadge.className"
                role="status"
              >
                <span class="status-badge__label">{{ statusBadge.text }}</span>
              </div>
              <div class="header-actions">
                <button
                  v-if="state === 2 || state === 5"
                  type="button"
                  class="btn btn-primary"
                  title="Final approval"
                  @click="approveAsTeamBoss"
                >
                  Approve
                </button>
                <button
                  v-if="state === 2 || state === 5"
                  type="button"
                  class="btn btn-danger"
                  title="Send back for revision"
                  @click="rejectAsTeamBoss"
                >
                  Reject
                </button>
                <button
                  v-if="showActions && report"
                  type="button"
                  class="btn btn-primary"
                  :title="saveButtonTitle"
                  @click="saveEdits"
                >
                  {{ saveButtonLabel }}
                </button>
                <button
                  type="button"
                  class="btn btn-neutral"
                  title="Back to read-only document view"
                  @click="editableEnabled = false"
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
            :user-id="String(report?.userId || '')"
            :editable="sectionNotesEditable(0)"
            @update:sections="onPlanSectionsUpdate"
          />

          <ReportTicketsComposer
            v-else-if="useReportTicketsComposer"
            :period="period"
            :anchor-date="date"
            :saved-doc="report"
            :plan-docs="loadedPlanDocs"
            :user-id="String(report?.userId || authStore.user?.id || '')"
            :editable="sectionNotesEditable(0)"
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
                :show-remove="showActions && index >= 1"
                :title-placeholder="sectionPlaceholders(index).title"
                :notes-placeholder="sectionPlaceholders(index).notes"
                @update:title="(v) => updateSectionTitle(index, v)"
                @update:model-value="(v) => updateSectionNotes(index, v)"
                @remove="removeSection(report.sections[index].title)"
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
                @remove="removeSection(section.title)"
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
    <RejectReasonDialog
      v-model="showRejectDialog"
      :reason="rejectReasonInput"
      :submitting="rejectSubmitting"
      @update:reason="(v) => (rejectReasonInput = v)"
      @confirm="confirmReject"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { getAllDocuments, updateDocument } from '../services/periodDocuments';
import { DOCUMENT_KIND, getDocumentKindFromRoute, isPlanKind } from '../constants/documentKind';
import {
  getReportPeriod,
  getReportDocumentTitleParts,
  REPORT_PERIODS,
  getReportSectionPlaceholders,
  getKindComposerPageTitle,
  getKindSectionDisplay,
  rebuildKindSections,
  buildKindDocumentReadView,
  sectionsFromKindReadView,
  sectionsForReportPersistence,
  sectionsForDocumentBody,
  normalizeDateForPeriod
} from '../utils/reportPeriod';
import { buildReportExportHtml, exportReportAsDoc, printReportHtml } from '../utils/reportDocumentExport';
import { useToast } from 'vue-toastification';
import { useReportHistorySidebarRefresh } from '../composables/useReportHistorySidebarRefresh';
import ReportSectionCard from '../components/reports/ReportSectionCard.vue';
import PlanTicketsComposer from '../components/reports/PlanTicketsComposer.vue';
import { findLatestPlanDoc } from '../utils/planTickets';
import ReportTicketsComposer from '../components/reports/ReportTicketsComposer.vue';
import ReportDocumentPage from '../components/reports/ReportDocumentPage.vue';
import ReportKindReadPage from '../components/reports/ReportKindReadPage.vue';
import ReportToolbarExportPrint from '../components/reports/ReportToolbarExportPrint.vue';
import RejectReasonDialog from '../components/reports/RejectReasonDialog.vue';

const STATUS_BADGES = {
  1: { text: 'Draft', className: 'status-draft' },
  2: { text: 'Pending', className: 'status-pending' },
  3: { text: 'Rejected', className: 'status-rejected' },
  4: { text: 'Rejected', className: 'status-rejected' },
  5: { text: 'Awaiting team boss', className: 'status-awaiting' },
  6: { text: 'Approved', className: 'status-approved' }
};

const props = defineProps({
  p_id: { type: String, default: '' },
  /** All-teams review: compose/edit when member has not submitted for this period. */
  composeUserId: { type: String, default: '' },
  composeUsername: { type: String, default: '' },
  composeGroup: { type: String, default: '' },
  composeAnchorDate: { type: String, default: '' }
});

const emit = defineEmits(['report-saved']);

const toast = useToast();
const refreshReportHistorySidebar = useReportHistorySidebarRefresh();
const route = useRoute();
const period = computed(() => getReportPeriod(route.meta?.reportPeriod));
const documentKind = computed(() => getDocumentKindFromRoute(route));
const kindPeriodLayout = computed(
  () =>
    period.value === REPORT_PERIODS.DAILY ||
    period.value === REPORT_PERIODS.WEEKLY ||
    period.value === REPORT_PERIODS.MONTHLY
);

const report = ref(null);
const kindReadView = ref(null);
/** Saved sections for all-teams document view; editor layout applied only in edit mode. */
const savedSectionsSnapshot = ref(null);
const editorSectionsCache = ref(null);
const selectedReport = ref(null);
const state = ref(0);
const date = ref(new Date().toLocaleDateString('en-CA'));
const editableEnabled = ref(false);
const showRejectDialog = ref(false);
const rejectReasonInput = ref('');
const rejectSubmitting = ref(false);

/** Embedded from a sidebar list (history or all-teams review). */
const fromHistory = computed(() => Boolean(String(props.p_id || '').trim()));
/** All-teams daily/weekly/monthly pages: document view + edit; save sends to team boss (state 5). */
const isAllTeamsReview = computed(() => Boolean(route.meta?.superAdminTeamsReview));
/** Member has no submitted report for the selected period (super-admin compose). */
const isComposeMode = computed(
  () =>
    isAllTeamsReview.value &&
    !fromHistory.value &&
    Boolean(String(props.composeUserId || '').trim()) &&
    Boolean(String(props.composeAnchorDate || '').trim())
);
const canEditReport = computed(() => {
  if (isComposeMode.value) return true;
  if (isAllTeamsReview.value) return [1, 2, 3, 4, 5, 6].includes(state.value);
  return [2, 3, 4, 5, 6].includes(state.value);
});
const showActions = computed(() => editableEnabled.value && canEditReport.value);
const isEditable = computed(() => editableEnabled.value && canEditReport.value);
const useKindReadLayout = computed(() => {
  if (!kindPeriodLayout.value) return false;
  if (isComposeMode.value && !editableEnabled.value) return true;
  if (isAllTeamsReview.value && !editableEnabled.value) return true;
  return (
    fromHistory.value &&
    !isAllTeamsReview.value &&
    (!editableEnabled.value || !canEditReport.value)
  );
});
const isPlanMode = computed(() => kindPeriodLayout.value && isPlanKind(documentKind.value));
const usePlanTicketsComposer = computed(
  () => isPlanMode.value && editableEnabled.value && canEditReport.value && !useKindReadLayout.value
);
const savedPlanDoc = ref(null);
const loadedPlanDocs = ref([]);
const previousPlanDoc = computed(() => {
  if (!isPlanMode.value || !report.value?.userId) return null;
  const memberPlans = loadedPlanDocs.value.filter(
    (p) => String(p.userId) === String(report.value.userId)
  );
  return findLatestPlanDoc(memberPlans, date.value, period.value);
});
const useReportTicketsComposer = computed(
  () =>
    kindPeriodLayout.value &&
    !isPlanMode.value &&
    editableEnabled.value &&
    canEditReport.value &&
    !useKindReadLayout.value
);
const saveButtonLabel = computed(() => (isAllTeamsReview.value ? 'Save' : 'Save content'));
const saveButtonTitle = computed(() =>
  isAllTeamsReview.value
    ? 'Save changes and set status to awaiting team boss approval'
    : 'Save sections without changing workflow status'
);
const documentTitleParts = computed(() =>
  getReportDocumentTitleParts(date.value, period.value)
);
const composerPageTitle = computed(() => getKindComposerPageTitle(period.value, documentKind.value));
const statusBadge = computed(() => STATUS_BADGES[state.value] ?? null);
const coreSectionIndexes = computed(() => [0]);
const extraSectionIndexes = computed(() => {
  const len = report.value?.sections?.length ?? 0;
  if (!kindPeriodLayout.value || len <= 1) return [];
  return Array.from({ length: len - 1 }, (_, i) => i + 1);
});
const rejectReasonText = computed(() => String(report.value?.rejectReason || '').trim());

const reportFileBase = computed(() =>
  `report-${period.value}-${String(date.value || '').replaceAll('/', '-')}`
);

function sectionNotesEditable(index) {
  if (!isEditable.value) return false;
  return true;
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

function removeSection(title) {
  if (!report.value?.sections) return;
  report.value.sections = report.value.sections.filter((s) => s.title !== title);
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

function buildExportHtml() {
  const metaLine = `${report.value?.username || 'Member'}${report.value?.group ? ` · ${report.value.group}` : ''}`;
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

function reportDateKey(r) {
  if (!r?.date) return '';
  if (typeof r.date === 'string') return r.date.split('T')[0];
  try {
    return new Date(r.date).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function onPlanSectionsUpdate(sections) {
  if (!report.value) return;
  report.value.sections = sections;
}

function onReportSectionsUpdate(sections) {
  if (!report.value) return;
  report.value.sections = sections;
}

function applyLoadedReport(item, planDocs, anchor) {
  loadedPlanDocs.value = Array.isArray(planDocs) ? planDocs : [];
  if (kindPeriodLayout.value) {
    kindReadView.value = buildKindDocumentReadView(item, period.value, anchor, documentKind.value);
    if (isPlanKind(documentKind.value)) {
      savedPlanDoc.value = item;
      const rawSections = item?.sections?.length ? [...item.sections] : [];
      if (isAllTeamsReview.value) {
        savedSectionsSnapshot.value = JSON.parse(JSON.stringify(rawSections));
        editorSectionsCache.value = null;
        report.value = {
          ...item,
          sections: JSON.parse(JSON.stringify(savedSectionsSnapshot.value))
        };
      } else {
        savedSectionsSnapshot.value = null;
        editorSectionsCache.value = null;
        report.value = { ...item, sections: rawSections };
      }
    } else {
      const rawSections = item?.sections?.length ? [...item.sections] : [];
      if (isAllTeamsReview.value) {
        savedSectionsSnapshot.value = JSON.parse(JSON.stringify(rawSections));
        editorSectionsCache.value = null;
        report.value = {
          ...item,
          sections: JSON.parse(JSON.stringify(savedSectionsSnapshot.value))
        };
      } else {
        savedSectionsSnapshot.value = null;
        editorSectionsCache.value = null;
        report.value = { ...item, sections: rawSections };
      }
    }
  } else {
    kindReadView.value = null;
    savedSectionsSnapshot.value = null;
    editorSectionsCache.value = null;
    report.value = item;
  }
  selectedReport.value = item;
  state.value = item.state;
  if (isAllTeamsReview.value || fromHistory.value) {
    editableEnabled.value = false;
  } else {
    editableEnabled.value = [2, 3, 4, 5, 6].includes(item.state);
  }
}

function loadComposeReport(docs, planDocs) {
  const uid = String(props.composeUserId || '').trim();
  const anchor = normalizeDateForPeriod(props.composeAnchorDate, period.value);
  date.value = anchor;
  const userDocs = (Array.isArray(docs) ? docs : []).filter((r) => String(r.userId ?? '') === uid);
  const userPlans = (Array.isArray(planDocs) ? planDocs : []).filter((r) => String(r.userId ?? '') === uid);
  const existing = userDocs.find((r) => reportDateKey(r) === anchor && Number(r.state ?? 0) >= 1);
  if (existing) {
    applyLoadedReport(existing, userPlans, anchor);
    return;
  }

  loadedPlanDocs.value = userPlans;
  kindReadView.value = buildKindDocumentReadView(null, period.value, anchor, documentKind.value);
  savedSectionsSnapshot.value = null;
  editorSectionsCache.value = null;
  report.value = {
    userId: uid,
    username: props.composeUsername || 'Member',
    group: props.composeGroup || '',
    date: anchor,
    sections: [],
    state: 0
  };
  selectedReport.value = null;
  state.value = 0;
  editableEnabled.value = false;
}

async function loadReport() {
  try {
    const [docRes, planRes] = await Promise.all([
      getAllDocuments(period.value, documentKind.value),
      getAllDocuments(period.value, DOCUMENT_KIND.PLAN)
    ]);
    const docs = docRes.data || [];
    const planDocs = planRes.data || [];

    if (isComposeMode.value) {
      loadComposeReport(docs, planDocs);
      return;
    }

    let item = null;
    if (props.p_id && props.p_id !== '') {
      item = docs.find((r) => String(r._id) === String(props.p_id));
      selectedReport.value = item;
    } else {
      item = docs.find((r) => reportDateKey(r) === date.value);
    }
    if (!item) return;

    const anchor = reportDateKey(item) || date.value;
    date.value = anchor;
    const userPlans = planDocs.filter((r) => String(r.userId) === String(item.userId));
    applyLoadedReport(item, userPlans, anchor);
  } catch {
    toast.error('Failed to load report');
  }
}

async function approveAsTeamBoss() {
  try {
    const r = selectedReport.value || report.value;
    await updateDocument(
      period.value,
      r.userId,
      r.username,
      r.group,
      reportDateKey(r),
      {
        sections: sectionsForReportPersistence(report.value.sections, kindPeriodLayout.value),
        state: 6
      },
      documentKind.value
    );
    toast.success('Report approved');
    await loadReport();
    refreshReportHistorySidebar?.();
  } catch {
    toast.error('Approve failed');
  }
}

async function rejectAsTeamBoss() {
  showRejectDialog.value = true;
}

async function confirmReject() {
  if (!String(rejectReasonInput.value || '').trim()) return;
  rejectSubmitting.value = true;
  try {
    const r = selectedReport.value || report.value;
    await updateDocument(
      period.value,
      r.userId,
      r.username,
      r.group,
      reportDateKey(r),
      {
        sections: sectionsForReportPersistence(report.value.sections, kindPeriodLayout.value),
        state: 3,
        rejectReason: rejectReasonInput.value
      },
      documentKind.value
    );
    toast.success('Report rejected');
    showRejectDialog.value = false;
    rejectReasonInput.value = '';
    await loadReport();
    refreshReportHistorySidebar?.();
  } catch {
    toast.error('Reject failed');
  } finally {
    rejectSubmitting.value = false;
  }
}

async function saveEdits() {
  try {
    const r = selectedReport.value || report.value;
    if (!r?.userId) return;
    const anchor = reportDateKey(r) || date.value;
    const st = isAllTeamsReview.value
      ? 5
      : typeof r.state === 'number'
        ? r.state
        : state.value;
    const response = await updateDocument(
      period.value,
      r.userId,
      r.username,
      r.group,
      anchor,
      {
        sections: sectionsForReportPersistence(report.value.sections, kindPeriodLayout.value),
        state: st
      },
      documentKind.value
    );
    const savedId = response?.data?._id;
    if (isAllTeamsReview.value) {
      editableEnabled.value = false;
      toast.success('Report saved — awaiting team boss approval');
    } else {
      toast.success('Content saved');
    }
    if (isComposeMode.value && savedId) {
      emit('report-saved', { id: String(savedId) });
    }
    await loadReport();
    refreshReportHistorySidebar?.();
  } catch {
    toast.error('Save failed');
  }
}

watch(
  () => [props.p_id, props.composeUserId, props.composeAnchorDate],
  () => {
    loadReport();
  }
);

watch(documentKind, loadReport);
watch(() => route.name, loadReport);

watch(
  () => state.value,
  (s) => {
    if (isComposeMode.value) return;
    const allowed = isAllTeamsReview.value ? [1, 2, 3, 4, 5, 6] : [2, 3, 4, 5, 6];
    if (!allowed.includes(s)) editableEnabled.value = false;
  }
);

watch(editableEnabled, (on) => {
  if (!report.value?.sections) return;
  if (isComposeMode.value) {
    if (on && editorSectionsCache.value) {
      report.value.sections = JSON.parse(JSON.stringify(editorSectionsCache.value));
    }
    return;
  }
  if (!isAllTeamsReview.value) return;
  if (on && editorSectionsCache.value) {
    report.value.sections = JSON.parse(JSON.stringify(editorSectionsCache.value));
    return;
  }
  if (!on && savedSectionsSnapshot.value) {
    report.value.sections = JSON.parse(JSON.stringify(savedSectionsSnapshot.value));
  }
});

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
  align-items: center;
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
  font-size: clamp(1.35rem, 2.6vw, 1.75rem);
  font-weight: 700;
  line-height: 1.2;
  margin: 0;
  padding: 0;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.document-title-range {
  font-size: 0.72em;
  font-weight: 500;
  color: var(--text-tertiary);
  letter-spacing: 0;
}

.edit-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.edit-toggle input {
  cursor: pointer;
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

.status-badge.status-draft {
  --edit-status-dot: #64748b;
  color: #334155;
  border-color: rgba(100, 116, 139, 0.35);
  background: linear-gradient(160deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.8) inset,
    0 2px 8px rgba(15, 23, 42, 0.05);
}

.status-badge.status-draft::before {
  background: linear-gradient(145deg, #cbd5e1, #475569);
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

.btn-danger {
  background: #fef2f2;
  color: #b91c1c;
  border-color: #fecaca;
}

.btn-danger:hover {
  background: #fee2e2;
  border-color: #fca5a5;
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
    flex-wrap: wrap;
    gap: 10px;
  }

  .header-actions {
    flex-wrap: wrap;
    width: 100%;
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

  .header-actions,
  .header-right {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions .btn {
    width: 100%;
    min-height: 44px;
  }

  .edit-toggle {
    justify-content: center;
    padding: 8px 0;
  }
}
</style>
