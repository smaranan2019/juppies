import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outcome, ourScoreFrom, unassignedGoals, validateMatchResult } from '../js/logic/match-result.js';

const roster = ['Alex', 'Bea', 'Cass'];
const valid = {
  ourScore: 3,
  theirScore: 1,
  playerOfMatch: 'Alex',
  players: [
    { player: 'Alex', goals: 2, assists: 0 },
    { player: 'Bea', goals: 0, assists: 2 },
  ],
};

test('outcome is from our point of view', () => {
  assert.equal(outcome({ ourScore: 3, theirScore: 1 }), 'W');
  assert.equal(outcome({ ourScore: 1, theirScore: 1 }), 'D');
  assert.equal(outcome({ ourScore: 0, theirScore: 2 }), 'L');
  assert.equal(outcome(undefined), null);
});

test('our score follows player goals and keeps own goals on top', () => {
  assert.equal(unassignedGoals(4, 3), 1);
  assert.equal(unassignedGoals(2, 3), 0);
  assert.equal(unassignedGoals(NaN, 3), 0);
  assert.equal(ourScoreFrom(3, 1), 4);
  assert.equal(ourScoreFrom(98, 5), 99);
});

test('a sensible result passes, including unattributed goals', () => {
  assert.deepEqual(validateMatchResult(valid, roster), []);
});

test('rejects bad scores, totals and player of the match', () => {
  const errors = validateMatchResult({
    ourScore: 1,
    theirScore: -1,
    playerOfMatch: 'Cass',
    players: [
      { player: 'Alex', goals: 2, assists: 2 },
      { player: 'Alex', goals: 0, assists: 0 },
      { player: 'Zed', goals: 0, assists: 0 },
    ],
  }, roster);
  assert.equal(errors.length, 6);
});
