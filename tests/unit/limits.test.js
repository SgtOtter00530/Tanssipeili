import test from 'node:test';
import assert from 'node:assert/strict';
import { KEEP_VIDEO_DEFAULT_MAX_BYTES, defaultKeepVideo, formatBytes } from '../../js/core/limits.js';

test('videon tallennus on oletuksena päällä vain kohtuullisen kokoisille tiedostoille', () => {
  assert.equal(KEEP_VIDEO_DEFAULT_MAX_BYTES, 150 * 1024 * 1024);
  assert.equal(defaultKeepVideo(20 * 1024 * 1024), true);
  assert.equal(defaultKeepVideo(150 * 1024 * 1024), true);
  assert.equal(defaultKeepVideo(150 * 1024 * 1024 + 1), false);
  assert.equal(defaultKeepVideo(undefined), true);
});

test('tiedoston koko esitetään suomalaisittain', () => {
  assert.equal(formatBytes(508341), '0,5 Mt');
  assert.equal(formatBytes(1024 * 1024), '1,0 Mt');
  assert.equal(formatBytes(157286400), '150 Mt');
  assert.equal(formatBytes(2.5 * 1024 * 1024 * 1024), '2,5 Gt');
  assert.equal(formatBytes(900), '1 kt');
  assert.equal(formatBytes(0), '0 kt');
});
