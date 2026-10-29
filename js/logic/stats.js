/**
 * Season statistics shown on the public Stats page.
 * `season` is the start year of a July–June season, or null for all time.
 */

import { seasonOf, sessionStart } from './dates.js';
import { outcome } from './match-result.js';

const key = (sessionId, player) => `${sessionId}|${player}`;
const inSeason = (season) => (session) => season === null || seasonOf(session.date) === season;
const isCounted = (session) => session.status !== 'Cancelled';

/** Seasons that have any sessions, newest first. */
export function availableSeasons(sessions) {
  return [...new Set(sessions.map((s) => seasonOf(s.date)))].sort((a, b) => b - a);
}

/** Results joined with their match, limited to the season, newest first. */
export function seasonResults(data, season) {
  const matchesById = new Map(data.sessions.map((s) => [s.id, s]));
  return data.results
    .map((result) => ({ result, match: matchesById.get(result.sessionId) }))
    .filter(({ match }) => match && isCounted(match) && inSeason(season)(match))
    .sort((a, b) => sessionStart(b.match) - sessionStart(a.match));
}

/** Win/draw/loss record and goal totals. */
export function teamRecord(data, season) {
  const record = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
  for (const { result } of seasonResults(data, season)) {
    record.played++;
    record.goalsFor += result.ourScore;
    record.goalsAgainst += result.theirScore;
    const o = outcome(result);
    if (o === 'W') record.won++;
    else if (o === 'L') record.lost++;
    else record.drawn++;
  }
  return record;
}

/**
 * One row per player who played at least once:
 * { name, apps, goals, assists, points, playerOfMatch }, best first.
 */
export function leaderboard(data, season) {
  const results = seasonResults(data, season);
  const counted = new Set(results.map(({ result }) => result.sessionId));
  const rows = new Map();
  const rowFor = (name) => {
    if (!rows.has(name)) rows.set(name, { name, apps: 0, goals: 0, assists: 0, points: 0, playerOfMatch: 0 });
    return rows.get(name);
  };

  for (const line of data.playerStats) {
    if (!counted.has(line.sessionId)) continue;
    const row = rowFor(line.player);
    row.apps++;
    row.goals += line.goals;
    row.assists += line.assists;
    row.points += line.goals + line.assists;
  }
  for (const { result } of results) {
    if (result.playerOfMatch) rowFor(result.playerOfMatch).playerOfMatch++;
  }

  return [...rows.values()].sort(
    (a, b) => b.points - a.points || b.goals - a.goals || b.playerOfMatch - a.playerOfMatch || a.name.localeCompare(b.name),
  );
}

/**
 * Attendance per active player over past, non-cancelled sessions:
 * { name, training: { attended, total }, match: { attended, total } }.
 *
 * A match with a recorded lineup uses who actually played; anything else
 * (including a result entered without a lineup) falls back to who RSVP'd Going.
 */
export function attendanceStats(data, now, season) {
  const past = data.sessions.filter((s) => isCounted(s) && sessionStart(s) < now && inSeason(season)(s));
  const going = new Set(data.rsvps.filter((r) => r.status === 'Going').map((r) => key(r.sessionId, r.player)));
  const played = new Set(data.playerStats.map((line) => key(line.sessionId, line.player)));
  const hasLineup = new Set(data.playerStats.map((line) => line.sessionId));
  const attended = (session, name) =>
    (hasLineup.has(session.id) ? played : going).has(key(session.id, name));

  return data.players
    .filter((p) => p.active)
    .map(({ name }) => {
      const row = { name, training: { attended: 0, total: 0 }, match: { attended: 0, total: 0 } };
      for (const session of past) {
        const bucket = session.type === 'Match' ? row.match : row.training;
        bucket.total++;
        if (attended(session, name)) bucket.attended++;
      }
      return row;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
