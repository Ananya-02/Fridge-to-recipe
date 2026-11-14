import test from 'node:test';
import assert from 'node:assert/strict';
import { parseModelOutput } from '../shared/recipeSchema.js';
import { createApp } from '../server/app.js';

const good = {
  ok: true,
  recipe: {
    title: 'Egg Scramble', baseServings: 2, prepMinutes: 5, cookMinutes: 5,
    ingredients: [{ id: 'i1', name: 'eggs', quantity: 4, unit: '', swaps: [] }],
    steps: [{ id: 's1', text: 'Beat the {{i1}} and cook.' }],
  },
};
const json = (o) => JSON.stringify(o);

test('parse: accepts fenced JSON', () => {
  assert.equal(parseModelOutput('```json\n' + json(good) + '\n```').valid, true);
});
test('parse: rejects malformed JSON, empty, wrong shape, bad placeholder', () => {
  assert.equal(parseModelOutput('{"ok": true,').valid, false);
  assert.equal(parseModelOutput('').valid, false);
  assert.equal(parseModelOutput(json({ ok: true, recipe: { title: 'x' } })).valid, false);
  const bad = structuredClone(good);
  bad.recipe.steps[0].text = 'Use {{i9}}';
  assert.equal(parseModelOutput(json(bad)).valid, false);
});
test('parse: accepts a refusal', () => {
  assert.equal(parseModelOutput(json({ ok: false, reason: 'Not food' })).valid, true);
});

async function post(callModel, body) {
  const server = createApp(callModel).listen(0);
  const r = await fetch(`http://localhost:${server.address().port}/api/recipe`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  server.close();
  return { status: r.status, body: await r.json() };
}

test('api: retries once after bad output, then succeeds', async () => {
  let calls = 0;
  const r = await post(async () => (++calls === 1 ? 'not json' : json(good)), { ingredients: 'eggs' });
  assert.equal(r.status, 200);
  assert.equal(calls, 2);
});
test('api: gives up after two bad outputs', async () => {
  const r = await post(async () => '{}', { ingredients: 'eggs' });
  assert.equal(r.status, 502);
  assert.equal(r.body.error.code, 'INVALID_OUTPUT');
});
test('api: maps timeout and rate limit; rejects empty input', async () => {
  const timeout = Object.assign(new Error('t'), { name: 'TimeoutError' });
  assert.equal((await post(async () => { throw timeout; }, { ingredients: 'eggs' })).status, 504);
  assert.equal((await post(async () => { throw Object.assign(new Error('x'), { status: 429 }); }, { ingredients: 'eggs' })).status, 429);
  assert.equal((await post(async () => '', { ingredients: '  ' })).status, 400);
});
