import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attendanceStats, availableSeasons, leaderboard, teamRecord } from '../js/logic/stats.js';
import { isLocked } from '../js/logic/rsvp.js';

const match = (id, date, status = 'Active') => ({ id, type: 'Match', date, start: '10:00', end: '', opponent: id, status });
const data = {
  players: [{ name: 'Alex', active: true }, { name: 'Bea', active: true }, { name: 'Old', active: false }],
  sessions: [
    match('m1', '2026-09-01'),
    match('m2', '2026-09-08'),
    match('m3', '2026-09-15', 'Cancelled'),
    match('m0', '2025-09-01'),
    { id: 't1', type: 'Training', date: '2026-09-02', start: '18:45', end: '21:30', status: 'Active' },
  ],
  rsvps: [
    { sessionId: 'm1', player: 'Bea', status: 'Going' },     // ignored: m1 has a lineup
    { sessionId: 'm2', player: 'Bea', status: 'Going' },     // counts: m2 has no result
    { sessionId: 't1', player: 'Alex', status: 'Going' },
  ],
  results: [
    { sessionId: 'm1', ourScore: 4, theirScore: 2, playerOfMatch: 'Alex' },
    { sessionId: 'm3', ourScore: 9, theirScore: 0, playerOfMatch: 'Bea' },  // cancelled: ignored
    { sessionId: 'm0', ourScore: 0, theirScore: 1, playerOfMatch: '' },
  ],
  playerStats: [
    { sessionId: 'm1', player: 'Alex', goals: 3, assists: 0 },
    { sessionId: 'm1', player: 'Old', goals: 1, assists: 1 },
    { sessionId: 'm3', player: 'Bea', goals: 9, assists: 0 },
  ],
};
const now = new Date('2026-10-01T00:00:00Z');

test('teamRecord counts one season and skips cancelled matches', () => {
  assert.deepEqual(teamRecord(data, 2026), { played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 4, goalsAgainst: 2 });
  assert.equal(teamRecord(data, null).played, 2);
});

test('leaderboard ranks by points and includes inactive players who played', () => {
  assert.deepEqual(leaderboard(data, 2026), [
    { name: 'Alex', apps: 1, goals: 3, assists: 0, points: 3, playerOfMatch: 1 },
    { name: 'Old', apps: 1, goals: 1, assists: 1, points: 2, playerOfMatch: 0 },
  ]);
});

test('attendance prefers the recorded lineup over RSVPs', () => {
  const [alex, bea] = attendanceStats(data, now, 2026);
  assert.deepEqual(alex.match, { attended: 1, total: 2 });
  assert.deepEqual(alex.training, { attended: 1, total: 1 });
  assert.deepEqual(bea.match, { attended: 1, total: 2 });
});

test('a result without a lineup falls back to RSVPs for attendance', () => {
  const noLineup = { ...data, playerStats: [] };
  const [alex, bea] = attendanceStats(noLineup, now, 2026);
  assert.deepEqual(alex.match, { attended: 0, total: 2 });
  assert.deepEqual(bea.match, { attended: 2, total: 2 });
});

test('availableSeasons is newest first', () => {
  assert.deepEqual(availableSeasons(data.sessions), [2026, 2025]);
});

test('firm RSVPs lock at the cutoff, TBC stays open', () => {
  const settings = { matchLockHours: 12, trainingLockHours: 2 };
  const session = match('m9', '2026-10-10');
  const before = new Date('2026-10-09T13:00:00Z');
  const after = new Date('2026-10-09T15:00:00Z');
  assert.equal(isLocked(session, 'Going', settings, before), false);
  assert.equal(isLocked(session, 'Going', settings, after), true);
  assert.equal(isLocked(session, 'TBC', settings, after), false);
});
