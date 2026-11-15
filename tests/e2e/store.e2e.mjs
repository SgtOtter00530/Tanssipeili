import assert from 'node:assert/strict';
import { withPage, runTests } from './harness.mjs';

const PRELUDE = `
  const DB = await import('/js/store/db.js');
  const track = { fps: 10, width: 720, height: 1280, frames: [{ t: 0, lm: null }, { t: 0.1, lm: null }] };
  const mkRef = (id, styleId, withVideo = true) => ({
    id, name: 'Malli ' + id, styleId, mirrored: false, track,
    video: withVideo ? new Blob([new Uint8Array(2048)], { type: 'video/mp4' }) : null,
    createdAt: new Date(2026, 10, 15, 12, 0, Number(id.replace(/\\D/g, '')) || 0).toISOString(),
  });
`;
const run = (page, body) => page.evaluate(`(async () => { ${PRELUDE} ${body} })()`);

await runTests('store', {
  'oletuslajit, mallin tallennus ja listaus ilman videoita': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/tests/e2e/blank.html`);
      const r = await run(page, `
        const s = await DB.openStore();
        const styles = await s.listStyles();
        await s.saveReference(mkRef('a1', 'street'));
        await s.saveReference(mkRef('b2', 'hiphop', false));
        const list = await s.listReferences();
        const got = await s.getReference('a1');
        return {
          persistent: s.persistent, styles,
          street: (await s.listReferences('street')).map((x) => x.id),
          listIds: list.map((x) => x.id), listHasVideo: list.some((x) => 'video' in x),
          videoSize: got.video.size, videoType: got.video.type, frames: got.track.frames.length,
          noVideo: (await s.getReference('b2')).video, missing: await s.getReference('zzz'),
          settings: await s.getSettings(),
        };
      `);
      assert.equal(r.persistent, true);
      assert.deepEqual(r.styles, [
        { id: 'street', name: 'Street', order: 0 }, { id: 'commercial', name: 'Commercial', order: 1 },
        { id: 'hiphop', name: 'Hip-hop', order: 2 }, { id: 'muu', name: 'Muu', order: 3 },
      ]);
      assert.deepEqual(r.street, ['a1']);
      assert.deepEqual(r.listIds, ['a1', 'b2']);
      assert.equal(r.listHasVideo, false);
      assert.equal(r.videoSize, 2048);
      assert.equal(r.videoType, 'video/mp4');
      assert.equal(r.frames, 2);
      assert.equal(r.noVideo, null);
      assert.equal(r.missing, null);
      assert.deepEqual(r.settings, { strictness: 'normaali' });
    }),

  'lajin poisto siirtää mallit lajiin Muu, eikä Muu-lajia voi poistaa': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/tests/e2e/blank.html`);
      const r = await run(page, `
        const s = await DB.openStore();
        await s.saveStyle({ id: 'oma', name: 'Oma laji', order: 4 });
        await s.saveReference(mkRef('c3', 'oma'));
        await s.deleteStyle('oma');
        let rejected = false;
        try { await s.deleteStyle('muu'); } catch { rejected = true; }
        await s.saveStyle({ id: 'street', name: 'Katutanssi', order: 0 });
        return {
          moved: (await s.getReference('c3')).styleId, videoKept: (await s.getReference('c3')).video.size,
          rejected, styles: (await s.listStyles()).map((x) => x.name),
        };
      `);
      assert.equal(r.moved, 'muu');
      assert.equal(r.videoKept, 2048);
      assert.equal(r.rejected, true);
      assert.deepEqual(r.styles, ['Katutanssi', 'Commercial', 'Hip-hop', 'Muu']);
    }),

  'tiedot säilyvät sivun uudelleenlatauksen yli, poisto poistaa myös videon': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/tests/e2e/blank.html`);
      await run(page, `
        const s = await DB.openStore();
        await s.saveReference(mkRef('a1', 'street'));
        await s.saveReference(mkRef('b2', 'street'));
        await s.saveSettings({ strictness: 'tarkka' });
      `);
      await page.reload();
      const r = await run(page, `
        const s = await DB.openStore();
        const before = (await s.listReferences()).map((x) => x.id);
        const settings = await s.getSettings();
        await s.deleteReference('a1');
        const videoKeys = await new Promise((res, rej) => {
          const open = indexedDB.open('tanssipeili');
          open.onsuccess = () => {
            const q = open.result.transaction('videos').objectStore('videos').getAllKeys();
            q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
          };
        });
        return { before, settings, after: (await s.listReferences()).map((x) => x.id), videoKeys, styles: (await s.listStyles()).length };
      `);
      assert.deepEqual(r.before, ['a1', 'b2']);
      assert.deepEqual(r.settings, { strictness: 'tarkka' });
      assert.deepEqual(r.after, ['b2']);
      assert.deepEqual(r.videoKeys, ['b2']);
      assert.equal(r.styles, 4, 'oletuslajeja ei luoda kahdesti');
    }),

  'tallennustilan loppuminen: StoreFullError, eikä aiempi kirjasto muutu': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/tests/e2e/blank.html`);
      const r = await run(page, `
        const s = await DB.openStore();
        await s.saveReference(mkRef('a1', 'street'));
        // Simuloidaan selaimen ilmoitus tilan loppumisesta videon tallennuksessa.
        const realPut = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) {
          if (this.name === 'videos') throw new DOMException('täynnä', 'QuotaExceededError');
          return realPut.apply(this, args);
        };
        let error = null;
        try { await s.saveReference(mkRef('b2', 'street')); } catch (e) { error = { full: e instanceof DB.StoreFullError, name: e.name }; }
        IDBObjectStore.prototype.put = realPut;
        return { error, ids: (await s.listReferences()).map((x) => x.id), a1video: (await s.getReference('a1')).video.size };
      `);
      assert.deepEqual(r.error, { full: true, name: 'StoreFullError' });
      assert.deepEqual(r.ids, ['a1'], 'puolivalmis malli ei jää kirjastoon');
      assert.equal(r.a1video, 2048);
    }),

  'muistiversio toimii samalla tavalla mutta ei ole pysyvä': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/tests/e2e/blank.html`);
      const r = await run(page, `
        const mem = await DB.openStore({ forceMemory: true });
        await mem.saveStyle({ id: 'oma', name: 'Oma', order: 4 });
        await mem.saveReference(mkRef('a1', 'oma'));
        await mem.deleteStyle('oma');
        let rejected = false;
        try { await mem.deleteStyle('muu'); } catch { rejected = true; }
        await mem.saveSettings({ strictness: 'salliva' });
        const list = await mem.listReferences('muu');
        return {
          persistent: mem.persistent, styles: (await mem.listStyles()).map((x) => x.id), moved: list.map((x) => x.id),
          listHasVideo: list.some((x) => 'video' in x), video: (await mem.getReference('a1')).video.size,
          rejected, settings: await mem.getSettings(),
          idbUntouched: !(await indexedDB.databases()).some((d) => d.name === 'tanssipeili'),
        };
      `);
      assert.equal(r.persistent, false);
      assert.deepEqual(r.styles, ['street', 'commercial', 'hiphop', 'muu']);
      assert.deepEqual(r.moved, ['a1']);
      assert.equal(r.listHasVideo, false);
      assert.equal(r.video, 2048);
      assert.equal(r.rejected, true);
      assert.deepEqual(r.settings, { strictness: 'salliva' });
      assert.equal(r.idbUntouched, true);
    }),

  'jos IndexedDB ei aukea, käytetään muistiversiota': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/tests/e2e/blank.html`);
      const r = await run(page, `
        indexedDB.open = () => { throw new DOMException('estetty', 'SecurityError'); };
        const s = await DB.openStore();
        return { persistent: s.persistent, styles: (await s.listStyles()).length };
      `);
      assert.deepEqual(r, { persistent: false, styles: 4 });
    }),
});
