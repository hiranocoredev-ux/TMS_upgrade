import {
  normalizeTicketTitle,
  isLegacyMonolithicPlanTitle,
  hasVisibleNotes,
  formatTicketSequenceLabel
} from './planTickets.js';
import { getKindSectionDisplay, normalizeDateForPeriod } from './reportPeriod.js';

export function findSubmittedPlanDoc(planDocs, anchorDateStr, period) {
  const anchor = normalizeDateForPeriod(anchorDateStr, period);
  const list = Array.isArray(planDocs) ? planDocs : [];
  return (
    list.find((r) => {
      if (Number(r.state ?? 0) < 1) return false;
      const raw = typeof r.date === 'string' ? r.date.split('T')[0] : '';
      if (!raw) return false;
      return normalizeDateForPeriod(raw, period) === anchor;
    }) || null
  );
}

/** Plan sections as ticket rows (from multi-ticket plan or legacy single block). */
export function planDocToTicketRows(planDoc, period, anchorDateStr) {
  if (!planDoc?.sections?.length) return [];
  const sections = planDoc.sections;
  const isLegacy =
    sections.length === 1 &&
    isLegacyMonolithicPlanTitle(sections[0]?.title, period, anchorDateStr);

  if (isLegacy) {
    return [
      {
        title: 'Plan',
        planNotes: sections[0]?.notes != null ? String(sections[0].notes) : ''
      }
    ];
  }

  return sections.map((sec) => ({
    title: String(sec?.title || '').trim() || 'Ticket',
    planNotes: sec?.notes != null ? String(sec.notes) : ''
  }));
}

function parseChecked(value) {
  if (value === true || value === false) return value;
  return null;
}

function parsePercent(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

/**
 * Build report composer rows from submitted plan + saved report sections.
 */
export function buildReportTicketSections(reportDoc, planDoc, period, anchorDateStr) {
  const saved = Array.isArray(reportDoc?.sections) ? reportDoc.sections : [];
  const byTitle = new Map();
  for (const s of saved) {
    const key = normalizeTicketTitle(s?.title);
    if (key) byTitle.set(key, s);
  }

  const planRows = planDocToTicketRows(planDoc, period, anchorDateStr);
  if (planRows.length) {
    return planRows.map((planRow) => {
      const savedRow = byTitle.get(normalizeTicketTitle(planRow.title));
      const planNotes = planRow.planNotes ?? '';
      return {
        title: planRow.title,
        planNotes,
        notes: savedRow?.notes != null ? String(savedRow.notes) : '',
        checked: parseChecked(savedRow?.checked),
        percent: parsePercent(savedRow?.percent) ?? 0
      };
    });
  }

  // Legacy single work-result report (no plan tickets yet)
  const display = getKindSectionDisplay(period, 'report', anchorDateStr);
  const legacyTitle = normalizeTicketTitle(display.label);
  const legacySaved =
    saved.find((s) => normalizeTicketTitle(s?.title) === legacyTitle) || saved[0];

  if (legacySaved && (saved.length === 1 || legacySaved === saved[0])) {
    return [
      {
        title: String(legacySaved.title || display.label || 'Work result'),
        planNotes: legacySaved.planNotes != null ? String(legacySaved.planNotes) : '',
        notes: legacySaved.notes != null ? String(legacySaved.notes) : '',
        checked: parseChecked(legacySaved.checked),
        percent: parsePercent(legacySaved.percent) ?? 0
      }
    ];
  }

  return saved.map((sec) => ({
    title: String(sec?.title || '').trim() || 'Ticket',
    planNotes: sec?.planNotes != null ? String(sec.planNotes) : '',
    notes: sec?.notes != null ? String(sec.notes) : '',
    checked: parseChecked(sec.checked),
    percent: parsePercent(sec.percent) ?? 0
  }));
}

export function reportTicketRowsToSections(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const title = String(row?.title || '').trim() || 'Ticket';
      const section = {
        title,
        planNotes: row?.planNotes != null ? String(row.planNotes) : '',
        notes: row?.notes != null ? String(row.notes) : ''
      };
      if (row?.checked === true || row?.checked === false) {
        section.checked = row.checked;
      }
      const pct = parsePercent(row?.percent);
      if (pct != null) section.percent = pct;
      return section;
    })
    .filter((s) => s.title);
}

export function buildReportTicketsReadView(doc, period, anchorDateStr) {
  const hasSubmittedDoc = doc != null && Number(doc.state ?? 0) >= 1;
  if (!hasSubmittedDoc) {
    return {
      anchorDate: anchorDateStr,
      pending: true,
      tickets: [],
      noPlan: false
    };
  }

  const sections = doc.sections || [];
  const tickets = sections.map((sec) => ({
    title: sec?.title != null ? String(sec.title) : 'Ticket',
    planNotes: sec?.planNotes != null ? String(sec.planNotes) : '',
    notes: sec?.notes != null ? String(sec.notes) : '',
    checked: parseChecked(sec.checked),
    percent: parsePercent(sec.percent)
  }));

  const isLegacyWorkOnly =
    tickets.length === 1 &&
    !hasVisibleNotes(tickets[0].planNotes) &&
    isLegacyMonolithicPlanTitle(tickets[0].title, period, anchorDateStr) === false &&
    tickets[0].checked == null &&
    tickets[0].percent == null;

  return {
    anchorDate: anchorDateStr,
    pending: false,
    tickets,
    isLegacyWorkOnly
  };
}

export function checkedStatusLabel(checked) {
  if (checked === true) return 'Complete';
  if (checked === false) return 'Not complete';
  return 'Not rated';
}

/** Per-ticket field flags for inline validation UI. */
export function reportTicketFieldErrors(validationErrors, index) {
  const entry = (Array.isArray(validationErrors) ? validationErrors : []).find(
    (e) => e.index === index
  );
  return entry?.fields || { percent: false, checked: false, notes: false };
}

/**
 * Submit validation for ticket-based reports.
 * - Progress % and Complete/Not complete are required per ticket.
 * - Work result notes are required only when marked Not complete.
 */
export function validateReportTicketSections(sections) {
  const rows = Array.isArray(sections) ? sections : [];
  const errors = [];

  rows.forEach((row, index) => {
    const label = formatTicketSequenceLabel(index, row?.title);
    const fields = { percent: false, checked: false, notes: false };

    if (parsePercent(row?.percent) == null) {
      fields.percent = true;
      errors.push({
        index,
        fields: { ...fields },
        message: `${label}: Set progress (0% or higher).`
      });
    }

    const checked = parseChecked(row?.checked);
    if (checked !== true && checked !== false) {
      fields.checked = true;
      errors.push({
        index,
        fields: { ...fields },
        message: `${label}: Select Complete or Not complete.`
      });
    }

    // Validate that section has content
    if (!hasVisibleNotes(row?.notes)) {
      // Allow empty content if completed (checked=true) and percent > 100%
      const isOverCompleted = checked === true && parsePercent(row?.percent) != null && parsePercent(row?.percent) > 100;
      
      if (!isOverCompleted) {
        fields.notes = true;
        if (checked === false) {
          errors.push({
            index,
            fields: { percent: fields.percent, checked: fields.checked, notes: true },
            message: `${label}: Work result is required when marked Not complete.`
          });
        } else {
          errors.push({
            index,
            fields: { percent: fields.percent, checked: fields.checked, notes: true },
            message: `${label}: Section content is required.`
          });
        }
      }
    }
  });

  const merged = mergeValidationErrorsByIndex(errors);

  return {
    ok: merged.length === 0,
    errors: merged,
    summary: merged.length
      ? merged.length === 1
        ? merged[0].message
        : `Complete required fields on ${merged.length} ticket(s) before submitting.`
      : ''
  };
}

function mergeValidationErrorsByIndex(errors) {
  const byIndex = new Map();
  for (const err of errors) {
    const prev = byIndex.get(err.index);
    if (!prev) {
      byIndex.set(err.index, {
        index: err.index,
        fields: { ...err.fields },
        messages: [err.message]
      });
    } else {
      prev.fields.percent = prev.fields.percent || err.fields.percent;
      prev.fields.checked = prev.fields.checked || err.fields.checked;
      prev.fields.notes = prev.fields.notes || err.fields.notes;
      if (!prev.messages.includes(err.message)) prev.messages.push(err.message);
    }
  }
  return [...byIndex.values()].map((e) => ({
    index: e.index,
    fields: e.fields,
    message: e.messages.join(' ')
  }));
}

/** Card tone from progress % (submit composer backgrounds). */
export function getReportTicketProgressTone(percent) {
  if (percent == null || percent === '') return 'unset';
  const n = Number(percent);
  if (!Number.isFinite(n)) return 'unset';
  const p = Math.min(100, Math.max(0, Math.round(n)));
  if (p >= 100) return 'complete';
  if (p <= 0) return 'none';
  return 'partial';
}

/** Mean progress % across tickets that have a percent set (rounded). */
export function averageTicketPercentFromTickets(tickets) {
  const rows = Array.isArray(tickets) ? tickets : [];
  const values = [];
  for (const row of rows) {
    const pct = parsePercent(row?.percent);
    if (pct != null) values.push(pct);
  }
  if (!values.length) return null;
  const sum = values.reduce((acc, n) => acc + n, 0);
  return Math.round(sum / values.length);
}

export function averageTicketPercentFromSections(sections) {
  const rows = Array.isArray(sections) ? sections : [];
  return averageTicketPercentFromTickets(
    rows.map((s) => ({ percent: s?.percent }))
  );
}

/** Colored percent text for history / document view (no card tint). */
export function getReportTicketPercentColorClass(percent) {
  const tone = getReportTicketProgressTone(percent);
  if (tone === 'complete') return 'is-pct-complete';
  if (tone === 'none') return 'is-pct-none';
  if (tone === 'partial') return 'is-pct-partial';
  return 'is-pct-unset';
}
