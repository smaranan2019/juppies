import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestOnly } from '../js/lib/async.js';

const after = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));

test('latestOnly drops the result of a call overtaken by a newer one', async () => {
  const load = latestOnly((ms, value) => after(ms, value));
  const slowOld = load(30, 'old');
  const fastNew = load(5, 'new');
  assert.equal(await fastNew, 'new');
  assert.equal(await slowOld, undefined);
});

test('latestOnly passes errors through', async () => {
  const load = latestOnly(async () => { throw new Error('offline'); });
  await assert.rejects(load(), /offline/);
});
