<template>
  <div class="report-view" :class="{ 'report-composer-page': fixedThreeSectionLayout && editableEnabled && teamBossCanEdit }">
    <div
      class="report-card"
      :class="{ 'report-card--document': !editableEnabled || !teamBossCanEdit }"
    >
      <div v-if="report">
        <ReportDocumentPage
          v-if="!editableEnabled || !teamBossCanEdit"
          :report="report"
          :period="period"
          :date-key="date"
          :status-text="statusText"
          :status-class="statusClass"
          :omit-carry-section="false"
          :side-by-side-core-sections="fixedThreeSectionLayout"
          :meta-line="`${report.username || 'Member'}${report.group ? ` · ${report.group}` : ''}`"
        >
          <template #actions>
            <ReportToolbarExportPrint @export-doc="handleExportDoc" @print="handlePrint" />
            <button
              v-if="state === 2 || state === 5"
              type="button"
              class="btn btn-primary"
              title="Final approval"
              @click="approveReport"
            >
              Approve
            </button>
            <button
              v-if="state === 2 || state === 5"
              type="button"
              class="btn btn-danger"
              title="Send back for revision"
              @click="rejectReport"
            >
              Reject
            </button>
            <button
              v-if="teamBossCanEdit"
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
              <div v-if="state === 6" class="status-badge status-approved" role="status">
                <span class="status-badge__label">Approved</span>
              </div>
              <div v-if="state === 5" class="status-badge status-awaiting" role="status">
                <span class="status-badge__label">Awaiting team boss</span>
              </div>
              <div v-if="state === 4" class="status-badge status-rejected" role="status">
                <span class="status-badge__label">Rejected</span>
              </div>
              <div class="header-actions">
                <button
                  v-if="state === 2 || state === 5"
                  type="button"
                  class="btn btn-primary"
                  title="Final approval"
                  @click="approveReport"
                >
                  Approve
                </button>
                <button
                  v-if="state === 2 || state === 5"
                  type="button"
                  class="btn btn-danger"
                  title="Send back for revision"
                  @click="rejectReport"
                >
                  Reject
                </button>
                <label
                  class="edit-toggle"
                  title="When enabled, you can change section titles and notes before final approve or reject."
                >
                  <input v-model="editableEnabled" type="checkbox" />
                  <span>Edit mode</span>
                </label>
              </div>
            </div>
          </header>

          <div class="sections-list" :class="{ 'sections-list--two-column': fixedThreeSectionLayout }">
            <template v-if="fixedThreeSectionLayout">
              <div class="sections-list__core-row">
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
              </div>
              <ReportSectionCard
                v-for="index in extraSectionIndexes"
                :key="index"
                :title="report.sections[index].title"
                :model-value="report.sections[index].notes"
                :editable="sectionNotesEditable(index)"
                :readonly-title="false"
                :show-remove="showActions && index >= 2"
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
            v-if="showActions"
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
import { updateReport, getAllReports } from '../services/reports';
import {
  getReportPeriod,
  getReportDocumentTitleParts,
  REPORT_PERIODS,
  getReportSectionPlaceholders,
  getFixedSectionDisplay,
  getReportComposerPageTitle,
  rebuildFixedLayoutSections,
  sectionsForReportPersistence,
  sectionsForDocumentBody
} from '../utils/reportPeriod';
import { buildReportExportHtml, exportReportAsDoc, printReportHtml } from '../utils/reportDocumentExport';
import { useToast } from 'vue-toastification';
import { useReportHistorySidebarRefresh } from '../composables/useReportHistorySidebarRefresh';
import ReportSectionCard from '../components/reports/ReportSectionCard.vue';
import ReportDocumentPage from '../components/reports/ReportDocumentPage.vue';
import ReportToolbarExportPrint from '../components/reports/ReportToolbarExportPrint.vue';

const props = defineProps({
  p_id: { type: String, default: '' }
});

const toast = useToast();
const refreshReportHistorySidebar = useReportHistorySidebarRefresh();
const authStore = useAuthStore();
const route = useRoute();
const period = computed(() => getReportPeriod(route.meta?.reportPeriod));
const fixedThreeSectionLayout = computed(
  () =>
    period.value === REPORT_PERIODS.DAILY ||
    period.value === REPORT_PERIODS.WEEKLY ||
    period.value === REPORT_PERIODS.MONTHLY
);

const report = ref(null);
const selectedReport = ref(null);
const state = ref(0);
const date = ref(new Date().toLocaleDateString('en-CA'));
const editableEnabled = ref(false);

const teamBossCanEdit = computed(() => [2, 3, 4, 5, 6].includes(state.value));
const showActions = computed(() => editableEnabled.value && teamBossCanEdit.value);
const isEditable = computed(() => editableEnabled.value && teamBossCanEdit.value);
const documentTitleParts = computed(() =>
  getReportDocumentTitleParts(date.value, period.value)
);
const composerPageTitle = computed(() => getReportComposerPageTitle(period.value));
const coreSectionIndexes = computed(() => [0, 1]);
const extraSectionIndexes = computed(() => {
  const len = report.value?.sections?.length ?? 0;
  if (!fixedThreeSectionLayout.value || len <= 2) return [];
  return Array.from({ length: len - 2 }, (_, i) => i + 2);
});

const statusText = computed(() => {
  if (state.value === 6) return 'Approved';
  if (state.value === 5) return 'Awaiting team boss';
  if (state.value === 4) return 'Rejected';
  if (state.value === 2) return 'Pending';
  if (state.value === 1) return 'Draft';
  return '';
});

const statusClass = computed(() => {
  if (state.value === 6) return 'status-approved';
  if (state.value === 5) return 'status-awaiting';
  if (state.value === 4) return 'status-rejected';
  if (state.value === 2) return 'status-pending';
  if (state.value === 1) return 'status-draft';
  return '';
});

const reportFileBase = computed(() =>
  `report-${period.value}-${String(date.value || '').replaceAll('/', '-')}`
);

function buildExportHtml() {
  const title = documentTitleParts.value?.primary || 'Report';
  const range = documentTitleParts.value?.range || '';
  return buildReportExportHtml({
    title,
    range,
    metaLine: `${report.value?.username || 'Member'}${report.value?.group ? ` · ${report.value.group}` : ''}`,
    sections: sectionsForDocumentBody(report.value?.sections || [], fixedThreeSectionLayout.value),
    period: period.value,
    dateKey: date.value,
    sideBySide: fixedThreeSectionLayout.value
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

function updateSectionTitle(index, value) {
  if (fixedThreeSectionLayout.value && index < 2) return;
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
    fixedThreeSectionLayout: fixedThreeSectionLayout.value
  });
}

function sectionComposerDisplay(index) {
  if (!fixedThreeSectionLayout.value) {
    return { label: '', subtitle: '', hint: '' };
  }
  const slot = index === 0 ? 'work' : 'plan';
  const display = getFixedSectionDisplay(period.value, slot, date.value);
  if (index !== 0 || !showActions.value) {
    return { ...display, hint: '' };
  }
  return display;
}

async function loadReport() {
  try {
    const response = await getAllReports(period.value);
    if (!response.data) return;

    let item = null;
    if (props.p_id && props.p_id !== '') {
      item = response.data.find((r) => r._id === props.p_id);
      selectedReport.value = item;
    } else {
      item = response.data.find((r) => r.date.split('T')[0] === date.value && r.state > 4);
    }
    if (!item) return;

    const anchor = item.date?.split?.('T')[0] || date.value;
    date.value = anchor;
    const uid = item.userId;
    const userList = response.data.filter((r) => String(r.userId) === String(uid));
    if (fixedThreeSectionLayout.value) {
      const sections = rebuildFixedLayoutSections(item, userList, period.value, anchor);
      report.value = { ...item, sections };
    } else {
      report.value = item;
    }
    selectedReport.value = item;
    state.value = item.state;
    const fromHistory = Boolean(String(props.p_id || '').trim());
    editableEnabled.value = fromHistory ? false : [2, 3, 4, 5, 6].includes(item.state);
  } catch (err) {
    toast.error('Failed to load report');
  }
}

async function approveReport() {
  try {
    const r = selectedReport.value || report.value;
    await updateReport(period.value, r.userId, r.username, r.group, r.date?.split?.('T')[0], {
      sections: sectionsForReportPersistence(report.value.sections, fixedThreeSectionLayout.value),
      state: 6
    });
    toast.success('Report approved');
    await loadReport();
    refreshReportHistorySidebar?.();
  } catch {
    toast.error('Approve failed');
  }
}

async function rejectReport() {
  try {
    const reason = window.prompt('Please enter reject reason');
    if (!String(reason || '').trim()) return;
    const r = selectedReport.value || report.value;
    await updateReport(period.value, r.userId, r.username, r.group, r.date?.split?.('T')[0], {
      sections: sectionsForReportPersistence(report.value.sections, fixedThreeSectionLayout.value),
      state: 3,
      rejectReason: reason
    });
    toast.success('Report rejected');
    await loadReport();
    refreshReportHistorySidebar?.();
  } catch {
    toast.error('Reject failed');
  }
}

watch(() => props.p_id, () => {
  loadReport();
});

watch(
  () => state.value,
  (s) => {
    if (![2, 3, 4, 5, 6].includes(s)) editableEnabled.value = false;
  }
);
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
