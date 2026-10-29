/**
 * Excel import/export for admins. Uses SheetJS, loaded as the global `XLSX`
 * from a CDN script tag in index.html.
 */

import { todaySG } from '../logic/dates.js';
import { parseSchedule } from '../logic/schedule-import.js';
import { leaderboard, seasonResults } from '../logic/stats.js';
import { formatTime } from '../ui/format.js';

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const RSVP_WORD = { Going: 'Yes', 'Not going': 'No', TBC: 'TBC' };

function requireSheetJs() {
  if (!window.XLSX) throw new Error('Excel tools are still loading. Try again in a second.');
  return window.XLSX;
}

/** Reads an uploaded schedule and returns the first sheet that parses into matches. */
export async function readScheduleFile(file, seasonStartYear) {
  const XLSX = requireSheetJs();
  const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: true });
  let fallback = null;
  for (const name of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: '' });
    const parsed = parseSchedule(rows, seasonStartYear);
    if (!parsed.error && parsed.matches.length) return parsed;
    fallback ??= parsed;
  }
  return fallback ?? { error: 'The file looks empty.' };
}

/** RSVPs in the team's sideways layout: one column per session, one row per player. */
function attendanceSheet(data, type) {
  const sessions = data.sessions.filter((s) => s.type === type);
  const answers = new Map(data.rsvps.map((r) => [`${r.sessionId}|${r.player}`, r]));
  const dateOf = (s) => new Date(`${s.date}T00:00:00Z`);
  const rows = [
    ['Date', ...sessions.map((s) => {
      const d = dateOf(s);
      return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}${s.status === 'Cancelled' ? ' (CANCELLED)' : ''}`;
    })],
    ['Day', ...sessions.map((s) => DAY_NAMES[dateOf(s).getUTCDay()])],
    ['Time', ...sessions.map((s) => formatTime(s.start))],
  ];
  if (type === 'Match') rows.push(['VS', ...sessions.map((s) => s.opponent)]);
  for (const { name } of data.players.filter((p) => p.active)) {
    rows.push([name, ...sessions.map((s) => {
      const r = answers.get(`${s.id}|${name}`);
      return r ? RSVP_WORD[r.status] + (r.reason ? ` (${r.reason})` : '') : '';
    })]);
  }
  return rows;
}

export function exportWorkbook(data) {
  const XLSX = requireSheetJs();
  const workbook = XLSX.utils.book_new();
  const addSheet = (rows, name, firstColWidth = 16) => {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = [{ wch: firstColWidth }, ...rows[0].slice(1).map(() => ({ wch: 14 }))];
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  };

  addSheet(attendanceSheet(data, 'Match'), 'Matches');
  addSheet(attendanceSheet(data, 'Training'), 'Training');
  addSheet([
    ['Date', 'Opponent', 'Us', 'Them', 'Player of the match'],
    ...seasonResults(data, null).map(({ match, result }) => [match.date, match.opponent, result.ourScore, result.theirScore, result.playerOfMatch]),
  ], 'Results', 12);
  addSheet([
    ['Player', 'Apps', 'Goals', 'Assists', 'Points', 'Player of the match'],
    ...leaderboard(data, null).map((r) => [r.name, r.apps, r.goals, r.assists, r.points, r.playerOfMatch]),
  ], 'Player stats (all time)');

  XLSX.writeFile(workbook, `juppies-${todaySG()}.xlsx`);
}
