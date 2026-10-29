import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDateCell, parseRsvpCell, parseSchedule } from '../js/logic/schedule-import.js';
import { DEMO_RESULTS, DEMO_SCHEDULE_ROWS, DEMO_SEASON } from '../js/demo-schedule.js';
import { validateMatchResult } from '../js/logic/match-result.js';

test('parseDateCell infers the year from the season', () => {
  assert.deepEqual(parseDateCell('13 September', 2026), { date: '2026-09-13', note: '' });
  assert.deepEqual(parseDateCell('14 Feb', 2026), { date: '2027-02-14', note: '' });
  assert.deepEqual(parseDateCell('3 Oct (NEW)', 2026), { date: '2026-10-03', note: 'NEW' });
  assert.deepEqual(parseDateCell('2026-11-01', 2020), { date: '2026-11-01', note: '' });
  assert.equal(parseDateCell('someday', 2026), null);
});

test('parseRsvpCell maps answers and keeps the reason', () => {
  assert.deepEqual(parseRsvpCell('Yes'), { status: 'Going', reason: '' });
  assert.deepEqual(parseRsvpCell('No (ovs)'), { status: 'Not going', reason: 'ovs' });
  assert.deepEqual(parseRsvpCell('maybe'), { status: 'TBC', reason: '' });
  assert.equal(parseRsvpCell(''), null);
  assert.equal(parseRsvpCell('??'), null);
});

test('parseSchedule reads the sideways layout', () => {
  const rows = [
    ['Date', '13 September', '19 September'],
    ['Day', 'SUNDAY', 'SATURDAY'],
    ['Time', '11:30 AM', '9:45 AM'],
    ['VS', 'NUS Titans', 'Merlions'],
    ['Amy', 'Yes', 'No (ovs)'],
    ['Ben', '', 'huh'],
  ];
  const parsed = parseSchedule(rows, 2026);
  assert.equal(parsed.matches.length, 2);
  assert.deepEqual(parsed.players, ['Amy', 'Ben']);
  assert.equal(parsed.matches[0].start, '11:30');
  assert.equal(parsed.matches[1].opponent, 'Merlions');
  assert.deepEqual(parsed.matches[1].rsvps.Amy, { status: 'Not going', reason: 'ovs' });
  assert.equal(parsed.warnings.length, 1);
});

test('parseSchedule reads the 2026/27 demo schedule without warnings', () => {
  const parsed = parseSchedule(DEMO_SCHEDULE_ROWS, DEMO_SEASON);
  assert.deepEqual(parsed.warnings, []);
  assert.equal(parsed.matches.length, 18);
  assert.equal(parsed.players.length, 26);
  const newMatch = parsed.matches.find((m) => m.date === '2026-10-04');
  assert.deepEqual([newMatch.note, newMatch.opponent, newMatch.start], ['NEW', 'NUS Titans FC', '11:30']);
  assert.equal(parsed.matches.at(-1).date, '2027-03-06');
  assert.deepEqual(parsed.matches[2].rsvps.Ella, { status: 'Going', reason: 'work' });
  assert.deepEqual(parsed.matches[10].rsvps.Hazel, { status: 'Not going', reason: 'work' });  // written "No(work)", no space
});

test('every real result matches a scheduled game and is valid', () => {
  const { matches, players } = parseSchedule(DEMO_SCHEDULE_ROWS, DEMO_SEASON);
  for (const r of DEMO_RESULTS) {
    assert.ok(matches.some((m) => m.date === r.date && m.opponent.trim() === r.opponent), `${r.date} ${r.opponent}`);
    assert.deepEqual(validateMatchResult({ ...r, playerOfMatch: '', players: [] }, players), []);
  }
});

test('parseSchedule explains a missing Date row', () => {
  assert.ok(parseSchedule([['Nope']], 2026).error);
});
