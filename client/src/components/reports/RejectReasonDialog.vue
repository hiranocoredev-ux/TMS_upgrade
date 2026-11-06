<template>
  <div v-if="modelValue" class="reject-modal" @click.self="$emit('update:modelValue', false)">
    <div class="reject-modal__card" role="dialog" aria-modal="true" aria-label="Reject report reason">
      <h3>Reject Report</h3>
      <p>Please enter a clear reason so the member can fix and resubmit correctly.</p>
      <label class="field">
        <span>Reject reason</span>
        <textarea
          :value="reason"
          rows="5"
          maxlength="2000"
          placeholder="Describe what should be fixed..."
          @input="$emit('update:reason', $event.target.value)"
        />
      </label>
      <div class="actions">
        <button type="button" class="btn btn-neutral" @click="$emit('update:modelValue', false)">Cancel</button>
        <button type="button" class="btn btn-danger" :disabled="submitting || !canSubmit" @click="$emit('confirm')">
          {{ submitting ? 'Rejecting...' : 'Reject with Reason' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  reason: { type: String, default: '' },
  submitting: { type: Boolean, default: false },
});

defineEmits(['update:modelValue', 'update:reason', 'confirm']);

const canSubmit = computed(() => String(props.reason || '').trim().length > 0);
</script>

<style scoped>
.reject-modal {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(15, 23, 42, 0.38);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
}

.reject-modal__card {
  width: min(560px, 100%);
  background: #fff;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 24px 42px rgba(15, 23, 42, 0.22);
  padding: 14px;
}

.reject-modal__card h3 {
  margin: 0 0 6px;
}

.reject-modal__card p {
  margin: 0 0 10px;
  font-size: 0.82rem;
  color: #64748b;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field span {
  font-size: 0.76rem;
  font-weight: 700;
  color: #475569;
}

.field textarea {
  width: 100%;
  resize: vertical;
  min-height: 130px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 10px 11px;
  font-size: 0.86rem;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
</style>
