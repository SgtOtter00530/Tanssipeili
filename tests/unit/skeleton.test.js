import test from 'node:test';
import assert from 'node:assert/strict';
import { LM, SEGMENTS, DRAW_EXTRA, point, mirrorLandmarks } from '../../js/core/skeleton.js';
import { poseFromAngles, approx } from './helpers.js';

test('segmenttejä on kymmenen ja jokaisella on ryhmä', () => {
  assert.equal(SEGMENTS.length, 10);
  assert.deepEqual(
    SEGMENTS.map((s) => s.id),
    ['lUpperArm', 'lForearm', 'rUpperArm', 'rForearm', 'lThigh', 'lShin', 'rThigh', 'rShin', 'torso', 'head'],
  );
  assert.deepEqual([...new Set(SEGMENTS.map((s) => s.group))].sort(), ['arms', 'core', 'legs']);
  assert.equal(DRAW_EXTRA.length, 2);
});

test('virtuaalipiste on parin keskipiste ja saa pienemmän näkyvyyden', () => {
  const pose = poseFromAngles({}, { hidden: [LM.L_HIP] });
  const hc = point(pose, 'hipCenter');
  assert.ok(approx(hc.x, (pose[LM.L_HIP].x + pose[LM.R_HIP].x) / 2));
  assert.equal(hc.v, 0);
  assert.equal(point(pose, 'shoulderCenter').v, 1);
  assert.equal(point(pose, LM.NOSE), pose[LM.NOSE]);
});

test('peilaus kääntää x:n ja vaihtaa vasemman ja oikean', () => {
  const pose = poseFromAngles({ lUpperArm: 0, lForearm: -45 });
  const m = mirrorLandmarks(pose);
  assert.equal(m.length, 33);
  assert.equal(m[LM.L_WRIST].x, 1 - pose[LM.R_WRIST].x);
  assert.equal(m[LM.L_WRIST].y, pose[LM.R_WRIST].y);
  assert.equal(m[LM.R_ELBOW].x, 1 - pose[LM.L_ELBOW].x);
  assert.equal(m[LM.NOSE].x, 1 - pose[LM.NOSE].x);
});

test('kahdesti peilattu asento on alkuperäinen', () => {
  const pose = poseFromAngles({ lUpperArm: 20, rThigh: 60 });
  const back = mirrorLandmarks(mirrorLandmarks(pose));
  back.forEach((p, i) => {
    assert.ok(approx(p.x, pose[i].x, 1e-12) && p.y === pose[i].y && p.v === pose[i].v, `piste ${i}`);
  });
});

test('peilaus ei muuta alkuperäistä taulukkoa', () => {
  const pose = poseFromAngles({});
  const x = pose[LM.L_WRIST].x;
  mirrorLandmarks(pose);
  assert.equal(pose[LM.L_WRIST].x, x);
});
