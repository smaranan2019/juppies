import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchId, oneOffTrainingId, youTubeId } from '../js/logic/ids.js';

test('youTubeId reads every common YouTube link shape', () => {
  assert.equal(youTubeId('https://www.youtube.com/live/GM1stGl6DiM?is=4BWwYFOkF7PeH0de'), 'GM1stGl6DiM');
  assert.equal(youTubeId('https://youtu.be/G7Pocvdtxes'), 'G7Pocvdtxes');
  assert.equal(youTubeId('https://www.youtube.com/watch?v=7UCvpFPWd5g&t=30'), '7UCvpFPWd5g');
  assert.equal(youTubeId('https://m.youtube.com/shorts/EMC1ZASCwPQ'), 'EMC1ZASCwPQ');
});

test('youTubeId rejects anything that is not an https YouTube link', () => {
  assert.equal(youTubeId('javascript:alert(1)//youtu.be/GM1stGl6DiM'), '');
  assert.equal(youTubeId('https://evil.example/?v=GM1stGl6DiM&youtube.com'), '');
  assert.equal(youTubeId('http://youtu.be/GM1stGl6DiM'), '');
  assert.equal(youTubeId(''), '');
});

test('session ids are readable and stable', () => {
  assert.equal(matchId('2026-10-04', 'NUS Titans FC'), 'M-20261004-nus-titans-fc');
  assert.equal(matchId('2026-10-04', '!!!'), 'M-20261004-match');
  assert.equal(oneOffTrainingId('2026-11-03', '18:45'), 'T-20261103-1845-X');
});
