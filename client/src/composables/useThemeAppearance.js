import { ref, computed, watch } from 'vue';

const STORAGE_KEY = 'tms-ui-theme';
const VALID = new Set(['light', 'dark', 'system']);

function readStoredPreference() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (VALID.has(s)) return s;
  } catch {
    /* ignore */
  }
  return 'light';
}

export const themePreference = ref(readStoredPreference());

let mediaBound = false;

function effectiveThemeValue() {
  if (themePreference.value === 'system') {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return themePreference.value;
}

function applyToDocument() {
  const effective = effectiveThemeValue();
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = effective;
  document.documentElement.dataset.themePreference = themePreference.value;
  try {
    localStorage.setItem(STORAGE_KEY, themePreference.value);
  } catch {
    /* ignore */
  }
}

/** Call once from main.js before mount to reduce theme flash */
export function initThemeAppearance() {
  applyToDocument();
  if (typeof window !== 'undefined' && !mediaBound) {
    mediaBound = true;
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (themePreference.value === 'system') applyToDocument();
    });
  }
}

export const themeOptions = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' }
];

watch(themePreference, () => applyToDocument(), { flush: 'sync' });

export function useThemeAppearance() {
  const effectiveTheme = computed(effectiveThemeValue);

  function setThemePreference(value) {
    if (!VALID.has(value)) return;
    themePreference.value = value;
  }

  return {
    themePreference,
    effectiveTheme,
    themeOptions,
    setThemePreference
  };
}
