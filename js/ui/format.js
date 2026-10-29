/** Display formatting. Pure functions: data in, text out. */

import { daysFromToday } from '../logic/dates.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-09-13' -> 'Sun 13 Sep' */
export function formatDate(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** '18:45' -> '6:45 PM' */
export function formatTime(time) {
  if (!time) return '';
  const hours = Number(time.slice(0, 2));
  return `${((hours + 11) % 12) + 1}:${time.slice(3)} ${hours < 12 ? 'AM' : 'PM'}`;
}

export function formatWhen(session) {
  const range = session.end ? `${formatTime(session.start)} – ${formatTime(session.end)}` : formatTime(session.start);
  return `${formatDate(session.date)} · ${range}`;
}

export function formatTimestamp(iso) {
  return new Date(iso).toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short' });
}

/** 'Today', 'Tomorrow', 'In 3 days', 'Yesterday' or '' when further away. */
export function relativeDay(isoDate, now = new Date()) {
  const days = daysFromToday(isoDate, now);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1 && days < 7) return `In ${days} days`;
  return '';
}

export const sessionTitle = (session) => (session.type === 'Match' ? `vs ${session.opponent || 'TBA'}` : 'Training');

export const percent = (part, whole) => (whole ? Math.round((100 * part) / whole) : 0);

/** Hint under our score in the result form. */
export const unassignedHint = (count) =>
  (count > 0
    ? `Includes ${count} goal${count > 1 ? 's' : ''} without a scorer (e.g. own goals).`
    : 'Adds up automatically from player goals.');
