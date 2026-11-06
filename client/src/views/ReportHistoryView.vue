<template>
  <div class="report-history-page">
    <div class="rh-layout">
      <aside class="rh-sidebar" aria-label="Report list and filters">
        <div class="rh-panel">
          <div class="rh-panel-head">
            <span class="rh-panel-title">{{ panelTitle }}</span>
            <span class="rh-panel-hint">{{ panelHint }}</span>
          </div>

          <div class="rh-filters">
            <template v-if="isDaily">
              <div class="rh-segment" role="group" aria-label="How to list daily reports">
                <button
                  type="button"
                  class="rh-segment-btn"
                  :class="{ 'is-active': dailyScopeMode === 'week' }"
                  @click="dailyScopeMode = 'week'"
                >
                  By week
                </button>
                <button
                  type="button"
                  class="rh-segment-btn"
                  :class="{ 'is-active': dailyScopeMode === 'month' }"
                  @click="dailyScopeMode = 'month'"
                >
                  By month
                </button>
              </div>

              <div class="rh-field">
                <label for="rh-history-cal">{{ dailyCalendarLabel }}</label>
                <ReportStatusCalendar
                  id="rh-history-cal"
                  granularity="daily"
                  palette="member"
                  :dots="memberDots"
                  v-model="historyCalendarValue"
                  compact
                />
                <span v-if="dailyScopeMode === 'week' && weekRangeHint" class="rh-field-hint">{{
                  weekRangeHint
                }}</span>
                <span v-else-if="dailyScopeMode === 'month'" class="rh-field-hint"
                  >Tap a day in the month to list every daily report in that calendar month</span
                >
              </div>
            </template>

            <template v-else-if="isWeekly">
              <div class="rh-field">
                <label for="rh-week-cal">Week</label>
                <ReportStatusCalendar
                  id="rh-week-cal"
                  granularity="weekly"
                  palette="member"
                  :dots="memberDots"
                  v-model="historyCalendarValue"
                  compact
                />
                <span class="rh-field-hint">{{ weekRangeHint }}</span>
              </div>
            </template>

            <template v-else>
              <div class="rh-field">
                <label for="rh-month-cal">Month</label>
                <ReportStatusCalendar
                  id="rh-month-cal"
                  granularity="monthly"
                  palette="member"
                  :dots="memberDots"
                  v-model="historyCalendarValue"
                  compact
                />
                <span class="rh-field-hint">One monthly report per key month</span>
              </div>
            </template>
          </div>

          <div class="rh-table-wrap">
            <div v-if="loadingStats" class="rh-loading" role="status">
              <span class="rh-spinner" aria-hidden="true" />
              <span>Loading your reports…</span>
            </div>

            <table v-else class="rh-table" :class="{ 'rh-table--daily': isDaily }">
              <thead>
                <tr>
                  <th class="col-num" scope="col">#</th>
                  <template v-if="isDaily">
                    <th scope="col">Date</th>
                  </template>
                  <template v-else>
                    <th scope="col">Name</th>
                    <th class="col-created" scope="col">Created</th>
                  </template>
                  <th class="col-status" scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, index) in sidebarRows"
                  :key="item.rowKey"
                  :class="{ 'is-selected': s_selectedRowKey === item.rowKey }"
                  :aria-selected="s_selectedRowKey === item.rowKey"
                  tabindex="0"
                  role="button"
                  @click="handleRowClick(item)"
                  @keydown.enter.prevent="handleRowClick(item)"
                  @keydown.space.prevent="handleRowClick(item)"
                >
                  <td class="col-num">{{ index + 1 }}</td>
                  <template v-if="isDaily">
                    <td class="col-date-only">
                      {{ formatDateDisplay(item._missing ? item.anchorDate : dateKeyFromItem(item)) }}
                    </td>
                  </template>
                  <template v-else>
                    <td class="col-name" :title="nameCellTooltip(item)">
                      {{ item._missing ? reportNameForAnchor(item.anchorDate) : reportName(item) }}
                    </td>
                    <td class="col-created">{{ item._missing ? '—' : formatCreated(item) }}</td>
                  </template>
                  <td class="col-status">
                    <span v-if="item._missing" class="rh-badge rh-badge--draft">Not submitted</span>
                    <span v-else class="rh-badge" :class="stateBadgeClass(item.state)">
                      {{ stateLabel(item.state) }}
                    </span>
                  </td>
                </tr>

                <tr v-if="sidebarRows.length === 0" class="rh-empty-row">
                  <td :colspan="isDaily ? 3 : 4" class="rh-empty">
                    <template v-if="stats.length === 0">
                      No reports yet for this period. When you save a report, it will appear here.
                    </template>
                    <template v-else-if="isDaily">
                      No daily reports in the selected
                      {{ dailyScopeMode === 'week' ? 'week' : 'month' }}. Try another
                      {{ dailyScopeMode === 'week' ? 'week' : 'month' }}.
                    </template>
                    <template v-else>
                      No saved report for the selected
                      {{ isWeekly ? 'week' : 'month' }}. Pick a different
                      {{ isWeekly ? 'week' : 'month' }}.
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </aside>

      <section class="rh-detail" aria-label="Selected report">
        <DailyReportView v-if="s_reportId" :key="`${documentKind}-${s_reportId}`" :p_id="s_reportId" />
        <ReportHistoryPendingPreview
          v-else-if="selectedPendingAnchor"
          :key="`${documentKind}-pending-${selectedPendingAnchor}`"
          :user-id="String(authStore.user?.id || '')"
          :period="period"
          :anchor-date="selectedPendingAnchor"
          :member-name="memberDisplayName"
          :group-name="memberGroupName"
          :document-kind="documentKind"
        />
        <div v-else class="rh-empty-detail">
          <div class="rh-empty-detail-inner">
            <p class="rh-empty-detail-title">Choose a report</p>
            <p class="rh-empty-detail-text">
              Select a row on the left to open that version. Document view is read-only for the standard sections; use Edit to change only extra sections you added.
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import DailyReportView from './DailyReportView_MemberChild.vue'
import ReportHistoryPendingPreview from '../components/reports/ReportHistoryPendingPreview.vue'
import ReportStatusCalendar from '../components/reports/ReportStatusCalendar.vue'
import { buildMemberDots } from '../utils/reportCalendarDots'
import { useAuthStore } from '../composables/useAuth'
import { provideReportHistorySidebarRefresh } from '../composables/useReportHistorySidebarRefresh'
import { getDocumentsByUser } from '../services/periodDocuments.js'
import { getDocumentKindFromRoute, isPlanKind } from '../constants/documentKind.js'
import {
  getReportPeriod,
  REPORT_PERIODS,
  normalizeDateForPeriod,
  formatReportDocumentTitle,
  addCalendarDaysDateKey,
  reportsForUserFromList
} from '../utils/reportPeriod'
import { weekStartDateKey } from '../utils/weekRule'
import { useToast } from 'vue-toastification'

const toast = useToast()
const authStore = useAuthStore()
const route = useRoute()

function todayEnCa() {
  return new Date().toLocaleDateString('en-CA')
}

function currentMonthValue() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

const period = computed(() => getReportPeriod(route.meta?.reportPeriod))
const documentKind = computed(() => getDocumentKindFromRoute(route))
const isDaily = computed(() => period.value === REPORT_PERIODS.DAILY)
const isWeekly = computed(() => period.value === REPORT_PERIODS.WEEKLY)
const loadingStats = ref(false)
const stats = ref([])
const s_reportId = ref('')
const s_selectedRowKey = ref('')

/** Daily history: list by ISO week or by calendar month */
const dailyScopeMode = ref('week')
const selectedWeek = ref('')
const selectedMonth = ref(currentMonthValue())
/** Calendar v-model: daily = any YYYY-MM-DD; weekly = Monday YYYY-MM-DD; monthly = YYYY-MM-01 */
const historyCalendarValue = ref(todayEnCa())

const dailyCalendarLabel = computed(() =>
  dailyScopeMode.value === 'week' ? 'Week (calendar)' : 'Month (calendar)'
)

const memberDots = computed(() => buildMemberDots(stats.value, period.value))

const STATE_LABELS = {
  1: { text: 'Draft', class: 'rh-badge--draft' },
  2: { text: 'Pending', class: 'rh-badge--pending' },
  3: { text: 'Rejected', class: 'rh-badge--rejected' },
  4: { text: 'Rejected', class: 'rh-badge--rejected' },
  5: { text: 'Awaiting team boss', class: 'rh-badge--awaiting' },
  6: { text: 'Approved', class: 'rh-badge--approved' }
}

function dateKeyFromItem(item) {
  if (!item?.date) return ''
  if (typeof item.date === 'string') return item.date.split('T')[0]
  try {
    return new Date(item.date).toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

/** The Saturday that starts the selected week. */
const selectedWeekMonday = computed(() => weekStartDateKey(selectedWeek.value) || '')

const selectedMonthAnchor = computed(() => {
  const v = String(selectedMonth.value || '').trim()
  const m = /^(\d{4})-(\d{2})$/.exec(v)
  if (!m) return ''
  return `${m[1]}-${m[2]}-01`
})

const panelTitle = computed(() => {
  const plan = isPlanKind(documentKind.value)
  if (isDaily.value) return plan ? 'Daily Plan History' : 'Daily Report History'
  if (isWeekly.value) return plan ? 'Weekly Plan History' : 'Weekly Report History'
  return plan ? 'Monthly Plan History' : 'Monthly Report History'
})

const panelHint = computed(() => {
  const plan = isPlanKind(documentKind.value)
  if (isDaily.value) {
    return plan
      ? 'Choose a week or month to list your daily plans, then open one from the list.'
      : 'Choose a week or month to list your daily reports, then open one from the list.'
  }
  if (isWeekly.value) {
    return plan
      ? 'Pick a week on the calendar; a week runs Saturday to Friday.'
      : 'Pick a week on the calendar; a week runs Saturday to Friday.'
  }
  return plan ? 'Pick a month to see the plan for that month.' : 'Pick a month to see the report for that month.'
})

const weekRangeHint = computed(() => {
  if (!selectedWeekMonday.value) return ''
  const mon = selectedWeekMonday.value
  const d = new Date(`${mon}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  const sun = new Date(d)
  sun.setDate(d.getDate() + 6)
  const fmt = (x) =>
    new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(x)
  return `Week spanning ${fmt(d)} – ${fmt(sun)}`
})

const filteredData = computed(() => {
  const rows = stats.value.filter((item) => {
    const raw = dateKeyFromItem(item)
    if (!raw) return false
    if (isDaily.value) {
      if (dailyScopeMode.value === 'week') {
        if (!selectedWeekMonday.value) return false
        const weekEnd = addCalendarDaysDateKey(selectedWeekMonday.value, 6)
        return raw >= selectedWeekMonday.value && raw <= weekEnd
      }
      const ym = String(selectedMonth.value || '').trim()
      if (!/^(\d{4})-(\d{2})$/.test(ym)) return false
      return raw.startsWith(`${ym}-`)
    }
    if (isWeekly.value) {
      if (!selectedWeekMonday.value) return false
      return normalizeDateForPeriod(raw, REPORT_PERIODS.WEEKLY) === selectedWeekMonday.value
    }
    if (!selectedMonthAnchor.value) return false
    return normalizeDateForPeriod(raw, REPORT_PERIODS.MONTHLY) === selectedMonthAnchor.value
  })
  if (isDaily.value) {
    return [...rows].sort((a, b) => dateKeyFromItem(a).localeCompare(dateKeyFromItem(b)))
  }
  return rows
})

const memberDisplayName = computed(() => authStore.user?.name || 'Member')
const memberGroupName = computed(() => {
  const g = String(authStore.user?.group || '').trim()
  return g && g !== '*' ? g : ''
})

function daysInSelectedMonth() {
  const ym = String(selectedMonth.value || '').trim()
  const m = /^(\d{4})-(\d{2})$/.exec(ym)
  if (!m) return []
  const y = Number(m[1])
  const mo = Number(m[2])
  const count = new Date(y, mo, 0).getDate()
  const out = []
  for (let d = 1; d <= count; d++) {
    out.push(`${m[1]}-${m[2]}-${String(d).padStart(2, '0')}`)
  }
  return out
}

function scopeDailyAnchors() {
  if (dailyScopeMode.value === 'week') {
    const mon = selectedWeekMonday.value
    if (!mon) return []
    return Array.from({ length: 7 }, (_, i) => addCalendarDaysDateKey(mon, i))
  }
  return daysInSelectedMonth()
}

function scopePeriodAnchor() {
  if (isWeekly.value) return selectedWeekMonday.value
  if (!isDaily.value) return selectedMonthAnchor.value
  return ''
}

function findReportForAnchor(anchor) {
  if (!anchor) return null
  return (
    stats.value.find((item) => {
      const raw = dateKeyFromItem(item)
      if (!raw || Number(item.state ?? 0) < 1) return false
      if (isDaily.value) return raw === anchor
      if (isWeekly.value) {
        return normalizeDateForPeriod(raw, REPORT_PERIODS.WEEKLY) === anchor
      }
      return normalizeDateForPeriod(raw, REPORT_PERIODS.MONTHLY) === anchor
    }) || null
  )
}

const pendingRows = computed(() => {
  const userId = String(authStore.user?.id || '').trim()
  if (!userId) return []

  const anchors = isDaily.value
    ? scopeDailyAnchors()
    : [scopePeriodAnchor()].filter(Boolean)

  const rows = []
  for (const anchor of anchors) {
    if (!anchor || findReportForAnchor(anchor)) continue

    rows.push({
      _id: null,
      _missing: true,
      anchorDate: anchor,
      rowKey: `pending:${anchor}`
    })
  }
  return rows
})

const sidebarRows = computed(() => {
  const submitted = filteredData.value.map((r) => ({
    ...r,
    _missing: false,
    rowKey: String(r._id)
  }))
  const pending = pendingRows.value

  if (isDaily.value) {
    return [...submitted, ...pending].sort((a, b) => {
      const ka = a._missing ? a.anchorDate : dateKeyFromItem(a)
      const kb = b._missing ? b.anchorDate : dateKeyFromItem(b)
      return String(ka).localeCompare(String(kb))
    })
  }

  if (submitted.length) return submitted
  return pending
})

const selectedPendingAnchor = computed(() => {
  if (s_reportId.value) return ''
  const row = sidebarRows.value.find((r) => r.rowKey === s_selectedRowKey.value && r._missing)
  return row?.anchorDate || ''
})

function syncWeekInputFromToday() {
  selectedWeek.value = normalizeDateForPeriod(todayEnCa(), REPORT_PERIODS.WEEKLY)
}

function syncHistoryCalendarFromSelectors() {
  if (isDaily.value) {
    if (dailyScopeMode.value === 'week') {
      historyCalendarValue.value = selectedWeekMonday.value || todayEnCa()
    } else {
      const ym = String(selectedMonth.value || '').trim()
      const ok = /^(\d{4})-(\d{2})$/.exec(ym)
      historyCalendarValue.value = ok ? `${ym}-01` : todayEnCa()
    }
  } else if (isWeekly.value) {
    historyCalendarValue.value = selectedWeekMonday.value || normalizeDateForPeriod(todayEnCa(), REPORT_PERIODS.WEEKLY)
  } else {
    historyCalendarValue.value =
      selectedMonthAnchor.value || normalizeDateForPeriod(todayEnCa(), REPORT_PERIODS.MONTHLY)
  }
}

function resetSelectorsForPeriod() {
  dailyScopeMode.value = 'week'
  syncWeekInputFromToday()
  selectedMonth.value = currentMonthValue()
  syncHistoryCalendarFromSelectors()
}

const loadStats = async () => {
  loadingStats.value = true
  stats.value = []
  try {
    const response = await getDocumentsByUser(period.value, authStore.user.id, documentKind.value)
    if (response.data) {
      stats.value = response.data
    }
  } catch (err) {
    console.error('Error loading stats:', err)
    toast.error('Could not load report history. Please try again.')
  } finally {
    loadingStats.value = false
  }
}

provideReportHistorySidebarRefresh(() => {
  void loadStats()
})

onMounted(() => {
  resetSelectorsForPeriod()
  loadStats()
})

watch(period, () => {
  s_reportId.value = ''
  s_selectedRowKey.value = ''
  resetSelectorsForPeriod()
  loadStats()
})

watch(documentKind, () => {
  s_reportId.value = ''
  s_selectedRowKey.value = ''
  resetSelectorsForPeriod()
  loadStats()
})

watch(dailyScopeMode, () => {
  syncHistoryCalendarFromSelectors()
})

watch(historyCalendarValue, (v) => {
  const raw = String(v || '').split('T')[0]
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return
  if (isDaily.value) {
    if (dailyScopeMode.value === 'week') {
      const start = normalizeDateForPeriod(raw, REPORT_PERIODS.WEEKLY)
      if (start && start !== selectedWeek.value) selectedWeek.value = start
    } else {
      const ym = raw.slice(0, 7)
      if (ym !== selectedMonth.value) selectedMonth.value = ym
    }
  } else if (isWeekly.value) {
    const start = normalizeDateForPeriod(raw, REPORT_PERIODS.WEEKLY)
    if (start && start !== selectedWeek.value) selectedWeek.value = start
  } else {
    const mo = normalizeDateForPeriod(raw, REPORT_PERIODS.MONTHLY)
    const ym = mo.slice(0, 7)
    if (ym !== selectedMonth.value) selectedMonth.value = ym
  }

  queueMicrotask(() => selectRowForAnchor(resolveAnchorFromCalendar(raw)))
})

function resolveAnchorFromCalendar(raw) {
  if (isDaily.value) return raw
  if (isWeekly.value) return normalizeDateForPeriod(raw, REPORT_PERIODS.WEEKLY)
  return normalizeDateForPeriod(raw, REPORT_PERIODS.MONTHLY)
}

function selectRowForAnchor(anchor) {
  if (!anchor) return
  const rows = sidebarRows.value
  const submitted = rows.find((r) => !r._missing && dateKeyFromItem(r) === anchor)
  if (submitted?._id) {
    s_selectedRowKey.value = submitted.rowKey
    s_reportId.value = submitted._id
    return
  }
  const pending = rows.find((r) => r._missing && r.anchorDate === anchor)
  if (pending) {
    s_selectedRowKey.value = pending.rowKey
    s_reportId.value = ''
  }
}

watch(sidebarRows, (rows) => {
  if (!rows.length) {
    s_reportId.value = ''
    s_selectedRowKey.value = ''
    return
  }
  const current = rows.find((r) => r.rowKey === s_selectedRowKey.value)
  if (current) {
    s_reportId.value = current._id || ''
    return
  }
  const firstReport = rows.find((r) => r._id)
  if (firstReport) {
    s_selectedRowKey.value = firstReport.rowKey
    s_reportId.value = firstReport._id
    return
  }
  const firstPending = rows.find((r) => r._missing)
  if (firstPending) {
    s_selectedRowKey.value = firstPending.rowKey
    s_reportId.value = ''
  }
})

const stateLabel = (state) => STATE_LABELS[state]?.text ?? '-'
const stateBadgeClass = (state) => STATE_LABELS[state]?.class ?? 'rh-badge--muted'

function formatDateDisplay(dateKey) {
  const raw = String(dateKey || '').split('T')[0]
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return '-'
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
      new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`)
    )
  } catch {
    return '-'
  }
}

function reportName(item) {
  const key = dateKeyFromItem(item)
  if (!key) return '-'
  return formatReportDocumentTitle(key, period.value)
}

function reportNameForAnchor(anchor) {
  if (!anchor) return '-'
  return formatReportDocumentTitle(anchor, period.value)
}

function nameCellTooltip(item) {
  const who = item?.username ? String(item.username) : 'Member'
  return `${who} - ${reportName(item)}`
}

function createdAtFromMongoId(id) {
  try {
    const hex = String(id).slice(0, 8)
    if (hex.length !== 8) return null
    const ms = parseInt(hex, 16) * 1000
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

function formatCreated(item) {
  const d = createdAtFromMongoId(item?._id)
  if (!d) return '-'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(d)
}

const handleRowClick = (item) => {
  s_selectedRowKey.value = item.rowKey
  s_reportId.value = item._id || ''
}
</script>

<style scoped>
.report-history-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: var(--content-max-width);
  margin: 0 auto;
  min-height: min(85vh, 900px);
  padding: 0 var(--spacing-sm) var(--spacing-sm);
  padding-left: max(var(--spacing-sm), env(safe-area-inset-left));
  padding-right: max(var(--spacing-sm), env(safe-area-inset-right));
  padding-bottom: max(var(--spacing-sm), env(safe-area-inset-bottom));
  font-family: var(--font-family-base);
  box-sizing: border-box;
}

.rh-layout {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0.75rem;
  flex: 1;
  min-height: 0;
}

.rh-sidebar {
  flex: 0 0 min(100%, 19rem);
  max-width: 20rem;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.rh-panel {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  min-height: 0;
  flex: 1;
  max-height: min(78vh, 820px);
}

.rh-panel-head {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.rh-panel-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.rh-panel-hint {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  line-height: var(--line-height-normal);
}

.rh-filters {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.rh-segment {
  display: flex;
  width: 100%;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  overflow: hidden;
  background: var(--color-gray-50);
}

.rh-segment-btn {
  flex: 1;
  padding: 0.4rem 0.5rem;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  font-family: inherit;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.rh-segment-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.rh-segment-btn.is-active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.rh-field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.rh-field label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.rh-field-hint {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--text-tertiary);
  line-height: var(--line-height-normal);
  text-transform: none;
  letter-spacing: 0;
}

.rh-field :deep(.tms-ncf) {
  width: 100%;
}

.rh-table-wrap {
  flex: 1;
  min-height: 10rem;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: var(--color-gray-50);
}

.rh-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  min-height: 9rem;
  padding: var(--spacing-lg);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.rh-spinner {
  width: 1.75rem;
  height: 1.75rem;
  border: 2px solid var(--border-medium);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: rh-spin 0.7s linear infinite;
}

@keyframes rh-spin {
  to {
    transform: rotate(360deg);
  }
}

.rh-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-xs);
  table-layout: fixed;
}

.rh-table thead {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--bg-primary);
  box-shadow: 0 1px 0 var(--border-light);
}

.rh-table th {
  text-align: left;
  padding: 0.5rem 0.5rem;
  font-weight: var(--font-weight-semibold);
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
  border-bottom: 1px solid var(--border-light);
}

.rh-table td {
  padding: 0.5rem 0.5rem;
  border-bottom: 1px solid var(--border-light);
  color: var(--text-secondary);
  vertical-align: middle;
}

.rh-table tbody tr {
  cursor: pointer;
  transition: background var(--transition-fast);
}

.rh-table tbody tr:hover {
  background: var(--color-primary-soft);
}

.rh-table tbody tr:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.rh-table tbody tr.is-selected {
  background: var(--color-primary-soft);
  box-shadow: inset 3px 0 0 0 var(--color-primary);
}

.col-num {
  width: 1.75rem;
  text-align: right;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.col-date-only {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.rh-table--daily .col-status {
  width: auto;
}

.col-name {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-created {
  width: 6.5rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--text-tertiary);
  font-size: 0.7rem;
}

.col-status {
  width: 5.5rem;
  text-align: right;
}

.rh-badge {
  display: inline-block;
  font-size: 0.65rem;
  font-weight: var(--font-weight-semibold);
  padding: 0.15rem 0.4rem;
  border-radius: var(--radius-full);
  line-height: 1.3;
  white-space: nowrap;
}

.rh-badge--draft {
  background: var(--color-gray-200);
  color: var(--color-gray-700);
}

.rh-badge--pending {
  background: #dbeafe;
  color: #1e40af;
}

.rh-badge--rejected {
  background: #fee2e2;
  color: var(--color-error);
}

.rh-badge--awaiting {
  background: #fef3c7;
  color: var(--color-warning);
}

.rh-badge--approved {
  background: #dcfce7;
  color: var(--color-success);
}

.rh-badge--muted {
  background: var(--color-gray-100);
  color: var(--text-tertiary);
}

.rh-empty-row .rh-empty {
  text-align: center;
  padding: var(--spacing-lg) var(--spacing-sm);
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.rh-detail {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.rh-detail :deep(.report-view) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.rh-empty-detail {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 18rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px dashed var(--border-medium);
}

.rh-empty-detail-inner {
  max-width: 22rem;
  text-align: center;
  padding: var(--spacing-xl);
}

.rh-empty-detail-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-sm);
}

.rh-empty-detail-text {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  line-height: var(--line-height-relaxed);
}

@media (max-width: 960px) {
  .rh-layout {
    flex-direction: column;
  }

  .rh-sidebar {
    flex: none;
    max-width: none;
    width: 100%;
  }

  .rh-panel {
    max-height: none;
  }

  .rh-table-wrap {
    max-height: min(48vh, 420px);
  }

  .rh-detail {
    min-height: min(45vh, 480px);
  }
}

@media (max-width: 640px) {
  .report-history-page {
    min-height: auto;
    padding-left: max(10px, env(safe-area-inset-left));
    padding-right: max(10px, env(safe-area-inset-right));
  }

  .rh-panel {
    padding: var(--spacing-sm);
  }

  .rh-segment-btn {
    padding: 0.55rem 0.4rem;
    font-size: 0.8rem;
  }

  .rh-table-wrap {
    max-height: min(42vh, 380px);
  }
}

@media (max-width: 400px) {
  .rh-table th,
  .rh-table td {
    padding: 0.4rem 0.35rem;
  }

  .col-created {
    width: 5.5rem;
    font-size: 0.65rem;
  }
}
</style>
