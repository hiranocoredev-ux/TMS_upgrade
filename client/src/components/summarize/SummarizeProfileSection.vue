<template>
  <section class="ps">
    <header class="ps__head">
      <div>
        <h2>Profile summarize</h2>
        <p class="ps__sub">
          What every member's citizen profiles add up to this month, measured against their target.
        </p>
      </div>
      <button v-if="canEditTargets" type="button" class="ps__btn ps__btn--primary" @click="$emit('edit-targets')">
        Monthly targets
      </button>
    </header>

    <p v-if="!data || !data.members?.length" class="ps__empty">
      No members to summarize yet.
    </p>

    <template v-else>
      <!-- Every group, side by side -->
      <div class="ps__cards">
        <article
          v-for="group in rankedGroups"
          :key="group.code"
          class="ps-card"
          :class="tierClass(group.total)"
        >
          <span class="ps-card__rank">#{{ group.rank }}</span>
          <h3 class="ps-card__name">{{ group.name }}</h3>
          <p class="ps-card__pct">{{ pct(group.total) }}</p>
          <p class="ps-card__meta">{{ group.counted }} of {{ group.profileTarget || '—' }} accounts</p>
        </article>
      </div>

      <div v-for="table in tables" :key="table.key" class="ps-table-block">
        <header class="ps-table-block__head">
          <h3>{{ table.title }}</h3>
          <span class="ps-table-block__meta">{{ table.rows.length }} {{ table.rows.length === 1 ? 'member' : 'members' }}</span>
        </header>

        <div class="ps-table-wrap">
          <table class="ps-table">
            <thead>
              <tr>
                <th class="c-no" scope="col">No</th>
                <th class="c-member" scope="col">Member</th>
                <th v-for="col in table.columns" :key="col.key" class="c-acc" scope="col" :title="columnHint(col)">
                  {{ col.short }}
                </th>
                <th class="c-num" scope="col">Counted</th>
                <th class="c-num" scope="col">Target</th>
                <th class="c-pct" scope="col">Profile %</th>
                <template v-if="table.job">
                  <th class="c-num" scope="col">Offers</th>
                  <th class="c-pct" scope="col">Offer %</th>
                </template>
                <th class="c-pct c-total" scope="col">Total %</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="(row, i) in table.rows" :key="row.userId" :class="{ 'is-muted': row.bittensor }">
                <td class="c-no">{{ i + 1 }}</td>
                <td class="c-member">
                  <span class="ps-member">
                    <UserAvatar :name="row.name" :profile-image="row.avatarUrl" :size="22" :tooltip="false" />
                    <span class="ps-member__name">{{ row.name }}</span>
                    <span v-if="row.bittensor" class="ps-chip">Bittensor</span>
                  </span>
                </td>

                <td v-for="col in table.columns" :key="col.key" class="c-acc">
                  <ProfileCountCell :cell="row.cells[col.key]" :reviews="col.reviews" />
                </td>

                <td class="c-num">{{ row.counted || '—' }}</td>
                <td class="c-num">{{ row.profileTarget || '—' }}</td>
                <td class="c-pct"><span class="ps-pct" :class="tierClass(row.profilePercent)">{{ pct(row.profilePercent) }}</span></td>

                <template v-if="table.job">
                  <td class="c-num">
                    <span v-if="row.offer.target">{{ row.offer.result }} / {{ row.offer.target }}</span>
                    <span v-else class="ps-muted">—</span>
                  </td>
                  <td class="c-pct"><span class="ps-pct" :class="tierClass(row.offer.percent)">{{ pct(row.offer.percent) }}</span></td>
                </template>

                <td class="c-pct c-total"><span class="ps-pct ps-pct--lead" :class="tierClass(row.total)">{{ pct(row.total) }}</span></td>
              </tr>
            </tbody>

            <tfoot>
              <tr>
                <th class="c-no" scope="row"></th>
                <th class="c-member">{{ table.footLabel }}</th>
                <th v-for="col in table.columns" :key="col.key" class="c-acc">
                  <ProfileCountCell :cell="table.foot.cells[col.key]" :reviews="col.reviews" strong />
                </th>
                <th class="c-num">{{ table.foot.counted || '—' }}</th>
                <th class="c-num">{{ table.foot.profileTarget || '—' }}</th>
                <th class="c-pct"><span class="ps-pct" :class="tierClass(table.foot.profilePercent)">{{ pct(table.foot.profilePercent) }}</span></th>
                <template v-if="table.job">
                  <th class="c-num">
                    <span v-if="table.foot.offer.target">{{ table.foot.offer.result }} / {{ table.foot.offer.target }}</span>
                    <span v-else class="ps-muted">—</span>
                  </th>
                  <th class="c-pct"><span class="ps-pct" :class="tierClass(table.foot.offer.percent)">{{ pct(table.foot.offer.percent) }}</span></th>
                </template>
                <th class="c-pct c-total">
                  <span class="ps-pct ps-pct--lead" :class="tierClass(table.foot.total)">{{ pct(table.foot.total) }}</span>
                </th>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- All groups together -->
      <div class="ps-table-block">
        <header class="ps-table-block__head">
          <h3>All groups</h3>
          <span class="ps-table-block__meta">{{ data.groups.length }} groups · {{ data.totals.memberCount }} members</span>
        </header>

        <div class="ps-table-wrap">
          <table class="ps-table">
            <thead>
              <tr>
                <th class="c-no" scope="col">No</th>
                <th class="c-member" scope="col">Group</th>
                <th v-for="col in allColumns" :key="col.key" class="c-acc" scope="col" :title="columnHint(col)">
                  {{ col.short }}
                </th>
                <th class="c-num" scope="col">Counted</th>
                <th class="c-num" scope="col">Target</th>
                <th class="c-pct" scope="col">Profile %</th>
                <th class="c-num" scope="col">Offers</th>
                <th class="c-pct c-total" scope="col">Total %</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(group, i) in data.groups" :key="group.code">
                <td class="c-no">{{ i + 1 }}</td>
                <td class="c-member">
                  <span class="ps-member__name">{{ group.name }}</span>
                  <span class="ps-chip">{{ group.type === 'job' ? 'Job' : 'Normal' }}</span>
                </td>
                <td v-for="col in allColumns" :key="col.key" class="c-acc">
                  <ProfileCountCell :cell="group.cells[col.key]" :reviews="col.reviews" />
                </td>
                <td class="c-num">{{ group.counted || '—' }}</td>
                <td class="c-num">{{ group.profileTarget || '—' }}</td>
                <td class="c-pct"><span class="ps-pct" :class="tierClass(group.profilePercent)">{{ pct(group.profilePercent) }}</span></td>
                <td class="c-num">
                  <span v-if="group.offer.target">{{ group.offer.result }} / {{ group.offer.target }}</span>
                  <span v-else class="ps-muted">—</span>
                </td>
                <td class="c-pct c-total"><span class="ps-pct ps-pct--lead" :class="tierClass(group.total)">{{ pct(group.total) }}</span></td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <th class="c-no" scope="row"></th>
                <th class="c-member">All teams</th>
                <th v-for="col in allColumns" :key="col.key" class="c-acc">
                  <ProfileCountCell :cell="data.totals.cells[col.key]" :reviews="col.reviews" strong />
                </th>
                <th class="c-num">{{ data.totals.counted || '—' }}</th>
                <th class="c-num">{{ data.totals.profileTarget || '—' }}</th>
                <th class="c-pct"><span class="ps-pct" :class="tierClass(data.totals.profilePercent)">{{ pct(data.totals.profilePercent) }}</span></th>
                <th class="c-num">
                  <span v-if="data.totals.offer.target">{{ data.totals.offer.result }} / {{ data.totals.offer.target }}</span>
                  <span v-else class="ps-muted">—</span>
                </th>
                <th class="c-pct c-total">
                  <span class="ps-pct ps-pct--lead" :class="tierClass(data.totals.total)">{{ pct(data.totals.total) }}</span>
                </th>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p class="ps-legend">
        <span class="ps-legend__item"><span class="ps-num ps-num--big">3</span> big profiles</span>
        <span class="ps-legend__item"><span class="ps-num ps-num--rev">12</span> reviews</span>
        <span class="ps-legend__item"><span class="ps-num ps-num--new">2</span> new profiles</span>
        · Upwork Dev, Upwork Client and Freelancer count every review (a profile with no reviews still counts 1).
        Contra and the AI-training platforms count only big profiles. Caller and keeper profiles count 1 each.
        Bittensor members carry no profile target and are scored on finance alone.
      </p>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import UserAvatar from '../UserAvatar.vue';
import ProfileCountCell from './ProfileCountCell.vue';
import { resultTier } from '../../utils/summarizeTiers';

const props = defineProps({
  /** The `profiles` block from GET /summarize in month mode. */
  data: { type: Object, default: null },
  canEditTargets: { type: Boolean, default: false },
});

defineEmits(['edit-targets']);

const pct = (value) => (typeof value === 'number' ? `${value}%` : '—');
const tierClass = (value) => (typeof value === 'number' ? `is-${resultTier(value)}` : 'is-none');

const columnsFor = (type) => props.data?.columns?.[type] || [];

/** The all-groups table shows every column, job kinds last. */
const allColumns = computed(() => [...columnsFor('normal'), ...columnsFor('job')]);

const columnHint = (col) =>
  col.reviews ? `${col.label} — big · reviews · new` : `${col.label} — big · new`;

const rankedGroups = computed(() => {
  const groups = [...(props.data?.groups || [])];
  groups.sort((a, b) => (b.total ?? -1) - (a.total ?? -1));
  return groups.map((group, i) => ({ ...group, rank: i + 1 }));
});

/** One table per group, with the columns that group's type uses. */
const tables = computed(() => {
  if (!props.data) return [];
  return props.data.groups.map((group) => ({
    key: group.code,
    title: group.name,
    job: group.type === 'job',
    columns: columnsFor(group.type === 'job' ? 'job' : 'normal'),
    rows: group.members,
    footLabel: `${group.name} total`,
    foot: group,
  }));
});
</script>

<style scoped>
.ps {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.ps__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.ps__head h2 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.ps__sub {
  margin: 2px 0 0;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.ps__btn {
  padding: 7px 14px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}

.ps__btn--primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--text-inverse);
}

.ps__empty {
  margin: 0;
  padding: var(--spacing-lg);
  border: 1px dashed var(--border-light);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.ps__cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: var(--spacing-sm);
}

.ps-card {
  position: relative;
  padding: var(--spacing-md);
  border: 1px solid var(--border-light);
  border-left: 4px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  box-shadow: var(--shadow-sm);
}

.ps-card.is-good { border-left-color: #1f7a4d; }
.ps-card.is-ok { border-left-color: #2563eb; }
.ps-card.is-warn { border-left-color: #d97706; }
.ps-card.is-low { border-left-color: #dc2626; }

.ps-card__rank {
  position: absolute;
  top: 10px;
  right: 12px;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  color: var(--text-tertiary);
}

.ps-card__name {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
}

.ps-card__pct {
  margin: 4px 0 0;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

.ps-card__meta {
  margin: 2px 0 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.ps-table-block__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: 4px;
}

.ps-table-block__head h3 {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
}

.ps-table-block__meta {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.ps-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  box-shadow: var(--shadow-sm);
  margin-bottom: var(--spacing-md);
}

.ps-table {
  width: 100%;
  min-width: 900px;
  overflow: visible;
  border: 0;
  border-radius: 0;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.ps-table th,
.ps-table td {
  padding: 7px 10px;
  border-bottom: 1px solid var(--border-light);
  background: inherit;
  white-space: nowrap;
  font-size: 13px;
  color: inherit;
  text-transform: none;
  letter-spacing: normal;
  text-align: left;
}

.ps-table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #14365f;
  color: #c9d8ec;
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

[data-theme='dark'] .ps-table thead th {
  background: #0b1322;
  color: #b6c3d6;
}

.ps-table tbody tr {
  background: var(--bg-primary);
}

.ps-table tbody tr:nth-child(even) {
  background: color-mix(in srgb, var(--text-primary) 2.5%, var(--bg-primary));
}

.ps-table tbody tr:hover {
  background: color-mix(in srgb, var(--color-primary) 7%, var(--bg-primary));
}

.ps-table tbody tr.is-muted {
  color: var(--text-tertiary);
}

.ps-table tfoot th {
  background: color-mix(in srgb, var(--color-primary) 10%, var(--bg-primary));
  border-top: 2px solid color-mix(in srgb, var(--color-primary) 40%, var(--border-medium));
  font-weight: var(--font-weight-bold);
}

.c-no {
  width: 46px;
  text-align: center !important;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.c-member {
  min-width: 190px;
}

.ps-member {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ps-member__name {
  font-weight: var(--font-weight-medium);
}

.ps-chip {
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.c-acc {
  width: 92px;
  text-align: center !important;
}

.c-num {
  width: 84px;
  text-align: center !important;
  font-variant-numeric: tabular-nums;
}

.c-pct {
  width: 92px;
  text-align: right !important;
}

.c-total {
  border-left: 1px solid var(--border-light);
}

.ps-pct {
  font-variant-numeric: tabular-nums;
  font-weight: var(--font-weight-semibold);
}

.ps-pct--lead {
  font-size: 14px;
}

.ps-pct.is-good { color: #1f7a4d; }
.ps-pct.is-ok { color: #2563eb; }
.ps-pct.is-warn { color: #b45309; }
.ps-pct.is-low { color: #dc2626; }
.ps-pct.is-none { color: var(--text-tertiary); }

[data-theme='dark'] .ps-pct.is-good { color: #4ade80; }
[data-theme='dark'] .ps-pct.is-warn { color: #fbbf24; }
[data-theme='dark'] .ps-pct.is-low { color: #f87171; }

.ps-muted {
  color: var(--text-tertiary);
}

.ps-legend {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  line-height: 1.7;
}

.ps-legend__item {
  margin-right: 10px;
}

.ps-num {
  display: inline-block;
  min-width: 20px;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.ps-num--big {
  background: color-mix(in srgb, #1f7a4d 14%, var(--bg-primary));
  color: #1f7a4d;
}

.ps-num--rev {
  background: color-mix(in srgb, #2563eb 12%, var(--bg-primary));
  color: #2563eb;
}

.ps-num--new {
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
}

[data-theme='dark'] .ps-num--big {
  background: color-mix(in srgb, #4ade80 18%, var(--bg-primary));
  color: #4ade80;
}

[data-theme='dark'] .ps-num--rev {
  background: color-mix(in srgb, #60a5fa 18%, var(--bg-primary));
  color: #60a5fa;
}
</style>
