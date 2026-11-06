import { buildSubmittedReportSideBySide } from './reportPeriod';

function esc(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sectionBodyHtml(notes) {
  const body = String(notes || '').trim();
  return body || '<div class="rpt-empty">—</div>';
}

function planSourceHintForPeriod(period) {
  if (period === 'weekly') return 'From the previous week’s submitted plan';
  if (period === 'monthly') return 'From the previous month’s submitted plan';
  return 'From the previous day’s submitted plan';
}

/**
 * Export/print HTML for history compare: anchor period plan + work result as a formal document.
 */
export function buildHistoryCompareDocumentHtml({
  title,
  metaLine = '',
  compare,
  period = 'daily',
}) {
  const plan = compare?.periodPlan || compare?.priorPlan;
  const work = compare?.workResult;
  const extras = Array.isArray(compare?.extras) ? compare.extras : [];

  const planTitle = esc(plan?.label || 'Plan');
  const workTitle = esc(work?.label || 'Report');
  const planHint = esc(planSourceHintForPeriod(period));
  const workPending = Boolean(work?.pending);
  const workHint = esc(
    workPending
      ? 'Work result not submitted for this period yet'
      : 'Work result submitted with this period’s report'
  );
  const workBody = workPending
    ? '<p><em>Not submitted yet</em></p>'
    : sectionBodyHtml(work?.notes);

  const extraSections = extras
    .map((s, idx) => {
      const st = esc(s?.title || `Section ${idx + 1}`);
      return `
        <section class="rpt-section rpt-section--full">
          <h3 class="rpt-section-title">${st}</h3>
          <div class="rpt-section-body">${sectionBodyHtml(s?.notes)}</div>
        </section>
      `;
    })
    .join('\n');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Arial, sans-serif;
      color: #111827;
      background: #fff;
      line-height: 1.55;
    }
    .rpt-doc {
      max-width: 960px;
      margin: 16px auto;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 24px 28px;
    }
    .rpt-head {
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 14px;
      margin-bottom: 20px;
    }
    .rpt-title {
      margin: 0;
      font-size: 26px;
      line-height: 1.2;
      letter-spacing: -0.02em;
      color: #0f172a;
      font-weight: 700;
    }
    .rpt-meta {
      margin-top: 8px;
      font-size: 13px;
      color: #64748b;
    }
    .rpt-compare-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 12px 0;
      table-layout: fixed;
    }
    .rpt-compare-cell {
      width: 50%;
      vertical-align: top;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 16px;
      background: #f8fafc;
    }
    .rpt-section-title {
      margin: 0 0 4px;
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
    }
    .rpt-section-hint {
      margin: 0 0 12px;
      font-size: 11px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: none;
      letter-spacing: 0.01em;
    }
    .rpt-section-body {
      font-size: 14px;
      color: #334155;
    }
    .rpt-section-body p { margin: 0 0 10px; }
    .rpt-section-body p:last-child { margin-bottom: 0; }
    .rpt-section-body ul, .rpt-section-body ol { margin: 0 0 10px; padding-left: 20px; }
    .rpt-section-body img { max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #e5e7eb; }
    .rpt-section-body strong, .rpt-section-body b { font-weight: 700; }
    .rpt-empty { color: #94a3b8; font-weight: 600; }
    .rpt-section--full {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 16px;
      margin-top: 16px;
    }
    @media print {
      .rpt-doc { border: none; margin: 0; padding: 0; max-width: none; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    @media (max-width: 720px) {
      .rpt-compare-table, .rpt-compare-table tbody, .rpt-compare-table tr, .rpt-compare-cell {
        display: block;
        width: 100%;
      }
      .rpt-compare-cell { margin-bottom: 12px; }
    }
  </style>
</head>
<body>
  <main class="rpt-doc">
    <header class="rpt-head">
      <h1 class="rpt-title">${esc(title)}</h1>
      ${metaLine ? `<div class="rpt-meta">${esc(metaLine)}</div>` : ''}
    </header>
    <table class="rpt-compare-table" role="presentation">
      <tr>
        <td class="rpt-compare-cell">
          <h3 class="rpt-section-title">${planTitle}</h3>
          <p class="rpt-section-hint">${planHint}</p>
          <div class="rpt-section-body">${sectionBodyHtml(plan?.notes)}</div>
        </td>
        <td class="rpt-compare-cell">
          <h3 class="rpt-section-title">${workTitle}</h3>
          <p class="rpt-section-hint">${workHint}</p>
          <div class="rpt-section-body">${workBody}</div>
        </td>
      </tr>
    </table>
    ${extraSections}
  </main>
</body>
</html>`;
}

function nextPlanHintForPeriod(period) {
  if (period === 'weekly') return 'Plan for the next week';
  if (period === 'monthly') return 'Plan for the next month';
  return 'Plan for the next day';
}

/**
 * Export/print HTML for submitted report: work result (left) + next plan (right).
 */
export function buildSubmittedSideBySideDocumentHtml({
  title,
  range = '',
  metaLine = '',
  compare,
  period = 'daily'
}) {
  const work = compare?.workResult;
  const plan = compare?.nextPlan;
  const extras = Array.isArray(compare?.extras) ? compare.extras : [];

  const workTitle = esc(work?.label || 'Work Result');
  const planTitle = esc(plan?.label || 'Plan');
  const workHint = esc('Work result for this reporting period');
  const planHint = esc(nextPlanHintForPeriod(period));

  const extraSections = extras
    .map((s, idx) => {
      const st = esc(s?.title || `Section ${idx + 1}`);
      return `
        <section class="rpt-section rpt-section--full">
          <h3 class="rpt-section-title">${st}</h3>
          <div class="rpt-section-body">${sectionBodyHtml(s?.notes)}</div>
        </section>
      `;
    })
    .join('\n');

  const fullTitle = range ? `${esc(title)} (${esc(range)})` : esc(title);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${fullTitle}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; color: #111827; background: #fff; line-height: 1.55; }
    .rpt-doc { max-width: 960px; margin: 16px auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px 28px; }
    .rpt-head { border-bottom: 2px solid #e5e7eb; padding-bottom: 14px; margin-bottom: 20px; }
    .rpt-title { margin: 0; font-size: 26px; font-weight: 700; color: #0f172a; }
    .rpt-meta { margin-top: 8px; font-size: 13px; color: #64748b; }
    .rpt-compare-table { width: 100%; border-collapse: separate; border-spacing: 12px 0; table-layout: fixed; }
    .rpt-compare-cell { width: 50%; vertical-align: top; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; background: #f8fafc; }
    .rpt-section-title { margin: 0 0 4px; font-size: 17px; font-weight: 700; color: #0f172a; }
    .rpt-section-hint { margin: 0 0 12px; font-size: 11px; font-weight: 600; color: #94a3b8; }
    .rpt-section-body { font-size: 14px; color: #334155; }
    .rpt-section-body p { margin: 0 0 10px; }
    .rpt-section--full { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-top: 16px; }
    @media (max-width: 720px) {
      .rpt-compare-table, .rpt-compare-table tbody, .rpt-compare-table tr, .rpt-compare-cell { display: block; width: 100%; }
      .rpt-compare-cell { margin-bottom: 12px; }
    }
  </style>
</head>
<body>
  <main class="rpt-doc">
    <header class="rpt-head">
      <h1 class="rpt-title">${fullTitle}</h1>
      ${metaLine ? `<div class="rpt-meta">${esc(metaLine)}</div>` : ''}
    </header>
    <table class="rpt-compare-table" role="presentation">
      <tr>
        <td class="rpt-compare-cell">
          <h3 class="rpt-section-title">${workTitle}</h3>
          <p class="rpt-section-hint">${workHint}</p>
          <div class="rpt-section-body">${sectionBodyHtml(work?.notes)}</div>
        </td>
        <td class="rpt-compare-cell">
          <h3 class="rpt-section-title">${planTitle}</h3>
          <p class="rpt-section-hint">${planHint}</p>
          <div class="rpt-section-body">${sectionBodyHtml(plan?.notes)}</div>
        </td>
      </tr>
    </table>
    ${extraSections}
  </main>
</body>
</html>`;
}

/** Build export HTML: stacked sections or side-by-side core when `sideBySide` is true. */
export function buildReportExportHtml({
  title,
  range = '',
  metaLine = '',
  sections = [],
  period = 'daily',
  dateKey = '',
  sideBySide = false
}) {
  if (sideBySide && Array.isArray(sections) && sections.length >= 2) {
    const compare = buildSubmittedReportSideBySide(sections, period, dateKey);
    return buildSubmittedSideBySideDocumentHtml({ title, range, metaLine, compare, period });
  }
  return buildReportDocumentHtml({ title, range, metaLine, sections });
}

export function buildReportDocumentHtml({
  title,
  range = '',
  metaLine = '',
  sections = [],
}) {
  const renderedSections = (Array.isArray(sections) ? sections : [])
    .map((s, idx) => {
      const st = esc(s?.title || `Section ${idx + 1}`);
      const body = String(s?.notes || '').trim();
      return `
        <section class="rpt-section">
          <h3 class="rpt-section-title">${st}</h3>
          <div class="rpt-section-body">${body || '<div class="rpt-empty">-</div>'}</div>
        </section>
      `;
    })
    .join('\n');

  const fullTitle = range ? `${esc(title)} (${esc(range)})` : esc(title);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${fullTitle}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Arial, sans-serif;
      color: #111827;
      background: #fff;
      line-height: 1.55;
    }
    .rpt-doc {
      max-width: 920px;
      margin: 16px auto;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 20px;
    }
    .rpt-head {
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .rpt-title {
      margin: 0;
      font-size: 28px;
      line-height: 1.2;
      letter-spacing: -0.02em;
      color: #0f172a;
    }
    .rpt-meta {
      margin-top: 6px;
      font-size: 13px;
      color: #64748b;
    }
    .rpt-section {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    .rpt-section-title {
      margin: 0 0 8px;
      font-size: 18px;
      color: #0f172a;
    }
    .rpt-section-body p { margin: 0 0 10px; }
    .rpt-section-body p:last-child { margin-bottom: 0; }
    .rpt-section-body ul, .rpt-section-body ol { margin: 0 0 10px; padding-left: 20px; }
    .rpt-section-body img { max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #e5e7eb; }
    .rpt-empty { color: #94a3b8; font-weight: 600; }
    @media print {
      .rpt-doc { border: none; margin: 0; padding: 0; max-width: none; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <main class="rpt-doc">
    <header class="rpt-head">
      <h1 class="rpt-title">${fullTitle}</h1>
      ${metaLine ? `<div class="rpt-meta">${esc(metaLine)}</div>` : ''}
    </header>
    <div class="rpt-content">
      ${renderedSections || '<div class="rpt-empty">No content</div>'}
    </div>
  </main>
</body>
</html>`;
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
    reader.readAsDataURL(blob);
  });
}

async function inlineBlobImagesInHtml(html) {
  const source = String(html || '');
  if (!source || !source.includes('blob:')) return source;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(source, 'text/html');
    const images = Array.from(doc.querySelectorAll('img[src^="blob:"]'));
    if (!images.length) return source;

    await Promise.all(images.map(async (img) => {
      const src = img.getAttribute('src') || '';
      if (!src.startsWith('blob:')) return;
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        const dataUrl = await blobToDataUrl(blob);
        if (dataUrl) img.setAttribute('src', dataUrl);
      } catch {
        // Keep original src; better partial export than hard failure.
      }
    }));

    return `<!doctype html>\n${doc.documentElement.outerHTML}`;
  } catch {
    return source;
  }
}

export async function exportReportAsDoc({ fileName, html }) {
  const exportHtml = await inlineBlobImagesInHtml(html);
  const blob = new Blob(['\ufeff', exportHtml], {
    type: 'application/msword;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName || 'report'}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Print HTML without opening a new tab. `window.open()` is often blocked as a popup;
 * writing into a hidden iframe and calling print() there avoids popup blockers.
 */
export function printReportHtml(html) {
  let iframe;
  try {
    iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Print preview');
    iframe.setAttribute('aria-hidden', 'true');
    Object.assign(iframe.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '0',
      height: '0',
      border: '0',
      visibility: 'hidden',
    });
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    if (!win) {
      document.body.removeChild(iframe);
      return false;
    }

    const doc = win.document;
    doc.open();
    doc.write(html);
    doc.close();

    let removed = false;
    let fallbackTimer;
    const cleanup = () => {
      if (removed) return;
      removed = true;
      if (fallbackTimer != null) window.clearTimeout(fallbackTimer);
      if (iframe?.parentNode) iframe.parentNode.removeChild(iframe);
    };

    fallbackTimer = window.setTimeout(cleanup, 120_000);
    win.addEventListener('afterprint', cleanup, { once: true });

    const runPrint = () => {
      try {
        win.focus();
        win.print();
      } catch {
        cleanup();
      }
    };

    const schedule = () => requestAnimationFrame(runPrint);
    if (doc.readyState === 'complete') {
      schedule();
    } else {
      win.addEventListener('load', schedule, { once: true });
    }

    return true;
  } catch {
    if (iframe?.parentNode) iframe.parentNode.removeChild(iframe);
    return false;
  }
}

