import test from 'node:test';
import assert from 'node:assert/strict';
import { amountText, fillStep, formatQty, recipeToText, stepParts } from '../src/lib/scale.js';
import { foodEmoji, splitIngredients } from '../src/lib/foodEmoji.js';
import { SAMPLE } from '../server/mock.js';

test('formatQty gives readable amounts', () => {
  assert.equal(formatQty(0.5), '½');
  assert.equal(formatQty(1.5), '1 ½');
  assert.equal(formatQty(4 / 3), '1 ⅓');
  assert.equal(formatQty(0.99), '1');
  assert.equal(formatQty(250), '250');
  assert.equal(formatQty(null), '');
});

test('amountText scales and handles "to taste"', () => {
  assert.equal(amountText(200, 'g', 2, 3), '300 g');
  assert.equal(amountText(4, '', 2, 1), '2');
  assert.equal(amountText(null, 'to taste', 2, 6), 'to taste');
  assert.equal(amountText(1, 'cup', 2, 4), '2 cups');
  assert.equal(amountText(1, 'cup', 2, 2), '1 cup');
});

test('fillStep follows servings and swaps, and survives unknown ids', () => {
  const ings = [{ id: 'i1', name: 'eggs', quantity: 4, unit: '', swaps: [{ name: 'tofu', quantity: 200, unit: 'g' }] }];
  assert.equal(fillStep('Beat the {{i1}}', ings, {}, 2, 2), 'Beat the 4 eggs');
  assert.equal(fillStep('Beat the {{i1}}', ings, { i1: 0 }, 2, 4), 'Beat the 400 g tofu');
  assert.doesNotThrow(() => fillStep('Add {{zzz}}', ings, {}, 2, 2));
});

test('stepParts marks ingredient mentions for highlighting', () => {
  const ings = [{ id: 'i1', name: 'eggs', quantity: 4, unit: '', swaps: [] }];
  assert.deepEqual(stepParts('Beat {{i1}} well', ings, {}, 2, 2), ['Beat ', { id: 'i1', amount: '4', name: 'eggs', swapped: false }, ' well']);
});

test('recipeToText includes servings, swaps and every step', () => {
  const text = recipeToText(SAMPLE, 4, { i2: 0 });
  assert.match(text, /Serves 4/);
  assert.match(text, /400 g firm tofu/);
  assert.equal(text.split('\n').filter((l) => /^\d+\. /.test(l)).length, SAMPLE.steps.length);
});

test('foodEmoji picks sensible emoji and splitIngredients splits lists', () => {
  assert.equal(foodEmoji('Eggplant'), '🍆');
  assert.equal(foodEmoji('2 eggs'), '🥚');
  assert.equal(foodEmoji('pineapple chunks'), '🍍');
  assert.equal(foodEmoji('mystery'), '🥄');
  assert.deepEqual(splitIngredients('eggs, rice;\n tomato ,,'), ['eggs', 'rice', 'tomato']);
});
