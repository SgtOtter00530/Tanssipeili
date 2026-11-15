import test from 'node:test';
import assert from 'node:assert/strict';
import { LM } from '../../js/core/skeleton.js';
import { projectReference } from '../../js/core/normalize.js';
import { poseFromAngles, shrinkAndShift } from './helpers.js';

const close = (a, b, eps = 0.01) => Math.abs(a - b) < eps;

test('pienempänä ja sivussa kuvattu malli sovittuu tanssijan päälle', () => {
  const pose = poseFromAngles({ lUpperArm: 0, rThigh: 60 });
  const p = projectReference(shrinkAndShift(pose, 0.5, 0.2), 9 / 16, pose, 9 / 16);
  assert.equal(p.length, 33);
  for (const i of [LM.L_WRIST, LM.R_WRIST, LM.L_ANKLE, LM.R_KNEE, LM.NOSE]) {
    assert.ok(close(p[i].x, pose[i].x) && close(p[i].y, pose[i].y), `piste ${i}`);
  }
});

test('eri kuvasuhteella kuvattu malli sovittuu oikein', () => {
  const user = poseFromAngles({ lUpperArm: -30 }, { aspect: 9 / 16 });
  const ref = poseFromAngles({ lUpperArm: -30 }, { aspect: 1 });
  const p = projectReference(ref, 1, user, 9 / 16);
  assert.ok(close(p[LM.L_WRIST].x, user[LM.L_WRIST].x) && close(p[LM.L_WRIST].y, user[LM.L_WRIST].y));
  assert.ok(close(p[LM.R_ANKLE].x, user[LM.R_ANKLE].x) && close(p[LM.R_ANKLE].y, user[LM.R_ANKLE].y));
});

test('mallin eri asento säilyy erilaisena sovituksen jälkeen', () => {
  const user = poseFromAngles({});
  const ref = poseFromAngles({ lUpperArm: 0 });
  const p = projectReference(ref, 9 / 16, user, 9 / 16);
  assert.ok(close(p[LM.L_HIP].x, user[LM.L_HIP].x));
  assert.ok(Math.abs(p[LM.L_ELBOW].y - user[LM.L_ELBOW].y) > 0.05);
});

test('näkyvyys kulkee mallin pisteiden mukana', () => {
  const user = poseFromAngles({});
  const ref = poseFromAngles({}, { hidden: [LM.L_WRIST] });
  assert.equal(projectReference(ref, 1, user, 1)[LM.L_WRIST].v, 0);
});

test('ilman näkyvää lantiota tai hartioita sovitusta ei tehdä', () => {
  const pose = poseFromAngles({});
  assert.equal(projectReference(pose, 1, poseFromAngles({}, { hidden: [LM.L_HIP] }), 1), null);
  assert.equal(projectReference(poseFromAngles({}, { hidden: [LM.R_SHOULDER] }), 1, pose, 1), null);
});
