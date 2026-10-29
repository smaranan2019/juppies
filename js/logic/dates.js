/**
 * Date and time helpers.
 *
 * Every session happens in Singapore (UTC+8, no daylight saving), so a fixed
 * offset is enough and we never depend on the viewer's own time zone.
 * Dates travel as 'yyyy-mm-dd' strings and times as 'HH:MM' strings.
 */

const SG_OFFSET = '+08:00';
const SG_OFFSET_MS = 8 * 60 * 60 * 1000;
const DEFAULT_SESSION_HOURS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const pad2 = (n) => String(n).padStart(2, '0');

/** "6:45 PM" | "18:45" | 0.78125 (Excel day fraction) | Date  ->  "18:45" ('' if unreadable). */
export function normTime(value) {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) {
    // Excel times can be a few seconds off, so round to the nearest minute.
    const mins = Math.round(value.getHours() * 60 + value.getMinutes() + value.getSeconds() / 60) % 1440;
    return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
  }
  if (typeof value === 'number') {
    const mins = Math.round((value % 1) * 24 * 60);
    return `${pad2(Math.floor(mins / 60) % 24)}:${pad2(mins % 60)}`;
  }
  const match = String(value).trim().toUpperCase().match(/^(\d{1,2})[:.]?(\d{2})?\s*(AM|PM)?$/);
  if (!match) return '';
  let hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  if (match[3] === 'PM' && hours < 12) hours += 12;
  if (match[3] === 'AM' && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return '';
  return `${pad2(hours)}:${pad2(minutes)}`;
}

/**
 * A season runs July to June and is named by the year it starts in.
 * yearFor(9, 2026) -> 2026 (September), yearFor(2, 2026) -> 2027 (February).
 */
export const yearFor = (month, seasonStartYear) => (month >= 7 ? seasonStartYear : seasonStartYear + 1);

/** '2027-02-14' -> 2026 */
export function seasonOf(isoDate) {
  const [year, month] = isoDate.split('-').map(Number);
  return month >= 7 ? year : year - 1;
}

/** 2026 -> '2026/27' */
export const seasonLabel = (startYear) => `${startYear}/${String(startYear + 1).slice(-2)}`;

export const sessionStart = (session) => new Date(`${session.date}T${session.start || '00:00'}:00${SG_OFFSET}`);

export function sessionEnd(session) {
  if (session.end) return new Date(`${session.date}T${session.end}:00${SG_OFFSET}`);
  return new Date(sessionStart(session).getTime() + DEFAULT_SESSION_HOURS * 60 * 60 * 1000);
}

/** Today's date in Singapore as 'yyyy-mm-dd'. */
export const todaySG = (now = new Date()) => new Date(now.getTime() + SG_OFFSET_MS).toISOString().slice(0, 10);

/** The Singapore wall-clock time of an instant as 'HH:MM'. */
export const clockSG = (instant) => new Date(instant.getTime() + SG_OFFSET_MS).toISOString().slice(11, 16);

/** Whole days from today (Singapore) to the given date. Negative for the past. */
export function daysFromToday(isoDate, now = new Date()) {
  return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${todaySG(now)}T00:00:00Z`)) / MS_PER_DAY);
}
