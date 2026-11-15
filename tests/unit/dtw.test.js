import test from 'node:test';
import assert from 'node:assert/strict';
import { findShift, alignTracks } from '../../js/core/dtw.js';
import { compareFrames, frameCost } from '../../js/core/compare.js';
import { sweepTrack, padStart, holdAt } from './helpers.js';

const A = 9 / 16;
const cost = (u, r) => (u.lm && r.lm ? frameCost(compareFrames(u.lm, r.lm, A, A)) : 90);

test('sama rata: siirtymä on nolla ja kohdistus kuva kuvalta', () => {
  const ref = sweepTrack(30);
  assert.equal(findShift(ref.frames, ref.frames, cost, 20), 0);
  const map = alignTracks(ref.frames, ref.frames, cost, { shift: 0, band: 5, warpPenalty: 6 });
  assert.ok(map instanceof Int32Array);
  assert.deepEqual([...map], ref.frames.map((_, i) => i));
});

test('rajausero löytyy yhtenä siirtymänä: oma video alkaa 5 kuvaa aiemmin', () => {
  const ref = sweepTrack(40);
  const user = padStart(ref, 5);
  const shift = findShift(user.frames, ref.frames, cost, 20);
  assert.equal(shift, -5);
  const map = alignTracks(user.frames, ref.frames, cost, { shift, band: 5, warpPenalty: 6 });
  assert.equal(map.length, 45);
  assert.equal(map[25], 20);
  assert.equal(map[44], 39);
  for (let i = 1; i < map.length; i++) assert.ok(map[i] >= map[i - 1], `taaksepäin kohdassa ${i}`);
});

test('oma video alkaa myöhemmästä kohdasta: siirtymä on positiivinen', () => {
  const ref = sweepTrack(40);
  const user = { ...ref, frames: ref.frames.slice(7) };
  assert.equal(findShift(user.frames, ref.frames, cost, 20), 7);
});

test('kuvat, joille mallissa ei ole vastinetta, saavat arvon -1', () => {
  const ref = sweepTrack(40);
  const user = padStart(ref, 12);
  const map = alignTracks(user.frames, ref.frames, cost, { shift: -12, band: 5, warpPenalty: 6 });
  for (let i = 0; i <= 6; i++) assert.equal(map[i], -1, `kuva ${i}`);
  assert.equal(map[7], 0);
  assert.equal(map[32], 20);
});

test('paikallinen kolmen kuvan viive seurataan', () => {
  const ref = sweepTrack(40);
  const small = holdAt(ref, 19, 3);
  const map = alignTracks(small.frames, ref.frames, cost, { shift: 0, band: 5, warpPenalty: 6 });
  assert.equal(map[10], 10);
  assert.equal(map[30], 27);
});

test('kaistan ulkopuolelle ei kohdisteta koskaan', () => {
  const ref = sweepTrack(40);
  const user = holdAt(ref, 10, 9);
  const shift = 0;
  const map = alignTracks(user.frames, ref.frames, cost, { shift, band: 5, warpPenalty: 6 });
  map.forEach((j, i) => {
    if (j >= 0) assert.ok(Math.abs(i + shift - j) <= 5, `kuva ${i} → ${j}`);
  });
});

test('tyhjät radat ja kuvat ilman henkilöä eivät kaada', () => {
  const ref = sweepTrack(20);
  assert.equal(alignTracks([], ref.frames, cost).length, 0);
  assert.deepEqual([...alignTracks(ref.frames, [], cost)], new Array(20).fill(-1));
  assert.equal(findShift([], ref.frames, cost, 20), 0);
  assert.equal(findShift(ref.frames, [], cost, 20), 0);
  const user = { ...ref, frames: ref.frames.map((f, i) => (i % 3 === 0 ? { t: f.t, lm: null } : f)) };
  const map = alignTracks(user.frames, ref.frames, cost, { shift: findShift(user.frames, ref.frames, cost, 20), band: 5, warpPenalty: 6 });
  assert.equal(map.length, 20);
});

test('toistuvassa liikkeessä valitaan pienin siirtymä', () => {
  // Kaksi samanlaista nostoa peräkkäin: siirtymä yhden jakson verran sopisi yhtä hyvin.
  const one = sweepTrack(15);
  const twice = { ...one, frames: [...one.frames, ...one.frames].map((f, i) => ({ t: i / 10, lm: f.lm })) };
  assert.equal(findShift(twice.frames, twice.frames, cost, 20), 0);
});
