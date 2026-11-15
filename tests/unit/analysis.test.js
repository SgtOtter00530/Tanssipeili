import test from 'node:test';
import assert from 'node:assert/strict';
import { LM } from '../../js/core/skeleton.js';
import { analyze } from '../../js/core/analysis.js';
import { sliceTrack, mirrorTrack } from '../../js/core/track.js';
import { sweepTrack, padStart, offsetSweep, withNullFrames, hideLegs, holdAt, halfSweep } from './helpers.js';

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
  assert.equal(a.timing.label, 'tahti pysyi tasaisena');
  assert.equal(a.timing.shiftSec, 0);
  assert.equal(a.detectedShare, 1);
  assert.equal(a.perFrame[10].levels.lUpperArm, 'green');
  assert.ok(a.timeline[10] < 1);
});

test('rajausero ei ole ajoitusvirhe: puoli sekuntia aiemmin aloitettu video on tasaisessa tahdissa', () => {
  const a = analyze(padStart(ref, 5), ref, 'normaali');
  assert.equal(a.groups.arms.dots, 4);
  assert.equal(a.timing.label, 'tahti pysyi tasaisena');
  assert.ok(Math.abs(a.timing.shiftSec - -0.5) < 1e-9);
  assert.ok(Math.abs(a.timing.driftSec) < 0.05);
});

test('kesken pätkän syntyvä viive näkyy ajoituksessa, ei asentovirheenä', () => {
  const late = analyze(holdAt(ref, 19, 3), ref, 'normaali');
  assert.equal(late.timing.label, 'jäit loppua kohti hieman jälkeen');
  assert.ok(Math.abs(late.timing.driftSec - 0.3) < 0.11);
  assert.equal(late.groups.arms.dots, 4);
  const early = analyze(ref, holdAt(ref, 19, 3), 'normaali');
  assert.equal(early.timing.label, 'nopeutit loppua kohti hieman');
  const long = sweepTrack(80);
  assert.equal(analyze(holdAt(long, 39, 5), long, 'normaali').timing.label, 'jäit loppua kohti selvästi jälkeen');
});

test('yksi koko ajan väärässä asennossa oleva raaja ei huku muiden joukkoon', () => {
  const a = analyze(offsetSweep(40, { rUpperArm: 90 }), ref, 'normaali');
  assert.equal(a.groups.arms.dots, 1);
  assert.equal(a.groups.arms.label, 'paljon eroja');
  assert.equal(a.groups.legs.dots, 4);
  assert.ok(a.timeline[20] > 80, `aikajana näyttää pahimman raajan: ${a.timeline[20]}`);
  assert.equal(a.perFrame[20].worst, a.timeline[20]);
});

test('vain puoleen väliin nouseva käsi ei näy lähellä mallia olevana', () => {
  // Tavallisen mittainen pätkä (12 s): käsi jää loppua kohti yhä selvemmin mallia alemmas.
  const a = analyze(halfSweep(120), sweepTrack(120), 'normaali');
  assert.ok(a.groups.arms.dots <= 2, `arms dots ${a.groups.arms.dots}`);
  assert.notEqual(a.groups.arms.label, 'lähellä mallia');
  assert.equal(a.perFrame[119].levels.lUpperArm, 'red');
  assert.ok(a.timeline.filter((d) => d !== null && d > 30).length >= 30, 'aikajanalla on pitkä punainen jakso');
  assert.equal(a.groups.legs.dots, 4);
  // Lyhyessäkään pätkässä (4 s) ajallinen jousto ei saa selittää eroa pois: jousto kiristyy pätkän mukana.
  const short = analyze(halfSweep(40), ref, 'normaali');
  assert.ok(short.groups.arms.dots <= 3, `arms dots ${short.groups.arms.dots}`);
  assert.equal(short.perFrame[39].levels.lUpperArm, 'red');
});

test('oman videon kohdat, joita malli ei kata, ovat tuntemattomia eivätkä punaisia', () => {
  const a = analyze(padStart(ref, 12), ref, 'normaali');
  assert.equal(a.map[0], -1);
  assert.equal(a.perFrame[0].levels.lUpperArm, 'unknown');
  assert.equal(a.timeline[0], null);
  assert.equal(a.groups.arms.dots, 4);
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

test('ilman kämmen- ja jalkaterävalintaa tulos on ennallaan', () => {
  const user = offsetSweep(40, { lFoot: 60 });
  const a = analyze(user, ref, 'normaali');
  assert.equal(Object.keys(a.perFrame[20].levels).length, 10);
  assert.equal(a.groups.hands, null);
  assert.equal(a.groups.feet, null);
  assert.ok(a.timeline[20] < 1, 'jalkaterän ero ei näy aikajanalla ilman valintaa');
  assert.equal(a.groups.legs.dots, 4);
});

test('valinnalla väärässä asennossa oleva jalkaterä näkyy omalla rivillään eikä heikennä Jalat-riviä', () => {
  const user = offsetSweep(40, { lFoot: 60 });
  const a = analyze(user, ref, 'normaali', { detail: true });
  assert.equal(Object.keys(a.perFrame[20].levels).length, 14);
  assert.equal(a.perFrame[20].levels.lFoot, 'red');
  assert.equal(a.perFrame[20].levels.rFoot, 'green');
  assert.deepEqual(a.groups.feet, { dots: 1, label: 'paljon eroja' });
  assert.deepEqual(a.groups.hands, { dots: 4, label: 'lähellä mallia' });
  assert.equal(a.groups.legs.dots, 4);
  assert.equal(a.groups.arms.dots, 4);
  assert.ok(a.timeline[20] > 55, `aikajana näyttää jalkaterän eron: ${a.timeline[20]}`);
});

test('kämmenet ja jalkaterät eivät vaikuta ajalliseen kohdistukseen', () => {
  const user = padStart(offsetSweep(40, { lFoot: 80, rHand: 80 }), 5);
  const plain = analyze(user, ref, 'normaali');
  const detailed = analyze(user, ref, 'normaali', { detail: true });
  assert.deepEqual([...detailed.map], [...plain.map]);
  assert.equal(detailed.timing.shiftSec, plain.timing.shiftSec);
});

test('piilossa olevat jalkaterät: rivi kertoo, ettei arviota voitu tehdä', () => {
  const hidden = { ...ref, frames: ref.frames.map((f) => ({ t: f.t, lm: f.lm.map((p, i) => ([31, 32].includes(i) ? { ...p, v: 0 } : p)) })) };
  const a = analyze(hidden, ref, 'normaali', { detail: true });
  assert.deepEqual(a.groups.feet, { dots: 0, label: 'ei pystytty arvioimaan' });
  assert.equal(a.groups.hands.dots, 4);
});
