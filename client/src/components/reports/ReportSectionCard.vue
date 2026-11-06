<template>
  <div
    class="report-section-card"
    :class="{
      'is-carry-forward': readonlyMirror,
      'has-locked-title': readonlyTitle,
      'is-composer-card': composerSize
    }"
  >
    <div class="section-header">
      <div class="section-header-main">
        <span v-if="sectionHeaderLabel" class="section-label">{{ sectionHeaderLabel }}</span>
        <template v-if="composerLabel">
          <h3 class="section-title">{{ composerLabel }}</h3>
          <p v-if="composerSubtitle" class="section-subtitle">{{ composerSubtitle }}</p>
        </template>
        <input
          v-else-if="editable && !readonlyTitle"
          :value="title"
          type="text"
          class="section-title-input"
          :placeholder="titlePlaceholder"
          @input="$emit('update:title', $event.target.value)"
        />
        <h3 v-else class="section-title">{{ title }}</h3>
      </div>
      <button
        v-if="canCollapse"
        type="button"
        class="btn-collapse-section"
        :title="isCollapsed ? 'Expand section' : 'Collapse section'"
        @click="isCollapsed = !isCollapsed"
      >
        {{ isCollapsed ? 'Expand' : 'Collapse' }}
      </button>
      <button
        v-if="editable && showRemove"
        type="button"
        class="btn-remove-section"
        title="Remove section"
        @click="$emit('remove')"
      >
        Remove
      </button>
    </div>
    <p v-if="sectionHint && !isCollapsed" class="section-hint">{{ sectionHint }}</p>
    <div
      v-show="!isCollapsed"
      class="section-content"
      :class="{ 'is-readonly-mirror': readonlyMirror, 'is-composer': composerSize }"
    >
      <ReportRichEditor
        :model-value="modelValue"
        :disabled="!editable || readonlyMirror"
        :placeholder="bodyPlaceholder"
        :size="composerSize ? 'composer' : 'default'"
        @update:model-value="$emit('update:modelValue', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import ReportRichEditor from './ReportRichEditor.vue';

const props = defineProps({
  title: { type: String, default: '' },
  modelValue: { type: String, default: '' },
  editable: { type: Boolean, default: true },
  /** When true with editable notes, still render title as plain text (not an input). */
  readonlyTitle: { type: Boolean, default: false },
  /** Muted carry-forward block: non-editable body + compact styling. */
  readonlyMirror: { type: Boolean, default: false },
  /** Micro-label above the carry-forward title (e.g. weekly vs daily). */
  carryForwardLabel: { type: String, default: 'From prior day' },
  showRemove: { type: Boolean, default: true },
  /** Empty title field hint (composer / history). */
  titlePlaceholder: {
    type: String,
    default: 'Short heading (shown in history)'
  },
  /** Empty body hint when the section is editable. */
  notesPlaceholder: {
    type: String,
    default: 'Add details for this section-text, formatting, or images.'
  },
  /** Empty body hint for the read-only carry-forward block. */
  mirrorPlaceholder: {
    type: String,
    default: ''
  },
  canCollapse: { type: Boolean, default: false },
  collapsedByDefaulf: { type: Boolean, default: false },
  /** Short label for product composer (e.g. "Work result"). */
  composerLabel: { type: String, default: '' },
  /** Date or period line under composer label. */
  composerSubtitle: { type: String, default: '' },
  /** Optional guidance above the editor body. */
  sectionHint: { type: String, default: '' },
  /** Taller editor for submit composer layout. */
  composerSize: { type: Boolean, default: false }
});

defineEmits(['update:title', 'update:modelValue', 'remove']);
const isCollapsed = ref(!!props.collapsedByDefault);

const bodyPlaceholder = computed(() => {
  if (props.readonlyMirror) {
    return (
      props.mirrorPlaceholder ||
      'Nothing was carried forward from the previous period for this block.'
    );
  }
  return props.notesPlaceholder;
});

const sectionHeaderLabel = computed(() => {
  if (props.composerLabel) return '';
  if (props.readonlyMirror) return props.carryForwardLabel || 'From prior day';
  if (props.readonlyTitle) return '';
  return '';
});
</script>

<style scoped>
.report-section-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 14px;
  box-shadow: var(--shadow-sm);
}

.report-section-card:last-child {
  margin-bottom: 0;
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 18px;
  background: linear-gradient(180deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%);
  border-bottom: 1px solid var(--border-light);
}

.section-header-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.section-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  line-height: 1;
}

.section-title {
  margin: 0;
  width: 100%;
  font-size: clamp(0.94rem, 1.05vw, 1.05rem);
  font-weight: 600;
  line-height: 1.38;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  word-break: break-word;
}

.section-title-input {
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.01em;
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  box-sizing: border-box;
}

.section-title-input::placeholder {
  color: var(--text-tertiary);
  font-weight: 500;
}

.section-title-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.has-locked-title .section-header {
  background: linear-gradient(180deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%);
  border-bottom-color: var(--border-light);
}

.has-locked-title .section-title {
  color: var(--text-primary);
}

.section-subtitle {
  margin: 2px 0 0;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-tertiary);
  line-height: 1.35;
}

.section-hint {
  margin: 0;
  padding: 10px 16px;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: #475569;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 1px solid var(--border-light);
}

.section-content.is-composer {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.report-section-card.is-composer-card {
  margin-bottom: 10px;
  border-radius: 10px;
  border-color: #e2e8f0;
}

.report-section-card.is-composer-card .section-header {
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.report-section-card.is-composer-card .section-title {
  font-size: 0.875rem;
  font-weight: 650;
  line-height: 1.3;
}

.report-section-card.is-composer-card .btn-collapse-section,
.report-section-card.is-composer-card .btn-remove-section {
  margin-top: 0;
  padding: 4px 8px;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 6px;
  line-height: 1.2;
}

.report-section-card.is-composer-card .section-content.is-composer {
  padding: 8px 10px 10px;
  background: #fafbfc;
}

/* Carry-forward: reference panel - visually separate from authored report sections */
.report-section-card.is-carry-forward {
  background: linear-gradient(
    165deg,
    color-mix(in srgb, var(--color-primary) 10%, var(--bg-primary)) 0%,
    var(--bg-tertiary) 42%,
    var(--bg-secondary) 100%
  );
  border: 1px dashed var(--border-medium);
  border-radius: 10px;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--border-light) 40%, transparent);
  margin-bottom: 20px;
}

.is-carry-forward .section-header {
  background: transparent;
  border-bottom: 1px dashed var(--border-medium);
  border-left: 4px solid var(--color-primary);
  padding: 14px 16px 12px 14px;
}

.is-carry-forward .section-label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.55rem 0.22rem;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  border: 1px solid var(--border-medium);
  border-radius: 999px;
  line-height: 1;
}

.is-carry-forward .section-title {
  margin-top: 2px;
  font-size: clamp(0.82rem, 2vw, 0.92rem);
  font-weight: 600;
  color: var(--text-secondary);
  line-height: 1.4;
}

.btn-remove-section {
  flex-shrink: 0;
  margin-top: 2px;
  padding: 6px 11px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-error);
  background: var(--bg-primary);
  border: 1px solid color-mix(in srgb, var(--color-error) 35%, var(--border-light));
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.btn-collapse-section {
  flex-shrink: 0;
  margin-top: 2px;
  padding: 6px 11px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-primary);
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.btn-collapse-section:hover {
  background: var(--bg-secondary);
  border-color: var(--border-dark);
}

.btn-remove-section:hover {
  background: color-mix(in srgb, var(--color-error) 14%, var(--bg-primary));
  border-color: var(--color-error);
  color: var(--color-error);
}

.section-content {
  padding: 0;
}

.section-content.is-readonly-mirror {
  padding: 12px 14px 16px;
  background: color-mix(in srgb, var(--bg-primary) 70%, transparent);
}

.section-content.is-readonly-mirror :deep(.report-rich-editor) {
  opacity: 1;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
}

.section-content.is-readonly-mirror :deep(.editor-toolbar) {
  display: none;
}

.section-content.is-readonly-mirror :deep(.editor-content) {
  min-height: 180px;
  height: 260px;
  max-height: 520px;
  resize: vertical !important;
  padding: 10px 12px;
}

.section-content.is-readonly-mirror :deep(.tiptap-content) {
  font-size: 0.875rem;
  color: #64748b;
  line-height: 1.5;
}

.section-content.is-readonly-mirror :deep(.tiptap-content p) {
  margin: 0 0 0.5rem;
}

.section-content.is-readonly-mirror :deep(.tiptap-content p:last-child) {
  margin-bottom: 0;
}

@media (max-width: 640px) {
  .section-header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 10px 14px;
  }

  .is-carry-forward .section-header {
    padding: 12px 12px 10px;
  }

  .btn-remove-section {
    align-self: flex-end;
  }
}

@media (max-width: 480px) {
  .section-title-input {
    min-height: 44px;
    font-size: 1rem;
  }
}
</style>
