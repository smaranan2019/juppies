/**
 * Reads the team's existing Excel schedule, which is laid out sideways:
 *
 *   Date     | 13 September | 19 September | ...
 *   Day      | SUNDAY       | SATURDAY     | ...
 *   Time     | 11:30 AM     | 9:45 AM      | ...
 *   VS       | NUS Titans   | Merlions     | ...
 *   <player> | Yes          | No (ovs)     | ...
 *
 * Input is the sheet as a 2D array (rows of cells), as produced by SheetJS.
 */

import { normTime, pad2, yearFor } from './dates.js';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const EXCEL_EPOCH_OFFSET_DAYS = 25569; // days between 1900-01-00 (Excel) and 1970-01-01 (Unix)
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const ROW_LABELS = {
  date: ['date', 'dates'],
  day: ['day'],
  time: ['time', 'times'],
  vs: ['vs', 'versus', 'opponent', 'against'],
};

const twoDigitYear = (y) => (y < 100 ? 2000 + y : y);
const monthFromName = (name) => MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;

/** Parses a date cell into { date: 'yyyy-mm-dd', note } or null. Text in brackets becomes the note. */
export function parseDateCell(value, seasonStartYear) {
  if (value === null || value === undefined || value === '') return null;
  let year;
  let month;
  let day;
  let note = '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // Excel dates can land a few seconds before midnight, so nudge to midday first.
    const midday = new Date(value.getTime() + 12 * 60 * 60 * 1000);
    month = midday.getMonth() + 1;
    day = midday.getDate();
    year = midday.getFullYear() > 1950 ? midday.getFullYear() : yearFor(month, seasonStartYear);
  } else if (typeof value === 'number') {
    const date = new Date(Math.round((value - EXCEL_EPOCH_OFFSET_DAYS) * MS_PER_DAY));
    year = date.getUTCFullYear();
    month = date.getUTCMonth() + 1;
    day = date.getUTCDate();
  } else {
    let text = String(value);
    const bracketed = text.match(/\(([^)]*)\)/);
    if (bracketed) note = bracketed[1].trim();
    text = text.replace(/\([^)]*\)/g, ' ').trim();

    let m;
    if ((m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) {
      [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
    } else if ((m = text.match(/^(\d{1,2})\s*[-\s/]?\s*([A-Za-z]{3,})\.?(?:[\s,/-]+(\d{2,4}))?/))) {
      day = Number(m[1]);
      month = monthFromName(m[2]);
      year = m[3] ? twoDigitYear(Number(m[3])) : null;
    } else if ((m = text.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2})(?:[\s,]+(\d{4}))?/))) {
      month = monthFromName(m[1]);
      day = Number(m[2]);
      year = m[3] ? Number(m[3]) : null;
    } else if ((m = text.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/))) {
      day = Number(m[1]);
      month = Number(m[2]);
      year = m[3] ? twoDigitYear(Number(m[3])) : null;
    }
    if (!month) return null;
    if (!year) year = yearFor(month, seasonStartYear);
  }

  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return null;
  return { date: `${year}-${pad2(month)}-${pad2(day)}`, note };
}

/** "No (ovs)" -> { status: 'Not going', reason: 'ovs' }. Blank or unreadable -> null. */
export function parseRsvpCell(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const m = text.match(/^(yes|no|tbc|maybe|y|n)\b\.?\s*(?:\(([^)]*)\)?)?\s*(.*)$/i);
  if (!m) return null;
  const word = m[1].toLowerCase();
  const status = word === 'yes' || word === 'y' ? 'Going' : word === 'no' || word === 'n' ? 'Not going' : 'TBC';
  const reason = [m[2], m[3]].filter((part) => part && part.trim()).join(' ').trim();
  return { status, reason };
}

/** Finds which row holds which label (Date, Time, VS...) in the first column. */
function findLabelRows(rows) {
  const labelRow = {};
  let lastLabelRow = -1;
  rows.forEach((row, index) => {
    const key = String((row || [])[0] ?? '').trim().toLowerCase().replace(/[^a-z]/g, '');
    const label = Object.keys(ROW_LABELS).find((name) => ROW_LABELS[name].includes(key));
    if (!label) return;
    labelRow[label] = index;
    lastLabelRow = Math.max(lastLabelRow, index);
  });
  return { labelRow, lastLabelRow };
}

/**
 * Returns { matches, players, warnings } or { error }.
 * Each match: { col, date, note, start, opponent, rsvps: { [name]: { status, reason } } }.
 */
export function parseSchedule(rows, seasonStartYear) {
  const { labelRow, lastLabelRow } = findLabelRows(rows);
  if (labelRow.date === undefined) return { error: 'Could not find a row labelled "Date" in the first column.' };

  const cell = (label, col) => (labelRow[label] === undefined ? '' : (rows[labelRow[label]] || [])[col]);
  const warnings = [];
  const matches = [];
  const dateRow = rows[labelRow.date] || [];

  for (let col = 1; col < dateRow.length; col++) {
    const raw = dateRow[col];
    if (raw === '' || raw === null || raw === undefined) continue;
    const parsed = parseDateCell(raw, seasonStartYear);
    if (!parsed) {
      warnings.push(`Column ${col + 1}: could not read date "${raw}"`);
      continue;
    }
    const rawTime = cell('time', col);
    const start = normTime(rawTime);
    if (!start && rawTime) warnings.push(`Column ${col + 1}: could not read time "${rawTime}"`);
    matches.push({ col, date: parsed.date, note: parsed.note, start, opponent: String(cell('vs', col) ?? '').trim(), rsvps: {} });
  }

  const players = [];
  for (let r = lastLabelRow + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const name = String(row[0] ?? '').trim();
    if (!name) continue;
    players.push(name);
    for (const match of matches) {
      const raw = row[match.col];
      const parsed = parseRsvpCell(raw);
      if (parsed) match.rsvps[name] = parsed;
      else if (String(raw ?? '').trim()) warnings.push(`${name} / ${match.date}: could not read "${raw}"`);
    }
  }
  return { matches, players, warnings };
}
