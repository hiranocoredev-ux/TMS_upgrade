/** Last calendar day of YYYY-MM */
export function lastDayOfMonth(monthYm) {
  if (!/^\d{4}-\d{2}$/.test(monthYm || '')) return '';
  const [y, m] = monthYm.split('-').map(Number);
  const d = new Date(y, m, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Default event date when adding from history (today if in month, else 1st). */
export function defaultEventDateForMonth(monthYm) {
  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (monthYm === currentYm) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  return `${monthYm}-01`;
}

export function defaultEventTime() {
  return '00:00';
}

export function eventAtToFormFields(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return { eventDate: '', eventTime: defaultEventTime() };
  }
  const eventDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const eventTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { eventDate, eventTime };
}

export function eventFieldsToPayload(eventDate, eventTime) {
  return {
    eventDate: String(eventDate || '').trim(),
    eventTime: String(eventTime || defaultEventTime()).trim() || defaultEventTime(),
  };
}
