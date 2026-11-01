/**
 * In-memory stand-in for the database, used when SUPABASE_URL is empty.
 * It mirrors the functions and rules in supabase/setup.sql so the whole app can be
 * tried with fake data. Nothing is saved between page loads.
 */

import { sessionStart, todaySG } from './logic/dates.js';
import { matchId, oneOffTrainingId, youTubeId } from './logic/ids.js';
import { RSVP_STATUSES, isLocked } from './logic/rsvp.js';
import { validateMatchResult } from './logic/match-result.js';
import { parseSchedule } from './logic/schedule-import.js';
import { DEMO_RESULTS, DEMO_SCHEDULE_ROWS, DEMO_SEASON } from './demo-schedule.js';

const ADMIN_ACTIONS = new Set([
  'addPlayer', 'setPlayerActive', 'setSessionStatus', 'addSession', 'importMatches',
  'addVideo', 'removeVideo', 'setFeedbackStatus', 'saveMatchResult', 'clearMatchResult',
]);

const TRAINING_REASONS = ['ovs', 'work', 'exams', 'injured', 'family'];

/** Deterministic pseudo-random numbers so the demo looks the same every load. */
function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
}

function addDaysISO(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Fixtures, results and videos are real; players and RSVP reasons are made up
 * (js/demo-schedule.js). The schedule goes through the same parser admins use.
 * Trainings and their RSVPs are generated.
 */
function seed() {
  const random = seededRandom(42);
  const today = todaySG();
  const now = new Date();
  const schedule = parseSchedule(DEMO_SCHEDULE_ROWS, DEMO_SEASON);
  const db = {
    settings: { trainingLockHours: 2, matchLockHours: 12, venue: '' },
    players: schedule.players.map((name) => ({ name, active: true })),
    sessions: [], rsvps: [], videos: [], feedback: [], results: [], playerStats: [],
  };

  for (const m of schedule.matches) {
    const id = matchId(m.date, m.opponent);
    db.sessions.push({ id, type: 'Match', date: m.date, start: m.start, end: '', opponent: m.opponent, status: 'Active', note: m.note });
    for (const [player, answer] of Object.entries(m.rsvps)) db.rsvps.push({ sessionId: id, player, ...answer });
  }

  for (let offset = -35; offset <= 21; offset++) {
    const date = addDaysISO(today, offset);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (weekday === 2) db.sessions.push({ id: `T-${date.replace(/-/g, '')}-1845`, type: 'Training', date, start: '18:45', end: '21:30', opponent: '', status: 'Active', note: '' });
    if (weekday === 6) db.sessions.push({ id: `T-${date.replace(/-/g, '')}-0845`, type: 'Training', date, start: '08:45', end: '11:30', opponent: '', status: 'Active', note: '' });
  }
  db.sessions.sort((a, b) => sessionStart(a) - sessionStart(b));

  for (const session of db.sessions.filter((s) => s.type === 'Training')) {
    for (const { name } of db.players) {
      const roll = random();
      if (roll < 0.15 || (sessionStart(session) > now && roll < 0.4)) continue;
      const status = roll > 0.92 ? 'TBC' : roll > 0.8 ? 'Not going' : 'Going';
      db.rsvps.push({ sessionId: session.id, player: name, status, reason: status === 'Going' ? '' : TRAINING_REASONS[Math.floor(roll * 100) % TRAINING_REASONS.length] });
    }
  }

  for (const r of DEMO_RESULTS) {
    const sessionId = matchId(r.date, r.opponent);
    db.results.push({ sessionId, ourScore: r.ourScore, theirScore: r.theirScore, playerOfMatch: '' });
    db.videos.push({ sessionId, title: 'Full match stream', url: r.video });
  }
  return db;
}

export function createDemoBackend() {
  const db = seed();
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const findSession = (id) => db.sessions.find((s) => s.id === id);
  const sortSessions = () => db.sessions.sort((a, b) => sessionStart(a) - sessionStart(b));
  const rosterHas = (name) => db.players.some((p) => p.name.toLowerCase() === name.toLowerCase());

  const actions = {
    adminSignIn() {
      return { token: 'demo' };
    },
    adminSignOut() {},
    bootstrap(body, isAdmin) {
      const out = {
        admin: isAdmin,
        now: new Date().toISOString(),
        settings: db.settings,
        players: db.players.filter((p) => isAdmin || p.active),
        sessions: db.sessions, rsvps: db.rsvps, videos: db.videos, results: db.results, playerStats: db.playerStats,
      };
      if (isAdmin) out.feedback = db.feedback;
      return out;
    },
    rsvp({ sessionId, player, status, reason }) {
      if (!RSVP_STATUSES.includes(status)) throw new Error('Status must be Going, Not going or TBC');
      const session = findSession(sessionId);
      if (!session) throw new Error('Session not found');
      if (session.status === 'Cancelled') throw new Error('This session is cancelled');
      const current = db.rsvps.find((r) => r.sessionId === sessionId && r.player === player);
      if (isLocked(session, current?.status, db.settings, new Date())) throw new Error('RSVP is locked. Please message the coach to change it.');
      if (current) Object.assign(current, { status, reason: reason || '' });
      else db.rsvps.push({ sessionId, player, status, reason: reason || '' });
    },
    feedback({ message, sessionId, anonymous, name }) {
      if (!message?.trim()) throw new Error('Feedback is empty');
      db.feedback.push({ id: String(Date.now()), timestamp: new Date().toISOString(), name: anonymous ? 'Anonymous' : name, sessionId: sessionId || '', message, status: 'New' });
    },
    addPlayer({ name }) {
      if (rosterHas(name)) throw new Error(`${name} is already on the list`);
      db.players.push({ name, active: true });
    },
    setPlayerActive({ name, active }) {
      db.players.find((p) => p.name === name).active = Boolean(active);
    },
    setSessionStatus({ id, status }) {
      findSession(id).status = status === 'Cancelled' ? 'Cancelled' : 'Active';
    },
    addSession({ type, date, start, end, opponent }) {
      const id = type === 'Match' ? matchId(date, opponent) : oneOffTrainingId(date, start);
      if (findSession(id)) throw new Error('That session already exists');
      db.sessions.push({ id, type, date, start, end: end || '', opponent: opponent || '', status: 'Active', note: '' });
      sortSessions();
      return { id };
    },
    importMatches({ matches, importRsvps }) {
      const summary = { added: 0, updated: 0, playersAdded: 0, rsvpsAdded: 0 };
      for (const m of matches) {
        const id = matchId(m.date, m.opponent);
        const existing = findSession(id);
        if (existing) {
          existing.start = m.start;
          summary.updated++;
        } else {
          db.sessions.push({ id, type: 'Match', date: m.date, start: m.start, end: '', opponent: m.opponent, status: 'Active', note: m.note || '' });
          summary.added++;
        }
        if (!importRsvps) continue;
        for (const [name, answer] of Object.entries(m.rsvps)) {
          if (!rosterHas(name)) {
            db.players.push({ name, active: true });
            summary.playersAdded++;
          }
          if (db.rsvps.some((r) => r.sessionId === id && r.player === name)) continue;
          db.rsvps.push({ sessionId: id, player: name, ...answer });
          summary.rsvpsAdded++;
        }
      }
      sortSessions();
      return summary;
    },
    addVideo({ sessionId, title, url }) {
      const id = youTubeId(url);
      if (!id) throw new Error('Please paste a YouTube link');
      db.videos.push({ sessionId, title: title || 'Video', url: `https://www.youtube.com/watch?v=${id}` });
    },
    removeVideo({ sessionId, url }) {
      db.videos = db.videos.filter((v) => !(v.sessionId === sessionId && v.url === url));
    },
    setFeedbackStatus({ id, status }) {
      db.feedback.find((f) => f.id === id).status = status;
    },
    saveMatchResult({ sessionId, ourScore, theirScore, playerOfMatch, players }) {
      const match = findSession(sessionId);
      if (!match || match.type !== 'Match') throw new Error('Match not found');
      if (sessionStart(match) > new Date()) throw new Error("This match hasn't started yet");
      const result = { ourScore, theirScore, playerOfMatch: playerOfMatch || '', players };
      const errors = validateMatchResult(result, db.players.map((p) => p.name));
      if (errors.length) throw new Error(errors.join(' '));
      db.results = db.results.filter((r) => r.sessionId !== sessionId).concat({ sessionId, ourScore, theirScore, playerOfMatch: result.playerOfMatch });
      db.playerStats = db.playerStats.filter((l) => l.sessionId !== sessionId)
        .concat(players.map((l) => ({ sessionId, player: l.player, goals: l.goals, assists: l.assists })));
    },
    clearMatchResult({ sessionId }) {
      db.results = db.results.filter((r) => r.sessionId !== sessionId);
      db.playerStats = db.playerStats.filter((l) => l.sessionId !== sessionId);
    },
  };

  return {
    /** `isAdmin` comes from the demo sign-in (any PIN). */
    handle(body, { isAdmin }) {
      if (ADMIN_ACTIONS.has(body.action) && !isAdmin) throw new Error('Admins only. Sign in with the admin PIN first.');
      const action = actions[body.action];
      if (!action) throw new Error(`Unknown action: ${body.action}`);
      return clone({ ok: true, ...(action(body, isAdmin) || { saved: true }) });
    },
  };
}
