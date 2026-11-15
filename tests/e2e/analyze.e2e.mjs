import assert from 'node:assert/strict';
import { withPage, runTests, fixture } from './harness.mjs';
import { visible, setTrim, canvasHasColor, waitForDrawing, addReference, strayTextNodes } from './flows.mjs';
import { COPY } from '../../js/ui/copy.js';

const rowText = async (page, name) =>
  (await page.locator('.summary-row', { has: page.locator('.summary-name', { hasText: name }) }).locator('.summary-value').textContent()).trim();

const storedVideoCount = (page) => page.evaluate(() => new Promise((res, rej) => {
  const open = indexedDB.open('tanssipeili');
  open.onsuccess = () => {
    const q = open.result.transaction('videos').objectStore('videos').count();
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  };
}));

async function analyzeVideo(page, file, start, end) {
  await page.locator('#pick-gallery').setInputFiles(fixture(file));
  await page.getByRole('button', { name: 'Analysoi', exact: true }).waitFor();
  if (start !== undefined) await setTrim(page, start, end);
  await page.getByRole('button', { name: 'Analysoi', exact: true }).click();
}

await runTests('analyze', {
  'tyhjä kirjasto ohjaa lisäämään mallin': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/#analysoi`);
      await page.getByRole('heading', { name: 'Analysoi' }).waitFor();
      assert.equal(await page.locator('nav.tabbar a[aria-current="page"]').textContent(), 'Analysoi');
      await visible(page, 'Kirjastossa ei ole vielä malleja');
      await page.getByRole('button', { name: 'Lisää malli' }).click();
      await page.getByRole('heading', { name: 'Lisää malli' }).waitFor();
    }),

  'mallin valinta lajin kautta ja kuvausohje': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/tests/e2e/blank.html`);
      await page.evaluate(async () => {
        const { openStore } = await import('/js/store/db.js');
        const s = await openStore();
        const track = { fps: 10, width: 720, height: 1280, frames: [{ t: 0, lm: null }] };
        await s.saveReference({ id: 'a', name: 'Kertosäe', styleId: 'commercial', mirrored: false, track, video: null, createdAt: '2026-11-15T10:00:00.000Z' });
        await s.saveReference({ id: 'b', name: 'Intro', styleId: 'hiphop', mirrored: false, track, video: null, createdAt: '2026-11-15T11:00:00.000Z' });
      });
      await page.goto(`${url}/#analysoi`);
      // oletuksena valittu Street on tyhjä, joten näytetään ensimmäinen laji, jossa on malleja
      await page.locator('.pick-ref', { hasText: 'Kertosäe' }).waitFor();
      await page.getByLabel('Laji').selectOption({ label: 'Hip-hop' });
      await page.locator('.pick-ref', { hasText: 'Intro' }).waitFor();
      assert.equal(await page.locator('.pick-ref').count(), 1);
      await page.locator('.pick-ref', { hasText: 'Intro' }).click();
      await visible(page, COPY.filmingGuide);
      await visible(page, 'Malli: Intro');
      assert.equal(await page.locator('#pick-camera').getAttribute('capture'), 'environment');
      assert.equal(await page.locator('#pick-camera').getAttribute('accept'), 'video/*');
      assert.equal(await page.locator('#pick-gallery').getAttribute('capture'), null);
      assert.equal(await page.getByText('Kuvaa nyt').count(), 1);
      assert.equal(await page.getByText('Valitse galleriasta').count(), 1);
      // mallin vaihto palaa valintaan
      await page.getByRole('button', { name: 'Vaihda malli' }).click();
      await page.locator('.pick-ref').first().waitFor();
      // virheellinen tiedosto
      await page.locator('.pick-ref').first().click();
      await page.locator('#pick-gallery').setInputFiles(fixture('not-a-video.mp4'));
      await visible(page, COPY.unsupported);
    }),

  'koko polku: sama pätkä, myöhässä aloitettu video ja video ilman tanssijaa': () =>
    withPage(async ({ page, url, externalRequests, pageErrors }) => {
      await page.goto(`${url}/`);
      await addReference(page, { start: 2, end: 8, name: 'Kyykkysarja', style: 'Hip-hop' });
      await page.getByRole('button', { name: 'Tallenna' }).click();
      const card = page.locator('.ref-card', { hasText: 'Kyykkysarja' });
      await card.waitFor();
      const videosBefore = await storedVideoCount(page);

      // 1) sama pätkä mallia vastaan, kirjaston Analysoi-painikkeesta
      await card.getByRole('button', { name: /Analysoi/ }).click();
      await visible(page, COPY.filmingGuide);
      await visible(page, 'Malli: Kyykkysarja');
      await analyzeVideo(page, 'pose_squats.mp4', 2, 8);
      await page.locator('.summary-row').first().waitFor({ timeout: 240000 });
      assert.equal(await rowText(page, 'Kädet'), '●●●● lähellä mallia');
      assert.equal(await rowText(page, 'Jalat'), '●●●● lähellä mallia');
      assert.equal(await rowText(page, 'Vartalo'), '●●●● lähellä mallia');
      assert.equal(await rowText(page, 'Ajoitus'), 'tahti pysyi tasaisena');
      assert.equal(await page.locator('.timeline-bar').count(), 60);
      await visible(page, COPY.honesty);
      assert.equal(await page.getByText(COPY.partlyDetected).count(), 0);
      assert.deepEqual(await strayTextNodes(page), [], 'sivulla ei näy tekstiä null, undefined tai NaN');
      await waitForDrawing(page, '#result-overlay', 500);
      assert.equal(await canvasHasColor(page, '#result-overlay', [46, 204, 113]), true, 'vihreää näkyy');
      assert.equal(await canvasHasColor(page, '#result-overlay', [80, 160, 255]), true, 'mallin ukko näkyy');
      assert.equal(await canvasHasColor(page, '#result-overlay', [231, 76, 60]), false, 'ei punaista samalla pätkällä');
      await page.getByLabel('Näytä malli').uncheck();
      await page.waitForTimeout(200);
      assert.equal(await canvasHasColor(page, '#result-overlay', [80, 160, 255]), false, 'malli piiloon');
      assert.equal(await canvasHasColor(page, '#result-overlay', [46, 204, 113]), true);
      // aikajanan napautus kelaa videon samaan kohtaan
      await page.locator('.timeline-bar').nth(30).click();
      await page.waitForFunction(() => Math.abs(document.querySelector('.stage video').currentTime - 5.0) < 0.15);
      assert.deepEqual(pageErrors, []);

      // tarkkuuden vaihto tulosnäkymässä laskee tuloksen heti uudelleen ja tallentuu
      await page.getByLabel('Tarkkuus').selectOption('tarkka');
      assert.equal(await page.locator('progress').count(), 0, 'videota ei käsitellä uudelleen');
      assert.equal(await page.locator('.timeline-bar').count(), 60);
      assert.equal(await page.locator('.summary-row').count(), 4);
      await page.waitForFunction(async () => {
        const { openStore } = await import('/js/store/db.js');
        return (await (await openStore()).getSettings()).strictness === 'tarkka';
      });
      await page.getByLabel('Tarkkuus').selectOption('normaali');

      // kämmenet ja jalkaterät: valinta tuo kaksi omaa riviä, muistetaan, eikä muuta muita rivejä
      const detail = page.getByLabel('Näytä kämmenet ja jalkaterät');
      assert.equal(await detail.isChecked(), false, 'oletuksena pois päältä');
      await detail.check();
      assert.equal(await page.locator('.summary-row').count(), 6);
      assert.match(await rowText(page, 'Kämmenet'), /lähellä mallia|eroja|ei pystytty arvioimaan/);
      assert.match(await rowText(page, 'Jalkaterät'), /lähellä mallia|eroja|ei pystytty arvioimaan/);
      assert.equal(await rowText(page, 'Kädet'), '●●●● lähellä mallia');
      assert.equal(await rowText(page, 'Jalat'), '●●●● lähellä mallia');
      assert.equal(await page.locator('progress').count(), 0, 'videota ei käsitellä uudelleen');
      await page.waitForFunction(async () => {
        const { openStore } = await import('/js/store/db.js');
        return (await (await openStore()).getSettings()).detail === true;
      });
      await detail.uncheck();
      assert.equal(await page.locator('.summary-row').count(), 4);

      // näkymästä poistuminen ei hävitä tulosta
      await page.locator('nav.tabbar a', { hasText: 'Asetukset' }).click();
      await visible(page, COPY.privacy);
      await page.locator('nav.tabbar a', { hasText: 'Analysoi' }).click();
      await page.locator('.summary-row').first().waitFor({ timeout: 5000 });
      await visible(page, 'Malli: Kyykkysarja');
      assert.equal(await page.locator('.timeline-bar').count(), 60);

      // punainen polku: sama oma video verrataan malliin, jossa kädet ovat suorina ylhäällä.
      // Mallin vaihto käyttää jo käsiteltyä omaa videota eikä käsittele sitä uudelleen.
      await page.evaluate(async () => {
        const { openStore } = await import('/js/store/db.js');
        const s = await openStore();
        const base = (await s.listReferences()).find((r) => r.name === 'Kyykkysarja');
        const frames = base.track.frames.map((f) => {
          if (!f.lm) return f;
          const lm = f.lm.map((p) => ({ ...p }));
          for (const [sh, el, wr] of [[11, 13, 15], [12, 14, 16]]) {
            lm[el] = { x: lm[sh].x, y: lm[sh].y - 0.1, v: 1 };
            lm[wr] = { x: lm[sh].x, y: lm[sh].y - 0.2, v: 1 };
          }
          return { t: f.t, lm };
        });
        await s.saveReference({ ...base, id: 'arms-up', name: 'Kädet ylhäällä', track: { ...base.track, frames }, video: null, createdAt: '2026-11-15T12:00:00.000Z' });
      });
      await page.getByRole('button', { name: 'Vaihda malli' }).click();
      await page.locator('.pick-ref', { hasText: 'Kädet ylhäällä' }).click();
      await page.locator('.summary-row').first().waitFor({ timeout: 5000 });
      await visible(page, 'Malli: Kädet ylhäällä');
      assert.equal(await rowText(page, 'Kädet'), '●○○○ paljon eroja');
      assert.match(await rowText(page, 'Jalat'), /lähellä mallia/);
      await waitForDrawing(page, '#result-overlay', 500);
      await page.locator('.timeline-bar').nth(20).click();
      await page.waitForTimeout(400);
      assert.equal(await canvasHasColor(page, '#result-overlay', [231, 76, 60]), true, 'kädet näkyvät punaisina');
      assert.equal(await canvasHasColor(page, '#result-overlay', [46, 204, 113]), true, 'jalat pysyvät vihreinä');
      const redBars = await page.locator('.timeline-fill').evaluateAll((els) => els.filter((e) => e.style.background.includes('231, 76, 60')).length);
      assert.ok(redBars >= 50, `aikajanalla punaisia palkkeja ${redBars}/60`);
      // takaisin alkuperäiseen malliin
      await page.getByRole('button', { name: 'Vaihda malli' }).click();
      await page.locator('.pick-ref', { hasText: 'Kyykkysarja' }).click();
      await page.locator('.summary-row').first().waitFor({ timeout: 5000 });
      assert.equal(await rowText(page, 'Kädet'), '●●●● lähellä mallia');

      // 2) oma video alkaa puoli sekuntia aiemmin: liike arvioidaan silti läheiseksi eikä rajausero näy ajoitusvirheenä.
      //    Samalla asetusten luku epäonnistuu käsittelyn jälkeen: tulos näytetään silti oletustarkkuudella.
      await page.getByRole('button', { name: 'Analysoi toinen video' }).click();
      await visible(page, 'Malli: Kyykkysarja');
      await page.evaluate(() => {
        const realGet = IDBObjectStore.prototype.get;
        IDBObjectStore.prototype.get = function (...args) {
          if (this.name === 'settings') throw new DOMException('suljettu', 'InvalidStateError');
          return realGet.apply(this, args);
        };
        window.__restoreGet = () => { IDBObjectStore.prototype.get = realGet; };
      });
      await analyzeVideo(page, 'pose_squats.mp4', 1.5, 8);
      await page.locator('.summary-row').first().waitFor({ timeout: 240000 });
      await page.evaluate(() => window.__restoreGet());
      assert.match(await rowText(page, 'Jalat'), /lähellä mallia/);
      assert.match(await rowText(page, 'Kädet'), /lähellä mallia/);
      assert.equal(await rowText(page, 'Ajoitus'), 'tahti pysyi tasaisena');
      assert.equal(await page.locator('.timeline-bar').count(), 65);
      await visible(page, COPY.timingHint);

      // 3) video ilman tanssijaa: selkeä viesti, ei tulosta
      await page.getByRole('button', { name: 'Analysoi toinen video' }).click();
      await analyzeVideo(page, 'no-person.mp4');
      await visible(page, COPY.noPerson, 240000);
      assert.equal(await page.locator('.summary-row').count(), 0);
      assert.equal(await page.locator('#result-overlay').count(), 0);

      // yksityisyys: omaa videota ei tallennettu, eikä mitään lähetetty ulos
      assert.equal(await storedVideoCount(page), videosBefore);
      assert.equal(externalRequests.length, 0);
      assert.deepEqual(pageErrors, []);
    }),
});
