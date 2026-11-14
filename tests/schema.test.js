import test from 'node:test';
import assert from 'node:assert/strict';
import { parseModelOutput, parseRecipe, toQuantity } from '../shared/recipeSchema.js';
import { SAMPLE } from '../server/mock.js';

const json = (o) => JSON.stringify(o);
const good = { ok: true, recipe: SAMPLE };

test('accepts the sample recipe, fenced JSON and chatter around JSON', () => {
  assert.equal(parseModelOutput(json(good)).valid, true);
  assert.equal(parseModelOutput('```json\n' + json(good) + '\n```').valid, true);
  assert.equal(parseModelOutput('Sure! Here you go:\n' + json(good) + '\nEnjoy!').valid, true);
});

test('rejects malformed JSON, empty output, wrong shape and bad placeholders', () => {
  assert.equal(parseModelOutput('{"ok": true,').valid, false);
  const empty = parseModelOutput('   ');
  assert.equal(empty.valid, false);
  assert.equal(empty.empty, true);
  assert.equal(parseModelOutput(json({ ok: true, recipe: { title: 'x' } })).valid, false);
  const bad = structuredClone(good);
  bad.recipe.steps[0].text = 'Use {{i99}}';
  assert.match(parseModelOutput(json(bad)).error, /unknown ingredient i99/);
  const dup = structuredClone(good);
  dup.recipe.ingredients[1].id = 'i1';
  assert.match(parseModelOutput(json(dup)).error, /unique/);
});

test('accepts a refusal', () => {
  const r = parseModelOutput(json({ ok: false, reason: 'Not food' }));
  assert.equal(r.valid, true);
  assert.equal(r.data.ok, false);
});

test('is lenient where it is safe: text quantities, missing extras, broken swaps', () => {
  const loose = structuredClone(good);
  loose.recipe.ingredients[0].quantity = '1 1/2';
  loose.recipe.ingredients[1].quantity = '0.5';
  loose.recipe.ingredients[2].quantity = 'to taste';
  loose.recipe.ingredients[3].swaps = 'onion powder';
  loose.recipe.baseServings = '4';
  delete loose.recipe.emoji;
  delete loose.recipe.blocks;
  loose.recipe.difficulty = 'impossible';
  loose.recipe.steps[0].timerMinutes = 'soon';
  const r = parseModelOutput(json(loose));
  assert.equal(r.valid, true, r.error);
  const rec = r.data.recipe;
  assert.equal(rec.ingredients[0].quantity, 1.5);
  assert.equal(rec.ingredients[1].quantity, 0.5);
  assert.equal(rec.ingredients[2].quantity, null);
  assert.deepEqual(rec.ingredients[3].swaps, []);
  assert.equal(rec.baseServings, 4);
  assert.equal(rec.emoji, '🍽️');
  assert.deepEqual(rec.blocks, []);
  assert.equal(rec.difficulty, 'easy');
  assert.equal(rec.steps[0].timerMinutes, null);
});

test('still rejects quantities that are not numbers', () => {
  const bad = structuredClone(good);
  bad.recipe.ingredients[0].quantity = 'a handful';
  assert.equal(parseModelOutput(json(bad)).valid, false);
  assert.equal(toQuantity('1/0'), Infinity); // and Infinity fails .finite()
  bad.recipe.ingredients[0].quantity = '1/0';
  assert.equal(parseModelOutput(json(bad)).valid, false);
});

test('drops invalid or unknown blocks one by one and reports it', () => {
  const withBad = structuredClone(good);
  withBad.recipe.blocks.push({ type: 'video', url: 'x' }, { type: 'chart', title: 'Bad', items: 'lots' });
  const r = parseModelOutput(json(withBad));
  assert.equal(r.valid, true);
  assert.equal(r.data.recipe.blocks.length, 3);
  assert.match(r.warnings[0], /Skipped 2/);
});

test('parseRecipe re-validates stored data', () => {
  assert.ok(parseRecipe(SAMPLE));
  assert.equal(parseRecipe({ title: 'x' }), null);
  assert.equal(parseRecipe(null), null);
});
