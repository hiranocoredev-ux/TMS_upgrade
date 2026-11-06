<template>
  <div class="rh-member-empty-wrap">
    <ReportHistoryMemberSummaryBar
      v-if="userId && anchorDate"
      :user-id="userId"
      :anchor-date="anchorDate"
      :period="period"
    />
    <div class="rh-member-empty" role="status">
    <div class="rh-member-empty__card">
      <div class="rh-member-empty__badge" aria-hidden="true">Not submitted</div>
      <h2 class="rh-member-empty__title">No report yet</h2>
      <p class="rh-member-empty__lead">
        <strong>{{ memberName }}</strong>
        <template v-if="groupName"> · {{ groupName }}</template>
      </p>
      <p class="rh-member-empty__text">
        {{ bodyText }}
      </p>
      <p class="rh-member-empty__hint">
        When this member submits their {{ periodNoun }}, it will appear here for review.
      </p>
    </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { REPORT_PERIODS } from '../../utils/reportPeriod';
import ReportHistoryMemberSummaryBar from './ReportHistoryMemberSummaryBar.vue';

const props = defineProps({
  memberName: { type: String, default: 'This member' },
  groupName: { type: String, default: '' },
  periodLabel: { type: String, default: '' },
  period: { type: String, default: REPORT_PERIODS.DAILY },
  userId: { type: String, default: '' },
  anchorDate: { type: String, default: '' }
});

const periodNoun = computed(() => {
  if (props.period === REPORT_PERIODS.WEEKLY) return 'weekly report';
  if (props.period === REPORT_PERIODS.MONTHLY) return 'monthly report';
  return 'daily report';
});

const bodyText = computed(() => {
  const label = String(props.periodLabel || '').trim();
  if (label) {
    return `There is no ${periodNoun.value} on file for ${label}.`;
  }
  return `There is no ${periodNoun.value} on file for the selected period.`;
});
</script>

<style scoped>
.rh-member-empty-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.rh-member-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: min(65vh, 560px);
  padding: clamp(1rem, 3vw, 2rem);
  box-sizing: border-box;
}

.rh-member-empty__card {
  width: 100%;
  max-width: 28rem;
  text-align: center;
  padding: clamp(1.5rem, 4vw, 2.25rem);
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md);
}

.rh-member-empty__badge {
  display: inline-flex;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0.35rem 0.85rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--color-error) 88%, white);
  background: color-mix(in srgb, var(--color-error) 12%, var(--bg-primary));
  border: 1px solid color-mix(in srgb, var(--color-error) 35%, transparent);
}

.rh-member-empty__title {
  margin: 0 0 0.65rem;
  font-size: clamp(1.15rem, 2.2vw, 1.35rem);
  font-weight: 650;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.rh-member-empty__lead {
  margin: 0 0 0.75rem;
  font-size: 0.9375rem;
  color: var(--text-secondary);
  line-height: 1.45;
}

.rh-member-empty__lead strong {
  color: var(--text-primary);
  font-weight: 650;
}

.rh-member-empty__text {
  margin: 0 0 0.85rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.55;
}

.rh-member-empty__hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-tertiary);
  line-height: 1.45;
}
</style>
