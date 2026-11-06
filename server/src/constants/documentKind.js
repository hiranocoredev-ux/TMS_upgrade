/** Work-result documents vs period plans (separate submit / approve flows). */
export const DOCUMENT_KIND = {
  REPORT: 'report',
  PLAN: 'plan'
};

export function normalizeDocumentKind(value) {
  return String(value || '').trim().toLowerCase() === DOCUMENT_KIND.PLAN
    ? DOCUMENT_KIND.PLAN
    : DOCUMENT_KIND.REPORT;
}
