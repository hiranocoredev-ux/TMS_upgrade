import { getKindSectionDisplay } from './reportPeriod';

/** Display label with 1-based sequence prefix (e.g. "1. Earning and Outcome result"). */
export function formatTicketSequenceLabel(index, title) {
  const n = Number(index);
  const seq = Number.isFinite(n) && n >= 0 ? n + 1 : 1;
  const label = String(title || '').trim() || 'Ticket';
  return `${seq}. ${label}`;
}

export function normalizeTicketTitle(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** True when a saved section is the old single-block plan title. */
export function isLegacyMonolithicPlanTitle(title, period, anchorDateStr) {
  const t = normalizeTicketTitle(title);
  if (!t || !/\bplan\b/i.test(title)) return false;
  try {
    const display = getKindSectionDisplay(period, 'plan', anchorDateStr);
    if (normalizeTicketTitle(display.label) === t) return true;
  } catch {
    /* ignore */
  }
  return /^[a-z0-9\s,'/-]+ plan$/i.test(String(title || '').trim());
}

function isLegacyMonolithicDoc(sections, period, anchorDateStr) {
  return (
    sections.length === 1 &&
    isLegacyMonolithicPlanTitle(sections[0]?.title, period, anchorDateStr)
  );
}

function templateByTitleMap(templates) {
  const map = new Map();
  for (const t of Array.isArray(templates) ? templates : []) {
    if (!t || t.active === false) continue;
    const title = String(t.title || '').trim();
    if (title) map.set(normalizeTicketTitle(title), t);
  }
  return map;
}

function rowFromSection(sec, templateMap) {
  const title = String(sec?.title || '').trim() || 'Ticket';
  const norm = normalizeTicketTitle(title);
  const tpl = templateMap.get(norm);
  return {
    templateId: tpl?._id ? String(tpl._id) : sec?.templateId ? String(sec.templateId) : null,
    title,
    notes: sec?.notes != null ? String(sec.notes) : '',
    isCustom: !tpl
  };
}

/** Build rows only from saved plan sections (removed tickets stay out of the doc). */
function buildRowsFromSavedSections(saved, templates, period, anchorDateStr) {
  if (isLegacyMonolithicDoc(saved, period, anchorDateStr)) {
    return [
      {
        templateId: null,
        title: 'Plan',
        notes: saved[0]?.notes != null ? String(saved[0].notes) : '',
        isCustom: false
      }
    ];
  }
  const templateMap = templateByTitleMap(templates);
  return saved.map((sec) => rowFromSection(sec, templateMap));
}

/** Layout entry: { title, templateId?, isCustom? } */
function buildRowsFromLayout(layout, templates, savedByTitle) {
  const templateMap = templateByTitleMap(templates);
  const rows = [];
  for (const entry of layout) {
    const title = String(entry?.title || '').trim();
    if (!title) continue;
    const norm = normalizeTicketTitle(title);
    const tpl = templateMap.get(norm);
    const fromSaved = savedByTitle.get(norm);
    rows.push({
      templateId: entry.templateId || (tpl?._id ? String(tpl._id) : null),
      title,
      notes: fromSaved?.notes != null ? String(fromSaved.notes) : '',
      isCustom: entry.isCustom === true || (!tpl && !entry.templateId)
    });
  }
  return rows;
}

function buildRowsFromAllTemplates(templates, savedByTitle) {
  return (Array.isArray(templates) ? templates : [])
    .filter((t) => t && t.active !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((t) => {
      const title = String(t.title || '').trim();
      const norm = normalizeTicketTitle(title);
      return {
        templateId: t._id ? String(t._id) : null,
        title,
        notes: savedByTitle.get(norm)?.notes ?? '',
        isCustom: false
      };
    });
}

export function layoutFromPlanSections(sections, templates, period, anchorDateStr) {
  const saved = Array.isArray(sections) ? sections : [];
  if (!saved.length) return [];
  if (isLegacyMonolithicDoc(saved, period, anchorDateStr)) {
    return [{ title: 'Plan', templateId: null, isCustom: false }];
  }
  const templateMap = templateByTitleMap(templates);
  return saved.map((sec) => {
    const title = String(sec?.title || '').trim();
    const tpl = templateMap.get(normalizeTicketTitle(title));
    return {
      title,
      templateId: tpl?._id ? String(tpl._id) : null,
      isCustom: !tpl
    };
  });
}

export function planLayoutStorageKey(userId, period) {
  return `plan_ticket_layout_${period}_${userId || 'anon'}`;
}

export function savePlanLayoutPreference(userId, period, tickets) {
  if (!userId || !period) return;
  const layout = (Array.isArray(tickets) ? tickets : []).map((t) => ({
    title: String(t.title || '').trim(),
    templateId: t.templateId || null,
    isCustom: !!t.isCustom
  }));
  try {
    localStorage.setItem(planLayoutStorageKey(userId, period), JSON.stringify(layout));
  } catch {
    /* ignore quota */
  }
}

export function getPlanLayoutPreference(userId, period) {
  if (!userId || !period) return null;
  try {
    const raw = localStorage.getItem(planLayoutStorageKey(userId, period));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Most recent plan document with sections (for carrying ticket list forward). */
export function findLatestPlanDoc(planDocs, currentAnchorDateStr, period) {
  const list = Array.isArray(planDocs) ? planDocs : [];
  const sorted = [...list]
    .filter((d) => Array.isArray(d?.sections) && d.sections.length > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (!sorted.length) return null;
  if (!currentAnchorDateStr) return sorted[0];
  const currentNorm = String(currentAnchorDateStr).split('T')[0];
  const other = sorted.find((d) => {
    const raw = typeof d.date === 'string' ? d.date.split('T')[0] : '';
    return raw && raw !== currentNorm;
  });
  return other || sorted[0];
}

export function getRemovedDefaultTemplates(activeTickets, templates) {
  const activeNorm = new Set(
    (Array.isArray(activeTickets) ? activeTickets : []).map((t) =>
      normalizeTicketTitle(t.title)
    )
  );
  return (Array.isArray(templates) ? templates : [])
    .filter((t) => t && t.active !== false)
    .filter((t) => !activeNorm.has(normalizeTicketTitle(t.title)))
    .map((t) => ({
      templateId: t._id ? String(t._id) : null,
      title: String(t.title || '').trim()
    }))
    .filter((t) => t.title);
}

/**
 * Merge templates + saved doc + last-plan layout into composer rows.
 * Only tickets present in the saved doc (or chosen layout) are shown.
 */
export function buildPlanTicketSections(doc, templates, period, anchorDateStr, options = {}) {
  const { previousPlanDoc, userId } = options;
  const saved = Array.isArray(doc?.sections) ? doc.sections : [];
  const savedByTitle = new Map();
  for (const s of saved) {
    const key = normalizeTicketTitle(s?.title);
    if (key) savedByTitle.set(key, s);
  }

  const hasSavedTicketList =
    saved.length > 0 && !isLegacyMonolithicDoc(saved, period, anchorDateStr);

  if (hasSavedTicketList) {
    return buildRowsFromSavedSections(saved, templates, period, anchorDateStr);
  }

  let legacyNotes = '';
  if (saved.length === 1 && isLegacyMonolithicPlanTitle(saved[0]?.title, period, anchorDateStr)) {
    legacyNotes = saved[0]?.notes ?? '';
  }

  const layoutFromPrevious = previousPlanDoc?.sections?.length
    ? layoutFromPlanSections(previousPlanDoc.sections, templates, period, anchorDateStr)
    : null;
  const layout =
    layoutFromPrevious ||
    getPlanLayoutPreference(userId, period) ||
    null;

  let rows;
  if (layout?.length) {
    rows = buildRowsFromLayout(layout, templates, savedByTitle);
  } else {
    rows = buildRowsFromAllTemplates(templates, savedByTitle);
  }

  if (legacyNotes && rows.length && !hasVisibleNotes(rows[0].notes)) {
    rows[0].notes = legacyNotes;
  }

  return rows;
}

export function planTicketRowsToSections(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({
      title: String(row?.title || '').trim() || 'Ticket',
      notes: row?.notes != null ? String(row.notes) : ''
    }))
    .filter((s) => s.title);
}

export function hasVisibleNotes(notes) {
  const raw = String(notes || '').trim();
  if (!raw) return false;
  return raw.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim().length > 0;
}

/** Read-only view model for plan documents with ticket sections. */
export function buildPlanTicketsReadView(doc, period, anchorDateStr) {
  const hasSubmittedDoc = doc != null && Number(doc.state ?? 0) >= 1;
  const sections = hasSubmittedDoc ? doc.sections || [] : [];

  if (!hasSubmittedDoc) {
    return {
      anchorDate: anchorDateStr,
      pending: true,
      tickets: []
    };
  }

  const tickets = sections.map((sec) => ({
    title: sec?.title != null ? String(sec.title) : 'Ticket',
    notes: sec?.notes != null ? String(sec.notes) : ''
  }));

  const isLegacySingle =
    tickets.length === 1 &&
    isLegacyMonolithicPlanTitle(tickets[0].title, period, anchorDateStr);

  return {
    anchorDate: anchorDateStr,
    pending: false,
    tickets: isLegacySingle
      ? [{ title: 'Plan', notes: tickets[0].notes }]
      : tickets
  };
}
