<template>
  <div class="report-view report-composer-page">
    <div class="report-card report-card--document">
      <ReportKindReadPage
        v-if="readView"
        :read-view="readView"
        :period="period"
        :user-id="userId"
        :anchor-date="anchorDate"
        :document-kind="documentKind"
        status-text="Not submitted"
        status-class="status-draft"
        :meta-line="metaLine"
        :show-summary="showSummary"
      >
        <template #actions>
          <ReportToolbarExportPrint @export-doc="handleExportDoc" @print="handlePrint" />
        </template>
      </ReportKindReadPage>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useToast } from 'vue-toastification';
import ReportKindReadPage from './ReportKindReadPage.vue';
import ReportToolbarExportPrint from './ReportToolbarExportPrint.vue';
import { buildKindDocumentReadView, getKindComposerPageTitle } from '../../utils/reportPeriod';
import { getDocumentKindFromRoute, isPlanKind, normalizeDocumentKind } from '../../constants/documentKind';
import { buildReportExportHtml, exportReportAsDoc, printReportHtml } from '../../utils/reportDocumentExport';
import { useRoute } from 'vue-router';
import { REPORT_PERIODS } from '../../utils/reportPeriod';

const props = defineProps({
  userId: { type: String, default: '' },
  period: { type: String, default: 'daily' },
  anchorDate: { type: String, default: '' },
  memberName: { type: String, default: 'Member' },
  groupName: { type: String, default: '' },
  documentKind: { type: String, default: '' }
});

const route = useRoute();
const toast = useToast();

const documentKind = computed(() =>
  props.documentKind ? normalizeDocumentKind(props.documentKind) : getDocumentKindFromRoute(route)
);

const metaLine = computed(() => {
  const name = String(props.memberName || 'Member').trim();
  const group = String(props.groupName || '').trim();
  return group ? `${name} · ${group}` : name;
});

const readView = computed(() => {
  if (!props.anchorDate) return null;
  return buildKindDocumentReadView(null, props.period, props.anchorDate, documentKind.value);
});

const showSummary = computed(
  () => !isPlanKind(documentKind.value) && props.period === REPORT_PERIODS.DAILY && Boolean(props.userId)
);

const exportFileBase = computed(() => {
  const kind = documentKind.value;
  const anchor = String(props.anchorDate || '').replace(/[^\d-]/g, '') || 'period';
  const uid = String(props.userId || 'member').slice(0, 8);
  return `${props.period}-${kind}-${anchor}-${uid}`;
});

function buildExportHtml() {
  const rv = readView.value;
  if (!rv) return '';
  const sections = [
    { title: rv.main?.label || 'Content', notes: rv.main?.notes || '' },
    ...(rv.extras || [])
  ];
  return buildReportExportHtml({
    title: getKindComposerPageTitle(props.period, documentKind.value),
    range: '',
    metaLine: metaLine.value,
    sections,
    period: props.period,
    dateKey: props.anchorDate,
    sideBySide: false
  });
}

function handleExportDoc() {
  if (!readView.value) return;
  exportReportAsDoc({ fileName: exportFileBase.value, html: buildExportHtml() });
}

function handlePrint() {
  if (!readView.value) return;
  const ok = printReportHtml(buildExportHtml());
  if (!ok) toast.error('Popup blocked. Please allow popups for printing.');
}
</script>
