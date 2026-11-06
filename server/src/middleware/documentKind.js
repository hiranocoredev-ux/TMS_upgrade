import { normalizeDocumentKind } from '../constants/documentKind.js';

/** Attach normalized document kind from route mount (`/api/reports` vs `/api/plans`). */
export function attachDocumentKind(kind) {
  return (req, _res, next) => {
    req.documentKind = normalizeDocumentKind(kind);
    next();
  };
}
