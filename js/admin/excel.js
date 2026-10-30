/**
 * Excel import/export for admins. SheetJS (~950 KB) is only downloaded the
 * first time an admin imports or exports, not on every visit.
 */

import { todaySG } from '../logic/dates.js';
import { parseSchedule } from '../logic/schedule-import.js';
import { leaderboard, seasonResults } from '../logic/stats.js';
import { formatTime } from '../ui/format.js';

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const RSVP_WORD = { Going: 'Yes', 'Not going': 'No', TBC: 'TBC' };

/*
 * 0.20.3 from SheetJS's own CDN (the npm/cdnjs builds stop at 0.18.5, which has
 * known vulnerabilities). The integrity hash pins the exact file; index.html's
 * Content Security Policy allows this host.
 */
const SHEETJS_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
const SHEETJS_INTEGRITY = 'sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT';

let sheetJsLoading = null;

/** Resolves with the global `XLSX`, adding its script tag on first use. */
function loadSheetJs() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  sheetJsLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SHEETJS_URL;
    script.integrity = SHEETJS_INTEGRITY;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => {
      sheetJsLoading = null; // allow a retry
      script.remove();
      reject(new Error("Couldn't load the Excel tools. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return sheetJsLoading;
}

/** Reads an uploaded schedule and returns the first sheet that parses into matches. */
export async function readScheduleFile(file, seasonStartYear) {
  const XLSX = await loadSheetJs();
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

export async function exportWorkbook(data) {
  const XLSX = await loadSheetJs();
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
