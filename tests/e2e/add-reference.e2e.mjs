import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withPage, runTests, fixture } from './harness.mjs';
import { visible, setTrim, canvasHasColor, waitForDrawing, addReference, storedReference, strayTextNodes } from './flows.mjs';
import { COPY } from '../../js/ui/copy.js';

await runTests('add-reference', {
  'mallin lisäys: rajaus, käsittely, esikatselu ja tallennus lajin alle': () =>
    withPage(async ({ page, url, externalRequests, pageErrors }) => {
      await page.goto(`${url}/`);
      await page.locator('.chip[data-style]', { hasText: 'Hip-hop' }).click();
      await page.getByRole('button', { name: 'Lisää malli' }).click();
      await page.getByRole('heading', { name: 'Lisää malli' }).waitFor();
      await visible(page, COPY.privacy);
      await page.locator('#ref-file').setInputFiles(fixture('pose_squats.mp4'));
      await page.getByRole('button', { name: 'Jatka' }).waitFor();
      await setTrim(page, 2, 8);
      assert.match(await page.locator('.trim-summary').textContent(), /6 s/);
      await page.getByRole('button', { name: 'Jatka' }).click();
      await visible(page, 'Käsitellään');
      assert.equal(await page.locator('progress').count(), 1);
      await page.getByRole('heading', { name: 'Esikatselu' }).waitFor({ timeout: 240000 });
      await waitForDrawing(page, '#preview-overlay', 500); // tikku-ukko piirtyy esikatseluun
      assert.equal(await canvasHasColor(page, '#preview-overlay', [255, 255, 255]), true, 'esikatselun ukko on valkoinen');
      assert.deepEqual(await strayTextNodes(page), [], 'sivulla ei näy tekstiä null, undefined tai NaN');
      // oletukset: nimi tiedostosta, laji kirjastossa valittu, video tallennetaan
      assert.equal(await page.getByLabel('Nimi').inputValue(), 'pose_squats');
      assert.equal(await page.getByLabel('Laji').locator('option:checked').textContent(), 'Hip-hop');
      assert.equal(await page.getByLabel('Tallenna myös video puhelimeen').isChecked(), true);
      await visible(page, COPY.keepVideoHint);
      // nimi on pakollinen
      await page.getByLabel('Nimi').fill('  ');
      assert.equal(await page.getByRole('button', { name: 'Tallenna' }).isDisabled(), true);
      await page.getByLabel('Nimi').fill('Kyykkysarja');
      await page.getByRole('button', { name: 'Tallenna' }).click();
      await page.locator('.ref-card', { hasText: 'Kyykkysarja' }).waitFor();
      assert.equal(await page.locator('.chip[aria-pressed="true"]').textContent(), 'Hip-hop');
      const ref = await storedReference(page, 'Kyykkysarja');
      assert.equal(ref.frames, 60);
      assert.equal(ref.fps, 10);
      assert.equal(ref.styleId, 'hiphop');
      assert.equal(ref.mirrored, false);
      assert.deepEqual(ref.clip, { start: 2, end: 8 });
      assert.ok(ref.detected >= 54, `henkilö löytyi ${ref.detected}/60 kuvasta`);
      assert.equal(ref.videoSize, fs.statSync(fixture('pose_squats.mp4')).size);
      assert.equal(externalRequests.length, 0);
      assert.deepEqual(pageErrors, []);
    }),

  'peilattu malli ilman videota, ja tallennustilan loppuminen säilyttää lomakkeen': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/`);
      await addReference(page, { start: 2, end: 4, name: 'Suora' });
      await page.getByRole('button', { name: 'Tallenna' }).click();
      await page.locator('.ref-card', { hasText: 'Suora' }).waitFor();
      const plain = await storedReference(page, 'Suora');

      await addReference(page, { start: 2, end: 4, name: 'Peili', style: 'Street', mirrored: true });
      // Selain ilmoittaa tilan loppuneen videota tallennettaessa.
      await page.evaluate(() => {
        const realPut = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) {
          if (this.name === 'videos') throw new DOMException('täynnä', 'QuotaExceededError');
          return realPut.apply(this, args);
        };
      });
      await page.getByRole('button', { name: 'Tallenna' }).click();
      await visible(page, COPY.storeFull);
      assert.equal(await page.getByLabel('Nimi').inputValue(), 'Peili', 'lomake säilyy täytettynä');
      assert.equal(await storedReference(page, 'Peili'), null);
      // Neuvon mukaan ilman videota tallennus onnistuu.
      await page.getByLabel('Tallenna myös video puhelimeen').uncheck();
      await page.getByRole('button', { name: 'Tallenna' }).click();
      await page.locator('.ref-card', { hasText: 'Peili' }).waitFor();
      assert.match(await page.locator('.ref-card', { hasText: 'Peili' }).textContent(), /peilikuva/);
      const mirrored = await storedReference(page, 'Peili');
      assert.equal(mirrored.mirrored, true);
      assert.equal(mirrored.videoSize, null);
      assert.equal(mirrored.styleId, 'street');
      assert.equal(mirrored.frames, 20);
      assert.ok(Math.abs(mirrored.sample.l15.x - (1 - plain.sample.r16.x)) < 0.01, 'vasen ranne on peilattu oikeasta');
      assert.ok(Math.abs(mirrored.sample.l15.y - plain.sample.r16.y) < 0.01);
    }),

  'virhepolut: tiedosto ei ole video, video ilman tanssijaa': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/#lisaa-malli`);
      await page.locator('#ref-file').setInputFiles(fixture('not-a-video.mp4'));
      await visible(page, COPY.unsupported);
      assert.equal(await page.getByRole('button', { name: 'Jatka' }).count(), 0, 'pysytään tiedoston valinnassa');
      await page.locator('#ref-file').setInputFiles(fixture('no-person.mp4'));
      await page.getByRole('button', { name: 'Jatka' }).waitFor();
      assert.equal(await page.getByText(COPY.unsupported).count(), 0, 'vanha virhe poistuu');
      await page.getByRole('button', { name: 'Jatka' }).click();
      await page.getByRole('heading', { name: 'Esikatselu' }).waitFor({ timeout: 240000 });
      await visible(page, COPY.noPerson);
      assert.equal(await page.getByRole('button', { name: 'Tallenna' }).isDisabled(), true);
    }),

  'käsittelyn peruutus palauttaa rajaukseen samalla videolla': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/#lisaa-malli`);
      await page.locator('#ref-file').setInputFiles(fixture('pose_squats.mp4'));
      await page.getByRole('button', { name: 'Jatka' }).waitFor();
      await setTrim(page, 1, 9);
      await page.getByRole('button', { name: 'Jatka' }).click();
      await page.locator('progress').waitFor();
      await page.getByRole('button', { name: 'Peruuta' }).click();
      await page.getByRole('button', { name: 'Jatka' }).waitFor();
      assert.equal(await page.getByLabel('Alku', { exact: true }).inputValue(), '1');
      assert.equal(await page.getByLabel('Loppu', { exact: true }).inputValue(), '9');
      assert.equal(await page.getByRole('heading', { name: 'Esikatselu' }).count(), 0);
    }),

  'rajaus: väli pysyy vähintään sekunnin mittaisena ja videon sisällä': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/#lisaa-malli`);
      await page.locator('#ref-file').setInputFiles(fixture('pose_squats.mp4'));
      await page.getByRole('button', { name: 'Jatka' }).waitFor();
      const start = page.getByLabel('Alku', { exact: true });
      const end = page.getByLabel('Loppu', { exact: true });
      assert.equal(await start.inputValue(), '0');
      assert.equal(Number(await end.inputValue()), 13);
      await end.fill('5');
      await start.fill('4.8');
      assert.ok(Number(await end.inputValue()) - Number(await start.inputValue()) >= 1 - 1e-9, 'väli vähintään 1 s');
      assert.ok(Number(await end.inputValue()) <= 13);
    }),
});
