<template>
  <div ref="rootRef" class="cs" :class="{ 'cs--open': open, 'cs--disabled': disabled }">
    <button
      ref="triggerRef"
      type="button"
      class="cs__trigger"
      :disabled="disabled"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="listId"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span v-if="selected" class="cs__value">
        <img
          v-if="flagSrc(selected.code)"
          :src="flagSrc(selected.code)"
          :alt="''"
          class="cs__flag"
          loading="lazy"
          @error="onFlagError(selected.code)"
        />
        <span v-else class="cs__flag cs__flag--emoji" aria-hidden="true">{{ countryFlag(selected.code) }}</span>
        <span class="cs__name">{{ selected.name }}</span>
        <span class="cs__code">{{ selected.code }}</span>
      </span>
      <span v-else class="cs__placeholder">{{ placeholder }}</span>

      <button
        v-if="selected && clearable && !disabled"
        type="button"
        class="cs__clear"
        :aria-label="`Clear ${selected.name}`"
        @click.stop="clear"
      >
        ×
      </button>
      <span class="cs__caret" aria-hidden="true">▾</span>
    </button>

    <Teleport to="body">
    <div v-if="open" ref="panelRef" class="cs__panel" :style="panelStyle">
      <input
        ref="searchRef"
        v-model="query"
        type="text"
        class="cs__search"
        :placeholder="searchPlaceholder"
        aria-label="Search country"
        autocomplete="off"
        @keydown="onSearchKeydown"
      />
      <ul :id="listId" ref="listRef" class="cs__list" role="listbox">
        <li v-if="!matches.length" class="cs__empty">No country matches “{{ query }}”.</li>
        <li
          v-for="(c, i) in matches"
          :key="c.code"
          :id="`${listId}-${c.code}`"
          class="cs__option"
          :class="{ 'is-active': i === activeIndex, 'is-selected': c.code === selected?.code }"
          role="option"
          :aria-selected="c.code === selected?.code"
          @mouseenter="activeIndex = i"
          @mousedown.prevent="choose(c)"
        >
          <img
            v-if="flagSrc(c.code)"
            :src="flagSrc(c.code)"
            :alt="''"
            class="cs__flag"
            loading="lazy"
            @error="onFlagError(c.code)"
          />
          <span v-else class="cs__flag cs__flag--emoji" aria-hidden="true">{{ countryFlag(c.code) }}</span>
          <span class="cs__name">{{ c.name }}</span>
          <span class="cs__code">{{ c.code }}</span>
        </li>
      </ul>
    </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { COUNTRIES, countryFlag, countryFlagUrl } from '../../constants/countries';

/**
 * Searchable country picker. Type to filter by name or code; arrows and Enter
 * pick one. `valueType` decides what the form stores — the ISO code (default)
 * or the country name, which is what the older profile forms keep.
 */
const props = defineProps({
  modelValue: { type: String, default: '' },
  valueType: { type: String, default: 'code' },
  placeholder: { type: String, default: 'Select country' },
  searchPlaceholder: { type: String, default: 'Type a country…' },
  disabled: { type: Boolean, default: false },
  clearable: { type: Boolean, default: true },
});

const emit = defineEmits(['update:modelValue', 'change']);

const listId = `cs-list-${Math.random().toString(36).slice(2, 8)}`;
const rootRef = ref(null);
const triggerRef = ref(null);
const panelRef = ref(null);
const searchRef = ref(null);
const listRef = ref(null);
/** Placed against the trigger from the body, so a scrolling dialog cannot clip it. */
const panelStyle = ref({});

const open = ref(false);
const query = ref('');
const activeIndex = ref(0);
/** Codes whose PNG failed to load, so we fall back to the emoji flag. */
const brokenFlags = ref(new Set());

const flagSrc = (code) => (brokenFlags.value.has(code) ? null : countryFlagUrl(code, 40));
const onFlagError = (code) => {
  const next = new Set(brokenFlags.value);
  next.add(code);
  brokenFlags.value = next;
};

const selected = computed(() => {
  const raw = String(props.modelValue || '').trim();
  if (!raw) return null;
  if (props.valueType === 'name') {
    const byName = COUNTRIES.find((c) => c.name.toLowerCase() === raw.toLowerCase());
    // An unlisted name (older free-text records) still shows what is stored.
    return byName || { code: '', name: raw };
  }
  return COUNTRIES.find((c) => c.code === raw.toUpperCase()) || null;
});

const matches = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return COUNTRIES;
  const starts = [];
  const contains = [];
  for (const c of COUNTRIES) {
    const name = c.name.toLowerCase();
    if (name.startsWith(q) || c.code.toLowerCase() === q) starts.push(c);
    else if (name.includes(q) || c.code.toLowerCase().startsWith(q)) contains.push(c);
  }
  return [...starts, ...contains];
});

watch(matches, () => {
  activeIndex.value = 0;
});

const valueOf = (country) => (props.valueType === 'name' ? country.name : country.code);

function choose(country) {
  emit('update:modelValue', valueOf(country));
  emit('change', country);
  close();
}

function clear() {
  emit('update:modelValue', '');
  emit('change', null);
}

const PANEL_HEIGHT = 320;

function place() {
  const el = triggerRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom;
  const openUp = below < PANEL_HEIGHT && rect.top > below;
  const width = Math.max(rect.width, 240);
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
  panelStyle.value = openUp
    ? { top: 'auto', bottom: `${window.innerHeight - rect.top + 4}px`, left: `${left}px`, width: `${width}px`, maxHeight: `${Math.min(PANEL_HEIGHT, rect.top - 16)}px` }
    : { top: `${rect.bottom + 4}px`, bottom: 'auto', left: `${left}px`, width: `${width}px`, maxHeight: `${Math.min(PANEL_HEIGHT, below - 16)}px` };
}

async function openPanel() {
  if (props.disabled) return;
  open.value = true;
  query.value = '';
  place();
  activeIndex.value = Math.max(
    0,
    matches.value.findIndex((c) => c.code === selected.value?.code),
  );
  await nextTick();
  searchRef.value?.focus();
  scrollActiveIntoView();
}

function close() {
  open.value = false;
  query.value = '';
}

const toggle = () => (open.value ? close() : openPanel());

function move(step) {
  if (!matches.value.length) return;
  const next = activeIndex.value + step;
  activeIndex.value = Math.min(matches.value.length - 1, Math.max(0, next));
  scrollActiveIntoView();
}

function scrollActiveIntoView() {
  nextTick(() => {
    const list = listRef.value;
    const el = list?.children?.[activeIndex.value];
    if (!el || !list) return;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  });
}

function onTriggerKeydown(e) {
  if (['ArrowDown', 'Enter', ' '].includes(e.key)) {
    e.preventDefault();
    openPanel();
  }
}

function onSearchKeydown(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    move(1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    move(-1);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const country = matches.value[activeIndex.value];
    if (country) choose(country);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    close();
    triggerRef.value?.focus();
  } else if (e.key === 'Tab') {
    close();
  }
}

const onDocumentPointerDown = (e) => {
  if (!open.value) return;
  const inTrigger = rootRef.value?.contains(e.target);
  const inPanel = panelRef.value?.contains(e.target);
  if (!inTrigger && !inPanel) close();
};

const onViewportChange = () => {
  if (open.value) place();
};

onMounted(() => {
  document.addEventListener('mousedown', onDocumentPointerDown);
  window.addEventListener('scroll', onViewportChange, true);
  window.addEventListener('resize', onViewportChange);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentPointerDown);
  window.removeEventListener('scroll', onViewportChange, true);
  window.removeEventListener('resize', onViewportChange);
});
</script>

<style scoped>
.cs {
  position: relative;
  width: 100%;
}

.cs__trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
}

.cs__trigger:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.cs--open .cs__trigger {
  border-color: var(--color-primary);
}

.cs--disabled .cs__trigger {
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.cs__value {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.cs__placeholder {
  flex: 1;
  color: var(--text-tertiary);
}

.cs__flag {
  width: 20px;
  height: 14px;
  object-fit: cover;
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

.cs__flag--emoji {
  width: auto;
  height: auto;
  box-shadow: none;
  font-size: 15px;
  line-height: 1;
}

.cs__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cs__code {
  margin-left: auto;
  padding-left: 8px;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}

.cs__clear,
.cs__caret {
  flex-shrink: 0;
  color: var(--text-tertiary);
  font-size: 12px;
}

.cs__clear {
  padding: 0 4px;
  border: 0;
  background: none;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.cs__clear:hover {
  color: var(--text-primary);
}

.cs__panel {
  position: fixed;
  z-index: 1200; /* above the dialog it may be opened from */
  display: flex;
  flex-direction: column;
  padding: 6px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  box-shadow: var(--shadow-lg);
}

.cs__search {
  width: 100%;
  padding: 7px 9px;
  margin-bottom: 6px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.cs__search:focus {
  outline: none;
  border-color: var(--color-primary);
}

.cs__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cs__option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.cs__option.is-active {
  background: color-mix(in srgb, var(--color-primary) 12%, var(--bg-primary));
}

.cs__option.is-selected {
  font-weight: var(--font-weight-semibold);
}

.cs__empty {
  padding: 10px 8px;
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
}
</style>
