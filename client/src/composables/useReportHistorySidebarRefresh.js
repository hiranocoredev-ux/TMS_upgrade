import { provide, inject } from 'vue';

/** Injected by embedded history layouts so detail views can refresh list/calendar after workflow actions */
export const REPORT_HISTORY_SIDEBAR_REFRESH_KEY = Symbol('reportHistorySidebarRefresh');

export function provideReportHistorySidebarRefresh(callback) {
  if (typeof callback === 'function') {
    provide(REPORT_HISTORY_SIDEBAR_REFRESH_KEY, callback);
  }
}

/** Call after submit/save/approve/reject so sidebar status & dots update without full page reload */
export function useReportHistorySidebarRefresh() {
  return inject(REPORT_HISTORY_SIDEBAR_REFRESH_KEY, null);
}
