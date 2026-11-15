import test from 'node:test';
import assert from 'node:assert/strict';
import { LM } from '../../js/core/skeleton.js';
import { analyze } from '../../js/core/analysis.js';
import { sliceTrack, mirrorTrack } from '../../js/core/track.js';
import { sweepTrack, padStart, offsetSweep, withNullFrames, hideLegs } from './helpers.js';

const ref = sweepTrack(40);

test('sama rata itseään vastaan: kaikki lähellä mallia ja tahdissa', () => {
  const a = analyze(ref, ref, 'normaali');
  assert.equal(a.map.length, 40);
  assert.equal(a.perFrame.length, 40);
  assert.equal(a.timeline.length, 40);
  for (const g of ['arms', 'legs', 'core']) {
    assert.equal(a.groups[g].dots, 4);
    assert.equal(a.groups[g].label, 'lähellä mallia');
  }
  assert.equal(a.timing.label, 'tahdissa');
  assert.equal(a.detectedShare, 1);
  assert.equal(a.perFrame[10].levels.lUpperArm, 'green');
  assert.ok(a.timeline[10] < 1);
});

test('puoli sekuntia myöhässä: ajoitus kertoo sen, kädet pysyvät lähellä mallia', () => {
  const late = analyze(padStart(ref, 5), ref, 'normaali');
  assert.equal(late.groups.arms.dots, 4);
  assert.match(late.timing.label, /jäljessä/);
  assert.ok(Math.abs(late.timing.medianLagSec - 0.5) < 0.11);
});

test('puoli sekuntia edellä: ajoitus sanoo edellä', () => {
  const early = analyze(ref, padStart(ref, 5), 'normaali');
  assert.match(early.timing.label, /edellä/);
  assert.ok(early.timing.medianLagSec < 0);
});

test('ajoituksen sanamuodot noudattavat raja-arvoja', () => {
  assert.equal(analyze(padStart(ref, 1), ref, 'normaali').timing.label, 'tahdissa');
  assert.equal(analyze(padStart(ref, 3), ref, 'normaali').timing.label, 'hieman jäljessä');
  assert.equal(analyze(padStart(ref, 6), ref, 'normaali').timing.label, 'selvästi jäljessä');
});

test('kädet selvästi eri asennossa: kädet saavat heikon arvion, jalat pysyvät hyvinä', () => {
  const off = analyze(offsetSweep(40, { rUpperArm: 60, rForearm: 60, lForearm: 60 }), ref, 'normaali');
  assert.ok(off.groups.arms.dots <= 1, `arms dots ${off.groups.arms.dots}`);
  assert.equal(off.groups.arms.label, 'paljon eroja');
  assert.equal(off.groups.legs.dots, 4);
  assert.equal(off.perFrame[20].levels.rUpperArm, 'red');
  assert.ok(off.timeline[20] > 15);
});

test('tarkkuusasetus muuttaa tasoja', () => {
  const user = offsetSweep(40, { rUpperArm: 20, rForearm: 20 });
  assert.equal(analyze(user, ref, 'salliva').perFrame[5].levels.rUpperArm, 'green');
  assert.equal(analyze(user, ref, 'normaali').perFrame[5].levels.rUpperArm, 'yellow');
  assert.equal(analyze(user, ref, 'tarkka').perFrame[5].levels.rUpperArm, 'yellow');
  assert.equal(analyze(offsetSweep(40, { rUpperArm: 21 }), ref, 'tarkka').perFrame[5].levels.rUpperArm, 'red');
});

test('puolet kuvista ilman henkilöä: ei kaadu, osuus raportoidaan, tyhjät kuvat tuntemattomia', () => {
  const gaps = analyze(withNullFrames(ref, 0.5), ref, 'normaali');
  assert.ok(Math.abs(gaps.detectedShare - 0.5) < 0.05);
  assert.equal(gaps.timeline[0], null);
  assert.equal(gaps.perFrame[0].levels.torso, 'unknown');
  assert.equal(gaps.groups.arms.dots, 4);
});

test('jalat piilossa koko ajan: arvio on "ei pystytty arvioimaan", ei huono', () => {
  const noLegs = analyze(hideLegs(ref), ref, 'normaali');
  assert.equal(noLegs.groups.legs.dots, 0);
  assert.equal(noLegs.groups.legs.label, 'ei pystytty arvioimaan');
  assert.equal(noLegs.groups.arms.dots, 4);
});

test('tyhjä rata ei kaada analyysia', () => {
  const empty = { fps: 10, width: 720, height: 1280, frames: [] };
  const a = analyze(empty, ref, 'normaali');
  assert.equal(a.perFrame.length, 0);
  assert.equal(a.detectedShare, 0);
  assert.equal(a.groups.arms.dots, 0);
  const b = analyze(ref, empty, 'normaali');
  assert.equal(b.groups.arms.dots, 0);
  assert.equal(b.perFrame.length, 40);
});

test('rajaus palauttaa välin ja aloittaa ajan nollasta', () => {
  const s = sliceTrack(ref, 1, 3);
  assert.equal(s.frames.length, 20);
  assert.equal(s.frames[0].t, 0);
  assert.ok(Math.abs(s.frames[19].t - 1.9) < 1e-9);
  assert.equal(s.frames[0].lm, ref.frames[10].lm);
  assert.equal(s.fps, 10);
  assert.equal(sliceTrack(ref, 0, 99).frames.length, 40);
});

test('radan peilaus peilaa jokaisen kuvan ja säilyttää tyhjät', () => {
  const t = withNullFrames(ref, 0.5);
  const m = mirrorTrack(t);
  assert.equal(m.frames[0].lm, null);
  assert.equal(m.frames[1].lm[LM.L_WRIST].x, 1 - t.frames[1].lm[LM.R_WRIST].x);
  assert.equal(m.frames.length, t.frames.length);
  assert.equal(m.width, t.width);
});
