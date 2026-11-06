<template>
  <div v-if="modelValue" class="plan-add-modal" @click.self="close">
    <div
      class="plan-add-modal__card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-add-modal-title"
    >
      <h3 id="plan-add-modal-title">Add plan ticket</h3>
      <p class="plan-add-modal__hint">
        Enter a new subtitle, or bring back a default ticket you removed earlier.
      </p>

      <label class="field">
        <span>New ticket title</span>
        <input
          v-model="customTitle"
          type="text"
          class="input"
          placeholder="e.g. Client follow-up"
          @keyup.enter="confirmCustom"
        />
      </label>

      <div v-if="removedDefaults.length" class="removed-block">
        <p class="removed-block__label">Removed default tickets</p>
        <ul class="removed-list">
          <li v-for="item in removedDefaults" :key="item.templateId || item.title">
            <span>{{ item.title }}</span>
            <button type="button" class="btn btn-neutral btn-sm" @click="restoreDefault(item)">
              Add back
            </button>
          </li>
        </ul>
      </div>

      <div class="actions">
        <button type="button" class="btn btn-neutral" @click="close">Cancel</button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!customTitle.trim()"
          @click="confirmCustom"
        >
          Add ticket
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  removedDefaults: { type: Array, default: () => [] }
});

const emit = defineEmits(['update:modelValue', 'add']);

const customTitle = ref('');

watch(
  () => props.modelValue,
  (open) => {
    if (open) customTitle.value = '';
  }
);

function close() {
  emit('update:modelValue', false);
}

function confirmCustom() {
  const title = customTitle.value.trim();
  if (!title) return;
  emit('add', { title, templateId: null, isCustom: true });
  close();
}

function restoreDefault(item) {
  emit('add', {
    title: item.title,
    templateId: item.templateId || null,
    isCustom: false
  });
  close();
}
</script>

<style scoped>
.plan-add-modal {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(15, 23, 42, 0.38);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
}

.plan-add-modal__card {
  width: min(520px, 100%);
  background: var(--bg-primary, #fff);
  border-radius: 14px;
  border: 1px solid var(--border-light, #e2e8f0);
  box-shadow: 0 24px 42px rgba(15, 23, 42, 0.22);
  padding: 1.25rem;
}

.plan-add-modal__card h3 {
  margin: 0 0 0.35rem;
  font-size: 1.125rem;
}

.plan-add-modal__hint {
  margin: 0 0 1rem;
  font-size: 0.8125rem;
  color: var(--text-tertiary, #64748b);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 1rem;
}

.field span {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary, #475569);
}

.input {
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--border-medium, #cbd5e1);
  border-radius: 8px;
  font-size: 0.875rem;
}

.removed-block {
  margin-bottom: 1rem;
  padding: 0.75rem;
  border-radius: 10px;
  background: var(--bg-secondary, #f8fafc);
  border: 1px solid var(--border-light, #e2e8f0);
}

.removed-block__label {
  margin: 0 0 0.5rem;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary, #64748b);
}

.removed-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.removed-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.btn-sm {
  padding: 0.3rem 0.55rem;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
