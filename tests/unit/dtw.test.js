import test from 'node:test';
import assert from 'node:assert/strict';
import { alignTracks } from '../../js/core/dtw.js';
import { compareFrames, frameCost } from '../../js/core/compare.js';
import { sweepTrack, padStart } from './helpers.js';

const A = 9 / 16;
const cost = (u, r) => (u.lm && r.lm ? frameCost(compareFrames(u.lm, r.lm, A, A)) : 90);

test('sama rata kohdistuu kuva kuvalta itseensä', () => {
  const ref = sweepTrack(30);
  const map = alignTracks(ref.frames, ref.frames, cost);
  assert.deepEqual([...map], ref.frames.map((_, i) => i));
});

test('alun tauko ei sotke kohdistusta: liike osuu oikeaan mallin kuvaan', () => {
  const ref = sweepTrack(40);
  const user = padStart(ref, 5);
  const map = alignTracks(user.frames, ref.frames, cost);
  assert.ok(map instanceof Int32Array);
  assert.equal(map.length, user.frames.length);
  assert.equal(map[0], 0);
  assert.equal(map[map.length - 1], ref.frames.length - 1);
  for (let i = 1; i < map.length; i++) assert.ok(map[i] >= map[i - 1], `taaksepäin kohdassa ${i}`);
  assert.ok(Math.abs(map[25] - 20) <= 1, `map[25] = ${map[25]}`);
});

test('käyttäjän rata puolella nopeudella venyy koko mallin yli', () => {
  const ref = sweepTrack(20);
  const slow = sweepTrack(40);
  const map = alignTracks(slow.frames, ref.frames, cost, { band: 0.6 });
  assert.equal(map[0], 0);
  assert.equal(map[39], 19);
  assert.ok(Math.abs(map[20] - 10) <= 1);
});

test('tyhjä tai yhden kuvan rata ei kaada', () => {
  const ref = sweepTrack(10);
  assert.equal(alignTracks([], ref.frames, cost).length, 0);
  assert.deepEqual([...alignTracks(ref.frames, [], cost)], new Array(10).fill(-1));
  assert.deepEqual([...alignTracks([ref.frames[0]], ref.frames, cost)], [0]);
});

test('kuvat ilman henkilöä eivät kaada kohdistusta', () => {
  const ref = sweepTrack(20);
  const user = { ...ref, frames: ref.frames.map((f, i) => (i % 3 === 0 ? { t: f.t, lm: null } : f)) };
  const map = alignTracks(user.frames, ref.frames, cost);
  assert.equal(map.length, 20);
  for (let i = 1; i < map.length; i++) assert.ok(map[i] >= map[i - 1]);
});
