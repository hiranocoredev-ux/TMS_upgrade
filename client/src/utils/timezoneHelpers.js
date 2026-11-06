/**
 * Timezone Helper Functions
 * All times are stored and displayed in EST (Eastern Standard Time)
 * EST is UTC-5 (or UTC-4 during EDT - Eastern Daylight Time)
 */

import { monthKeyOfDateKey, monthStartDateKey, monthEndDateKey } from './businessMonth';

export const EST_TIMEZONE = 'America/New_York';

// en-CA renders as YYYY-MM-DD, and the timeZone option makes the formatter
// resolve "now" against EST/EDT (DST handled by the platform) rather than the
// browser's local zone or UTC.
const EST_DATE_KEY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: EST_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

/** Current (or given instant's) EST calendar date as `YYYY-MM-DD`. */
export function getESTDateKey(value = new Date()) {
  return EST_DATE_KEY_FORMATTER.format(new Date(value));
}

/**
 * The month an instant belongs to, as `YYYY-MM`.
 *
 * A month here runs from the 6th to the 5th of the next month, so 3 Oct still
 * belongs to September. See utils/businessMonth for the rule itself.
 */
export function getESTMonthKey(value = new Date()) {
  return monthKeyOfDateKey(getESTDateKey(value));
}

/** First day of that month (the 6th), as `YYYY-MM-DD`. */
export function getESTMonthStartKey(value = new Date()) {
  return monthStartDateKey(getESTMonthKey(value));
}

/** Last day of that month (the 5th of the next one), as `YYYY-MM-DD`. */
export function getESTMonthEndKey(value = new Date()) {
  return monthEndDateKey(getESTMonthKey(value));
}

/**
 * Convert EST date/time to UTC for database storage
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @param {string} timeString - Time string in HH:mm format (EST)
 * @returns {Date} - Date object in UTC
 */
export function estToUTC(dateString, timeString) {
  if (!dateString || !timeString) {
    throw new Error('Date and time are required');
  }

  // Parse the date and time components
  const [year, month, day] = dateString.split('-').map(Number);
  const [hours, minutes] = timeString.split(':').map(Number);

  // Create a date object treating the input as EST
  // We'll use a date in EST timezone to determine DST
  const estDate = new Date(year, month - 1, day, hours, minutes);
  
  // Check if DST is in effect for this date
  const isDST = isDaylightSavingTime(estDate);
  const offsetHours = isDST ? 4 : 5; // EDT is UTC-4, EST is UTC-5

  // Create UTC date by adding offset hours
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours + offsetHours, minutes));
  
  return utcDate;
}

/**
 * Convert UTC date to EST for display
 * @param {Date|string} utcDate - Date in UTC
 * @returns {Object} - Object with date and time strings in EST
 */
export function utcToEST(utcDate) {
  if (!utcDate) return null;
  
  const date = new Date(utcDate);
  
  // Get UTC components
  const utcYear = date.getUTCFullYear();
  const utcMonth = date.getUTCMonth();
  const utcDay = date.getUTCDate();
  const utcHours = date.getUTCHours();
  const utcMinutes = date.getUTCMinutes();
  
  // Create a date object in EST to check DST
  // First, create a date assuming EST (subtract 5 hours)
  const tempDate = new Date(Date.UTC(utcYear, utcMonth, utcDay, utcHours - 5, utcMinutes));
  const isDST = isDaylightSavingTime(tempDate);
  const offsetHours = isDST ? 4 : 5;
  
  // Subtract offset to get EST
  const estDate = new Date(date.getTime() - (offsetHours * 60 * 60 * 1000));
  
  const year = estDate.getUTCFullYear();
  const month = String(estDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(estDate.getUTCDate()).padStart(2, '0');
  const hours = String(estDate.getUTCHours()).padStart(2, '0');
  const minutes = String(estDate.getUTCMinutes()).padStart(2, '0');
  
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
    dateTime: new Date(Date.UTC(year, month - 1, day, hours, minutes))
  };
}

/**
 * Format UTC date to EST display string
 * @param {Date|string} utcDate - Date in UTC
 * @param {boolean} includeDate - Whether to include date in output
 * @returns {string} - Formatted string in EST
 */
export function formatESTDateTime(utcDate, includeDate = true) {
  if (!utcDate) return 'N/A';
  
  const est = utcToEST(utcDate);
  if (!est) return 'N/A';
  
  const date = new Date(est.dateTime);
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = String(minutes).padStart(2, '0');
  
  if (includeDate) {
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const year = date.getUTCFullYear();
    return `${month}/${day}/${year} ${displayHours}:${displayMinutes} ${ampm} EST`;
  }
  
  return `${displayHours}:${displayMinutes} ${ampm} EST`;
}

/**
 * Check if a date is in Daylight Saving Time (EDT)
 * DST in US Eastern Time: 2nd Sunday in March to 1st Sunday in November
 * @param {Date} date - Date to check
 * @returns {boolean} - True if DST is in effect
 */
function isDaylightSavingTime(date) {
  const year = date.getFullYear();
  
  // Find 2nd Sunday in March
  const marchDST = getNthSunday(year, 3, 2);
  // Find 1st Sunday in November
  const novemberDST = getNthSunday(year, 11, 1);
  
  // DST starts at 2 AM on 2nd Sunday of March
  const dstStart = new Date(marchDST);
  dstStart.setHours(2, 0, 0, 0);
  
  // DST ends at 2 AM on 1st Sunday of November
  const dstEnd = new Date(novemberDST);
  dstEnd.setHours(2, 0, 0, 0);
  
  return date >= dstStart && date < dstEnd;
}

/**
 * Get the Nth Sunday of a given month
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @param {number} n - Which Sunday (1 = first, 2 = second, etc.)
 * @returns {Date} - Date of the Nth Sunday
 */
function getNthSunday(year, month, n) {
  const firstDay = new Date(year, month - 1, 1);
  const firstSunday = new Date(firstDay);
  firstSunday.setDate(1 + (7 - firstDay.getDay()) % 7);
  
  if (n === 1) return firstSunday;
  
  const nthSunday = new Date(firstSunday);
  nthSunday.setDate(firstSunday.getDate() + (n - 1) * 7);
  
  return nthSunday;
}

/**
 * Get current EST date/time string for input fields
 * @returns {Object} - Object with date and time strings
 */
export function getCurrentEST() {
  const now = new Date();
  const est = utcToEST(now);
  return {
    date: est.date,
    time: est.time
  };
}

