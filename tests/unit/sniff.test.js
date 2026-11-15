import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sniffVideo, describeSniff } from '../../js/core/sniff.js';

const enc = (s) => [...s].map((c) => c.charCodeAt(0));
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const box = (type, ...payload) => { const body = payload.flat(); return [...u32(body.length + 8), ...enc(type), ...body]; };
const stsd = (fourcc) => box('stsd', u32(0), u32(1), box(fourcc, new Array(16).fill(0)));

test('mp4: merkki ja koodekit luetaan ftyp- ja stsd-laatikoista', () => {
  const head = new Uint8Array([...box('ftyp', enc('isom'), u32(512), enc('isomiso2')), ...box('free', [1, 2, 3])]);
  const tail = new Uint8Array([...box('moov', box('trak', stsd('hvc1')), box('trak', stsd('mp4a')))]);
  const r = sniffVideo(head, tail);
  assert.equal(r.container, 'mp4');
  assert.equal(r.brand, 'isom');
  assert.deepEqual(r.codecs, ['hvc1', 'mp4a']);
  assert.equal(describeSniff(r), 'mp4 (isom), koodekit hvc1+mp4a');
});

test('mov ja webm tunnistetaan, tuntematon sisältö kerrotaan tuntemattomaksi', () => {
  assert.equal(sniffVideo(new Uint8Array(box('ftyp', enc('qt  '), u32(0))), new Uint8Array(0)).container, 'mov');
  assert.equal(sniffVideo(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]), new Uint8Array(0)).container, 'webm/mkv');
  const text = sniffVideo(new Uint8Array(enc('tämä ei ole video')), new Uint8Array(0));
  assert.equal(text.container, 'tuntematon');
  assert.equal(describeSniff(text), 'säiliö tuntematon, koodekkeja ei löytynyt');
  assert.equal(describeSniff(sniffVideo(new Uint8Array(0), new Uint8Array(0))), 'tyhjä tiedosto');
});

test('sama koodekki alussa ja lopussa lasketaan kerran, eikä satunnainen data kaada', () => {
  const part = new Uint8Array([...box('ftyp', enc('mp42'), u32(0)), ...stsd('avc1')]);
  assert.deepEqual(sniffVideo(part, part).codecs, ['avc1']);
  const noise = new Uint8Array(5000).map((_, i) => (i * 97) % 251);
  assert.doesNotThrow(() => sniffVideo(noise, noise));
  // katkennut stsd aivan puskurin lopussa
  assert.deepEqual(sniffVideo(new Uint8Array([...enc('stsd'), 0, 0]), new Uint8Array(0)).codecs, []);
});

test('oikea testivideo: mp4 ja H.264', () => {
  const buf = fs.readFileSync(new URL('../fixtures/pose_squats.mp4', import.meta.url));
  const r = sniffVideo(new Uint8Array(buf.subarray(0, 2 << 20)), new Uint8Array(buf.subarray(Math.max(0, buf.length - (2 << 20)))));
  assert.equal(r.container, 'mp4');
  assert.ok(r.codecs.includes('avc1'), r.codecs.join(','));
});
