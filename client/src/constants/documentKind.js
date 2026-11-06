/** Work-result documents vs period plans (separate pages and APIs). */
export const DOCUMENT_KIND = {
  REPORT: 'report',
  PLAN: 'plan'
};

export function normalizeDocumentKind(value) {
  return String(value || '').trim().toLowerCase() === DOCUMENT_KIND.PLAN
    ? DOCUMENT_KIND.PLAN
    : DOCUMENT_KIND.REPORT;
}

export function isPlanKind(kind) {
  return normalizeDocumentKind(kind) === DOCUMENT_KIND.PLAN;
}

export function getDocumentKindFromRoute(route) {
  return normalizeDocumentKind(route?.meta?.documentKind);
}
