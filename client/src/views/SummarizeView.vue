<template>
  <div class="sz-page">
    <!-- HEADER -->
    <header class="sz-header">
      <div class="sz-header__title">
        <h1>{{ isMonthly ? 'Monthly Summarize' : 'Weekly Summarize' }}</h1>
        <p class="sz-header__sub">
          <span>{{ windowLabel }}</span>
        </p>
      </div>

      <div class="sz-controls">
        <div class="sz-month">
          <button type="button" class="sz-icon-btn" aria-label="Previous month" @click="shiftMonth(-1)">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <TmsNativeCalendarField v-model="month" type="month" title="Month" />
          <button type="button" class="sz-icon-btn" aria-label="Next month" @click="shiftMonth(1)">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>

        <label v-if="mode === 'week'" class="sz-field">
          <span class="sz-field__label">Week</span>
          <select
            class="sz-select"
            :value="periodId"
            :disabled="!periods.length"
            @change="onPeriodChange"
          >
            <option v-if="!periods.length" value="">No weeks</option>
            <option v-for="p in periods" :key="p._id" :value="p._id">
              {{ p.definition }} · {{ periodRangeLabel(p) }}
            </option>
          </select>
        </label>

        <label v-if="allGroups.length > 1" class="sz-field">
          <span class="sz-field__label">Group</span>
          <select v-model="groupFilter" class="sz-select">
            <option value="all">All groups</option>
            <option v-for="g in allGroups" :key="g.code" :value="g.code">{{ g.name }}</option>
          </select>
        </label>
      </div>
    </header>

    <!-- SUMMARY -->
    <section class="sz-section" aria-labelledby="sz-summary-title">
      <div class="sz-section__head">
        <div>
          <h2 id="sz-summary-title">Team Summary</h2>
          <p class="sz-section__desc">Results for every member, grouped by team.</p>
        </div>
        <div class="sz-section__tools">
          <button
            v-if="canEditInputs"
            type="button"
            class="sz-btn"
            :disabled="loading"
            title="Enter this week's counts"
            @click="inputsOpen = true"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M13.5 6.5l4 4" stroke="currentColor" stroke-width="2"/></svg>
            Weekly counts
          </button>
          <button
            v-if="canEditTargets"
            type="button"
            class="sz-btn"
            :disabled="loading"
            title="Set this month's profile targets"
            @click="targetsOpen = true"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>
            Monthly targets
          </button>
          <button type="button" class="sz-btn" :disabled="loading" @click="load">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" :class="{ 'is-spinning': loading }"><path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Refresh
          </button>
          <button type="button" class="sz-btn sz-btn--primary" :disabled="!visibleGroups.length" @click="exportCsv">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Export CSV
          </button>
        </div>
      </div>

      <!-- STATES -->
      <div v-if="loading && !data" class="sz-state">
        <span class="sz-spinner" aria-hidden="true"></span>
        <p>Loading summarize…</p>
      </div>

      <div v-else-if="error" class="sz-state sz-state--error">
        <p>{{ error }}</p>
        <button type="button" class="sz-btn" @click="load">Try again</button>
      </div>

      <div v-else-if="data && mode === 'week' && !periods.length" class="sz-state">
        <p class="sz-state__title">No weeks are set up for {{ formatMonth(month) }}</p>
        <p>Weekly summarize uses the week periods and weekly plans for the month.</p>
        <router-link :to="{ name: 'PeriodicPlansView' }" class="sz-btn">Set up weeks in Week Plans</router-link>
      </div>

      <div v-else-if="data && !visibleGroups.length" class="sz-state">
        <p class="sz-state__title">No members to summarize</p>
        <p>There are no active group members for this period.</p>
      </div>

      <div v-else-if="data" class="sz-body" :class="{ 'is-refreshing': loading }">
        <!-- GROUP RANKING -->
        <SummarizeGroupRanking
          :groups="rankedGroups"
          :caption="groupRankingCaption"
          :selected="groupFilter"
          :loading="worktimeLoading"
          @toggle="toggleGroup"
        />

        <!-- TABLES (one per group type in the weekly view) -->
        <div v-for="table in groupTables" :key="table.type" class="sz-table-block">
          <h3 v-if="table.label" class="sz-table-title">
            {{ table.label }}
            <span>{{ table.hint }}</span>
          </h3>

          <div class="sz-table-wrap">
            <table class="sz-table" :class="{ 'sz-table--compact': table.resultColumns.length < 3 }">
              <thead>
                <tr class="sz-head-sections">
                  <th class="c-no" scope="col" rowspan="2">No</th>
                  <th class="c-member" scope="col" rowspan="2" :aria-sort="ariaSort('name')">
                    <button type="button" class="sz-sort" @click="toggleSort('name')">
                      <span class="sz-head-title">
                        Member <span class="sz-sort__icon" :class="{ 'is-on': sort.key === 'name' }">{{ sortIcon('name') }}</span>
                      </span>
                    </button>
                  </th>
                  <th
                    v-for="section in table.sections"
                    :key="section.label"
                    class="c-section"
                    :class="section.cls"
                    scope="colgroup"
                    :colspan="section.span"
                  >
                    {{ section.label }}
                  </th>
                </tr>
                <tr class="sz-head-cols">
                  <th v-for="col in MONEY_COLUMNS" :key="col.key" class="c-num" scope="col" :aria-sort="ariaSort(col.key)">
                    <button type="button" class="sz-sort" @click="toggleSort(col.key)">
                      <span class="sz-head-title">
                        {{ col.label }} <span class="sz-sort__icon" :class="{ 'is-on': sort.key === col.key }">{{ sortIcon(col.key) }}</span>
                      </span>
                    </button>
                  </th>
                  <th v-for="col in table.financeColumns" :key="col.key" class="c-result" :class="col.cls" scope="col">
                    <button type="button" class="sz-sort" :title="col.title" @click="toggleSort(col.key)">
                      <span class="sz-head-stack">
                        <span class="sz-head-title">
                          {{ col.label || 'Result' }} <span class="sz-sort__icon" :class="{ 'is-on': sort.key === col.key }">{{ sortIcon(col.key) }}</span>
                        </span>
                        <span v-for="rule in col.rules" :key="rule" class="sz-head-rule">{{ rule }}</span>
                      </span>
                    </button>
                  </th>
                  <th v-for="col in table.accountColumns" :key="col.key" class="c-acc" scope="col" :title="accountColumnTitle(col)">
                    <span class="sz-head-stack">
                      <span class="sz-head-title">{{ col.short }}</span>
                    </span>
                  </th>
                  <th
                    v-for="col in table.scoreColumns"
                    :key="col.key"
                    class="c-result"
                    :class="col.cls"
                    scope="col"
                    :aria-sort="col.sortable ? ariaSort(col.key) : null"
                  >
                    <button v-if="col.sortable" type="button" class="sz-sort" :title="col.title" @click="toggleSort(col.key)">
                      <span class="sz-head-stack">
                        <span class="sz-head-title">
                          {{ col.label || 'Result' }} <span class="sz-sort__icon" :class="{ 'is-on': sort.key === col.key }">{{ sortIcon(col.key) }}</span>
                        </span>
                        <span v-for="rule in col.rules" :key="rule" class="sz-head-rule">{{ rule }}</span>
                      </span>
                    </button>
                    <span v-else class="sz-head-label" :title="col.title">
                      <span class="sz-head-stack">
                        <span class="sz-head-title">{{ col.label || 'Result' }}</span>
                        <span v-for="rule in col.rules" :key="rule" class="sz-head-rule">{{ rule }}</span>
                      </span>
                    </span>
                  </th>
                </tr>
              </thead>

              <tbody v-for="g in table.groups" :key="g.code" class="sz-group" :style="{ '--g-accent': g.accent }">
                <tr class="sz-band">
                  <th :colspan="table.columnCount" scope="rowgroup">
                    <span class="sz-band__inner">
                      <span class="sz-band__dot" aria-hidden="true"></span>
                      <span class="sz-band__name">{{ g.name }}</span>
                      <span class="sz-band__meta">
                        {{ g.memberCount }} {{ g.memberCount === 1 ? 'member' : 'members' }} · {{ g.plannedCount }} with plan<template v-if="g.excludedCount"> · {{ g.excludedCount }} not counted</template>
                      </span>
                    </span>
                  </th>
                </tr>

                <tr v-for="(m, i) in g.members" :key="m.userId" class="sz-row" :class="{ 'is-alt': i % 2 === 1, 'is-excluded': m.excluded }">
                  <td class="c-no">{{ i + 1 }}</td>
                  <td class="c-member">
                    <span class="sz-member">
                      <UserAvatar :name="m.name" :profile-image="m.avatarUrl" :size="26" :tooltip="false" />
                      <span class="sz-member__name" :title="m.email || m.name">{{ m.name }}</span>
                      <span v-if="isBoss(m.role)" class="sz-tag">Boss</span>
                      <span v-if="m.status && m.status !== 'active'" class="sz-tag sz-tag--muted">{{ m.status }}</span>
                      <span v-if="m.excluded" class="sz-tag sz-tag--muted" title="Left out of this week's percentages">Not counted</span>
                    </span>
                  </td>
                  <td
                    v-for="col in MONEY_COLUMNS"
                    :key="col.key"
                    class="c-num"
                    :class="moneyCell(m, col.key, true).cls"
                  >
                    {{ moneyCell(m, col.key, true).text }}
                  </td>
                  <td v-for="cell in resultCells(memberScores(m), table.financeColumns)" :key="cell.key" class="c-result" :class="cell.cls">
                    <SummarizeResultCell v-if="!cell.blank" :value="cell.value" :detail="cell.detail" :hint="cell.hint" :empty-hint="cell.emptyHint" />
                  </td>
                  <td v-for="col in table.accountColumns" :key="col.key" class="c-acc">
                    <ProfileCountCell :cell="m.profile?.cells?.[col.key]" :reviews="col.reviews" />
                  </td>
                  <td v-for="cell in resultCells(memberScores(m), table.scoreColumns)" :key="cell.key" class="c-result" :class="cell.cls">
                    <span v-if="cell.loading" class="sz-pending" aria-label="Loading">…</span>
                    <SummarizeResultCell
                      v-else-if="!cell.blank"
                      :value="cell.value"
                      :detail="cell.detail"
                      :hint="cell.hint"
                      :empty-hint="cell.emptyHint"
                    />
                    <!-- Super admin: take 1% off (or give it back) the member's Final WorkTime for this week. -->
                    <span
                      v-if="cell.key === 'worktime' && !cell.loading && canEditDeductions && (hasNumber(m.worktimeBase) || m.worktimeDeduction > 0)"
                      class="sz-deduct"
                    >
                      <button
                        type="button"
                        class="sz-deduct__btn"
                        :disabled="savingDeduction.has(m.userId) || m.worktimeDeduction >= 100"
                        :title="`Take 1% off ${m.name}'s Final WorkTime for this week`"
                        :aria-label="`Deduct 1% from ${m.name}'s WorkTime`"
                        @click="changeDeduction(m, 1)"
                      >−1%</button>
                      <button
                        v-if="m.worktimeDeduction > 0"
                        type="button"
                        class="sz-deduct__btn"
                        :disabled="savingDeduction.has(m.userId)"
                        :title="`Give 1% back (${m.worktimeDeduction}% deducted now)`"
                        :aria-label="`Give 1% back to ${m.name}'s WorkTime`"
                        @click="changeDeduction(m, -1)"
                      >+1%</button>
                    </span>
                  </td>
                </tr>

                <tr class="sz-sum sz-sum--total">
                  <td class="c-no"></td>
                  <th class="c-member" scope="row">Group total</th>
                  <td v-for="col in MONEY_COLUMNS" :key="col.key" class="c-num" :class="moneyCell(g.totals, col.key).cls">
                    {{ moneyCell(g.totals, col.key).text }}
                  </td>
                  <td v-for="cell in resultCells(groupScores(g), table.financeColumns)" :key="cell.key" class="c-result" :class="cell.cls">
                    <SummarizeResultCell v-if="!cell.blank" :value="cell.value" :detail="cell.detail" :hint="cell.hint" :empty-hint="cell.emptyHint" />
                  </td>
                  <td v-for="col in table.accountColumns" :key="col.key" class="c-acc">
                    <ProfileCountCell :cell="g.profile?.cells?.[col.key]" :reviews="col.reviews" strong />
                  </td>
                  <td v-for="cell in resultCells(groupScores(g), table.scoreColumns)" :key="cell.key" class="c-result" :class="cell.cls">
                    <span v-if="cell.loading" class="sz-pending" aria-label="Loading">…</span>
                    <SummarizeResultCell
                      v-else-if="!cell.blank"
                      :value="cell.value"
                      :detail="cell.detail"
                      :hint="cell.hint"
                      :empty-hint="cell.emptyHint"
                    />
                  </td>
                </tr>
                <tr class="sz-sum sz-sum--avg">
                  <td class="c-no"></td>
                  <th class="c-member" scope="row">Average</th>
                  <td v-for="col in MONEY_COLUMNS" :key="col.key" class="c-num" :class="moneyCell(g.averages, col.key).cls">
                    {{ moneyCell(g.averages, col.key).text }}
                  </td>
                  <td v-for="col in table.financeColumns" :key="col.key" class="c-result" :class="col.cls"></td>
                  <td v-for="col in table.accountColumns" :key="col.key" class="c-acc"></td>
                  <td v-for="col in table.scoreColumns" :key="col.key" class="c-result" :class="col.cls"></td>
                </tr>
              </tbody>

              <tfoot v-if="table.footer">
                <tr class="sz-sum sz-sum--overall">
                  <td class="c-no"></td>
                  <th class="c-member" scope="row">{{ table.footerLabel }}</th>
                  <td v-for="col in MONEY_COLUMNS" :key="col.key" class="c-num" :class="moneyCell(table.footer.money, col.key).cls">
                    {{ moneyCell(table.footer.money, col.key).text }}
                  </td>
                  <td v-for="cell in resultCells(table.footer.scores, table.financeColumns)" :key="cell.key" class="c-result" :class="cell.cls">
                    <SummarizeResultCell v-if="!cell.blank" :value="cell.value" :detail="cell.detail" :hint="cell.hint" :empty-hint="cell.emptyHint" />
                  </td>
                  <td v-for="col in table.accountColumns" :key="col.key" class="c-acc">
                    <ProfileCountCell :cell="table.footer.profileCells?.[col.key]" :reviews="col.reviews" strong />
                  </td>
                  <td v-for="cell in resultCells(table.footer.scores, table.scoreColumns)" :key="cell.key" class="c-result" :class="cell.cls">
                    <span v-if="cell.loading" class="sz-pending" aria-label="Loading">…</span>
                    <SummarizeResultCell
                      v-else-if="!cell.blank"
                      :value="cell.value"
                      :detail="cell.detail"
                      :hint="cell.hint"
                      :empty-hint="cell.emptyHint"
                    />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- MEMBER RANKING -->
        <SummarizeMemberRanking
          :rows="rankingRows"
          :groups="legendGroups"
          :caption="memberRankingCaption"
          total-label="Total"
          :loading="worktimeLoading"
        />

        <div class="sz-notes">
          <p class="sz-note">
            <strong>Finance:</strong> Profit = accepted income − accepted outcome. Result = Profit ÷ Plan.
            Pending income is shown for reference and is not counted.
          </p>
          <template v-if="isMonthly">
            <p class="sz-note">
              <strong>Profiles:</strong> a cell reads big · reviews · new for Upwork Dev, Upwork Client
              and Freelancer, and big · new everywhere else. Counted accounts = 1 for each Upwork Dev,
              Upwork Client or Freelancer profile plus 1 for every review it carries (one review makes 2),
              plus each big profile on Contra and the AI-training platforms, plus every caller / keeper
              profile. New accounts outside those three platforms are not counted. A member scores
              counted ÷ target; a job member averages that with their job offers; a group is the average
              of its members.
            </p>
          </template>
          <template v-else>
            <p class="sz-note">
              <strong>WorkTime:</strong> Real = the same target % as Worktime Management for this week
              (holidays included, added time counted). From 95% up, Final = (Real − 95) × 20, capped at 100%:
              95% gives 0%, 97.5% gives 50%, 100% gives 100%. Under 95%, Final = Real − 95, a negative score:
              85.9% gives −9.1%. Group rows show the members' average Final %.
              Super admin can take 1% at a time off a member's Final % for the week (shown as "−N%" under it);
              the reduced value, which can go below 0%, is what Total and the rankings use.
            </p>
            <p class="sz-note">
              <strong>Weekly counts</strong> are entered per week by super admin, per member and per group.
              Normal teams count calls per member and getting citizen per group; job teams count job interviews
              per member and job offers per group. A group count with no entry uses a plan of
              {{ data.defaultGroupCountPlan }} for that week.
            </p>
            <p class="sz-note">
              <strong>Total:</strong> member = the average of Finance, Final WorkTime and their weekly count;
              group = the average of those three plus the group's own count (Getting citizen / Job offer).
              A member with <strong>no plan</strong> for something (finance plan, call / interview plan) is left out
              of that percentage everywhere — their own Total, and their group's — since there is nothing to measure
              them against. Their money still shows in the group's Plan / Income / Profit sums.
            </p>
            <p class="sz-note">
              Super admin can switch a member off for a week in <strong>Weekly counts</strong>. They stay in the
              table, marked "Not counted", and are left out of every percentage of that week.
            </p>
          </template>
          <p v-if="worktimeError" class="sz-note sz-note--error">WorkTime could not be loaded: {{ worktimeError }}</p>
        </div>
      </div>
    </section>

    <SummarizeWeeklyInputsModal
      v-if="inputsOpen && data?.period"
      :period="data.period"
      :period-label="periodLabel(data.period)"
      :groups="allGroups"
      :default-plan="data.defaultGroupCountPlan"
      @close="inputsOpen = false"
      @saved="onInputsSaved"
    />

    <SummarizeProfileTargetsModal
      v-if="targetsOpen && data?.profiles"
      :data="data.profiles"
      :month="month"
      @close="targetsOpen = false"
      @saved="onTargetsSaved"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import UserAvatar from '../components/UserAvatar.vue';
import TmsNativeCalendarField from '../components/ui/TmsNativeCalendarField.vue';
import SummarizeResultCell from '../components/summarize/SummarizeResultCell.vue';
import SummarizeWeeklyInputsModal from '../components/summarize/SummarizeWeeklyInputsModal.vue';
import SummarizeProfileTargetsModal from '../components/summarize/SummarizeProfileTargetsModal.vue';
import ProfileCountCell from '../components/summarize/ProfileCountCell.vue';
import SummarizeGroupRanking from '../components/summarize/SummarizeGroupRanking.vue';
import SummarizeMemberRanking from '../components/summarize/SummarizeMemberRanking.vue';
import { getSummarize, saveWorktimeDeduction } from '../services/summarize';
import { getWorkflowChartData } from '../services/workflow';
import { formatMonth, getNextMonth, getPreviousMonth } from '../utils/financeHelpers';
import { getESTMonthKey } from '../utils/timezoneHelpers';
import { monthRangeKeys, monthRangeLabel } from '../utils/businessMonth';
import { computeWorktimeMetrics, worktimeFinalPercent } from '../utils/worktimeMetrics';
import { useThemeAppearance } from '../composables/useThemeAppearance';

const MONTH_RE = /^\d{4}-\d{2}$/;

const MONEY_COLUMNS = [
  { key: 'plan', label: 'Plan' },
  { key: 'income', label: 'Income' },
  { key: 'outcome', label: 'Outcome' },
  { key: 'profit', label: 'Profit' },
  { key: 'pending', label: 'Pending' }
];

/** Result columns, keyed by the score they show. The rule rides under the label. */
const COLUMN = {
  finance: { key: 'result', section: 'Finance', sortable: true, cls: '', rules: ['Profit ÷ Plan'], title: 'Finance: profit ÷ plan' },
  worktime: {
    key: 'worktime',
    section: 'WorkTime',
    sortable: true,
    cls: 'c-section-start c-worktime',
    rules: ['Final = (Real − 95) × 20', 'Under 95: Real − 95'],
    title: 'WorkTime: Final % from the Real target % (Worktime Management)'
  },
  calls: {
    key: 'calls',
    section: 'Call count',
    sortable: true,
    cls: 'c-section-start',
    rules: ['Made ÷ Plan'],
    title: 'Call count: calls made ÷ call plan'
  },
  // The same per-member count, named for a job team.
  interviewCount: {
    key: 'calls',
    section: 'Interview count',
    sortable: true,
    cls: 'c-section-start',
    rules: ['Got ÷ Plan'],
    title: 'Interview count: job interviews got ÷ plan, per member'
  },
  citizen: {
    key: 'citizen',
    section: 'Getting citizen',
    sortable: false,
    cls: 'c-section-start',
    rules: ['Got ÷ Plan · group'],
    title: 'Getting citizen (per group): got ÷ plan'
  },
  offer: {
    key: 'offer',
    section: 'Job offer',
    sortable: false,
    cls: 'c-section-start',
    rules: ['Got ÷ Plan · group'],
    title: 'Job offers (per group): got ÷ plan'
  },
  // Monthly: the citizen profiles each member owns, counted against their target.
  profile: {
    key: 'profile',
    section: 'Profiles',
    sortable: true,
    cls: 'c-section-start',
    rules: ['Counted ÷ Target'],
    title: 'Profiles: counted accounts ÷ the month target'
  },
  profileOffer: {
    key: 'profileOffer',
    section: 'Job offer',
    sortable: false,
    cls: 'c-section-start',
    rules: ['Got ÷ Target'],
    title: 'Job offers this month: offers got ÷ target'
  },
  total: {
    key: 'total',
    section: 'Total',
    sectionCls: 'c-section--total',
    label: 'Average',
    sortable: true,
    cls: 'c-section-start c-total',
    title: 'Total: the average of this team\'s results'
  }
};

/** Which result columns each table shows. */
const TABLE_COLUMNS = {
  monthNormal: ['finance', 'profile', 'total'],
  monthJob: ['finance', 'profile', 'profileOffer', 'total'],
  normal: ['finance', 'worktime', 'calls', 'citizen', 'total'],
  job: ['finance', 'worktime', 'interviewCount', 'offer', 'total']
};
const TOTAL_RULES = {
  monthNormal: ['Member: Fin · Profiles', 'Group: Fin · Profiles'],
  monthJob: ['Member: Fin · Profiles · Offer', 'Group: Fin · Profiles · Offer'],
  normal: ['Member: Fin · Time · Calls', 'Group: Fin · Time · Calls · Citizen'],
  job: ['Member: Fin · Time · Interviews', 'Group: Fin · Time · Interviews · Offer']
};
const FINANCE_COLUMN_COUNT = MONEY_COLUMNS.length + 1; // money columns + the finance Result

/**
 * Group colours: the validated categorical palette (colour-blind safe), as
 * light / dark steps of the same eight hues. A group keeps its colour across the
 * ranking cards, the table and the member chart.
 */
const GROUP_PALETTE = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
};
const OTHER_GROUP_ACCENT = { light: '#94a3b8', dark: '#64748b' }; // groups past the eight slots
const BOSS_ROLES = new Set(['GROUP_BOSS', 'BOSS', 'ADMIN']);

const { effectiveTheme } = useThemeAppearance();

/* ===============================
   STATE
================================ */
const route = useRoute();
/** Weekly and monthly are separate pages; the route says which one this is. */
const mode = computed(() => (route.meta?.summarizeMode === 'month' ? 'month' : 'week'));
const month = ref(getESTMonthKey());
const periodId = ref(''); // '' lets the server pick the current week
const groupFilter = ref('all');
const sort = ref({ key: '', dir: 'desc' });
const inputsOpen = ref(false);
const targetsOpen = ref(false);

const data = ref(null);
const loading = ref(false);
const error = ref('');
/** userId -> Real worktime achievement % for the selected range (Worktime Management logic). */
const worktimeByUser = ref(new Map());
const worktimeLoading = ref(false);
const worktimeError = ref('');
/** userIds whose WorkTime deduction is being saved (their buttons wait meanwhile). */
const savingDeduction = ref(new Set());
let requestSeq = 0;

/* ===============================
   API
================================ */
async function load() {
  if (!MONTH_RE.test(month.value || '')) return;
  const seq = ++requestSeq;
  loading.value = true;
  error.value = '';
  try {
    const res = await getSummarize({
      mode: mode.value,
      month: month.value,
      periodId: mode.value === 'week' ? periodId.value : undefined
    });
    if (seq !== requestSeq) return;
    data.value = res?.data || null;
    // Reflect the week the server resolved (its default pick when none was chosen).
    if (mode.value === 'week') periodId.value = data.value?.period?._id || '';
    loadWorktime(seq, data.value);
  } catch (err) {
    if (seq !== requestSeq) return;
    error.value = err?.response?.data?.message || err?.message || 'Failed to load summarize data.';
  } finally {
    if (seq === requestSeq) loading.value = false;
  }
}

const toDateKey = (value) => new Date(value).toISOString().slice(0, 10);
const addDaysKey = (dateKey, n) => {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Worktime chart range for the summarize window, in the chart API's convention
 * (date_to exclusive): the selected week period, or the whole calendar month
 * which runs from the 6th to the 5th.
 */
function worktimeRangeFor(payload) {
  if (!payload) return null;
  if (payload.mode === 'week') {
    const p = payload.period;
    return p ? { date_from: toDateKey(p.startDate), date_to: addDaysKey(toDateKey(p.endDate), 1) } : null;
  }
  // A month runs from the 6th to the 5th, like every month in this system.
  const { start, endExclusive } = monthRangeKeys(payload.month);
  return { date_from: start, date_to: endExclusive };
}

async function loadWorktime(seq, payload) {
  // Worktime scoring belongs to the weekly view only.
  const range = payload?.mode === 'week' ? worktimeRangeFor(payload) : null;
  worktimeError.value = '';
  if (!range) {
    worktimeByUser.value = new Map();
    worktimeLoading.value = false;
    return;
  }
  worktimeLoading.value = true;
  try {
    const res = await getWorkflowChartData(range);
    if (seq !== requestSeq) return;
    const rows = res?.data?.data?.chartData || [];
    const map = new Map();
    for (const row of rows) {
      // Holidays included — the Worktime Management default.
      const { achievementPercent } = computeWorktimeMetrics(row, {
        includeHoliday: true,
        fallbackPeriodTargetMinutes: Number(row.periodTargetMinutes) || 0
      });
      map.set(String(row.userId), achievementPercent);
    }
    worktimeByUser.value = map;
  } catch (err) {
    if (seq !== requestSeq) return;
    worktimeByUser.value = new Map();
    worktimeError.value = err?.response?.data?.message || err?.message || 'Request failed';
  } finally {
    if (seq === requestSeq) worktimeLoading.value = false;
  }
}

watch(month, () => {
  periodId.value = '';
  load();
});

// Drop a group filter that no longer exists in the fresh data.
watch(data, (value) => {
  if (groupFilter.value !== 'all' && !value?.groups?.some((g) => g.code === groupFilter.value)) {
    groupFilter.value = 'all';
  }
});

onMounted(load);

function onPeriodChange(event) {
  periodId.value = event.target.value;
  load();
}

function shiftMonth(delta) {
  month.value = delta < 0 ? getPreviousMonth(month.value) : getNextMonth(month.value);
}

function onInputsSaved() {
  inputsOpen.value = false;
  load();
}

function onTargetsSaved() {
  targetsOpen.value = false;
  load();
}

/** The member row as the server sent it, so a deduction change shows at once. */
function sourceMember(userId) {
  for (const g of data.value?.groups || []) {
    const found = g.members.find((x) => String(x.userId) === String(userId));
    if (found) return found;
  }
  return null;
}

/**
 * Super admin: +1 takes another 1% off the member's Final WorkTime for this week,
 * -1 gives 1% back. The table updates first and goes back if the save fails.
 */
async function changeDeduction(m, step) {
  const periodIdValue = data.value?.period?._id;
  const source = sourceMember(m.userId);
  if (!periodIdValue || !source || savingDeduction.value.has(m.userId)) return;

  const before = Number(source.worktimeDeduction) || 0;
  const points = Math.min(100, Math.max(0, before + step));
  if (points === before) return;

  source.worktimeDeduction = points;
  savingDeduction.value = new Set(savingDeduction.value).add(m.userId);
  try {
    await saveWorktimeDeduction({ periodId: periodIdValue, userId: String(m.userId), points });
  } catch {
    // The API client already shows the error message.
    source.worktimeDeduction = before;
  } finally {
    const next = new Set(savingDeduction.value);
    next.delete(m.userId);
    savingDeduction.value = next;
  }
}

function toggleGroup(code) {
  groupFilter.value = groupFilter.value === code ? 'all' : code;
}

/* ===============================
   FORMATTING
================================ */
const moneyFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const dayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const countFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

const money = (value) => {
  const n = Number(value) || 0;
  return `${n < 0 ? '-' : ''}$${moneyFormatter.format(Math.abs(n))}`;
};
const hasNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const periodRangeLabel = (p) =>
  p ? `${dayFormatter.format(new Date(p.startDate))} – ${dayFormatter.format(new Date(p.endDate))}` : '';
const periodLabel = (p) => (p ? `${p.definition} · ${periodRangeLabel(p)}` : '');
/** "result / plan" under a count percent; empty when nothing was entered. */
/** "17 of 20 accounts", shown under a member's profile percentage. */
const profileNote = (p) =>
  p && p.profileTarget ? `${p.counted} of ${p.profileTarget} accounts` : '';

const countDetail = (c) => {
  if (!c || (!c.plan && !c.result)) return '';
  return `${countFormatter.format(c.result || 0)} / ${c.plan ? countFormatter.format(c.plan) : '—'}`;
};
/** Real worktime % shown under the Final %, plus any deduction super admin made. */
const realDetail = (v, deduction = 0) => {
  const real = hasNumber(v) ? `Real ${v.toFixed(2)}%` : '';
  const cut = deduction > 0 ? `−${deduction}%` : '';
  return [real, cut].filter(Boolean).join(' · ');
};
const isBoss = (role) => BOSS_ROLES.has(role);

function moneyCell(row, key, isMember = false) {
  const v = Number(row?.[key]) || 0;
  if (key === 'plan' && isMember && !row.hasPlan) return { text: 'No plan', cls: 'is-muted' };
  if ((key === 'outcome' || key === 'pending') && v === 0) return { text: '—', cls: 'is-muted' };
  return { text: money(v), cls: key === 'profit' && v < 0 ? 'is-neg' : '' };
}

/* ===============================
   SCORING
================================ */
/** Final % = (Real − 95) × 20 up to 100%, or Real − 95 (negative) under 95% (see utils/worktimeMetrics). */
const worktimeFinal = (real) => worktimeFinalPercent(real);

/**
 * Average of the results that can be measured. A weekly count with no plan has no
 * result, so it is left out instead of dragging the average down as a 0%.
 */
const averageScore = (values) => {
  const scored = values.filter(hasNumber);
  return scored.length ? scored.reduce((sum, v) => sum + v, 0) / scored.length : null;
};



/** Average of a numeric field across members (members without a value are skipped). */
const averageOf = (members, key) => {
  const values = members.map((m) => m[key]).filter(hasNumber);
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
};

const groupAccent = (idx) => {
  const theme = effectiveTheme.value === 'dark' ? 'dark' : 'light';
  return GROUP_PALETTE[theme][idx] ?? OTHER_GROUP_ACCENT[theme];
};

const isJob = (type) => type === 'job';

/* ===============================
   DERIVED
================================ */
const periods = computed(() => data.value?.periods || []);
/** Weekly counts are entered per week, by super admin only. */
const canEditInputs = computed(() => !!data.value?.canEditWeeklyInputs && mode.value === 'week' && !!data.value?.period);
/** WorkTime deductions: super admin, weekly view only (the server checks this too). */
const canEditDeductions = computed(() => canEditInputs.value && viewMode.value === 'week');

/** The mode the loaded data belongs to (keeps the table stable while a new mode loads). */
const viewMode = computed(() => data.value?.mode || mode.value);
const isMonthly = computed(() => viewMode.value === 'month');

const windowLabel = computed(() => {
  // Say which days the month covers, so the figures can be checked at a glance.
  if (mode.value === 'month') return `Monthly · ${formatMonth(month.value)} · ${monthRangeLabel(month.value)}`;
  const p = data.value?.period;
  return p ? `Weekly · ${p.definition} (${periodRangeLabel(p)}) · ${formatMonth(month.value)}` : `Weekly · ${formatMonth(month.value)}`;
});

/** The monthly profile block, indexed so rows can pick their own numbers up. */
const profileByUser = computed(
  () => new Map((data.value?.profiles?.members || []).map((m) => [String(m.userId), m])),
);
const profileByGroup = computed(
  () => new Map((data.value?.profiles?.groups || []).map((g) => [g.code, g])),
);

/** Super admin sets the month's profile targets from the same toolbar. */
const canEditTargets = computed(() => isMonthly.value && !!data.value?.canEditProfileTargets && !!data.value?.profiles);

const accountColumnTitle = (col) => col.label + (col.reviews ? ' — big · reviews · new' : ' — big · new');

const allGroups = computed(() =>
  (data.value?.groups || []).map((g, idx) => {
    const job = isJob(g.type);
    const members = g.members.map((m) => {
      const worktimeReal = worktimeByUser.value.get(String(m.userId)) ?? null;
      // Final % before and after super admin's deduction (never below 0%).
      const worktimeBase = worktimeFinal(worktimeReal);
      const worktimeDeduction = isMonthly.value ? 0 : Number(m.worktimeDeduction) || 0;
      // A negative Final % (Real under 95%) stays negative, and a deduction lowers it further.
      const worktime = hasNumber(worktimeBase) ? worktimeBase - worktimeDeduction : null;
      const profile = isMonthly.value ? profileByUser.value.get(String(m.userId)) || null : null;
      // Monthly a member scores on finance and their profiles (plus job offers
      // on a job team); weekly on finance, worktime and their own count.
      const total = isMonthly.value
        ? averageScore([m.result, profile?.profilePercent, profile?.offer?.percent])
        : averageScore([m.result, worktime, m.calls?.rate]);
      return { ...m, worktimeReal, worktimeBase, worktimeDeduction, worktime, profile, total };
    });
    const counted = members.filter((m) => !m.excluded);
    const worktime = averageOf(counted, 'worktime');
    const profile = isMonthly.value ? profileByGroup.value.get(g.code) || null : null;
    // Monthly a group scores on finance and its members' profile results (plus
    // job offers); weekly on finance, worktime, its members' counts and its
    // outcome count (citizens / job offers).
    const total = isMonthly.value
      ? averageScore([g.totals.result, profile?.profilePercent, profile?.offer?.percent])
      : averageScore([
          g.totals.result,
          worktime,
          g.calls?.rate,
          job ? g.offer?.rate : g.citizen?.rate
        ]);
    return {
      ...g,
      type: g.type || 'normal',
      members,
      worktime,
      worktimeReal: averageOf(counted, 'worktimeReal'),
      profile,
      total,
      accent: groupAccent(idx)
    };
  })
);

const sortValue = (m, key) => {
  if (key === 'name') return String(m.name || '').toLowerCase();
  if (key === 'result') return hasNumber(m.result) ? m.result : Number.NEGATIVE_INFINITY;
  // Final first; Real breaks ties (many members sit at Final 0%).
  if (key === 'worktime') return hasNumber(m.worktimeReal) ? m.worktime * 1000 + m.worktimeReal : Number.NEGATIVE_INFINITY;
  if (key === 'calls') return hasNumber(m.calls?.rate) ? m.calls.rate : Number.NEGATIVE_INFINITY;
  if (key === 'profile') return hasNumber(m.profile?.profilePercent) ? m.profile.profilePercent : Number.NEGATIVE_INFINITY;
  if (key === 'total') return hasNumber(m.total) ? m.total : Number.NEGATIVE_INFINITY;
  return Number(m[key]) || 0;
};

const visibleGroups = computed(() => {
  const groups = groupFilter.value === 'all' ? allGroups.value : allGroups.value.filter((g) => g.code === groupFilter.value);
  const { dir } = sort.value;
  const sortable = new Set(['name', ...MONEY_COLUMNS.map((c) => c.key), 'result', 'worktime', 'calls', 'profile', 'total']);
  const key = sortable.has(sort.value.key) ? sort.value.key : '';
  if (!key) return groups;
  const sign = dir === 'asc' ? 1 : -1;
  return groups.map((g) => ({
    ...g,
    members: [...g.members].sort((a, b) => {
      const va = sortValue(a, key);
      const vb = sortValue(b, key);
      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    })
  }));
});

/* ===============================
   TABLES (one per group type in the weekly view)
================================ */
const buildColumns = (kind) =>
  TABLE_COLUMNS[kind].map((name) => {
    const col = COLUMN[name];
    return name === 'total' ? { ...col, rules: TOTAL_RULES[kind] || [] } : col;
  });

const sectionsOf = (columns, accountColumns = []) => {
  const sections = [{ label: 'Finance', span: FINANCE_COLUMN_COUNT }];
  if (accountColumns.length) {
    sections.push({ label: 'Profile accounts', span: accountColumns.length, cls: 'c-section--accounts' });
  }
  for (const col of columns) {
    if (col.key === 'result') continue;
    sections.push({ label: col.section, span: 1, cls: col.sectionCls });
  }
  return sections;
};

/** Monthly only: one column per platform the team's profiles can hold. */
const accountColumnsFor = (kind) => {
  if (!kind.startsWith('month')) return [];
  return data.value?.profiles?.columns?.[kind === 'monthJob' ? 'job' : 'normal'] || [];
};

/** The account counts of a whole table, added up for its footer row. */
const sumProfileCells = (groups) => {
  const cells = {};
  for (const g of groups) {
    for (const [key, cell] of Object.entries(g.profile?.cells || {})) {
      const into = cells[key] || (cells[key] = { big: 0, fresh: 0, reviews: 0, counted: 0 });
      into.big += cell.big;
      into.fresh += cell.fresh;
      into.reviews += cell.reviews;
      into.counted += cell.counted;
    }
  }
  return cells;
};

/** Money + score totals of a whole table (its groups added up). */
const tableFooter = (groups, kind) => {
  const money = { plan: 0, income: 0, outcome: 0, profit: 0, pending: 0 };
  const counts = { calls: { plan: 0, result: 0 }, citizen: { plan: 0, result: 0 }, offer: { plan: 0, result: 0 } };
  const used = { calls: false, citizen: false, offer: false };
  for (const g of groups) {
    for (const key of Object.keys(money)) money[key] += Number(g.totals[key]) || 0;
    for (const key of Object.keys(counts)) {
      const c = g[key];
      if (!c) continue;
      counts[key].plan += Number(c.plan) || 0;
      counts[key].result += Number(c.result) || 0;
      used[key] = true;
    }
  }
  const rate = (c) => (c.plan > 0 ? (c.result / c.plan) * 100 : null);
  const members = groups.flatMap((g) => g.members).filter((m) => !m.excluded);
  const worktime = averageOf(members, 'worktime');
  // Only the groups' own finance results (already plan-aware) roll up here.
  const plannedProfit = groups.reduce((sum, g) => sum + (hasNumber(g.totals.result) ? (g.totals.result / 100) * g.totals.plan : 0), 0);
  const financeResult = money.plan > 0 ? (plannedProfit / money.plan) * 100 : null;
  const scores = {
    finance: financeResult,
    worktime: { value: worktime, real: averageOf(members, 'worktimeReal') },
    calls: used.calls ? { ...counts.calls, rate: rate(counts.calls) } : null,
    citizen: used.citizen ? { ...counts.citizen, rate: rate(counts.citizen) } : null,
    offer: used.offer ? { ...counts.offer, rate: rate(counts.offer) } : null
  };

  if (kind.startsWith('month')) {
    // Across the groups: the counts add up, the percentages average.
    const counted = groups.reduce((sum, g) => sum + (g.profile?.counted || 0), 0);
    const target = groups.reduce((sum, g) => sum + (g.profile?.profileTarget || 0), 0);
    const offerTarget = groups.reduce((sum, g) => sum + (g.profile?.offer?.target || 0), 0);
    const offerResult = groups.reduce((sum, g) => sum + (g.profile?.offer?.result || 0), 0);
    const profilePercent = averageScore(groups.map((g) => g.profile?.profilePercent));
    const offerPercent = offerTarget > 0 ? (offerResult / offerTarget) * 100 : null;
    scores.profile = { plan: target, result: counted, rate: profilePercent };
    scores.profileOffer = offerTarget > 0 ? { plan: offerTarget, result: offerResult, rate: offerPercent } : null;
    scores.total = averageScore([financeResult, profilePercent, offerPercent]);
    return { money, scores, profileCells: sumProfileCells(groups) };
  }

  scores.total = averageScore([
    financeResult,
    worktime,
    scores.calls?.rate,
    kind === 'job' ? scores.offer?.rate : scores.citizen?.rate
  ]);
  return { money, scores };
};

const makeTable = ({ type, kind, label, hint, groups, footerLabel }) => {
  const resultColumns = buildColumns(kind);
  const accountColumns = accountColumnsFor(kind);
  return {
    type,
    label,
    hint,
    groups,
    resultColumns,
    // The finance result sits with the money columns; the rest follow the
    // account cells, so each header section stays over its own columns.
    financeColumns: resultColumns.filter((c) => c.key === 'result'),
    scoreColumns: resultColumns.filter((c) => c.key !== 'result'),
    accountColumns,
    sections: sectionsOf(resultColumns, accountColumns),
    columnCount: MONEY_COLUMNS.length + resultColumns.length + accountColumns.length + 2, // + No, Member
    footerLabel: footerLabel || 'All groups',
    footer: groups.length > 1 ? tableFooter(groups, kind) : null
  };
};

/** Weekly: one table per group type (normal teams and job teams score differently). */
const groupTables = computed(() => {
  const groups = visibleGroups.value;
  const normal = groups.filter((g) => !isJob(g.type));
  const job = groups.filter((g) => isJob(g.type));
  const both = normal.length > 0 && job.length > 0;
  const tables = [];

  if (isMonthly.value) {
    if (normal.length) {
      tables.push(
        makeTable({
          type: 'month-normal',
          kind: 'monthNormal',
          groups: normal,
          label: both ? 'Teams' : '',
          hint: both ? 'Finance and profile accounts' : '',
          footerLabel: both ? 'All teams' : 'All groups'
        })
      );
    }
    if (job.length) {
      tables.push(
        makeTable({
          type: 'month-job',
          kind: 'monthJob',
          groups: job,
          label: both ? 'Job teams' : '',
          hint: both ? 'Finance, caller / keeper profiles and job offers' : '',
          footerLabel: both ? 'All job teams' : 'All groups'
        })
      );
    }
    return tables;
  }

  if (normal.length) {
    tables.push(
      makeTable({
        type: 'normal',
        kind: 'normal',
        groups: normal,
        label: both ? 'Teams' : '',
        hint: both ? 'Call count and getting citizen' : '',
        footerLabel: both ? 'All teams' : 'All groups'
      })
    );
  }
  if (job.length) {
    tables.push(
      makeTable({
        type: 'job',
        kind: 'job',
        groups: job,
        label: both ? 'Job teams' : '',
        hint: both ? 'Job interviews and job offers' : '',
        footerLabel: both ? 'All job teams' : 'All groups'
      })
    );
  }
  return tables;
});

/* ---- score objects per row, read by the result cells ---- */
/** Counted accounts against the target, read like any other count cell. */
const profileScore = (p) =>
  p ? { plan: p.profileTarget, result: p.counted, rate: p.profilePercent } : null;
const offerScore = (p) =>
  p && p.offer?.target ? { plan: p.offer.target, result: p.offer.result, rate: p.offer.percent } : null;

const memberScores = (m) => ({
  finance: m.result,
  worktime: { value: m.worktime, real: m.worktimeReal, deduction: m.worktimeDeduction },
  calls: m.calls,
  citizen: null, // the group's outcome count stays blank on member rows
  offer: null,
  profile: profileScore(m.profile),
  profileOffer: offerScore(m.profile),
  total: m.total
});

const groupScores = (g) => ({
  finance: g.totals.result,
  worktime: { value: g.worktime, real: g.worktimeReal },
  calls: g.calls,
  citizen: g.citizen,
  offer: g.offer,
  profile: profileScore(g.profile),
  profileOffer: offerScore(g.profile),
  total: g.total
});

const COUNT_HINTS = {
  calls: ['of the weekly count plan', 'No plan set'],
  citizen: ['of citizen plan', 'No citizen plan'],
  offer: ['of job offer plan', 'No offer plan'],
  profile: ['of the profile target', 'No target set'],
  profileOffer: ['of the job offer target', 'No offer target']
};

/** One cell per result column of the table, in column order. */
function resultCells(scores, columns) {
  return (columns || []).map((col) => {
    const base = { key: col.key, cls: col.cls };
    if (col.key === 'result') return { ...base, value: scores.finance };
    if (col.key === 'worktime') {
      return {
        ...base,
        loading: worktimeLoading.value,
        value: scores.worktime.value,
        detail: realDetail(scores.worktime.real, scores.worktime.deduction),
        hint: 'final WorkTime',
        emptyHint: 'No worktime data'
      };
    }
    if (col.key === 'total') {
      return { ...base, loading: worktimeLoading.value, value: scores.total, hint: 'total' };
    }
    const count = scores[col.key];
    if (!count) return { ...base, blank: true };
    const [hint, emptyHint] = COUNT_HINTS[col.key];
    return { ...base, value: count.rate, detail: countDetail(count), hint, emptyHint };
  });
}

/* ===============================
   RANKINGS
================================ */
/** Rankings measure the same Total the table's last column shows. */
const rankTotal = (row) => (hasNumber(row.total) ? row.total : 0);

const groupMetrics = (g) => {
  if (isMonthly.value) {
    const metrics = [
      { label: 'Finance', value: g.totals.result },
      { label: 'Profiles', value: g.profile?.profilePercent }
    ];
    if (isJob(g.type)) metrics.push({ label: 'Offer', value: g.profile?.offer?.percent });
    return metrics;
  }
  return isJob(g.type)
    ? [
        { label: 'Finance', value: g.totals.result },
        { label: 'WorkTime', value: g.worktime, loading: worktimeLoading.value },
        { label: 'Interviews', value: g.calls?.rate },
        { label: 'Offer', value: g.offer?.rate }
      ]
    : [
        { label: 'Finance', value: g.totals.result },
        { label: 'WorkTime', value: g.worktime, loading: worktimeLoading.value },
        { label: 'Calls', value: g.calls?.rate },
        { label: 'Citizen', value: g.citizen?.rate }
      ];
};

/** Group ranking cards, best first. */
const rankedGroups = computed(() =>
  [...allGroups.value]
    .map((g) => ({
      code: g.code,
      name: g.name,
      accent: g.accent,
      total: rankTotal(g),
      metrics: groupMetrics(g)
    }))
    .sort((a, b) => b.total - a.total || String(a.name).localeCompare(String(b.name)))
);

const groupRankingCaption = computed(() =>
  isMonthly.value
    ? "Total = the average of the team's finance and profile results"
    : 'Total = the average of each team\'s group results'
);
const memberRankingCaption = computed(() =>
  isMonthly.value
    ? 'Total = average of Finance and Profiles (job members also their job offers)'
    : 'Total = average of Finance, Final WorkTime and the weekly count (calls / job interviews)'
);

/** Member ranking chart: every member of the groups in view. */
const rankingRows = computed(() =>
  visibleGroups.value.flatMap((g) =>
    g.members.filter((m) => !m.excluded).map((m) => ({
      userId: m.userId,
      name: m.name,
      groupName: g.name,
      accent: g.accent,
      total: rankTotal(m),
      parts: isMonthly.value
        ? [
            { label: 'Finance', value: m.result },
            { label: 'Profiles', value: m.profile?.profilePercent, note: profileNote(m.profile) },
            ...(isJob(g.type) ? [{ label: 'Job offers', value: m.profile?.offer?.percent }] : [])
          ]
        : [
            { label: 'Finance', value: m.result },
            { label: 'WorkTime (final)', value: m.worktime, note: realDetail(m.worktimeReal).toLowerCase() },
            { label: isJob(g.type) ? 'Interview count' : 'Call count', value: m.calls?.rate }
          ]
    }))
  )
);
const legendGroups = computed(() => visibleGroups.value.map((g) => ({ name: g.name, accent: g.accent })));

/* ===============================
   SORTING (within each group)
================================ */
function toggleSort(key) {
  const firstDir = key === 'name' ? 'asc' : 'desc';
  const current = sort.value;
  if (current.key !== key) {
    sort.value = { key, dir: firstDir };
  } else if (current.dir === firstDir) {
    sort.value = { key, dir: firstDir === 'asc' ? 'desc' : 'asc' };
  } else {
    sort.value = { key: '', dir: 'desc' };
  }
}

const sortIcon = (key) => {
  if (sort.value.key !== key) return '↕';
  return sort.value.dir === 'asc' ? '↑' : '↓';
};
const ariaSort = (key) => {
  if (sort.value.key !== key) return 'none';
  return sort.value.dir === 'asc' ? 'ascending' : 'descending';
};

/* ===============================
   CSV EXPORT
================================ */
const csvCell = (value) => {
  let s = value == null ? '' : String(value);
  // Stop spreadsheet apps from evaluating text cells (names) as formulas.
  if (typeof value === 'string' && /^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const round2 = (v) => (hasNumber(v) ? Math.round(v * 100) / 100 : '');
const moneyRow = (m) => [m.plan, m.income, m.outcome, m.profit, m.pending];
const countCols = (c) => (c ? [c.plan ?? '', c.result ?? '', round2(c.rate)] : ['', '', '']);

function exportCsv() {
  if (isMonthly.value) return exportFinanceCsv();
  const rows = [[
    'Group', 'Group type', 'No', 'Member', 'Plan', 'Income', 'Outcome', 'Profit', 'Pending income',
    'Finance result % (Profit / Plan)', 'WorkTime real %', 'WorkTime final %',
    'Weekly count plan', 'Weekly count result', 'Weekly count result % (calls / job interviews)',
    'Citizen plan', 'Citizens got', 'Getting citizen result %',
    'Job offer plan', 'Job offers got', 'Job offer result %',
    'Total %'
  ]];

  for (const g of visibleGroups.value) {
    g.members.forEach((m, i) => {
      rows.push([
        g.name, g.type, i + 1, m.name, m.hasPlan ? m.plan : '', m.income, m.outcome, m.profit, m.pending, m.result ?? '',
        round2(m.worktimeReal), round2(m.worktime),
        ...countCols(m.calls), ...countCols(null), ...countCols(null),
        round2(m.total)
      ]);
    });
    rows.push([
      g.name, g.type, '', 'Group total', ...moneyRow(g.totals), g.totals.result ?? '',
      round2(g.worktimeReal), round2(g.worktime),
      ...countCols(g.calls), ...countCols(g.citizen), ...countCols(g.offer),
      round2(g.total)
    ]);
    rows.push([g.name, g.type, '', 'Average', ...moneyRow(g.averages), '', '', '', ...countCols(null), ...countCols(null), ...countCols(null), '']);
  }

  for (const table of groupTables.value) {
    if (!table.footer) continue;
    const { money: m, scores } = table.footer;
    rows.push([
      table.footerLabel, table.type, '', 'Total', ...moneyRow(m), round2(scores.finance),
      round2(scores.worktime.real), round2(scores.worktime.value),
      ...countCols(scores.calls), ...countCols(scores.citizen), ...countCols(scores.offer),
      round2(scores.total)
    ]);
  }

  downloadCsv(rows);
}

/** Monthly export: finance, the profile accounts and the month's totals. */
function exportFinanceCsv() {
  const columns = [
    ...(data.value?.profiles?.columns?.normal || []),
    ...(data.value?.profiles?.columns?.job || [])
  ];
  const accountCells = (profile) =>
    columns.flatMap((col) => {
      const cell = profile?.cells?.[col.key];
      return col.reviews
        ? [cell?.big ?? '', cell?.reviews ?? '', cell?.fresh ?? '']
        : [cell?.big ?? '', cell?.fresh ?? ''];
    });
  const accountHeaders = columns.flatMap((col) =>
    col.reviews
      ? [`${col.label} big`, `${col.label} reviews`, `${col.label} new`]
      : [`${col.label} big`, `${col.label} new`]
  );

  const rows = [[
    'Group', 'Group type', 'No', 'Member',
    'Plan', 'Income', 'Outcome', 'Profit', 'Pending income', 'Finance result % (Profit / Plan)',
    ...accountHeaders,
    'Counted accounts', 'Profile target', 'Profile %',
    'Job offer target', 'Job offers got', 'Job offer %',
    'Total %'
  ]];

  const profileCols = (p) => [
    p?.counted ?? '',
    p?.profileTarget || '',
    round2(p?.profilePercent),
    p?.offer?.target || '',
    p?.offer?.target ? p.offer.result : '',
    round2(p?.offer?.percent)
  ];

  for (const g of visibleGroups.value) {
    g.members.forEach((m, i) => {
      rows.push([
        g.name, g.type, i + 1, m.name,
        m.hasPlan ? m.plan : '', m.income, m.outcome, m.profit, m.pending, m.result ?? '',
        ...accountCells(m.profile), ...profileCols(m.profile), round2(m.total)
      ]);
    });
    rows.push([
      g.name, g.type, '', 'Group total', ...moneyRow(g.totals), g.totals.result ?? '',
      ...accountCells(g.profile), ...profileCols(g.profile), round2(g.total)
    ]);
    rows.push([g.name, g.type, '', 'Average', ...moneyRow(g.averages), '', ...accountCells(null), ...profileCols(null), '']);
  }

  for (const table of groupTables.value) {
    if (!table.footer) continue;
    const { money: m, scores, profileCells } = table.footer;
    rows.push([
      table.footerLabel, table.type, '', 'Total', ...moneyRow(m), round2(scores.finance),
      ...accountCells({ cells: profileCells }),
      scores.profile?.result ?? '', scores.profile?.plan || '', round2(scores.profile?.rate),
      scores.profileOffer?.plan || '', scores.profileOffer?.result ?? '', round2(scores.profileOffer?.rate),
      round2(scores.total)
    ]);
  }

  downloadCsv(rows);
}

function downloadCsv(rows) {
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const week = mode.value === 'week' && data.value?.period ? `-${data.value.period.definition}` : '';
  const slug = `${month.value}${week}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const link = document.createElement('a');
  link.href = url;
  link.download = `summarize-${mode.value === 'week' ? 'weekly' : 'monthly'}-${slug}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
</script>

<style scoped>
.sz-page {
  --sz-good: #1f7a4d;
  --sz-ok: #1f4e8c;
  --sz-mid: #9a6700;
  --sz-low: #b42318;
  --sz-neg: #b42318;
  --sz-track: var(--border-light);

  /* table */
  --sz-head-bg: #14365f;
  --sz-head-bg-2: #1c4577;
  --sz-head-total: #102c4f;
  --sz-head-text: #ffffff;
  --sz-head-muted: #c9d8ec;
  --sz-head-rule: #a6bddc;
  --sz-head-line: rgba(255, 255, 255, 0.14);
  --sz-line: var(--border-light);
  --sz-line-strong: var(--border-medium);
  --sz-row-alt: color-mix(in srgb, var(--text-primary) 2.5%, var(--bg-primary));
  --sz-row-hover: color-mix(in srgb, var(--color-primary) 8%, var(--bg-primary));
  --sz-total-tint: color-mix(in srgb, var(--color-primary) 5%, transparent);
  --sz-total-tint-strong: color-mix(in srgb, var(--color-primary) 12%, transparent);
  --sz-total-line: color-mix(in srgb, var(--color-primary) 55%, var(--bg-primary));
  --sz-foot-bg: color-mix(in srgb, var(--color-primary) 9%, var(--bg-primary));

  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: min(1600px, 100%);
  margin: 0 auto;
  min-width: 0;
}

[data-theme='dark'] .sz-page {
  --sz-good: #4ade80;
  --sz-ok: #60a5fa;
  --sz-mid: #fbbf24;
  --sz-low: #f87171;
  --sz-neg: #f87171;

  --sz-head-bg: #0b1322;
  --sz-head-bg-2: #111c30;
  --sz-head-total: #0a1a33;
  --sz-head-text: #f1f5f9;
  --sz-head-muted: #b6c3d6;
  --sz-head-rule: #8ea0ba;
  --sz-head-line: rgba(148, 163, 184, 0.18);
}

/* ---------- header ---------- */
.sz-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--spacing-md) var(--spacing-lg);
  padding: var(--spacing-lg) var(--spacing-xl);
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.sz-header h1 {
  margin: 0 0 var(--spacing-xs);
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.sz-header__sub {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  align-items: center;
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.sz-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm) var(--spacing-md);
}

.sz-month {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.sz-field {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.sz-field__label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sz-select {
  min-width: 0;
  max-width: 260px;
  padding: 7px 10px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.sz-select:focus-visible,
.sz-seg__btn:focus-visible,
.sz-btn:focus-visible,
.sz-icon-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* ---------- segmented control ---------- */
.sz-seg {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
}

.sz-seg__btn {
  padding: 6px 14px;
  border: 0;
  border-radius: calc(var(--radius-md) - 2px);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.sz-seg__btn:hover {
  color: var(--text-primary);
}

.sz-seg__btn.is-active {
  background: var(--bg-primary);
  color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

/* ---------- buttons ---------- */
.sz-btn,
.sz-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--border-medium);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  text-decoration: none;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}

.sz-btn {
  padding: 7px 12px;
  border-radius: var(--radius-md);
}

.sz-icon-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
}

.sz-btn svg,
.sz-icon-btn svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.sz-btn:hover:not(:disabled),
.sz-icon-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.sz-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.sz-btn--primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--text-inverse);
}

.sz-btn--primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
  color: var(--text-inverse);
}

.is-spinning {
  animation: sz-spin 0.9s linear infinite;
}

/* ---------- section ---------- */
.sz-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg) var(--spacing-xl) var(--spacing-xl);
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  min-width: 0;
}

.sz-section__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.sz-section__head h2 {
  margin: 0 0 4px;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.sz-section__desc {
  margin: 0;
  max-width: 70ch;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.sz-section__tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
}

.sz-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  min-width: 0;
  transition: opacity var(--transition-base);
}

.sz-body.is-refreshing {
  opacity: 0.6;
  pointer-events: none;
}

/* ---------- states ---------- */
.sz-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-3xl) var(--spacing-lg);
  border: 1px dashed var(--border-medium);
  border-radius: var(--radius-lg);
  text-align: center;
  color: var(--text-tertiary);
}

.sz-state p {
  margin: 0;
}

.sz-state__title {
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.sz-state--error {
  border-color: var(--sz-low);
  color: var(--sz-low);
}

.sz-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--border-light);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: sz-spin 0.8s linear infinite;
}

@keyframes sz-spin {
  to { transform: rotate(360deg); }
}

/* ---------- group band dot + tiers + notes ---------- */
.sz-band__dot {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--g-accent);
}

.is-neg {
  color: var(--sz-neg);
}

.sz-notes {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sz-note {
  margin: 0;
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
  color: var(--text-tertiary);
}

.sz-note--error {
  color: var(--sz-low);
}

.sz-note strong {
  color: var(--text-secondary);
}

.sz-pending {
  color: var(--text-tertiary);
  letter-spacing: 0.1em;
}

/* ---------- table ---------- */
.sz-table-block {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-width: 0;
}

.sz-table-title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px var(--spacing-sm);
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.sz-table-title span {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-normal);
  color: var(--text-tertiary);
}

/* The wrapper is the table's scroll area, sized to the visible screen so the
   header rows (and the No / Member columns) stay frozen while the table scrolls. */
.sz-table-wrap {
  max-height: calc(100vh - var(--topbar-height, 64px) - 32px);
  overflow: auto;
  border: 1px solid var(--sz-line-strong);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  box-shadow: var(--shadow-sm);
}

/* The global table rule sets overflow: hidden (plus a border), which would make
   the table its own scroll container and silently disable every sticky cell. */
/* Monthly shows the finance columns only, so it needs less room. */
.sz-table--compact {
  min-width: 920px;
}

.sz-table {
  width: 100%;
  min-width: 1100px;
  overflow: visible;
  border: 0;
  border-radius: 0;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.sz-table th,
.sz-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--sz-line);
  background: inherit;
  white-space: nowrap;
  vertical-align: middle;
}

/* The app's global th / td rules (uppercase, tiny, grey) must not reach the body. */
.sz-table td,
.sz-table tbody th,
.sz-table tfoot th {
  font-size: 13px;
  color: inherit;
  text-transform: none;
  letter-spacing: normal;
}

/* header (two sticky rows: sections, then columns) */
.sz-table thead th {
  position: sticky;
  top: 0;
  z-index: 3;
  padding: 0;
  background: var(--sz-head-bg-2);
  border-bottom: 1px solid var(--sz-head-line);
  color: var(--sz-head-muted);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-align: left;
  vertical-align: bottom;
}

.sz-table thead .sz-head-sections th {
  height: 34px;
  background: var(--sz-head-bg);
}

.sz-table thead .sz-head-cols th {
  top: 34px;
}

.sz-table thead th.c-no {
  z-index: 4;
  padding: 0 12px 10px;
  text-align: center;
}

.sz-table thead th.c-member {
  z-index: 4;
  box-shadow: inset -1px 0 0 var(--sz-head-line);
}

.sz-table thead .c-section {
  padding: 0 12px;
  text-align: center;
  vertical-align: middle;
  color: var(--sz-head-text);
  font-size: 11.5px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.08em;
  box-shadow: inset 1px 0 0 var(--sz-head-line);
}

.sz-table thead .c-section--total,
.sz-table thead .sz-head-cols .c-total {
  background: var(--sz-head-total);
}

.sz-table thead .sz-head-cols .c-section-start {
  box-shadow: inset 1px 0 0 var(--sz-head-line);
}

.sz-table thead .sz-head-cols .c-total {
  box-shadow: inset 2px 0 0 var(--sz-total-line), -10px 0 10px -10px rgba(0, 0, 0, 0.35);
}

.sz-head-stack {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
}

.c-num .sz-head-stack,
.c-result .sz-head-stack {
  align-items: flex-end;
}

.sz-head-title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* The rule under a Result header, e.g. "Final = (Real − 90) × 10". */
.sz-head-rule {
  font-size: 10.5px;
  font-weight: var(--font-weight-normal);
  text-transform: none;
  letter-spacing: 0;
  white-space: nowrap;
  color: var(--sz-head-rule);
}

.sz-sort {
  display: flex;
  align-items: flex-end;
  width: 100%;
  padding: 9px 12px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  text-align: inherit;
  cursor: pointer;
}

.c-num .sz-sort,
.c-result .sz-sort {
  justify-content: flex-end;
}

.sz-sort:hover {
  color: var(--sz-head-text);
}

.sz-sort:focus-visible {
  outline: 2px solid var(--sz-head-text);
  outline-offset: -3px;
}

.sz-sort__icon {
  font-size: 10px;
  opacity: 0.45;
}

.sz-sort__icon.is-on {
  opacity: 1;
  color: var(--sz-head-text);
}

/* Header cell without a sort button (padding normally comes from .sz-sort). */
.sz-head-label {
  display: flex;
  justify-content: flex-end;
  padding: 9px 12px;
}

/* columns */
.c-no {
  position: sticky;
  left: 0;
  z-index: 1;
  width: 48px;
  min-width: 48px;
  text-align: center;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.c-member {
  position: sticky;
  left: 48px;
  z-index: 1;
  min-width: 190px;
  text-align: left;
  box-shadow: inset -1px 0 0 var(--sz-line-strong);
}

.c-num,
.c-result {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* Wide amounts must not slide under the frozen Member column. */
.c-num {
  min-width: 96px;
}

.c-result {
  width: 120px;
}

.c-worktime {
  min-width: 156px;
}

/* Super admin's −1% / +1% WorkTime deduction buttons, under the Final %. */
.sz-deduct {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 4px;
}

.sz-deduct__btn {
  padding: 1px 6px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
}

.sz-deduct__btn:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.sz-deduct__btn:focus-visible {
  outline: 2px solid var(--text-tertiary);
  outline-offset: 1px;
}

.sz-deduct__btn:disabled {
  opacity: 0.45;
  cursor: default;
}

/* Monthly profile accounts: narrow, centred, wide enough for the header. */
.c-acc {
  min-width: 74px;
  padding-left: 5px;
  padding-right: 5px;
  text-align: center;
  white-space: nowrap;
}

/* Hairlines keep eleven account columns readable across a row. */
.sz-table tbody .c-acc,
.sz-table tfoot .c-acc {
  box-shadow: inset 1px 0 0 color-mix(in srgb, var(--border-light) 70%, transparent);
}

.sz-table thead .sz-head-cols .c-acc {
  font-size: 10.5px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.04em;
  box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.08);
}

.sz-table thead .c-section--accounts {
  background: var(--sz-head-total, rgba(255, 255, 255, 0.06));
}

/* Total is frozen on the right, like No / Member on the left. */
.c-total {
  position: sticky;
  right: 0;
  z-index: 1;
  min-width: 172px;
}

.sz-table td.is-muted {
  color: var(--text-tertiary);
}

/* Section dividers (WorkTime, Call count, …) and the emphasised Total column. */
.sz-table tbody .c-section-start,
.sz-table tfoot .c-section-start {
  box-shadow: inset 1px 0 0 var(--sz-line-strong);
}

.sz-table tbody td.c-total,
.sz-table tfoot td.c-total {
  background-image: linear-gradient(var(--sz-total-tint), var(--sz-total-tint));
  box-shadow: inset 2px 0 0 var(--sz-total-line), -10px 0 10px -10px rgba(15, 23, 42, 0.28);
}

.sz-table thead .c-total,
.sz-table thead .c-section--total {
  position: sticky;
  right: 0;
  z-index: 4;
}

.sz-table thead .c-section--total {
  box-shadow: inset 2px 0 0 var(--sz-total-line), -10px 0 10px -10px rgba(0, 0, 0, 0.35);
}

/* group band + rows (opaque backgrounds so the sticky cells stay solid) */
.sz-band th {
  padding: 0;
  background: color-mix(in srgb, var(--g-accent) 12%, var(--bg-primary));
  border-bottom: 1px solid color-mix(in srgb, var(--g-accent) 30%, var(--bg-primary));
  box-shadow: inset 4px 0 0 var(--g-accent);
  text-align: left;
}

.sz-band__inner {
  position: sticky;
  left: 0;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px 8px 16px;
}

.sz-band__name {
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.sz-band__meta {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-normal);
  color: var(--text-tertiary);
}

.sz-row {
  background: var(--bg-primary);
}

.sz-row.is-alt {
  background: var(--sz-row-alt);
}

/* A member switched off for this week: visible, but out of every percentage. */
.sz-row.is-excluded {
  opacity: 0.6;
}

.sz-row.is-excluded .sz-member__name {
  text-decoration: line-through;
}

.sz-table .sz-row:hover {
  background: var(--sz-row-hover);
}

.sz-row .c-no,
.sz-sum--total .c-no,
.sz-sum--avg .c-no {
  box-shadow: inset 4px 0 0 var(--g-accent);
}

.sz-sum--total {
  background: color-mix(in srgb, var(--g-accent) 8%, var(--bg-primary));
}

.sz-sum--total th,
.sz-sum--total td {
  padding-top: 10px;
  padding-bottom: 10px;
  border-top: 2px solid color-mix(in srgb, var(--g-accent) 45%, var(--bg-primary));
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

/* The group's own percentages read louder than the member rows above them. */
.sz-sum--total :deep(.sz-result__pct) {
  font-size: var(--font-size-lg);
  line-height: var(--line-height-tight);
}

.sz-sum--total :deep(.sz-result__bar) {
  height: 5px;
}

.sz-sum--total :deep(.sz-result__detail) {
  font-size: var(--font-size-xs);
}

.sz-sum--total td.c-total {
  background-image: linear-gradient(var(--sz-total-tint-strong), var(--sz-total-tint-strong));
}

.sz-sum--total td.c-total :deep(.sz-result__pct) {
  font-size: var(--font-size-xl);
}

.sz-sum--avg {
  background: color-mix(in srgb, var(--g-accent) 3.5%, var(--bg-primary));
  color: var(--text-secondary);
}

.sz-sum--avg th {
  font-weight: var(--font-weight-medium);
  color: var(--text-tertiary);
}

.sz-group:not(:last-of-type) .sz-sum--avg > th,
.sz-group:not(:last-of-type) .sz-sum--avg > td {
  border-bottom: 2px solid var(--sz-line-strong);
}

/* "All groups" footer, pinned to the bottom of the scroll area */
.sz-sum--overall {
  background: var(--sz-foot-bg);
}

.sz-sum--overall th,
.sz-sum--overall td {
  position: sticky;
  bottom: 0;
  z-index: 2;
  padding-top: 10px;
  padding-bottom: 10px;
  border-top: 2px solid var(--sz-total-line);
  border-bottom: 0;
  font-weight: var(--font-weight-bold);
}

.sz-sum--overall :deep(.sz-result__pct) {
  font-size: var(--font-size-lg);
  line-height: var(--line-height-tight);
}

.sz-sum--overall td.c-total :deep(.sz-result__pct) {
  font-size: var(--font-size-xl);
}

.sz-sum--overall .c-no,
.sz-sum--overall .c-member,
.sz-sum--overall .c-total {
  z-index: 3;
}

.sz-member {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: 100%;
}

.sz-member__name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: var(--font-weight-medium);
}

.sz-tag {
  padding: 1px 7px;
  border-radius: var(--radius-full);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  text-transform: capitalize;
}

.sz-tag--muted {
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
}

/* ---------- responsive ---------- */
@media (max-width: 768px) {
  .sz-header,
  .sz-section {
    padding: var(--spacing-md);
  }

  .sz-header h1 {
    font-size: var(--font-size-2xl);
  }

  .sz-controls,
  .sz-section__tools {
    width: 100%;
  }

  .sz-select {
    max-width: 100%;
  }

  .c-member {
    min-width: 170px;
  }
}
</style>
