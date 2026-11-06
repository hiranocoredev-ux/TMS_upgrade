<template>
  <div class="report-view report-composer-page">
    <div
      v-if="report"
      class="report-card"
      :class="{ 'report-card--document': useDocumentLayout }"
    >
      <div v-if="rejectReasonText" class="reject-warning">
        <strong>Rejected Reason</strong>
        <p>{{ rejectReasonText }}</p>
      </div>
      <ReportKindReadPage
        v-if="useKindReadDocument"
        :read-view="kindReadView"
        :period="period"
        :user-id="String(authStore.user?.id || '')"
        :anchor-date="effectiveReportDate"
        :document-kind="documentKind"
        :status-text="statusLabel"
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
        :date-key="effectiveReportDate"
        :status-text="statusLabel"
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
            <div
              v-if="isDailyPeriod && showActions"
              class="date-switcher"
              :class="{ 'date-switcher--plan': isPlanMode }"
            >
              <span class="date-switcher__label">{{ isPlanMode ? 'Plan Date (EST):' : 'Report Date (EST):' }}</span>
              <template v-if="isPlanMode">
                <button
                  type="button"
                  class="btn btn-date"
                  :class="{ 'btn-date--active': dailyDateKey === planDailyNextKey }"
                  @click="dailyDateKey = planDailyNextKey"
                >
                  {{ formatDateButtonLabel(planDailyNextKey) }}
                </button>
                <button
                  type="button"
                  class="btn btn-date"
                  :class="{ 'btn-date--active': dailyDateKey === planDailyCurrentKey }"
                  @click="dailyDateKey = planDailyCurrentKey"
                >
                  {{ formatDateButtonLabel(planDailyCurrentKey) }}
                </button>
                <span class="date-switcher__or">or</span>
                <TmsNativeCalendarField
                  v-model="dailyDateKey"
                  type="date"
                  class="date-switcher__picker"
                  :max="planPickerBounds.daily.max"
                  title="Pick plan date"
                />
              </template>
              <template v-else>
                <button
                  type="button"
                  class="btn btn-date"
                  :class="{ 'btn-date--active': dailyDateKey === estTodayKey }"
                  @click="dailyDateKey = estTodayKey"
                >
                  {{ formatDateButtonLabel(estTodayKey) }}
                </button>
                <button
                  type="button"
                  class="btn btn-date"
                  :class="{ 'btn-date--active': dailyDateKey === estYesterdayKey }"
                  @click="dailyDateKey = estYesterdayKey"
                >
                  {{ formatDateButtonLabel(estYesterdayKey) }}
                </button>
                <span class="date-switcher__or">or</span>
                <TmsNativeCalendarField
                  v-model="dailyDateKey"
                  type="date"
                  class="date-switcher__picker"
                  :max="reportPickerBounds.daily.max"
                  title="Pick report date"
                />
              </template>
            </div>
            <div
              v-if="isWeeklyPeriod && showActions"
              class="date-switcher"
              :class="{ 'date-switcher--plan': isPlanMode }"
            >
              <span class="date-switcher__label">{{ isPlanMode ? 'Plan Week:' : 'Report Week:' }}</span>
              <template v-if="isPlanMode">
                <button
                  type="button"
                  class="btn btn-date btn-date--with-subtitle"
                  :class="{ 'btn-date--active': weeklyAnchorDateKey === planWeekNextKey }"
                  @click="weeklyAnchorDateKey = planWeekNextKey"
                >
                  <span class="btn-date__title">{{ getWeekButtonLabel(planWeekNextKey).title }}</span>
                  <span class="btn-date__sub">{{ getWeekButtonLabel(planWeekNextKey).sub }}</span>
                </button>
                <button
                  type="button"
                  class="btn btn-date btn-date--with-subtitle"
                  :class="{ 'btn-date--active': weeklyAnchorDateKey === planWeekCurrentKey }"
                  @click="weeklyAnchorDateKey = planWeekCurrentKey"
                >
                  <span class="btn-date__title">{{ getWeekButtonLabel(planWeekCurrentKey).title }}</span>
                  <span class="btn-date__sub">{{ getWeekButtonLabel(planWeekCurrentKey).sub }}</span>
                </button>
                <span class="date-switcher__or">or</span>
                <TmsNativeCalendarField
                  v-model="planWeekPickerValue"
                  type="week"
                  class="date-switcher__picker date-switcher__picker--week"
                  :max="planWeekPickerMax"
                  title="Pick plan week"
                />
              </template>
              <template v-else>
                <button
                  type="button"
                  class="btn btn-date btn-date--with-subtitle"
                  :class="{ 'btn-date--active': weeklyAnchorDateKey === currentWeekAnchorKey }"
                  @click="weeklyAnchorDateKey = currentWeekAnchorKey"
                >
                  <span class="btn-date__title">{{ getWeekButtonLabel(currentWeekAnchorKey).title }}</span>
                  <span class="btn-date__sub">{{ getWeekButtonLabel(currentWeekAnchorKey).sub }}</span>
                </button>
                <button
                  type="button"
                  class="btn btn-date btn-date--with-subtitle"
                  :class="{ 'btn-date--active': weeklyAnchorDateKey === previousWeekAnchorKey }"
                  @click="weeklyAnchorDateKey = previousWeekAnchorKey"
                >
                  <span class="btn-date__title">{{ getWeekButtonLabel(previousWeekAnchorKey).title }}</span>
                  <span class="btn-date__sub">{{ getWeekButtonLabel(previousWeekAnchorKey).sub }}</span>
                </button>
                <span class="date-switcher__or">or</span>
                <TmsNativeCalendarField
                  v-model="planWeekPickerValue"
                  type="week"
                  class="date-switcher__picker date-switcher__picker--week"
                  :max="reportWeekPickerMax"
                  title="Pick report week"
                />
              </template>
            </div>
            <div
              v-if="isMonthlyPeriod && showActions"
              class="date-switcher"
              :class="{ 'date-switcher--plan': isPlanMode }"
            >
              <span class="date-switcher__label">{{ isPlanMode ? 'Plan Month:' : 'Report Month:' }}</span>
              <template v-if="isPlanMode">
                <button
                  type="button"
                  class="btn btn-date"
                  :class="{ 'btn-date--active': monthlyAnchorDateKey === planMonthNextKey }"
                  @click="monthlyAnchorDateKey = planMonthNextKey"
                >
                  {{ formatMonthButtonLabel(planMonthNextKey) }}
                </button>
                <button
                  type="button"
                  class="btn btn-date"
                  :class="{ 'btn-date--active': monthlyAnchorDateKey === planMonthCurrentKey }"
                  @click="monthlyAnchorDateKey = planMonthCurrentKey"
                >
                  {{ formatMonthButtonLabel(planMonthCurrentKey) }}
                </button>
                <span class="date-switcher__or">or</span>
                <TmsNativeCalendarField
                  v-model="planMonthPickerValue"
                  type="month"
                  class="date-switcher__picker"
                  :max="planMonthPickerMax"
                  title="Pick plan month"
                />
              </template>
              <template v-else>
                <button
                  type="button"
                  class="btn btn-date"
                  :class="{ 'btn-date--active': monthlyAnchorDateKey === currentMonthAnchorKey }"
                  @click="monthlyAnchorDateKey = currentMonthAnchorKey"
                >
                  {{ formatMonthButtonLabel(currentMonthAnchorKey) }}
                </button>
                <button
                  type="button"
                  class="btn btn-date"
                  :class="{ 'btn-date--active': monthlyAnchorDateKey === previousMonthAnchorKey }"
                  @click="monthlyAnchorDateKey = previousMonthAnchorKey"
                >
                  {{ formatMonthButtonLabel(previousMonthAnchorKey) }}
                </button>
                <span class="date-switcher__or">or</span>
                <TmsNativeCalendarField
                  v-model="planMonthPickerValue"
                  type="month"
                  class="date-switcher__picker"
                  :max="reportMonthPickerMax"
                  title="Pick report month"
                />
              </template>
            </div>
          </div>

          <div class="header-right">
            <div class="status-badge" :class="statusClass" role="status">
              <span class="status-badge__label">{{ statusLabel }}</span>
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
                title="Submit for review"
                @click="submitReport"
                :disabled="!isAllowedSubmitDate"
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
          :anchor-date="effectiveReportDate"
          :saved-doc="savedPlanDoc"
          :previous-plan-doc="previousPlanDoc"
          :user-id="String(authStore.user?.id || '')"
          :editable="isEditable"
          @update:sections="onPlanSectionsUpdate"
        />

        <ReportTicketsComposer
          v-else-if="useReportTicketsComposer"
          :period="period"
          :anchor-date="effectiveReportDate"
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
              :show-remove="sectionShowRemove(index)"
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
  shiftPeriodDate,
  getReportDocumentTitleParts,
  REPORT_PERIODS,
  buildKindDocumentReadView,
  sectionsFromKindReadView,
  sectionsForReportPersistence,
  sectionsForDocumentBody,
  getReportSectionPlaceholders,
  getKindSectionDisplay,
  getKindComposerPageTitle,
  getPlanComposerAnchorOptions,
  getPlanComposerPickerBounds,
  getReportComposerPickerBounds,
  isAllowedPlanComposerAnchor,
  isAllowedReportComposerAnchor,
} from '../utils/reportPeriod';
import { weekStartDateKey } from '../utils/weekRule';
import TmsNativeCalendarField from '../components/ui/TmsNativeCalendarField.vue';
import { useToast } from 'vue-toastification';
import ReportSectionCard from '../components/reports/ReportSectionCard.vue';
import PlanTicketsComposer from '../components/reports/PlanTicketsComposer.vue';
import { findLatestPlanDoc } from '../utils/planTickets';
import { validateReportTicketSections } from '../utils/reportTickets';
import ReportTicketsComposer from '../components/reports/ReportTicketsComposer.vue';
import ReportKindReadPage from '../components/reports/ReportKindReadPage.vue';
import ReportDocumentPage from '../components/reports/ReportDocumentPage.vue';
import ReportToolbarExportPrint from '../components/reports/ReportToolbarExportPrint.vue';
import { buildReportExportHtml, exportReportAsDoc, printReportHtml } from '../utils/reportDocumentExport';

const toast = useToast();
const authStore = useAuthStore();
const route = useRoute();
const period = computed(() => getReportPeriod(route.meta?.reportPeriod));
const isDailyPeriod = computed(() => period.value === 'daily');
const isWeeklyPeriod = computed(() => period.value === REPORT_PERIODS.WEEKLY);
const isMonthlyPeriod = computed(() => period.value === REPORT_PERIODS.MONTHLY);
const documentKind = computed(() => getDocumentKindFromRoute(route));
const kindPeriodLayout = computed(
  () => isDailyPeriod.value || isWeeklyPeriod.value || isMonthlyPeriod.value
);
const EST_TIMEZONE = 'America/New_York';

const report = ref(null);
const state = ref(0);
const estDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: EST_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});
const getESTDateKey = (d = new Date()) => estDateFormatter.format(d);
const shiftDateKey = (dateKey, deltaDays) => {
  const [y, m, day] = String(dateKey).split('-').map(Number);
  const base = new Date(Date.UTC(y, (m || 1) - 1, day || 1));
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}-${String(base.getUTCDate()).padStart(2, '0')}`;
};
const estTodayKey = getESTDateKey();
const estYesterdayKey = shiftDateKey(estTodayKey, -1);
const planAnchorOptions = getPlanComposerAnchorOptions(estTodayKey);
const planDailyNextKey = planAnchorOptions.daily.next;
const planDailyCurrentKey = planAnchorOptions.daily.current;
const planWeekNextKey = planAnchorOptions.weekly.next;
const planWeekCurrentKey = planAnchorOptions.weekly.current;
const planMonthNextKey = planAnchorOptions.monthly.next;
const planMonthCurrentKey = planAnchorOptions.monthly.current;
const planPickerBounds = getPlanComposerPickerBounds(estTodayKey);
const planWeekPickerMax = planPickerBounds.weekly.max;
const planMonthPickerMax = String(planPickerBounds.monthly.max).slice(0, 7);
// Report pickers allow any past period; only future is blocked (max = current period).
const reportPickerBounds = getReportComposerPickerBounds(estTodayKey);
const reportWeekPickerMax = reportPickerBounds.weekly.max;
const reportMonthPickerMax = String(reportPickerBounds.monthly.max).slice(0, 7);
const todayStr = estTodayKey;
const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC'
});
const monthLabelFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  timeZone: 'UTC'
});
const currentWeekAnchorKey = normalizeDateForPeriod(estTodayKey, REPORT_PERIODS.WEEKLY);
const previousWeekAnchorKey = shiftPeriodDate(currentWeekAnchorKey, -1, REPORT_PERIODS.WEEKLY);
const currentMonthAnchorKey = normalizeDateForPeriod(estTodayKey, REPORT_PERIODS.MONTHLY);
const previousMonthAnchorKey = shiftPeriodDate(currentMonthAnchorKey, -1, REPORT_PERIODS.MONTHLY);
const dailyDateKey = ref(estTodayKey);
const weeklyAnchorDateKey = ref(currentWeekAnchorKey);
const monthlyAnchorDateKey = ref(currentMonthAnchorKey);

function applyComposerDateDefaults() {
  if (isPlanKind(documentKind.value)) {
    dailyDateKey.value = planDailyNextKey;
    weeklyAnchorDateKey.value = planWeekNextKey;
    monthlyAnchorDateKey.value = planMonthNextKey;
  } else {
    dailyDateKey.value = estTodayKey;
    weeklyAnchorDateKey.value = currentWeekAnchorKey;
    monthlyAnchorDateKey.value = currentMonthAnchorKey;
  }
}
const viewMode = ref('edit');

const STORAGE_KEY = computed(() => `${period.value}_titles_${authStore.user?.id || 'anon'}`);

/** Draft + pending + rejected: member can edit. States 5–6 are read-only (awaiting team boss / final). */
const showActions = computed(() => [0, 1, 2, 3, 4].includes(state.value));
const isEditable = computed(() => [0, 1, 2, 3, 4].includes(state.value));
const useDocumentLayout = computed(() => !isEditable.value || viewMode.value === 'document');
const isPlanMode = computed(() => kindPeriodLayout.value && isPlanKind(documentKind.value));
const usePlanTicketsComposer = computed(() => isPlanMode.value && !useDocumentLayout.value);
const useReportTicketsComposer = computed(
  () => kindPeriodLayout.value && !isPlanMode.value && !useDocumentLayout.value
);
const useKindReadDocument = computed(
  () => useDocumentLayout.value && kindPeriodLayout.value && kindReadView.value
);
const savedPlanDoc = ref(null);
const loadedPlanDocs = ref([]);
const previousPlanDoc = computed(() => {
  if (!isPlanKind(documentKind.value)) return null;
  return findLatestPlanDoc(
    loadedPlanDocs.value,
    effectiveReportDate.value,
    period.value
  );
});
const kindReadView = ref(null);
const reportTicketValidation = ref([]);

const statusLabel = computed(() => {
  switch (state.value) {
    case 6:
      return 'Approved';
    case 5:
      return 'Awaiting team approval';
    case 2:
      return 'Pending';
    case 3:
    case 4:
      return 'Rejected';
    default:
      return 'Draft';
  }
});

const statusClass = computed(() => {
  switch (state.value) {
    case 6:
      return 'status-approved';
    case 5:
      return 'status-awaiting';
    case 2:
      return 'status-pending';
    case 3:
    case 4:
      return 'status-rejected';
    default:
      return 'status-draft';
  }
});

const documentTitleParts = computed(() =>
  getReportDocumentTitleParts(effectiveReportDate.value || todayStr, period.value)
);
const composerPageTitle = computed(() => getKindComposerPageTitle(period.value, documentKind.value));
const rejectReasonText = computed(() => String(report.value?.rejectReason || '').trim());

const effectiveReportDate = computed(() => {
  if (isDailyPeriod.value) {
    return dailyDateKey.value || (isPlanMode.value ? planDailyNextKey : estTodayKey);
  }
  if (isWeeklyPeriod.value) {
    return (
      weeklyAnchorDateKey.value ||
      (isPlanMode.value ? planWeekNextKey : currentWeekAnchorKey)
    );
  }
  if (isMonthlyPeriod.value) {
    return (
      monthlyAnchorDateKey.value ||
      (isPlanMode.value ? planMonthNextKey : currentMonthAnchorKey)
    );
  }
  return normalizeDateForPeriod(todayStr, period.value);
});
const isAllowedSubmitDate = computed(() => {
  const anchor = effectiveReportDate.value;
  if (isPlanMode.value) {
    return isAllowedPlanComposerAnchor(anchor, period.value);
  }
  return isAllowedReportComposerAnchor(anchor, period.value, estTodayKey);
});

const planWeekPickerValue = computed({
  get() {
    return weeklyAnchorDateKey.value || '';
  },
  set(dateKey) {
    const start = weekStartDateKey(dateKey);
    if (start) weeklyAnchorDateKey.value = start;
  }
});

const planMonthPickerValue = computed({
  get() {
    return String(monthlyAnchorDateKey.value || '').slice(0, 7);
  },
  set(ym) {
    const v = String(ym || '').trim();
    if (/^\d{4}-\d{2}$/.test(v)) {
      monthlyAnchorDateKey.value = `${v}-01`;
    }
  }
});

const reportFileBase = computed(() =>
  `report-${period.value}-${String(effectiveReportDate.value || '').replaceAll('/', '-')}`
);

function parseDateKeyUtc(dateKey) {
  const m = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function formatDateButtonLabel(dateKey) {
  const d = parseDateKeyUtc(dateKey);
  if (!d) return String(dateKey || '');
  return shortDateFormatter.format(d);
}

function formatMonthButtonLabel(monthStartKey) {
  const d = parseDateKeyUtc(monthStartKey);
  if (!d) return String(monthStartKey || '');
  return monthLabelFormatter.format(d);
}

function toOrdinalWord(n) {
  return ({ 1: 'First', 2: 'Second', 3: 'Third', 4: 'Fourth', 5: 'Fifth', 6: 'Sixth' }[n] || `${n}th`);
}

function getWeekButtonLabel(weekMondayKey) {
  const monday = parseDateKeyUtc(weekMondayKey);
  if (!monday) return { title: String(weekMondayKey || ''), sub: '' };
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  // Wednesday benchmark assigns week ownership/month label.
  const wednesday = new Date(monday);
  wednesday.setUTCDate(monday.getUTCDate() + 2);
  const weekNumberInMonth = Math.floor((wednesday.getUTCDate() - 1) / 7) + 1;
  const monthName = monthLabelFormatter.format(wednesday);
  return {
    title: `${monthName} ${toOrdinalWord(weekNumberInMonth)} Week`,
    sub: `(${monday.getUTCMonth() + 1}/${monday.getUTCDate()}-${sunday.getUTCMonth() + 1}/${sunday.getUTCDate()})`
  };
}

function buildExportHtml() {
  const title = documentTitleParts.value?.primary || 'Report';
  const range = documentTitleParts.value?.range || '';
  const sections =
    kindReadView.value && kindPeriodLayout.value
      ? sectionsFromKindReadView(kindReadView.value)
      : sectionsForDocumentBody(report.value?.sections || [], kindPeriodLayout.value);
  return buildReportExportHtml({
    title,
    range,
    metaLine: `${authStore.user?.name || 'Member'}${authStore.user?.group ? ` · ${authStore.user.group}` : ''}`,
    sections,
    period: period.value,
    dateKey: effectiveReportDate.value,
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

const coreSectionIndexes = computed(() => [0]);
const extraSectionIndexes = computed(() => {
  const len = report.value?.sections?.length ?? 0;
  if (!kindPeriodLayout.value || len <= 1) return [];
  return Array.from({ length: len - 1 }, (_, i) => i + 1);
});

function sectionNotesEditable(index) {
  if (!isEditable.value) return false;
  return true;
}

function sectionShowRemove(index) {
  if (!showActions.value) return false;
  if (kindPeriodLayout.value) return index >= 1;
  return (report.value?.sections?.length > 1);
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
  const display = getKindSectionDisplay(period.value, documentKind.value, effectiveReportDate.value);
  if (!showActions.value) {
    return { ...display, hint: '' };
  }
  return display;
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

function saveTitlesToStorage() {
  if (!report.value || kindPeriodLayout.value) return;
  const titles = report.value.sections.map((s) => s.title);
  localStorage.setItem(STORAGE_KEY.value, JSON.stringify(titles));
}

/** When the report can be edited, show the form first; read-only workflow states use document layout only. */
function applyDefaultViewMode() {
  viewMode.value = [0, 1, 2, 3, 4].includes(state.value) ? 'edit' : 'document';
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

function refreshKindReadView() {
  if (!report.value || !kindPeriodLayout.value) {
    kindReadView.value = null;
    return;
  }
  kindReadView.value = buildKindDocumentReadView(
    report.value,
    period.value,
    effectiveReportDate.value,
    documentKind.value
  );
}

async function loadReport() {
  try {
    const normalizedDate = normalizeDateForPeriod(effectiveReportDate.value, period.value);
    const [docRes, planRes] = await Promise.all([
      getDocumentsByUser(period.value, authStore.user.id, documentKind.value),
      getDocumentsByUser(period.value, authStore.user.id, DOCUMENT_KIND.PLAN)
    ]);
    const list = docRes.data || [];
    const planDocs = planRes.data || [];
    loadedPlanDocs.value = planDocs;

    if (kindPeriodLayout.value) {
      const doc = list.find((r) => r.date.split('T')[0] === normalizedDate);
      const base = doc || { state: 1, sections: [] };
      if (isPlanKind(documentKind.value)) {
        savedPlanDoc.value = base;
        report.value = { ...base, sections: base.sections?.length ? [...base.sections] : [] };
      } else {
        savedPlanDoc.value = null;
        report.value = { ...base, sections: base.sections?.length ? [...base.sections] : [] };
      }
      state.value = base.state ?? 1;
      applyDefaultViewMode();
      refreshKindReadView();
      return;
    }

    let todayReport = list.find((r) => r.date.split('T')[0] === normalizedDate);

    if (!todayReport) {
      const saved = localStorage.getItem(STORAGE_KEY.value);
      if (!saved) {
        todayReport = {
          state: 1,
          sections: [
            { title: 'Earning Money', notes: '' },
            { title: 'Catching Real Person', notes: '' },
            { title: 'Task Progress', notes: '' }
          ]
        };
      } else {
        const titles = JSON.parse(saved);
        todayReport = {
          state: 1,
          sections: titles.map((t) => ({ title: t, notes: '' }))
        };
      }
    }

    report.value = todayReport;
    state.value = todayReport.state;
    applyDefaultViewMode();
  } catch (err) {
    toast.error('Failed to load report');
  }
}

async function saveReport() {
  try {
    const normalizedDate = normalizeDateForPeriod(effectiveReportDate.value, period.value);
    await updateDocument(
      period.value,
      authStore.user.id,
      authStore.user.name,
      authStore.user.group,
      normalizedDate,
      {
        sections: sectionsForReportPersistence(report.value.sections, kindPeriodLayout.value),
        state: 1
      },
      documentKind.value
    );
    toast.success('Saved successfully');
    loadReport();
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

  if (!isAllowedSubmitDate.value) {
    if (isPlanMode.value) toast.warning('Plan submit date is outside the allowed range (EST).');
    else if (isDailyPeriod.value) toast.warning('Report submit cannot be a future date (EST).');
    else if (isWeeklyPeriod.value) toast.warning('Report submit cannot be a future week (EST).');
    else if (isMonthlyPeriod.value) toast.warning('Report submit cannot be a future month (EST).');
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
    const normalizedDate = normalizeDateForPeriod(effectiveReportDate.value, period.value);
    await updateDocument(
      period.value,
      authStore.user.id,
      authStore.user.name,
      authStore.user.group,
      normalizedDate,
      {
        sections: sectionsForReportPersistence(report.value.sections, kindPeriodLayout.value),
        state: 2
      },
      documentKind.value
    );
    toast.success('Submitted successfully');
    saveTitlesToStorage();
    loadReport();
  } catch {
    toast.error('Submit failed');
  }
}

applyComposerDateDefaults();
onMounted(loadReport);
watch(period, () => {
  applyComposerDateDefaults();
  loadReport();
});
watch(documentKind, () => {
  applyComposerDateDefaults();
  loadReport();
});
watch(() => route.name, () => {
  loadReport();
});
watch(effectiveReportDate, () => {
  loadReport();
});
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
  align-items: flex-start;
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
  flex: 1 1 auto;
  min-width: 0;
}

.date-switcher {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  max-width: 100%;
}

.date-switcher--plan {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
}

.date-switcher--plan .btn-date {
  flex-shrink: 0;
  white-space: nowrap;
}

.date-switcher__label {
  flex-shrink: 0;
  white-space: nowrap;
  font-size: .73rem;
  font-weight: 700;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: .04em;
}

.date-switcher__or {
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-tertiary);
  padding: 0 2px;
  white-space: nowrap;
}

.date-switcher__picker {
  flex: 0 0 10.25rem;
  width: 10.25rem;
  min-width: 0;
}

.date-switcher__picker--week {
  flex: 0 0 12.5rem;
  width: 12.5rem;
}

.date-switcher__picker :deep(.tms-ncf) {
  width: 100%;
}

.date-switcher__picker :deep(.tms-ncf__input) {
  min-height: 30px;
  height: 30px;
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
  font-size: 0.74rem;
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

/* Matches ReportDocumentPage (.rdoc__status) for consistency between View and Edit. */
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
  padding: 10px 16px;
  margin-top: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  border: 1px dashed color-mix(in srgb, var(--color-primary) 45%, var(--border-medium));
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-section:hover {
  background: color-mix(in srgb, var(--color-primary-soft) 70%, #fff);
  border-color: var(--color-primary);
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
.btn-date {
  height: 30px;
  padding: 0 10px;
  font-size: .74rem;
  background: var(--bg-secondary);
}
.btn-date--with-subtitle {
  height: auto;
  min-height: 40px;
  padding: 4px 10px;
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 1px;
}
.btn-date__title {
  font-size: 0.74rem;
  line-height: 1.1;
  font-weight: 700;
}
.btn-date__sub {
  font-size: 0.66rem;
  line-height: 1.05;
  opacity: 0.78;
  font-weight: 600;
}
.btn-date--active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-soft);
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

  .date-switcher--plan {
    flex-wrap: wrap;
  }

  .report-card {
    padding: 12px;
  }
}

@media (max-width: 480px) {
  .report-view {
    padding: 4px 8px;
  }

  .btn {
    flex: 1 1 auto;
    min-height: 44px;
  }

  .header-actions {
    width: 100%;
    justify-content: stretch;
    gap: 8px;
  }

  .header-actions .btn {
    flex: 1 1 calc(50% - 4px);
    text-align: center;
  }
}
</style>

