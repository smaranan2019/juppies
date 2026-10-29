/**
 * Read-only queries over the data returned by the backend's bootstrap call:
 *   { players, sessions, rsvps, videos, results, playerStats, settings, feedback? }
 * Sessions arrive sorted by start time.
 */

import { sessionEnd } from './dates.js';

export const sessionById = (data, id) => data.sessions.find((s) => s.id === id);
export const activePlayers = (data) => data.players.filter((p) => p.active);
export const rsvpsFor = (data, sessionId) => data.rsvps.filter((r) => r.sessionId === sessionId);
export const rsvpOf = (data, sessionId, player) => data.rsvps.find((r) => r.sessionId === sessionId && r.player === player);
export const videosFor = (data, sessionId) => data.videos.filter((v) => v.sessionId === sessionId);
export const resultFor = (data, sessionId) => data.results.find((r) => r.sessionId === sessionId);
export const statLinesFor = (data, sessionId) => data.playerStats.filter((s) => s.sessionId === sessionId);

const isActiveSession = (s) => s.status !== 'Cancelled';

/** Sessions of a type that haven't finished yet, soonest first. */
export const upcomingSessions = (data, type, now) =>
  data.sessions.filter((s) => s.type === type && sessionEnd(s) > now);

/** Sessions of a type that have finished, most recent first. */
export const pastSessions = (data, type, now) =>
  data.sessions.filter((s) => s.type === type && sessionEnd(s) <= now).reverse();

export const nextSession = (data, type, now) => upcomingSessions(data, type, now).find(isActiveSession);

/** Counts answers from active players. Everyone else on the roster is "none". */
export function rsvpCounts(data, sessionId) {
  const statusByPlayer = new Map(rsvpsFor(data, sessionId).map((r) => [r.player, r.status]));
  const counts = { Going: 0, 'Not going': 0, TBC: 0, none: 0 };
  for (const player of activePlayers(data)) counts[statusByPlayer.get(player.name) ?? 'none']++;
  return counts;
}

/** Active players grouped by their answer, each group sorted by name. */
export function rsvpGroups(data, sessionId) {
  const byPlayer = new Map(rsvpsFor(data, sessionId).map((r) => [r.player, r]));
  const groups = { Going: [], TBC: [], 'Not going': [], none: [] };
  for (const { name } of activePlayers(data)) {
    const rsvp = byPlayer.get(name);
    groups[rsvp ? rsvp.status : 'none'].push({ name, reason: rsvp ? rsvp.reason : '' });
  }
  Object.values(groups).forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
  return groups;
}

/** Upcoming, non-cancelled sessions the player hasn't answered yet, soonest first. */
export function unansweredSessions(data, player, now) {
  return data.sessions.filter((s) => isActiveSession(s) && sessionEnd(s) > now && !rsvpOf(data, s.id, player));
}

/** Matches that have finished but don't have a result yet, most recent first (for admins). */
export const matchesAwaitingResult = (data, now) =>
  pastSessions(data, 'Match', now).filter((s) => isActiveSession(s) && !resultFor(data, s.id));

/** The most recent match with a result, or undefined. */
export const latestResultMatch = (data, now) =>
  pastSessions(data, 'Match', now).find((s) => isActiveSession(s) && resultFor(data, s.id));
