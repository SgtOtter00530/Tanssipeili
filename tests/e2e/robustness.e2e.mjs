import assert from 'node:assert/strict';
import { withPage, runTests, fixture } from './harness.mjs';
import { visible, setTrim, addReference, storedReference } from './flows.mjs';
import { COPY } from '../../js/ui/copy.js';

await runTests('robustness', {
  'sisältökäytäntö estää yhteydet muualle kuin sovelluksen omaan osoitteeseen': () =>
    withPage(async ({ page, url, pageErrors }) => {
      await page.goto(`${url}/`);
      await page.locator('.chip[data-style]').first().waitFor();
      const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
      assert.match(csp, /default-src 'self'/);
      assert.match(csp, /connect-src 'self'/);
      const r = await page.evaluate(async () => {
        const violations = [];
        document.addEventListener('securitypolicyviolation', (e) => violations.push(e.violatedDirective));
        let fetchBlocked = false;
        try { await fetch('https://example.com/kerays', { mode: 'no-cors' }); } catch { fetchBlocked = true; }
        const img = new Image();
        const imgBlocked = await new Promise((res) => { img.onerror = () => res(true); img.onload = () => res(false); img.src = 'https://example.com/kuva.png'; });
        return { fetchBlocked, imgBlocked, violations };
      });
      assert.equal(r.fetchBlocked, true);
      assert.equal(r.imgBlocked, true);
      assert.ok(r.violations.length >= 2, `rikkomukset: ${r.violations}`);
      assert.deepEqual(pageErrors, []);
    }),

  'nopeat peräkkäiset näkymänvaihdot jättävät näkyviin vain viimeisen näkymän': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/`);
      await page.locator('.chip[data-style]').first().waitFor();
      // Vaihdetaan näkymää juuri kun edellinen on vielä lukemassa tietojaan (asetukset → kirjasto), useita kertoja.
      await page.evaluate(async () => {
        const tick = () => new Promise((res) => setTimeout(res, 0));
        for (let k = 0; k < 6; k++) {
          location.hash = '#asetukset';
          await tick();
          location.hash = '#analysoi';
          await tick();
          location.hash = '#kirjasto';
          await tick();
        }
      });
      await page.locator('.chip[data-style]').first().waitFor();
      await page.waitForTimeout(500);
      assert.equal(await page.locator('#view h1').count(), 1);
      assert.equal(await page.locator('#view h1').textContent(), 'Kirjasto');
      assert.equal(await page.getByText('Palautteen tarkkuus').count(), 0, 'asetusnäkymä ei jää kirjaston alle');
      assert.equal(await page.getByText('Kirjastossa ei ole vielä malleja').count(), 0, 'analyysinäkymä ei jää kirjaston alle');
      assert.equal(await page.locator('.chip-row').count(), 1);
      assert.equal(await page.locator('nav.tabbar a[aria-current="page"]').textContent(), 'Kirjasto');
    }),

  'toisto pysyy rajatussa pätkässä myös videon lopun jälkeen': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/tests/e2e/blank.html`);
      const r = await page.evaluate(async () => {
        const { mountStage } = await import('/js/ui/stage.js');
        const blob = await (await fetch('/tests/fixtures/pose_squats.mp4')).blob();
        const stage = await mountStage(document.body, blob, { start: 11, end: 13, overlayId: 'o', draw() {} });
        const v = stage.video;
        v.muted = true;
        // viedään video aivan loppuun ja odotetaan, että se päättyy
        v.currentTime = v.duration;
        await new Promise((res) => v.addEventListener('seeked', res, { once: true }));
        document.querySelector('.stage-play').click();
        const seen = [];
        for (let k = 0; k < 8; k++) { await new Promise((res) => setTimeout(res, 100)); seen.push(v.currentTime); }
        // kelataan pätkän ulkopuolelle ja painetaan toistoa
        v.pause();
        v.currentTime = 2;
        await new Promise((res) => v.addEventListener('seeked', res, { once: true }));
        document.querySelector('.stage-play').click();
        await new Promise((res) => setTimeout(res, 400));
        const afterOutside = v.currentTime;
        stage.destroy();
        return { seen, afterOutside };
      });
      assert.ok(r.seen.slice(2).every((t) => t >= 10.9 && t <= 13.05), `ajat lopun jälkeen: ${r.seen}`);
      assert.ok(r.afterOutside >= 10.9 && r.afterOutside <= 13.05, `aika ulkopuolelta: ${r.afterOutside}`);
    }),

  'käsittelyn aikana näyttö pidetään päällä, ja tallennusvirhe videon kanssa neuvoo kokeilemaan ilman': () =>
    withPage(async ({ page, url }) => {
      await page.addInitScript(() => {
        window.__lock = { requested: [], released: 0 };
        Object.defineProperty(navigator, 'wakeLock', {
          configurable: true,
          value: { request: async (type) => { window.__lock.requested.push(type); return { release: async () => { window.__lock.released++; } }; } },
        });
      });
      await page.goto(`${url}/`);
      await addReference(page, { start: 2, end: 3, name: 'Lyhyt' });
      const lock = await page.evaluate(() => window.__lock);
      assert.deepEqual(lock.requested, ['screen']);
      assert.equal(lock.released, 1, 'lukko vapautetaan käsittelyn jälkeen');
      // tiedoston koko näkyy videon tallennusvalinnan yhteydessä
      await visible(page, '0,5 Mt');
      // muu kuin tilan loppumisesta johtuva virhe videota tallennettaessa
      await page.evaluate(() => {
        const realPut = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) {
          if (this.name === 'videos') throw new DOMException('tuntematon', 'UnknownError');
          return realPut.apply(this, args);
        };
      });
      await page.getByRole('button', { name: 'Tallenna' }).click();
      await visible(page, COPY.saveFailedWithVideo);
      assert.equal(await page.getByLabel('Nimi').inputValue(), 'Lyhyt');
      assert.equal(await storedReference(page, 'Lyhyt'), null);
      await page.getByLabel('Tallenna myös video puhelimeen').uncheck();
      await page.getByRole('button', { name: 'Tallenna' }).click();
      await page.locator('.ref-card', { hasText: 'Lyhyt' }).waitFor();
    }),

  'virheen yhteydessä näkyy tekninen tieto, ja vianmäärityslokin voi lukea ja tyhjentää asetuksista': () =>
    withPage(async ({ page, url, externalRequests }) => {
      await page.goto(`${url}/#lisaa-malli`);
      await page.locator('#ref-file').setInputFiles(fixture('not-a-video.mp4'));
      await visible(page, COPY.unsupported);
      const detail = await page.locator('.error-detail').textContent();
      assert.match(detail, /^Tekninen tieto: .*(koodi|aikakatkaisu)/, detail);
      assert.match(detail, /tiedosto luettavissa, säiliö tuntematon/, detail);
      // onnistunut käsittely ja sen jälkeen toiston katkeaminen kesken esikatselun
      await page.locator('#ref-file').setInputFiles(fixture('pose_squats.mp4'));
      await page.getByRole('button', { name: 'Jatka' }).waitFor();
      await setTrim(page, 2, 3);
      await page.getByRole('button', { name: 'Jatka' }).click();
      await page.getByRole('heading', { name: 'Esikatselu' }).waitFor({ timeout: 120000 });
      await page.locator('.stage video').waitFor({ state: 'attached' });
      await page.locator('.stage-play').click();
      await page.waitForFunction(() => !document.querySelector('.stage video').paused);
      await page.locator('.stage-play').click();
      await page.evaluate(() => {
        document.querySelector('.stage video').src = URL.createObjectURL(new Blob(['rikki'], { type: 'video/mp4' }));
      });
      await visible(page, COPY.playbackFailed);
      assert.match(await page.locator('.error-detail').textContent(), /Tekninen tieto: .*koodi/);
      // loki asetuksissa
      await page.goto(`${url}/#asetukset`);
      await page.getByRole('heading', { name: 'Vianmääritys' }).waitFor();
      const log = await page.locator('#diag-log').inputValue();
      assert.match(log, /käynnistys .*selain=/);
      assert.match(log, /video-virhe vaihe=rajaus/);
      assert.match(log, /video-auki vaihe=rajaus leveys=720 korkeus=1280/);
      assert.match(log, /käsittely-valmis kuvia=10 tunnistettu=\d+ .*ms-per-kuva=\d+/);
      assert.match(log, /video-virhe vaihe=toisto/);
      assert.match(log, /video-auki vaihe=toisto leveys=720/);
      assert.match(log, /toisto-pyyntö kohta=[\d.]+ valmius=\d verkkotila=\d tauolla=true/);
      assert.match(log, /video-valittu käyttö=malli tyyppi=video\/mp4 koko-mt=0\.5/);
      assert.match(log, /tiedosto-tieto luku=ok sisältö=mp4 \(\w+\), koodekit avc1/);
      assert.match(log, /toistokyky .*h264=/);
      assert.match(log, /näyttölukko tila=/);
      assert.doesNotMatch(log, /pose_squats|not-a-video/, 'tiedostojen nimiä ei kirjata');
      assert.equal(await page.getByRole('button', { name: 'Kopioi loki' }).count(), 1);
      // loki säilyy uudelleenlatauksen yli ja tyhjenee pyydettäessä
      await page.reload();
      await page.getByRole('heading', { name: 'Vianmääritys' }).waitFor();
      assert.match(await page.locator('#diag-log').inputValue(), /video-virhe vaihe=toisto/);
      await page.getByRole('button', { name: 'Tyhjennä loki' }).click();
      assert.doesNotMatch(await page.locator('#diag-log').inputValue(), /video-virhe/);
      assert.equal(externalRequests.length, 0);
    }),

  'tunnistuksen kaatuminen kesken käsittelyn: selkeä viesti ja uusi yritys käynnistää tunnistuksen uudelleen': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/#lisaa-malli`);
      await page.locator('#ref-file').setInputFiles(fixture('pose_squats.mp4'));
      await page.getByRole('button', { name: 'Jatka' }).waitFor();
      await setTrim(page, 2, 3);
      // Ensimmäinen käsittely onnistuu ja lataa tunnistuksen.
      await page.getByRole('button', { name: 'Jatka' }).click();
      await page.getByRole('heading', { name: 'Esikatselu' }).waitFor({ timeout: 120000 });
      // Lasketaan, montako kertaa tunnistus luodaan, ja kaadetaan seuraava tunnistuskutsu kerran.
      await page.evaluate(() => {
        const Real = window.Pose;
        window.__poseCreated = 0;
        window.Pose = function (...args) { window.__poseCreated++; return new Real(...args); };
        const realSend = Real.prototype.send;
        let failed = false;
        Real.prototype.send = function (...args) {
          if (!failed) { failed = true; return Promise.reject(new Error('WebGL-yhteys katkesi')); }
          return realSend.apply(this, args);
        };
      });
      await page.getByRole('button', { name: 'Takaisin rajaukseen' }).click();
      await page.getByRole('button', { name: 'Jatka' }).click();
      await visible(page, COPY.engineFailed, 60000);
      await page.getByRole('button', { name: 'Jatka' }).waitFor();
      assert.equal(await page.getByRole('heading', { name: 'Esikatselu' }).count(), 0);
      // Uusi yritys luo tunnistuksen uudelleen eikä käytä kaatunutta.
      await page.getByRole('button', { name: 'Jatka' }).click();
      await page.getByRole('heading', { name: 'Esikatselu' }).waitFor({ timeout: 120000 });
      assert.equal(await page.evaluate(() => window.__poseCreated), 1);
    }),
});
