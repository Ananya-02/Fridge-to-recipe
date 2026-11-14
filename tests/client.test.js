import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePartial } from '../src/lib/partialJson.js';
import { createEventParser } from '../src/lib/sse.js';
import { loadSessions, newSession, sanitizeSession, SESSIONS_KEY, withVersion } from '../src/lib/sessions.js';
import { initial, reducer } from '../src/hooks/useRecipeRequest.js';
import { SAMPLE } from '../server/mock.js';

test('parsePartial: every prefix of a real response parses or returns null, never throws', () => {
  const full = JSON.stringify({ ok: true, recipe: SAMPLE });
  for (let i = 0; i <= full.length; i++) assert.doesNotThrow(() => parsePartial(full.slice(0, i)));
  assert.deepEqual(parsePartial(full), { ok: true, recipe: SAMPLE });
});

test('parsePartial: closes open strings and containers, drops half-written keys', () => {
  assert.deepEqual(parsePartial('{"recipe":{"title":"Spicy Tom'), { recipe: { title: 'Spicy Tom' } });
  assert.deepEqual(parsePartial('{"a":[1,2,{"b":"x"},{"c'), { a: [1, 2, { b: 'x' }, {}] });
  assert.deepEqual(parsePartial('{"a":1,"b":tru'), { a: 1 });
  assert.deepEqual(parsePartial('Sure! {"a":"b"} trailing'), { a: 'b' });
  assert.equal(parsePartial('no json here'), null);
});

test('SSE parser handles events split across chunks and CRLF', () => {
  const got = [];
  const feed = createEventParser((event, data) => got.push([event, data]));
  feed('event: chunk\ndata: {"text":"he');
  feed('llo"}\n\nevent: done\r\ndata: {"ok":true}\r\n\r\n');
  feed('event: bad\ndata: {not json}\n\n');
  assert.deepEqual(got, [['chunk', { text: 'hello' }], ['done', { ok: true }]]);
});

test('request reducer: phases, chunks, reset on retry, terminal states', () => {
  let s = reducer(initial, { type: 'start', kind: 'create' });
  assert.equal(s.status, 'loading');
  s = reducer(s, { type: 'phase', phase: 'writing' });
  s = reducer(s, { type: 'chunk', text: '{"a"' });
  assert.equal(s.text, '{"a"');
  s = reducer(s, { type: 'reset' });
  assert.equal(s.text, '');
  assert.equal(s.phase, 'retrying');
  assert.equal(s.attempt, 2);
  assert.equal(reducer(s, { type: 'success' }).status, 'success');
  assert.equal(reducer(s, { type: 'refused', reason: 'no' }).status, 'empty');
  const err = reducer(s, { type: 'error', code: 'TIMEOUT', message: 'm' });
  assert.equal(err.status, 'error');
  assert.equal(err.kind, 'create');
  // a late chunk after the request ended is ignored
  assert.equal(reducer(err, { type: 'chunk', text: 'x' }).text, '');
});

const memoryStorage = (value) => ({ getItem: () => value, setItem() {} });

test('sessions: corrupt or tampered storage never crashes and is cleaned', () => {
  assert.deepEqual(loadSessions(memoryStorage('{not json')), []);
  assert.deepEqual(loadSessions(memoryStorage('{"a":1}')), []);
  assert.deepEqual(loadSessions(null), []);

  const s = newSession('eggs', [], SAMPLE);
  const tampered = { ...s, servings: 999, checked: ['s1', 'nope'], swaps: { i1: 1, i2: 7, i7: 0 }, current: 5 };
  const broken = { id: 'x', versions: [{ recipe: { title: 'no steps' } }] };
  const loaded = loadSessions(memoryStorage(JSON.stringify([tampered, broken, null])));
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].servings, SAMPLE.baseServings);
  assert.deepEqual(loaded[0].checked, ['s1']);
  assert.deepEqual(loaded[0].swaps, { i1: 1 });
  assert.equal(loaded[0].current, 0);
  assert.equal(SESSIONS_KEY, 'fridge.sessions.v1');
});

test('sessions: a refinement adds a version and resets progress', () => {
  const s = { ...newSession('eggs', [], SAMPLE), checked: ['s1'], swaps: { i1: 0 }, servings: 5 };
  const v2 = withVersion(s, { ...SAMPLE, title: 'Vegan' }, 'make it vegan');
  assert.equal(v2.versions.length, 2);
  assert.equal(v2.current, 1);
  assert.deepEqual(v2.checked, []);
  assert.deepEqual(v2.swaps, {});
  assert.equal(v2.servings, 5);
  assert.ok(sanitizeSession(v2));
});
