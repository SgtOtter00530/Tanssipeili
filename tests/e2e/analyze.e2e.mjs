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
      assert.equal(await rowText(page, 'Ajoitus'), 'tahdissa');
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

      // 2) oma video alkaa puoli sekuntia aiemmin: liike arvioidaan silti läheiseksi
      await page.getByRole('button', { name: 'Analysoi toinen video' }).click();
      await visible(page, 'Malli: Kyykkysarja');
      await analyzeVideo(page, 'pose_squats.mp4', 1.5, 8);
      await page.locator('.summary-row').first().waitFor({ timeout: 240000 });
      assert.match(await rowText(page, 'Jalat'), /lähellä mallia/);
      assert.match(await rowText(page, 'Kädet'), /lähellä mallia/);
      assert.equal(await page.locator('.timeline-bar').count(), 65);

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
