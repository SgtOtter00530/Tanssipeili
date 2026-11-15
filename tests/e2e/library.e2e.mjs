import assert from 'node:assert/strict';
import { withPage, runTests } from './harness.mjs';
import { COPY } from '../../js/ui/copy.js';

const chips = (page) => page.locator('.chip[data-style]').allTextContents();
const visible = (page, text) => page.getByText(text, { exact: false }).first().waitFor({ state: 'visible' });

async function addStyle(page, name) {
  await page.getByRole('button', { name: 'Lisää laji' }).click();
  await page.getByLabel('Lajin nimi').fill(name);
  await page.getByRole('button', { name: 'Tallenna' }).click();
  await page.locator('.chip[data-style]', { hasText: name }).waitFor();
}

// Tallentaa kaksi mallia suoraan kirjastoon ennen sovelluksen avaamista.
async function seed(page, url) {
  await page.goto(`${url}/tests/e2e/blank.html`);
  await page.evaluate(async () => {
    const { openStore } = await import('/js/store/db.js');
    const s = await openStore();
    const frames = Array.from({ length: 60 }, (_, i) => ({ t: i / 10, lm: null }));
    const base = { mirrored: false, track: { fps: 10, width: 720, height: 1280, frames }, video: null };
    await s.saveReference({ ...base, id: 'r1', name: 'Kertosäe', styleId: 'street', createdAt: '2026-11-15T10:00:00.000Z' });
    await s.saveReference({ ...base, id: 'r2', name: 'Intro', styleId: 'hiphop', mirrored: true, createdAt: '2026-11-15T11:00:00.000Z' });
  });
}

await runTests('library', {
  'kuori: navigaatio, oletuslajit ja tyhjän lajin teksti': () =>
    withPage(async ({ page, url, externalRequests, pageErrors }) => {
      await page.goto(`${url}/`);
      await page.locator('.chip[data-style]').first().waitFor();
      assert.deepEqual(await page.locator('nav.tabbar a').allTextContents(), ['Kirjasto', 'Analysoi', 'Asetukset']);
      assert.deepEqual(await chips(page), ['Street', 'Commercial', 'Hip-hop', 'Muu']);
      await visible(page, COPY.emptyStyle);
      assert.equal(await page.title(), 'Tanssipeili');
      assert.equal(await page.locator('html').getAttribute('lang'), 'fi');
      assert.equal(await page.locator('nav.tabbar a[aria-current="page"]').textContent(), 'Kirjasto');
      assert.equal(await page.getByRole('button', { name: 'Lisää malli' }).count(), 1);
      assert.equal(await page.locator('#banner').isVisible(), false);
      assert.equal(externalRequests.length, 0);
      assert.deepEqual(pageErrors, []);
    }),

  'lajien lisäys, nimeäminen ja poisto säilyvät uudelleenlatauksen yli': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/`);
      await page.locator('.chip[data-style]').first().waitFor();
      await addStyle(page, 'Dancehall');
      assert.deepEqual(await chips(page), ['Street', 'Commercial', 'Hip-hop', 'Muu', 'Dancehall']);
      await page.reload();
      await page.locator('.chip[data-style]', { hasText: 'Dancehall' }).waitFor();
      // nimeäminen
      await page.locator('.chip[data-style]', { hasText: 'Dancehall' }).click();
      await page.getByRole('button', { name: 'Nimeä uudelleen' }).click();
      await page.getByLabel('Lajin nimi').fill('Afro');
      await page.getByRole('button', { name: 'Tallenna' }).click();
      await page.locator('.chip[data-style]', { hasText: 'Afro' }).waitFor();
      // tyhjä nimi ei kelpaa
      await page.getByRole('button', { name: 'Lisää laji' }).click();
      await page.getByLabel('Lajin nimi').fill('   ');
      assert.equal(await page.getByRole('button', { name: 'Tallenna' }).isDisabled(), true);
      await page.getByRole('button', { name: 'Peruuta' }).click();
      // poisto vahvistuksella
      await page.locator('.chip[data-style]', { hasText: 'Afro' }).click();
      await page.getByRole('button', { name: 'Poista laji' }).click();
      await visible(page, 'Poistetaanko laji Afro?');
      await page.getByRole('button', { name: 'Poista', exact: true }).click();
      await page.locator('.chip[data-style]', { hasText: 'Afro' }).waitFor({ state: 'detached' });
      assert.deepEqual(await chips(page), ['Street', 'Commercial', 'Hip-hop', 'Muu']);
      // lajia Muu ei voi poistaa
      await page.locator('.chip[data-style]', { hasText: 'Muu' }).click();
      assert.equal(await page.getByRole('button', { name: 'Poista laji' }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Nimeä uudelleen' }).count(), 1);
    }),

  'mallit näkyvät oman lajinsa alla ja poistuvat vahvistuksen jälkeen': () =>
    withPage(async ({ page, url }) => {
      await seed(page, url);
      await page.goto(`${url}/`);
      const card = page.locator('.ref-card');
      await card.first().waitFor();
      assert.equal(await card.count(), 1);
      assert.match(await card.first().textContent(), /Kertosäe/);
      assert.match(await card.first().textContent(), /6 s/);
      await page.locator('.chip[data-style]', { hasText: 'Hip-hop' }).click();
      await page.locator('.ref-card', { hasText: 'Intro' }).waitFor();
      assert.match(await card.first().textContent(), /peilikuva/);
      assert.equal(await card.count(), 1);
      // peruttu poisto ei poista
      await card.first().getByRole('button', { name: 'Poista' }).click();
      await visible(page, 'Poistetaanko malli Intro?');
      await page.getByRole('button', { name: 'Peruuta' }).click();
      assert.equal(await card.count(), 1);
      await card.first().getByRole('button', { name: 'Poista' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Poista', exact: true }).click();
      await visible(page, COPY.emptyStyle);
      assert.equal(await card.count(), 0);
      // lajin poisto siirtää mallin lajiin Muu
      await page.locator('.chip[data-style]', { hasText: 'Street' }).click();
      await page.getByRole('button', { name: 'Poista laji' }).click();
      await visible(page, 'Mallit siirtyvät lajiin Muu');
      await page.getByRole('dialog').getByRole('button', { name: 'Poista', exact: true }).click();
      await page.locator('.chip[data-style]', { hasText: 'Muu' }).click();
      await page.locator('.ref-card', { hasText: 'Kertosäe' }).waitFor();
    }),

  'asetukset: rehellisyys- ja tietosuojatekstit, tarkkuus säilyy': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/#asetukset`);
      await visible(page, COPY.honesty);
      await visible(page, COPY.privacy);
      assert.equal(await page.locator('nav.tabbar a[aria-current="page"]').textContent(), 'Asetukset');
      assert.equal(await page.locator('input[name="strictness"]:checked').inputValue(), 'normaali');
      await page.getByLabel('Tarkka').check();
      await page.reload();
      await visible(page, COPY.honesty);
      assert.equal(await page.locator('input[name="strictness"]:checked').inputValue(), 'tarkka');
    }),

  'reititys: tuntematon osoite näyttää kirjaston, välilehdet vaihtavat näkymää': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/#olematon`);
      await page.locator('.chip[data-style]').first().waitFor();
      await page.locator('nav.tabbar a', { hasText: 'Asetukset' }).click();
      await visible(page, COPY.privacy);
      await page.locator('nav.tabbar a', { hasText: 'Kirjasto' }).click();
      await page.locator('.chip[data-style]').first().waitFor();
      assert.equal(await page.getByText(COPY.privacy).count(), 0);
    }),

  'kun tallennus ei toimi, sovellus kertoo sen ja toimii silti': () =>
    withPage(async ({ page, url }) => {
      await page.addInitScript(() => {
        indexedDB.open = () => {
          throw new DOMException('estetty', 'SecurityError');
        };
      });
      await page.goto(`${url}/`);
      await page.locator('.chip[data-style]').first().waitFor();
      assert.equal((await page.locator('#banner').textContent()).trim(), COPY.notPersistent);
      assert.equal(await page.locator('#banner').isVisible(), true);
      await addStyle(page, 'Dancehall');
      assert.equal((await chips(page)).length, 5);
    }),

  'kosketuskohteet vähintään 44 px eikä sivu vieritä sivusuunnassa 360 px leveänä': () =>
    withPage(async ({ page, url }) => {
      await seed(page, url);
      for (const hash of ['#kirjasto', '#asetukset']) {
        await page.goto(`${url}/${hash}`);
        await page.locator('h1').waitFor();
        await page.waitForTimeout(150);
        const r = await page.evaluate(() => {
          const els = [...document.querySelectorAll('button, a, select, label.option')].filter((e) => e.offsetParent !== null);
          const small = els.map((e) => ({ t: e.textContent.trim().slice(0, 20), h: e.getBoundingClientRect().height, w: e.getBoundingClientRect().width })).filter((x) => x.h < 44 || x.w < 44);
          return { small, count: els.length, overflow: document.documentElement.scrollWidth > window.innerWidth };
        });
        assert.ok(r.count >= 4, `${hash}: elementtejä ${r.count}`);
        assert.deepEqual(r.small, [], `${hash}: liian pienet kosketuskohteet`);
        assert.equal(r.overflow, false, `${hash}: sivusuuntainen vieritys`);
      }
    }, { viewport: { width: 360, height: 740 } }),
});
