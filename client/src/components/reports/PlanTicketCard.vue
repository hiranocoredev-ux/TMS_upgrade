<template>
  <article class="period-ticket-card period-ticket-card--plan">
    <header class="period-ticket-card__head">
      <input
        v-if="editable && isCustom"
        :value="title"
        type="text"
        class="period-ticket-card__title-input"
        placeholder="Ticket title"
        @input="$emit('update:title', $event.target.value)"
      />
      <h3 v-else class="period-ticket-card__title">{{ title }}</h3>
      <div class="period-ticket-card__tools">
        <button
          v-if="editable && isCustom"
          type="button"
          class="period-ticket-card__remove"
          title="Remove ticket"
          @click="$emit('remove')"
        >
          Remove
        </button>
        <button
          v-if="collapsible"
          type="button"
          class="period-ticket-card__remove"
          @click="collapsed = !collapsed"
        >
          {{ collapsed ? 'Expand' : 'Collapse' }}
        </button>
      </div>
    </header>
    <div v-show="!collapsed" class="period-ticket-card__work">
      <p class="period-ticket-card__work-label">Plan</p>
      <ReportRichEditor
        :model-value="modelValue"
        :disabled="!editable"
        placeholder="Describe your plan for this area…"
        size="composer"
        @update:model-value="$emit('update:modelValue', $event)"
      />
    </div>
  </article>
</template>

<script setup>
import { ref } from 'vue';
import ReportRichEditor from './ReportRichEditor.vue';

const props = defineProps({
  title: { type: String, default: '' },
  modelValue: { type: String, default: '' },
  editable: { type: Boolean, default: true },
  isCustom: { type: Boolean, default: false },
  collapsible: { type: Boolean, default: true },
  collapsedByDefault: { type: Boolean, default: false }
});

defineEmits(['update:title', 'update:modelValue', 'remove']);

const collapsed = ref(props.collapsedByDefault);
</script>
