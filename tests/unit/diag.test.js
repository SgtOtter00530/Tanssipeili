import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiag } from '../../js/core/diag.js';

const fakeStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
};

test('loki kirjaa tapahtumat ajan kanssa ja muotoilee ne riveiksi', () => {
  let now = Date.UTC(2026, 10, 15, 14, 3, 5, 120);
  const d = createDiag({ storage: fakeStorage(), now: () => now });
  d.log('video-auki', { leveys: 1080, korkeus: 1920, kesto: 12.5 });
  now += 1500;
  d.log('video-virhe', { vaihe: 'toisto', koodi: 3, viesti: 'PIPELINE_ERROR_DECODE' });
  const text = d.format();
  const lines = text.split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^\d{2}:\d{2}:\d{2}\.\d{3} video-auki leveys=1080 korkeus=1920 kesto=12\.5$/);
  assert.match(lines[1], /video-virhe vaihe=toisto koodi=3 viesti=PIPELINE_ERROR_DECODE$/);
  assert.equal(d.entries().length, 2);
});

test('loki säilyy tallennuksessa uudelleenlatauksen yli ja sen voi tyhjentää', () => {
  const storage = fakeStorage();
  const a = createDiag({ storage });
  a.log('käynnistys', { selain: 'testi' });
  const b = createDiag({ storage });
  assert.equal(b.entries().length, 1);
  assert.match(b.format(), /käynnistys selain=testi/);
  b.clear();
  assert.equal(createDiag({ storage }).entries().length, 0);
});

test('loki pitää vain viimeisimmät 200 tapahtumaa ja lyhentää pitkät arvot', () => {
  const d = createDiag({ storage: fakeStorage() });
  for (let i = 0; i < 230; i++) d.log('t', { i });
  assert.equal(d.entries().length, 200);
  assert.match(d.format().split('\n')[0], / i=30$/);
  d.log('pitkä', { viesti: 'x'.repeat(1000) });
  assert.ok(d.format().split('\n').at(-1).length < 400);
});

test('rikkinäinen tai puuttuva tallennus ei kaada lokia', () => {
  const broken = { getItem: () => '{ei jsonia', setItem: () => { throw new Error('täynnä'); }, removeItem: () => {} };
  const d = createDiag({ storage: broken });
  d.log('a', {});
  assert.equal(d.entries().length, 1);
  const none = createDiag({ storage: null });
  none.log('b', { arvo: undefined, tyhjä: null, olio: { x: 1 } });
  assert.match(none.format(), /b olio=\{"x":1\}$/);
});
