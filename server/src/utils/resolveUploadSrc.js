/**
 * Resolve stored paths such as `/uploads/avatars/...` for use in `<img src>`.
 * When the API runs on another origin than the SPA (production), prefix the API origin.
 */
export function resolveUploadSrc(path) {
  let raw = String(path ?? '').trim();
  if (!raw) return '';
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:')) return raw;
  // Stored paths sometimes omit the leading slash
  if (/^uploads\//i.test(raw)) raw = `/${raw}`;
  if (!raw.startsWith('/uploads/')) return raw;

  const api = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL).trim()
    : '';
  const origin = api.replace(/\/api\/?$/i, '').replace(/\/$/, '');
  if (origin.startsWith('http://') || origin.startsWith('https://')) {
    return `${origin}${raw}`;
  }
  return raw;
}
