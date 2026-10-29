import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normTime, seasonOf, seasonLabel, sessionStart, sessionEnd, todaySG, clockSG, yearFor } from '../js/logic/dates.js';

test('normTime reads the formats found in schedules', () => {
  assert.equal(normTime('6:45 PM'), '18:45');
  assert.equal(normTime('18:45'), '18:45');
  assert.equal(normTime('0845'), '08:45');
  assert.equal(normTime('12 AM'), '00:00');
  assert.equal(normTime(0.78125), '18:45');
  assert.equal(normTime('25:00'), '');
  assert.equal(normTime(''), '');
});

test('seasons run July to June', () => {
  assert.equal(yearFor(9, 2026), 2026);
  assert.equal(yearFor(2, 2026), 2027);
  assert.equal(seasonOf('2026-07-01'), 2026);
  assert.equal(seasonOf('2027-06-30'), 2026);
  assert.equal(seasonLabel(2026), '2026/27');
});

test('session times are Singapore time', () => {
  const session = { date: '2026-09-13', start: '11:30', end: '' };
  assert.equal(sessionStart(session).toISOString(), '2026-09-13T03:30:00.000Z');
  assert.equal(sessionEnd(session).toISOString(), '2026-09-13T06:30:00.000Z');
  assert.equal(clockSG(sessionStart(session)), '11:30');
});

test('todaySG rolls over at Singapore midnight', () => {
  assert.equal(todaySG(new Date('2026-09-13T15:59:00Z')), '2026-09-13');
  assert.equal(todaySG(new Date('2026-09-13T16:00:00Z')), '2026-09-14');
});
