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
      assert.match(r.err.detail, /uusintaa: NotReadableError/);
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

  'Androidissa videon valinta ohittaa järjestelmän kuvavalitsimen, muualla valinta on ennallaan': async () => {
    const ANDROID = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Mobile Safari/537.36';
    const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    const accepts = async (userAgent) => {
      let out;
      await withPage(async ({ page, url }) => {
        await page.goto(`${url}/tests/e2e/blank.html`);
        await page.evaluate(async () => {
          const { openStore } = await import('/js/store/db.js');
          const track = { fps: 10, width: 720, height: 1280, frames: [{ t: 0, lm: null }] };
          await (await openStore()).saveReference({ id: 'a', name: 'Malli', styleId: 'street', mirrored: false, track, video: null, createdAt: '2026-11-15T10:00:00.000Z' });
        });
        await page.goto(`${url}/#lisaa-malli`);
        const model = await page.locator('#ref-file').getAttribute('accept');
        await page.goto(`${url}/#analysoi`);
        await page.locator('.pick-ref').first().click();
        out = {
          model,
          gallery: await page.locator('#pick-gallery').getAttribute('accept'),
          camera: await page.locator('#pick-camera').getAttribute('accept'),
          capture: await page.locator('#pick-camera').getAttribute('capture'),
        };
      }, userAgent ? { userAgent } : {});
      return out;
    };
    const android = await accepts(ANDROID);
    assert.equal(android.model, 'video/*,application/x-tanssipeili');
    assert.equal(android.gallery, 'video/*,application/x-tanssipeili');
    assert.equal(android.camera, 'video/*', 'kameralla kuvaus ei käytä valitsinta');
    assert.equal(android.capture, 'environment');
    assert.deepEqual(await accepts(IPHONE), { model: 'video/*', gallery: 'video/*', camera: 'video/*', capture: 'environment' });
    assert.deepEqual(await accepts(null), { model: 'video/*', gallery: 'video/*', camera: 'video/*', capture: 'environment' });
  },

  'hetkellinen lukuvirhe korjaantuu uusimalla, pysyvä virhe kertoo kohdan': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/tests/e2e/blank.html`);
      const r = await run(page, `
        const { diag } = await import('/js/core/diag.js');
        const flaky = new File([await source.arrayBuffer()], 'horjuva.mp4', { type: 'video/mp4' });
        const realSlice = flaky.slice.bind(flaky);
        let failures = 2;
        flaky.slice = (...args) => (failures-- > 0
          ? { arrayBuffer: () => Promise.reject(new DOMException('The requested file could not be read, typically due to permission problems that have occurred after a reference to a file was acquired.', 'NotReadableError')) }
          : realSlice(...args));
        const ok = await S.stashFile(flaky);
        const okLog = diag.format().split('\\n').at(-1);
        const dead = new File(['x'.repeat(5000)], 'kuollut.mp4', { type: 'video/mp4' });
        let calls = 0;
        dead.slice = () => { calls++; return { arrayBuffer: () => Promise.reject(new DOMException('The requested file could not be read, typically due to permission problems that have occurred after a reference to a file was acquired.', 'NotReadableError')) }; };
        let detail = null;
        try { await S.stashFile(dead); } catch (e) { detail = e.detail; }
        return { where: ok.where, size: ok.file.size, sourceSize: source.size, okLog, calls, detail, errLog: diag.format().split('\\n').at(-1) };
      `);
      assert.equal(r.where, 'opfs');
      assert.equal(r.size, r.sourceSize);
      assert.match(r.okLog, /video-kopio tila=ok .*uusintoja=2/);
      assert.equal(r.calls, 4, 'yksi yritys ja kolme uusintaa');
      assert.match(r.detail, /^kohdassa 0\.0\/0\.0 Mt, 3 uusintaa: NotReadableError/);
      assert.ok(r.detail.length < 120, `tiivis: ${r.detail.length}`);
      assert.match(r.errLog, /video-kopio tila=virhe tieto=kohdassa 0\.0\/0\.0 Mt, 3 uusintaa: NotReadableError/);
    }),

  'lukuvirheen jälkeen tarjotaan valinta tiedostoselaimesta, ja sitä kautta valittu video toimii': () =>
    withPage(async ({ page, url }) => {
      await page.addInitScript(() => {
        window.__failReads = true;
        const realSlice = Blob.prototype.slice;
        Blob.prototype.slice = function (...args) {
          if (window.__failReads && this instanceof File && this.name === 'pose_squats.mp4') {
            return { arrayBuffer: () => Promise.reject(new DOMException('The requested file could not be read', 'NotReadableError')) };
          }
          return realSlice.apply(this, args);
        };
      });
      await page.goto(`${url}/#lisaa-malli`);
      assert.equal(await page.locator('#ref-file-any').count(), 0, 'varavalintaa ei näytetä ennen virhettä');
      await page.locator('#ref-file').setInputFiles(fixture('pose_squats.mp4'));
      await visible(page, COPY.readFailed);
      const any = page.locator('#ref-file-any');
      assert.equal(await any.count(), 1);
      assert.equal(await any.getAttribute('accept'), null, 'varavalinnassa ei ole tyyppirajausta, joten puhelin avaa tiedostoselaimen');
      assert.equal(await page.locator('label.file-btn', { hasText: 'Valitse tiedostoselaimesta' }).count(), 1);
      await page.evaluate(() => { window.__failReads = false; });
      await any.setInputFiles(fixture('pose_squats.mp4'));
      await page.getByRole('button', { name: 'Jatka' }).waitFor();
      assert.equal(await page.getByText(COPY.readFailed).count(), 0);
      const log = await page.evaluate(async () => (await import('/js/core/diag.js')).diag.format());
      assert.match(log, /video-valittu käyttö=malli tyyppi=video\/mp4 koko-mt=0\.5 nimi-muoto=muu valitsin=tavallinen/);
      assert.match(log, /video-valittu käyttö=malli .*valitsin=tiedostoselain/);
    }),

  'asetuksissa näkyy sovelluksen versio': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/#asetukset`);
      await page.getByRole('heading', { name: 'Vianmääritys' }).waitFor();
      assert.match(await page.locator('#app-version').textContent(), /^Versio \d{4}-\d{2}-\d{2}\.\d+$/);
      assert.match(await page.locator('#diag-log').inputValue(), /käynnistys versio=\d{4}-\d{2}-\d{2}\.\d+ /);
    }),
});
