import { ref, computed, watch } from 'vue';

const STORAGE_KEY = 'tms.timezone';

const detectLocal = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const getAllZones = () => {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      return Intl.supportedValuesOf('timeZone');
    }
  } catch {
    /* fall through */
  }
  // Minimal fallback set for older runtimes.
  return [
    'UTC',
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Moscow',
    'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Seoul', 'Asia/Kolkata', 'Asia/Dubai',
    'Australia/Sydney', 'Pacific/Auckland',
  ];
};

const stored = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
})();

const timezone = ref(stored || detectLocal());

watch(timezone, (v) => {
  try {
    localStorage.setItem(STORAGE_KEY, v);
  } catch {
    /* ignore */
  }
});

const offsetLabel = (tz, at = new Date()) => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(at);
    const p = parts.find((x) => x.type === 'timeZoneName');
    return p ? p.value : '';
  } catch {
    return '';
  }
};

export function useTimezone() {
  const zones = getAllZones();
  const localZone = detectLocal();
  const currentOffset = computed(() => offsetLabel(timezone.value));

  return {
    timezone,
    zones,
    localZone,
    currentOffset,
    offsetLabel,
  };
}
