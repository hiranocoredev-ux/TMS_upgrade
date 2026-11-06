<template>
  <div ref="rootRef" class="mpk" :class="{ 'mpk--open': open, 'mpk--disabled': disabled, 'mpk--compact': compact }">
    <button
      ref="triggerRef"
      type="button"
      class="mpk__trigger"
      :disabled="disabled"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="toggle"
    >
      <span v-if="selected.length" class="mpk__chips">
        <span v-for="m in shown" :key="m.id" class="mpk__chip">
          <UserAvatar :name="m.name" :profile-image="m.avatarUrl" :size="16" :tooltip="false" />
          <span class="mpk__chip-name">{{ m.name }}</span>
          <span
            v-if="!disabled"
            class="mpk__chip-x"
            role="button"
            :aria-label="`Remove ${m.name}`"
            @click.stop="remove(m.id)"
            >×</span
          >
        </span>
        <span v-if="overflow > 0" class="mpk__more">+{{ overflow }}</span>
      </span>
      <span v-else class="mpk__placeholder">{{ placeholder }}</span>
      <span class="mpk__caret" aria-hidden="true">▾</span>
    </button>

    <Teleport to="body">
    <div v-if="open" ref="panelRef" class="mpk__panel" :style="panelStyle">
      <input
        ref="searchRef"
        v-model="query"
        type="text"
        class="mpk__search"
        placeholder="Search member…"
        aria-label="Search member"
        autocomplete="off"
        @keydown.esc.prevent="close"
      />
      <ul class="mpk__list" role="listbox" :aria-multiselectable="multiple">
        <li v-if="!matches.length" class="mpk__empty">No member matches.</li>
        <li
          v-for="m in matches"
          :key="m.id"
          class="mpk__option"
          :class="{ 'is-selected': isSelected(m.id) }"
          role="option"
          :aria-selected="isSelected(m.id)"
          @mousedown.prevent="pick(m)"
        >
          <UserAvatar :name="m.name" :profile-image="m.avatarUrl" :size="20" :tooltip="false" />
          <span class="mpk__name">{{ m.name }}</span>
          <span v-if="m.group" class="mpk__group">{{ m.group }}</span>
          <span v-if="isSelected(m.id)" class="mpk__tick" aria-hidden="true">✓</span>
        </li>
      </ul>
    </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import UserAvatar from '../UserAvatar.vue';

/**
 * Searchable member picker. `multiple` binds an array of ids (managers of an
 * account); otherwise it binds a single id.
 */
const props = defineProps({
  modelValue: { type: [Array, String], default: () => [] },
  /** [{ id, name, group?, avatarUrl? }] */
  members: { type: Array, default: () => [] },
  multiple: { type: Boolean, default: true },
  placeholder: { type: String, default: 'Nobody yet' },
  disabled: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
  /** How many chips to show before collapsing the rest into “+n”. */
  maxChips: { type: Number, default: 2 },
});

const emit = defineEmits(['update:modelValue']);

const rootRef = ref(null);
const triggerRef = ref(null);
const panelRef = ref(null);
const searchRef = ref(null);
const open = ref(false);
const query = ref('');
/**
 * The panel is teleported to the body and placed against the trigger, so a
 * dialog that scrolls its own body cannot clip it.
 */
const panelStyle = ref({});

const ids = computed(() => {
  if (props.multiple) return (Array.isArray(props.modelValue) ? props.modelValue : []).map(String);
  return props.modelValue ? [String(props.modelValue)] : [];
});

const byId = computed(() => new Map(props.members.map((m) => [String(m.id), m])));
const selected = computed(() => ids.value.map((id) => byId.value.get(id)).filter(Boolean));
const shown = computed(() => selected.value.slice(0, props.maxChips));
const overflow = computed(() => Math.max(0, selected.value.length - props.maxChips));

const matches = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.members;
  return props.members.filter((m) => `${m.name} ${m.group || ''}`.toLowerCase().includes(q));
});

const isSelected = (id) => ids.value.includes(String(id));

function emitIds(next) {
  emit('update:modelValue', props.multiple ? next : next[0] || '');
}

function pick(member) {
  const id = String(member.id);
  if (!props.multiple) {
    emitIds([id]);
    close();
    return;
  }
  emitIds(isSelected(id) ? ids.value.filter((x) => x !== id) : [...ids.value, id]);
}

const remove = (id) => emitIds(ids.value.filter((x) => x !== String(id)));

const PANEL_HEIGHT = 280;

function place() {
  const el = triggerRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom;
  const openUp = below < PANEL_HEIGHT && rect.top > below;
  const width = Math.max(rect.width, 220);
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
  panelStyle.value = openUp
    ? { top: 'auto', bottom: `${window.innerHeight - rect.top + 4}px`, left: `${left}px`, width: `${width}px`, maxHeight: `${Math.min(PANEL_HEIGHT, rect.top - 16)}px` }
    : { top: `${rect.bottom + 4}px`, bottom: 'auto', left: `${left}px`, width: `${width}px`, maxHeight: `${Math.min(PANEL_HEIGHT, below - 16)}px` };
}

async function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
  query.value = '';
  if (open.value) {
    place();
    await nextTick();
    searchRef.value?.focus();
  }
}

const close = () => {
  open.value = false;
  query.value = '';
};

const onPointerDown = (e) => {
  if (!open.value) return;
  const inTrigger = rootRef.value?.contains(e.target);
  const inPanel = panelRef.value?.contains(e.target);
  if (!inTrigger && !inPanel) close();
};

const onViewportChange = () => {
  if (open.value) place();
};

onMounted(() => {
  document.addEventListener('mousedown', onPointerDown);
  window.addEventListener('scroll', onViewportChange, true);
  window.addEventListener('resize', onViewportChange);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onPointerDown);
  window.removeEventListener('scroll', onViewportChange, true);
  window.removeEventListener('resize', onViewportChange);
});
</script>

<style scoped>
.mpk {
  position: relative;
  width: 100%;
}

.mpk__trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 34px;
  padding: 4px 8px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
}

.mpk--compact .mpk__trigger {
  min-height: 28px;
  padding: 2px 6px;
  font-size: var(--font-size-xs);
}

.mpk--open .mpk__trigger {
  border-color: var(--color-primary);
}

.mpk--disabled .mpk__trigger {
  background: var(--bg-tertiary);
  cursor: not-allowed;
}

.mpk__chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.mpk__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 160px;
  padding: 1px 6px 1px 2px;
  border-radius: var(--radius-full);
  background: var(--bg-tertiary);
  font-size: 11px;
}

.mpk__chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mpk__chip-x {
  color: var(--text-tertiary);
  cursor: pointer;
}

.mpk__chip-x:hover {
  color: #dc2626;
}

.mpk__more {
  font-size: 11px;
  color: var(--text-tertiary);
}

.mpk__placeholder {
  flex: 1;
  color: var(--text-tertiary);
}

.mpk__caret {
  color: var(--text-tertiary);
  font-size: 11px;
}

.mpk__panel {
  position: fixed;
  z-index: 1200; /* above the dialog it may be opened from */
  display: flex;
  flex-direction: column;
  min-width: 220px;
  padding: 6px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  box-shadow: var(--shadow-lg);
}

.mpk__search {
  width: 100%;
  padding: 6px 8px;
  margin-bottom: 6px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.mpk__search:focus {
  outline: none;
  border-color: var(--color-primary);
}

.mpk__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
}

.mpk__option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.mpk__option:hover {
  background: color-mix(in srgb, var(--color-primary) 10%, var(--bg-primary));
}

.mpk__option.is-selected {
  font-weight: var(--font-weight-semibold);
}

.mpk__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mpk__group,
.mpk__tick {
  margin-left: auto;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.mpk__tick {
  color: var(--color-primary);
}

.mpk__empty {
  padding: 8px;
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
}
</style>
