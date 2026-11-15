import test from 'node:test';
import assert from 'node:assert/strict';
import { LM, SEGMENTS, DETAIL_SEGMENTS } from '../../js/core/skeleton.js';
import {
  MIN_VIS, THRESHOLDS, segmentAngle, angleDiff, compareFrames, levelOf, frameCost,
} from '../../js/core/compare.js';
import { poseFromAngles } from './helpers.js';

const seg = (id) => SEGMENTS.find((s) => s.id === id);

test('kulmaero on lyhin kaari välillä 0–180', () => {
  assert.equal(angleDiff(350, 10), 20);
  assert.equal(angleDiff(0, 180), 180);
  assert.equal(angleDiff(-90, 90), 180);
  assert.equal(angleDiff(45, 45), 0);
  assert.equal(angleDiff(-170, 170), 20);
});

test('segmentin kulma vastaa asennon rakennuskulmaa', () => {
  const pose = poseFromAngles({ lUpperArm: 30 });
  assert.ok(Math.abs(segmentAngle(pose, seg('lUpperArm'), 9 / 16) - 30) < 1e-6);
  assert.ok(Math.abs(segmentAngle(pose, seg('torso'), 9 / 16) - -90) < 1e-6);
});

test('vertailu löytää 60 asteen eron yhdestä raajasta ja nollan muista', () => {
  const a = poseFromAngles({});
  const b = poseFromAngles({ lUpperArm: 30 });
  const d = compareFrames(a, b, 9 / 16, 9 / 16);
  assert.ok(Math.abs(d.lUpperArm - 60) < 1e-6);
  assert.ok(d.rThigh < 1e-6);
  assert.ok(d.torso < 1e-6);
  assert.equal(Object.keys(d).length, 10);
});

test('sama asento eri kuvasuhteessa antaa nollaeron', () => {
  const tall = poseFromAngles({ lUpperArm: 45, rThigh: 120 }, { aspect: 9 / 16 });
  const square = poseFromAngles({ lUpperArm: 45, rThigh: 120 }, { aspect: 1 });
  const d = compareFrames(tall, square, 9 / 16, 1);
  for (const [id, diff] of Object.entries(d)) assert.ok(diff < 1e-6, `${id}: ${diff}`);
  // Ilman kuvasuhteen huomiointia ero olisi selvä:
  assert.ok(compareFrames(tall, square, 1, 1).lUpperArm > 10);
});

test('piilossa oleva nivel tekee segmentistä tuntemattoman, ei punaista', () => {
  const hidden = poseFromAngles({}, { hidden: [LM.L_WRIST] });
  const other = poseFromAngles({ lForearm: -90 });
  const d = compareFrames(hidden, other, 1, 1);
  assert.equal(d.lForearm, null);
  assert.notEqual(d.lUpperArm, null);
  assert.equal(compareFrames(other, hidden, 1, 1).lForearm, null);
  assert.equal(levelOf(null, 'normaali'), 'unknown');
});

test('näkyvyysraja on 0,5', () => {
  assert.equal(MIN_VIS, 0.5);
  const low = poseFromAngles({}, { v: 0.49 });
  assert.equal(segmentAngle(low, seg('torso'), 1), null);
  const ok = poseFromAngles({}, { v: 0.5 });
  assert.notEqual(segmentAngle(ok, seg('torso'), 1), null);
});

test('tasot noudattavat tarkkuusasetuksen raja-arvoja', () => {
  assert.deepEqual(THRESHOLDS, {
    salliva: { green: 25, yellow: 45 },
    normaali: { green: 15, yellow: 30 },
    tarkka: { green: 10, yellow: 20 },
  });
  assert.equal(levelOf(15, 'normaali'), 'green');
  assert.equal(levelOf(15.1, 'normaali'), 'yellow');
  assert.equal(levelOf(30, 'normaali'), 'yellow');
  assert.equal(levelOf(30.1, 'normaali'), 'red');
  assert.equal(levelOf(24, 'salliva'), 'green');
  assert.equal(levelOf(46, 'salliva'), 'red');
  assert.equal(levelOf(11, 'tarkka'), 'yellow');
  assert.equal(levelOf(0, 'tarkka'), 'green');
});

test('kuvan kustannus on tunnettujen erojen keskiarvo, 90 jos mitään ei tunneta', () => {
  assert.equal(frameCost({ a: 10, b: 30, c: null }), 20);
  assert.equal(frameCost({ a: null }), 90);
  assert.equal(frameCost({}), 90);
});

test('kuvan ulkopuolelle arvattu piste tekee segmentistä tuntemattoman', () => {
  const pose = poseFromAngles({});
  const out = pose.map((p, i) => (i === LM.L_WRIST ? { x: 1.1, y: p.y, v: 0.9 } : p));
  assert.equal(segmentAngle(out, seg('lForearm'), 9 / 16), null);
  assert.notEqual(segmentAngle(out, seg('lUpperArm'), 9 / 16), null);
  const below = pose.map((p, i) => (i === LM.L_ANKLE ? { x: p.x, y: 1.08, v: 0.9 } : p));
  assert.equal(compareFrames(below, pose, 1, 1).lShin, null);
  // aivan reunalla oleva piste kelpaa
  const edge = pose.map((p, i) => (i === LM.L_ANKLE ? { x: p.x, y: 1.0, v: 0.9 } : p));
  assert.notEqual(compareFrames(edge, pose, 1, 1).lShin, null);
});

test('vertailun voi tehdä myös kämmenille ja jalkaterille', () => {
  const a = poseFromAngles({});
  const b = poseFromAngles({ lFoot: 105, rHand: 30 });
  const d = compareFrames(a, b, 9 / 16, 9 / 16, [...SEGMENTS, ...DETAIL_SEGMENTS]);
  assert.equal(Object.keys(d).length, 14);
  assert.ok(Math.abs(d.lFoot - 60) < 1e-6);
  assert.ok(Math.abs(d.rHand - 60) < 1e-6);
  assert.ok(d.rFoot < 1e-6);
  assert.equal(Object.keys(compareFrames(a, b, 1, 1)).length, 10, 'oletuksena vain pääsegmentit');
});

test('nollan pituinen segmentti on tuntematon', () => {
  const pose = poseFromAngles({});
  const collapsed = pose.map((p, i) => (i === 19 ? { ...pose[LM.L_WRIST] } : p));
  assert.equal(segmentAngle(collapsed, DETAIL_SEGMENTS[0], 9 / 16), null);
});
