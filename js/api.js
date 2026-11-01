/**
 * Talks to the database. Every app action maps to one Postgres function in
 * supabase/setup.sql (called over Supabase's REST API), or to the in-memory
 * demo backend when no Supabase project is configured.
 *
 * callApi resolves with the response object, or rejects with an Error whose
 * message is safe to show to the user.
 */

import { isDemo, supabaseClient } from './supabase-client.js';
import { storage } from './storage.js';
import { createDemoBackend } from './demo-backend.js';

/**
 * action -> (payload) => [database function, its named parameters].
 * tests/database.test.js checks each of these against the real SQL.
 */
export const RPC_CALLS = {
  bootstrap: () => ['bootstrap', {}],
  adminSignIn: (p) => ['admin_sign_in', { p_pin: p.pin }],
  adminSignOut: () => ['admin_sign_out', {}],
  rsvp: (p) => ['submit_rsvp', { p_session_id: p.sessionId, p_player: p.player, p_status: p.status, p_reason: p.reason ?? '' }],
  feedback: (p) => ['submit_feedback', { p_message: p.message, p_session_id: p.sessionId ?? '', p_name: p.anonymous ? '' : p.name ?? '' }],
  addPlayer: (p) => ['add_player', { p_name: p.name }],
  setPlayerActive: (p) => ['set_player_active', { p_name: p.name, p_active: p.active }],
  setSessionStatus: (p) => ['set_session_status', { p_id: p.id, p_status: p.status }],
  addSession: (p) => ['add_session', {
    p_type: p.type, p_date: p.date, p_start: p.start, p_end: p.end ?? '', p_opponent: p.opponent ?? '', p_note: p.note ?? '',
  }],
  importMatches: (p) => ['import_matches', { p_matches: p.matches, p_import_rsvps: Boolean(p.importRsvps) }],
  addVideo: (p) => ['add_video', { p_session_id: p.sessionId, p_title: p.title, p_url: p.url }],
  removeVideo: (p) => ['remove_video', { p_session_id: p.sessionId, p_url: p.url }],
  setFeedbackStatus: (p) => ['set_feedback_status', { p_id: p.id, p_status: p.status }],
  saveMatchResult: (p) => ['save_match_result', {
    p_session_id: p.sessionId, p_our_score: p.ourScore, p_their_score: p.theirScore,
    p_player_of_match: p.playerOfMatch, p_players: p.players,
  }],
  clearMatchResult: (p) => ['clear_match_result', { p_session_id: p.sessionId }],
};

const demoBackend = isDemo ? createDemoBackend() : null;
const DEMO_LATENCY_MS = 150;
/** Give up on a request after this long, so a bad connection can't leave the app spinning forever. */
const REQUEST_TIMEOUT_MS = 20_000;

/** Turns database and network errors into something a player can act on. */
function friendlyMessage(error) {
  if (/permission denied for function/i.test(error.message)) return 'Admins only. Sign in with the admin PIN first.';
  if (/abort|timed? ?out/i.test(error.message)) return 'The server took too long to answer. Check your connection and try again.';
  if (/failed to fetch|network/i.test(error.message)) return "Couldn't reach the server. Check your connection and try again.";
  return error.message || 'Something went wrong';
}

export async function callApi(action, payload = {}) {
  const toRpc = RPC_CALLS[action];
  if (!toRpc) throw new Error(`Unknown action: ${action}`);

  if (demoBackend) {
    await new Promise((resolve) => setTimeout(resolve, DEMO_LATENCY_MS));
    return demoBackend.handle({ action, ...payload }, { isAdmin: Boolean(storage.get('admin_token')) });
  }

  const [fn, params] = toRpc(payload);
  const request = supabaseClient().rpc(fn, params).abortSignal(AbortSignal.timeout(REQUEST_TIMEOUT_MS));
  const adminToken = storage.get('admin_token');
  if (adminToken) request.setHeader('x-admin-token', adminToken);
  const { data, error } = await request;
  if (error) throw new Error(friendlyMessage(error));
  return data !== null && typeof data === 'object' ? data : { value: data };
}

export { isDemo };
