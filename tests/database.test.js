/**
 * Runs supabase/setup.sql in a real Postgres (PGlite) that mimics Supabase:
 * the anon/authenticated roles, request headers, and Supabase's permissive
 * default grants, so these tests prove the "deny by default" rules hold.
 */

import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { matchId, youTubeId } from '../js/logic/ids.js';
import { RPC_CALLS } from '../js/api.js';

const SETUP_SQL = readFileSync(new URL('../supabase/setup.sql', import.meta.url), 'utf8');
const PIN = 'floorball-pin';
const ADMIN = { role: 'anon', token: null }; // the token is filled in by signing in
const STRANGER = { role: 'anon', token: 'made-up-token' };
const ANON = { role: 'anon' };

const SUPABASE_STAND_IN = `
  create role anon nologin;
  create role authenticated nologin;
  create schema extensions;
  grant usage on schema public to anon, authenticated;
  -- Supabase grants everything to the API roles by default; setup.sql must take it back.
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`;

let db;

/** Runs `sql` as an API caller with the given role and admin token, like PostgREST does. */
async function as(caller, sql, params = []) {
  const headers = caller.token ? { 'x-admin-token': caller.token } : {};
  await db.query(`select set_config('request.headers', $1, false)`, [JSON.stringify(headers)]);
  await db.exec(`set role ${caller.role}`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}

const signIn = async (pin) => (await as(ANON, 'select admin_sign_in($1) as result', [pin])).rows[0].result;
const rpcError = (claims, sql, params) => as(claims, sql, params).then(() => null, (error) => error.message);
const bootstrap = async (claims) => (await as(claims, 'select public.bootstrap() as data')).rows[0].data;
const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const daysFromToday = (n) => new Date(Date.now() + 8 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);

before(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STAND_IN);
  await db.exec(SETUP_SQL);
  await db.exec(SETUP_SQL); // re-running after an update must be safe
  await db.exec(`
    insert into players (name) values ('Alex'), ('Bea'), ('Cass');
    insert into players (name, active) values ('Old', false);
  `);
  await db.query('select set_admin_pin($1)', [PIN]);
  ADMIN.token = (await signIn(PIN)).token;
});

test('anon can read public data but not feedback, admins or inactive players', async () => {
  const data = await bootstrap(ANON);
  assert.equal(data.admin, false);
  assert.deepEqual(data.players.map((p) => p.name), ['Alex', 'Bea', 'Cass']);
  assert.equal(data.feedback, undefined);
  assert.ok(data.sessions.some((s) => s.type === 'Training'), 'weekly trainings are generated');
  assert.deepEqual((await as(ANON, 'select * from feedback')).rows, []);
  assert.match(await rpcError(ANON, 'select * from admin_pin'), /permission denied/);
  assert.match(await rpcError(ANON, 'select * from admin_sessions'), /permission denied/);
});

test('admins see everything, including inactive players', async () => {
  const data = await bootstrap(ADMIN);
  assert.equal(data.admin, true);
  assert.ok(data.players.some((p) => p.name === 'Old'));
  assert.deepEqual(data.feedback, []);
});

test('nobody can write to tables directly, only through functions', async () => {
  for (const claims of [ANON, STRANGER, ADMIN]) {
    assert.match(await rpcError(claims, `insert into players (name) values ('Hacker')`), /permission denied/);
    assert.match(await rpcError(claims, `update rsvps set status = 'Going'`), /permission denied/);
    assert.match(await rpcError(claims, 'delete from sessions'), /permission denied/);
  }
});

test('admin functions refuse anyone without a valid session', async () => {
  assert.match(await rpcError(ANON, `select add_player('Zed')`), /Admins only/);
  assert.match(await rpcError(STRANGER, `select add_player('Zed')`), /Admins only/);
  assert.match(await rpcError(ANON, 'select match_result_errors(1, 0, null, $1)', ['[]']), /permission denied/);
  await as(ADMIN, `select add_player('Dani')`);
  assert.match(await rpcError(ADMIN, `select add_player('dani')`), /already on the list/);
});

test('wrong PINs are refused, and five in a row lock sign-in, even for the right PIN', async () => {
  assert.equal(await signIn(PIN).then((r) => typeof r.token), 'string');
  for (let i = 0; i < 4; i++) assert.deepEqual(await signIn('wrong'), { error: 'Wrong PIN.' });
  await signIn(PIN); // a correct PIN resets the count
  for (let i = 0; i < 5; i++) assert.deepEqual(await signIn('wrong'), { error: 'Wrong PIN.' });
  assert.match((await signIn(PIN)).error, /Too many/);
  assert.equal((await bootstrap(ADMIN)).admin, true, 'devices already signed in keep working');
  await db.exec(`update admin_pin set locked_until = now() - interval '1 second'`);
  assert.ok((await signIn(PIN)).token);
});

test('signing out and changing the PIN end sessions; the browser cannot change the PIN', async () => {
  const device = { role: 'anon', token: (await signIn(PIN)).token };
  assert.equal((await bootstrap(device)).admin, true);
  await as(device, 'select admin_sign_out()');
  assert.equal((await bootstrap(device)).admin, false);
  assert.equal((await bootstrap(ADMIN)).admin, true, "other devices aren't signed out");

  assert.match(await rpcError(ADMIN, `select set_admin_pin('hacked-pin')`), /permission denied/);
  await db.exec(`update admin_sessions set expires_at = now() - interval '1 second'`);
  assert.equal((await bootstrap(ADMIN)).admin, false, 'expired sessions stop working');

  await db.query('select set_admin_pin($1)', [PIN]);
  assert.equal((await db.query('select count(*)::int as n from admin_sessions')).rows[0].n, 0);
  await assert.rejects(db.query(`select set_admin_pin('short')`), /at least 6/);
  ADMIN.token = (await signIn(PIN)).token;
});

test('RSVPs: anyone can answer, firm answers lock at the cutoff, TBC stays open', async () => {
  await db.exec(`insert into sessions (id, type, date, start_time, opponent)
    values ('M-soon', 'Match', (now() at time zone 'Asia/Singapore')::date + 1, '23:59', 'Soon FC')`);
  await db.exec(`update settings set match_lock_hours = 48`);
  await as(ANON, `select submit_rsvp('M-soon', 'Alex', 'Going')`);
  assert.match(await rpcError(ANON, `select submit_rsvp('M-soon', 'Alex', 'Not going', 'ovs')`), /locked/);
  await as(ANON, `select submit_rsvp('M-soon', 'Bea', 'TBC')`);
  await as(ANON, `select submit_rsvp('M-soon', 'Bea', 'Going')`);
  assert.match(await rpcError(ANON, `select submit_rsvp('M-soon', 'Old', 'Going')`), /not on the team list/);
  assert.match(await rpcError(ANON, `select submit_rsvp('M-soon', 'Alex', 'Maybe')`), /Status must be/);
  await db.exec(`update settings set match_lock_hours = 12`);
});

test('feedback: anyone can send, only admins can read', async () => {
  await as(ANON, `select submit_feedback($1, '', '')`, ['=IMPORTDATA("x")']);
  assert.match(await rpcError(ANON, `select submit_feedback('   ')`), /empty/);
  const [entry] = (await bootstrap(ADMIN)).feedback;
  assert.deepEqual([entry.name, entry.message, entry.status], ['Anonymous', '=IMPORTDATA("x")', 'New']);
  await as(ADMIN, 'select set_feedback_status($1, $2)', [entry.id, 'Done']);
  assert.equal((await bootstrap(ADMIN)).feedback[0].status, 'Done');
});

test("feedback is limited to 10 messages a minute, so the inbox can't be flooded", async () => {
  await db.exec(`delete from feedback`);
  for (let i = 0; i < 10; i++) await as(ANON, `select submit_feedback('hello')`);
  assert.match(await rpcError(ANON, `select submit_feedback('one too many')`), /try again in a minute/);
  await db.exec(`update feedback set created_at = now() - interval '2 minutes'`);
  await as(ANON, `select submit_feedback('later')`);
  await db.exec(`delete from feedback`);
});

test('match results: validated, replaceable and clearable', async () => {
  await db.exec(`insert into sessions (id, type, date, start_time, opponent)
    values ('M-past', 'Match', '2026-10-10', '09:45', 'Merlions')`);
  const save = (our, their, potm, lineup) =>
    rpcError(ADMIN, 'select save_match_result($1, $2, $3, $4, $5)', ['M-past', our, their, potm, JSON.stringify(lineup)]);

  const invalid = await save(1, null, 'Cass', [{ player: 'Alex', goals: 2, assists: 0 }, { player: 'Zed', goals: 0, assists: 0 }]);
  assert.match(invalid, /Scores must be whole numbers/);
  assert.match(invalid, /Zed is not on the team list/);
  assert.match(invalid, /add up to more than our score/);
  assert.match(invalid, /must be someone who played/);

  assert.equal(await save(3, 1, 'Alex', [{ player: 'Alex', goals: 2, assists: 0 }, { player: 'Bea', goals: 1, assists: 1 }]), null);
  assert.equal(await save(4, 1, 'Bea', [{ player: 'Bea', goals: 2, assists: 0 }]), null);
  let data = await bootstrap(ANON);
  assert.deepEqual(data.results.find((r) => r.sessionId === 'M-past'), { sessionId: 'M-past', ourScore: 4, theirScore: 1, playerOfMatch: 'Bea' });
  assert.deepEqual(data.playerStats.filter((s) => s.sessionId === 'M-past').map((s) => s.player), ['Bea']);

  await as(ADMIN, `select clear_match_result('M-past')`);
  data = await bootstrap(ANON);
  assert.equal(data.results.some((r) => r.sessionId === 'M-past'), false);

  await db.exec(`insert into sessions (id, type, date, start_time, opponent) values ('M-future', 'Match', '2099-01-01', '10:00', 'Later')`);
  assert.match(await rpcError(ADMIN, 'select save_match_result($1, 1, 0, null, $2)', ['M-future', '[]']), /hasn't started/);
});

test('videos: only https YouTube links, stored in one canonical form', async () => {
  assert.match(await rpcError(ADMIN, `select add_video('M-past', 'x', 'javascript:alert(1)//youtu.be/GM1stGl6DiM')`), /YouTube link/);
  await as(ADMIN, `select add_video('M-past', 'Stream', 'https://www.youtube.com/live/GM1stGl6DiM?is=abc')`);
  const [video] = (await bootstrap(ANON)).videos;
  assert.equal(video.url, 'https://www.youtube.com/watch?v=GM1stGl6DiM');
  await as(ADMIN, 'select remove_video($1, $2)', ['M-past', video.url]);
  assert.equal((await bootstrap(ANON)).videos.length, 0);
});

test('schedule import upserts matches and only fills blank RSVPs', async () => {
  const matches = [{ date: '2026-12-06', start: '18:30', opponent: 'Wondersticks', note: '', rsvps: { Alex: { status: 'Going', reason: '' }, Newbie: { status: 'TBC', reason: 'work' } } }];
  const run = async () => (await as(ADMIN, 'select import_matches($1, true) as summary', [JSON.stringify(matches)])).rows[0].summary;
  assert.deepEqual(await run(), { added: 1, updated: 0, playersAdded: 1, rsvpsAdded: 2 });
  await as(ANON, `select submit_rsvp('M-20261206-wondersticks', 'Alex', 'Not going', 'ovs')`);
  assert.deepEqual(await run(), { added: 0, updated: 1, playersAdded: 0, rsvpsAdded: 0 });
  const alex = (await bootstrap(ANON)).rsvps.find((r) => r.sessionId === 'M-20261206-wondersticks' && r.player === 'Alex');
  assert.equal(alex.status, 'Not going', "an answer given in the app isn't overwritten by a re-import");
});

test('one-off sessions get readable ids and clear errors', async () => {
  const id = (await as(ADMIN, `select add_session('Training', $1, '19:00', '21:00') as id`, [daysFromToday(3)])).rows[0].id;
  assert.equal(id, `T-${daysFromToday(3).replace(/-/g, '')}-1900-X`);
  assert.match(await rpcError(ADMIN, `select add_session('Match', $1, '10:00', '', '')`, [today()]), /Add the opponent/);
  assert.match(await rpcError(ADMIN, `select add_session('Training', 'soon', '10:00')`), /yyyy-mm-dd/);
});

test('SQL id helpers match the browser versions', async () => {
  const cases = [['2026-09-13', 'NUS Titans'], ['2026-10-04', 'NUS Titans FC'], ['2026-01-24', 'Cripz '], ['2026-03-06', '!!!']];
  for (const [date, opponent] of cases) {
    const { rows } = await db.query('select match_id($1::date, $2) as id', [date, opponent]);
    assert.equal(rows[0].id, matchId(date, opponent), `${date} ${opponent}`);
  }
  for (const url of ['https://youtu.be/G7Pocvdtxes', 'https://www.youtube.com/live/GM1stGl6DiM?is=x', 'http://youtu.be/G7Pocvdtxes', 'javascript:youtu.be/G7Pocvdtxes']) {
    const { rows } = await db.query('select youtube_id($1) as id', [url]);
    assert.equal(rows[0].id ?? '', youTubeId(url), url);
  }
});

test('every function the browser calls exists with matching parameters', async () => {
  const { rows } = await db.query(`
    select p.proname as name, coalesce(p.proargnames, '{}') as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`);
  const signatures = new Map(rows.map((r) => [r.name, r.args]));
  for (const [action, toRpc] of Object.entries(RPC_CALLS)) {
    const [fn, params] = toRpc({});
    assert.ok(signatures.has(fn), `${action} -> ${fn} exists`);
    for (const param of Object.keys(params)) assert.ok(signatures.get(fn).includes(param), `${fn}(${param})`);
  }
});
