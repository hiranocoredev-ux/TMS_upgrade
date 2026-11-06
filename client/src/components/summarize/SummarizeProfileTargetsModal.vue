<template>
  <Teleport to="body">
    <div class="pt-overlay" @mousedown.self="requestClose">
      <div ref="dialogRef" class="pt-dialog" role="dialog" aria-modal="true" aria-labelledby="pt-title">
        <header class="pt-head">
          <div>
            <h2 id="pt-title">Monthly profile targets</h2>
            <p class="pt-sub">
              {{ monthLabel }} · how many accounts each member should hold, and the job offers job
              members were meant to land.
            </p>
          </div>
          <button type="button" class="pt-close" aria-label="Close" :disabled="saving" @click="requestClose">×</button>
        </header>

        <div class="pt-body">
          <section v-for="group in groups" :key="group.code" class="pt-group">
            <header class="pt-group__head">
              <h3>{{ group.name }}</h3>
              <span class="pt-group__type">{{ group.type === 'job' ? 'Job team' : 'Normal team' }}</span>
            </header>

            <table class="pt-table">
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col" class="c-num">Counted</th>
                  <th scope="col" class="c-num">Target</th>
                  <template v-if="group.type === 'job'">
                    <th scope="col" class="c-num">Offer target</th>
                    <th scope="col" class="c-num">Offers got</th>
                  </template>
                </tr>
              </thead>
              <tbody>
                <tr v-for="member in group.members" :key="member.userId" :class="{ 'is-muted': member.bittensor }">
                  <th scope="row">
                    <span class="pt-member">
                      {{ member.name }}
                      <span v-if="member.bittensor" class="pt-chip">Bittensor</span>
                    </span>
                  </th>
                  <td class="c-num">{{ member.counted || '—' }}</td>
                  <td class="c-num">
                    <input
                      v-model="rows[member.userId].profileTarget"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="—"
                      :disabled="member.bittensor"
                      :aria-label="`${member.name} profile target`"
                    />
                  </td>
                  <template v-if="group.type === 'job'">
                    <td class="c-num">
                      <input
                        v-model="rows[member.userId].offerTarget"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="—"
                        :aria-label="`${member.name} job offer target`"
                      />
                    </td>
                    <td class="c-num">
                      <input
                        v-model="rows[member.userId].offerResult"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="—"
                        :aria-label="`${member.name} job offers received`"
                      />
                    </td>
                  </template>
                </tr>
              </tbody>
            </table>
          </section>

          <p class="pt-hint">
            A Bittensor member carries no profile target — finance alone scores them.
            Leaving a target empty leaves that member without a profile percentage.
          </p>
        </div>

        <footer class="pt-foot">
          <p v-if="errorMsg" class="pt-error" role="alert">{{ errorMsg }}</p>
          <span v-else class="pt-count">{{ changedCount }} change{{ changedCount === 1 ? '' : 's' }} to save</span>
          <div class="pt-actions">
            <button type="button" class="pt-btn" :disabled="saving" @click="requestClose">Cancel</button>
            <button type="button" class="pt-btn pt-btn--primary" :disabled="saving || !changedCount" @click="save">
              {{ saving ? 'Saving…' : 'Save targets' }}
            </button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { saveProfileTargets } from '../../services/summarize';

const props = defineProps({
  /** The `profiles` block from the monthly summarize. */
  data: { type: Object, required: true },
  month: { type: String, required: true },
});

const emit = defineEmits(['close', 'saved']);

const dialogRef = ref(null);
const saving = ref(false);
const errorMsg = ref('');

const groups = computed(() => props.data?.groups || []);

const toInput = (n) => (Number(n) > 0 ? String(n) : '');

/** An editable row per member, so only what changed is sent. */
const rows = reactive({});
const original = {};
for (const group of props.data?.groups || []) {
  for (const member of group.members) {
    rows[member.userId] = {
      profileTarget: toInput(member.profileTarget),
      offerTarget: toInput(member.offer?.target),
      offerResult: toInput(member.offer?.result),
    };
    original[member.userId] = { ...rows[member.userId] };
  }
}

const isChanged = (userId) => {
  const a = rows[userId];
  const b = original[userId];
  return a.profileTarget !== b.profileTarget || a.offerTarget !== b.offerTarget || a.offerResult !== b.offerResult;
};

const changedIds = computed(() => Object.keys(rows).filter(isChanged));
const changedCount = computed(() => changedIds.value.length);

const monthLabel = computed(() => {
  const [y, m] = String(props.month || '').split('-').map(Number);
  if (!y || !m) return props.month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
});

const toNumber = (v) => {
  const t = String(v ?? '').trim();
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
};

async function save() {
  saving.value = true;
  errorMsg.value = '';
  try {
    await saveProfileTargets({
      month: props.month,
      targets: changedIds.value.map((userId) => ({
        userId,
        profileTarget: toNumber(rows[userId].profileTarget),
        offerTarget: toNumber(rows[userId].offerTarget),
        offerResult: toNumber(rows[userId].offerResult),
      })),
    });
    emit('saved');
  } catch (err) {
    errorMsg.value = err?.response?.data?.message || err?.message || 'Could not save the targets.';
  } finally {
    saving.value = false;
  }
}

function requestClose() {
  if (!saving.value) emit('close');
}

const onKeydown = (e) => {
  if (e.key === 'Escape') requestClose();
};

onMounted(() => document.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown));
</script>

<style scoped>
.pt-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal-backdrop, 1040);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.55);
}

.pt-dialog {
  display: flex;
  flex-direction: column;
  width: min(760px, 100%);
  max-height: min(90vh, 940px);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  background: var(--bg-primary);
  color: var(--text-primary);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.pt-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--border-light);
}

.pt-head h2 {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
}

.pt-sub {
  margin: 2px 0 0;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.pt-close {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-tertiary);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.pt-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg);
  overflow-y: auto;
}

.pt-group__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: 4px;
}

.pt-group__head h3 {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
}

.pt-group__type {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.pt-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.pt-table th,
.pt-table td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-light);
  text-align: left;
  font-size: 13px;
  text-transform: none;
  letter-spacing: normal;
}

.pt-table thead th {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: var(--bg-tertiary);
}

.pt-table tbody tr.is-muted {
  color: var(--text-tertiary);
}

.pt-member {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: var(--font-weight-medium);
}

.pt-chip {
  padding: 1px 7px;
  border-radius: var(--radius-full);
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
  font-size: 10px;
  text-transform: uppercase;
}

.c-num {
  width: 110px;
  text-align: center !important;
}

.c-num input {
  width: 84px;
  padding: 5px 8px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  font: inherit;
  text-align: center;
}

.c-num input:disabled {
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
}

.pt-hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.pt-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--border-light);
  background: var(--bg-secondary);
}

.pt-count {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.pt-error {
  margin: 0;
  font-size: var(--font-size-sm);
  color: #dc2626;
}

.pt-actions {
  display: flex;
  gap: 8px;
}

.pt-btn {
  padding: 7px 14px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}

.pt-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.pt-btn--primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--text-inverse);
}
</style>
