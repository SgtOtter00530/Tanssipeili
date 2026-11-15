import assert from 'node:assert/strict';
import { withPage, runTests, fixture } from './harness.mjs';
import { visible, setTrim } from './flows.mjs';
import { COPY } from '../../js/ui/copy.js';

const PRELUDE = `
  const S = await import('/js/store/scratch.js');
  const source = new File([await (await fetch('/tests/fixtures/pose_squats.mp4')).blob()], 'oma video.MP4', { type: 'video/mp4' });
  const listScratch = async () => {
    const root = await navigator.storage.getDirectory();
    const names = [];
    try { const dir = await root.getDirectoryHandle('tyokopiot'); for await (const [name] of dir.entries()) names.push(name); } catch {}
    return names;
  };
  const loads = (file) => new Promise((res) => { const v = document.createElement('video'); v.onloadedmetadata = () => res(v.videoWidth); v.onerror = () => res('virhe ' + v.error.message); v.src = URL.createObjectURL(file); });
`;
const run = (page, body) => page.evaluate(`(async () => { ${PRELUDE} ${body} })()`);

await runTests('scratch', {
  'työkopio tehdään sovelluksen omaan tallennustilaan ja se on tavu tavulta sama': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/tests/e2e/blank.html`);
      const r = await run(page, `
        const progress = [];
        const stash = await S.stashFile(source, { onProgress: (done, total) => progress.push(done / total) });
        const a = new Uint8Array(await source.arrayBuffer());
        const b = new Uint8Array(await stash.file.arrayBuffer());
        let same = a.length === b.length;
        for (let i = 0; same && i < a.length; i += 997) same = a[i] === b[i];
        return { where: stash.where, name: stash.name, isOriginal: stash.file === source, size: stash.file.size, sourceSize: source.size, same,
          progressEnd: progress.at(-1), width: await loads(stash.file), listed: await listScratch() };
      `);
      assert.equal(r.where, 'opfs');
      assert.equal(r.isOriginal, false);
      assert.equal(r.size, r.sourceSize);
      assert.equal(r.same, true);
      assert.equal(r.progressEnd, 1);
      assert.equal(r.width, 720, 'kopio aukeaa videona');
      assert.deepEqual(r.listed, [r.name]);
      assert.match(r.name, /^video-\d+-\d+\.mp4$/, 'nimi ei sisällä alkuperäisen tiedoston nimeä');
    }),

  'siivous poistaa työkopiot, paitsi ne jotka pyydetään säilyttämään': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/tests/e2e/blank.html`);
      const r = await run(page, `
        const one = await S.stashFile(source);
        const two = await S.stashFile(source);
        const before = (await listScratch()).length;
        await S.clearScratch([two.name]);
        const kept = await listScratch();
        await S.clearScratch();
        return { before, kept, keptName: two.name, after: await listScratch(), different: one.name !== two.name };
      `);
      assert.equal(r.before, 2);
      assert.equal(r.different, true);
      assert.deepEqual(r.kept, [r.keptName]);
      assert.deepEqual(r.after, []);
    }),

  'jos oma tallennustila ei ole käytössä, kopio tehdään muistiin; jos lähdettä ei saa luettua, virhe kertoo sen': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/tests/e2e/blank.html`);
      const r = await run(page, `
        const realDir = navigator.storage.getDirectory;
        navigator.storage.getDirectory = () => Promise.reject(new DOMException('ei käytössä', 'SecurityError'));
        const mem = await S.stashFile(source);
        const memOk = { where: mem.where, name: mem.name, isOriginal: mem.file === source, size: mem.file.size, width: await loads(mem.file) };
        navigator.storage.getDirectory = realDir;
        const broken = new File(['x'.repeat(1000)], 'rikki.mp4', { type: 'video/mp4' });
        broken.slice = () => ({ arrayBuffer: () => Promise.reject(new DOMException('The requested file could not be read', 'NotReadableError')) });
        let err = null;
        try { await S.stashFile(broken); } catch (e) { err = { isSource: e instanceof S.SourceReadError, detail: e.detail }; }
        let empty = null;
        try { await S.stashFile(new File([], 'tyhja.mp4')); } catch (e) { empty = { isSource: e instanceof S.SourceReadError, detail: e.detail }; }
        return { memOk, err, empty, leftovers: await listScratch() };
      `);
      assert.deepEqual(r.memOk, { where: 'muisti', name: null, isOriginal: false, size: r.memOk.size, width: 720 });
      assert.equal(r.err.isSource, true);
      assert.match(r.err.detail, /NotReadableError/);
      assert.equal(r.empty.isSource, true);
      assert.match(r.empty.detail, /tyhjä tiedosto/);
      assert.deepEqual(r.leftovers, [], 'epäonnistunut kopio ei jää tallennustilaan');
    }),

  'sovellus ei avaa valittua alkuperäistä tiedostoa videona, vaan aina työkopion': () =>
    withPage(async ({ page, url, pageErrors }) => {
      await page.addInitScript(() => {
        window.__urlSources = [];
        const real = URL.createObjectURL.bind(URL);
        URL.createObjectURL = (obj) => { window.__urlSources.push({ name: obj && obj.name, size: obj && obj.size }); return real(obj); };
      });
      await page.goto(`${url}/#lisaa-malli`);
      await page.locator('#ref-file').setInputFiles(fixture('pose_squats.mp4'));
      await page.getByRole('button', { name: 'Jatka' }).waitFor();
      await setTrim(page, 2, 3);
      await page.getByRole('button', { name: 'Jatka' }).click();
      await page.getByRole('heading', { name: 'Esikatselu' }).waitFor({ timeout: 120000 });
      await page.locator('.stage video').waitFor({ state: 'attached' });
      assert.equal(await page.getByLabel('Nimi').inputValue(), 'pose_squats', 'oletusnimi tulee yhä alkuperäisestä tiedostosta');
      const sources = await page.evaluate(() => window.__urlSources);
      assert.ok(sources.length >= 3, `videoita avattiin ${sources.length} kertaa`);
      assert.ok(sources.every((s) => s.name !== 'pose_squats.mp4'), `avatut: ${JSON.stringify(sources)}`);
      assert.ok(sources.every((s) => s.size === sources[0].size));
      const log = await page.evaluate(async () => (await import('/js/core/diag.js')).diag.format());
      assert.match(log, /video-kopio tila=ok paikka=opfs koko-mt=0\.5 ms=\d+/);
      assert.deepEqual(pageErrors, []);
    }),

  'kun valittua videota ei saa luettua, sovellus sanoo sen selvästi': () =>
    withPage(async ({ page, url }) => {
      await page.addInitScript(() => {
        const realSlice = Blob.prototype.slice;
        Blob.prototype.slice = function (...args) {
          if (this instanceof File && this.name === 'pose_squats.mp4') {
            return { arrayBuffer: () => Promise.reject(new DOMException('The requested file could not be read', 'NotReadableError')) };
          }
          return realSlice.apply(this, args);
        };
      });
      await page.goto(`${url}/#lisaa-malli`);
      await page.locator('#ref-file').setInputFiles(fixture('pose_squats.mp4'));
      await visible(page, COPY.readFailed);
      assert.match(await page.locator('.error-detail').textContent(), /NotReadableError/);
      assert.equal(await page.getByRole('button', { name: 'Jatka' }).count(), 0);
      assert.equal(await page.locator('#ref-file').count(), 1, 'palataan tiedoston valintaan');
    }),

  'asetuksissa näkyy sovelluksen versio': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/#asetukset`);
      await page.getByRole('heading', { name: 'Vianmääritys' }).waitFor();
      assert.match(await page.locator('#app-version').textContent(), /^Versio \d{4}-\d{2}-\d{2}\.\d+$/);
      assert.match(await page.locator('#diag-log').inputValue(), /käynnistys versio=\d{4}-\d{2}-\d{2}\.\d+ /);
    }),
});
