import { ref, readonly } from 'vue';
import apiClient from '../services/axios';

/**
 * The Hubstaff organization ID (it changes every two weeks) and the links to a
 * member's Hubstaff activity page. One shared state for the whole app.
 */
const state = ref({
  organizationId: '',
  updatedAt: null,
  updatedByName: '',
  currentDue: null,
  nextDue: null,
  needsUpdate: false,
});
const loaded = ref(false);
let inflight = null;

async function load({ force = false } = {}) {
  if (loaded.value && !force) return state.value;
  if (inflight && !force) return inflight;
  inflight = apiClient
    .get('/workflow/hubstaff-org')
    .then((res) => {
      state.value = { ...state.value, ...(res.data?.data || {}) };
      loaded.value = true;
      return state.value;
    })
    .catch(() => state.value)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

async function save(organizationId) {
  const res = await apiClient.put('/workflow/hubstaff-org', { organizationId }, { silentSuccess: true });
  state.value = { ...state.value, ...(res.data?.data || {}) };
  loaded.value = true;
  return state.value;
}

/** First day of the month six months before `dateKey` (Hubstaff's min_date). */
function minDateFor(dateKey) {
  const [y, m] = String(dateKey).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 - 6, 1));
  return d.toISOString().slice(0, 10);
}

/**
 * Link to a member's Hubstaff activity (screenshots) for one day, e.g.
 * https://app.hubstaff.com/organizations/795932/activities?date=2026-11-20&...&filters%5Buser%5D=3928787
 * Empty when the organization ID or the member's Hubstaff ID is missing.
 */
function hubstaffActivityUrl(hubstaffUserId, dateKey) {
  const org = String(state.value.organizationId || '').trim();
  const user = String(hubstaffUserId || '').trim();
  if (!org || !user || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return '';
  const params = new URLSearchParams({
    date: dateKey,
    min_date: minDateFor(dateKey),
    all_screenshots: 'false',
    time_zone: 'user',
  });
  params.append('filters[user]', user);
  return `https://app.hubstaff.com/organizations/${encodeURIComponent(org)}/activities?${params.toString()}`;
}

export function useHubstaffOrg() {
  return { hubstaffOrg: readonly(state), loadHubstaffOrg: load, saveHubstaffOrg: save, hubstaffActivityUrl };
}
