// Jaetut käyttöpolut e2e-testeille.
import { fixture } from './harness.mjs';

export const visible = (page, text, timeout) => page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', ...(timeout ? { timeout } : {}) });

export async function setTrim(page, start, end) {
  await page.getByLabel('Alku', { exact: true }).fill(String(start));
  await page.getByLabel('Loppu', { exact: true }).fill(String(end));
  await page.getByLabel('Alku', { exact: true }).fill(String(start));
}

export async function canvasPixels(page, selector) {
  return page.evaluate((sel) => {
    const c = document.querySelector(sel);
    if (!c || !c.width) return { opaque: 0, colors: [] };
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let opaque = 0;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 0) {
        opaque++;
        if (d[i + 3] > 150) seen.add(`${d[i] >> 3},${d[i + 1] >> 3},${d[i + 2] >> 3}`);
      }
    }
    return { opaque, colors: [...seen] };
  }, selector);
}

/** Onko canvasissa annettua väriä (8 yksikön tarkkuudella per kanava). */
export async function canvasHasColor(page, selector, rgb) {
  const { colors } = await canvasPixels(page, selector);
  const key = rgb.map((v) => v >> 3);
  return colors.some((c) => {
    const p = c.split(',').map(Number);
    return p.every((v, i) => Math.abs(v - key[i]) <= 1);
  });
}

/** Lisää mallin sovelluksen kautta. Olettaa, että sovellus on auki. */
export async function addReference(page, { file = 'pose_squats.mp4', start, end, name, style, mirrored = false, keepVideo = true }) {
  await page.goto(new URL('#lisaa-malli', page.url()).href);
  await page.locator('#ref-file').setInputFiles(fixture(file));
  await page.getByRole('button', { name: 'Jatka' }).waitFor();
  await setTrim(page, start, end);
  await page.getByRole('button', { name: 'Jatka' }).click();
  await page.getByRole('heading', { name: 'Esikatselu' }).waitFor({ timeout: 240000 });
  if (mirrored) await page.getByLabel('Malli on peilikuva').check();
  if (!keepVideo) await page.getByLabel('Tallenna myös video puhelimeen').uncheck();
  await page.getByLabel('Nimi').fill(name);
  if (style) await page.getByLabel('Laji').selectOption({ label: style });
}

export async function storedReference(page, name) {
  return page.evaluate(async (n) => {
    const { openStore } = await import('/js/store/db.js');
    const s = await openStore();
    const meta = (await s.listReferences()).find((r) => r.name === n);
    if (!meta) return null;
    const full = await s.getReference(meta.id);
    return {
      id: full.id, styleId: full.styleId, mirrored: full.mirrored, clip: full.clip,
      frames: full.track.frames.length, fps: full.track.fps, width: full.track.width,
      detected: full.track.frames.filter((f) => f.lm).length,
      videoSize: full.video ? full.video.size : null,
      sample: full.track.frames[5].lm ? { l15: full.track.frames[5].lm[15], r16: full.track.frames[5].lm[16] } : null,
    };
  }, name);
}

/** Odottaa, että canvasiin on piirretty vähintään annettu määrä pikseleitä (piirto tapahtuu seuraavalla ruudunpäivityksellä). */
export async function waitForDrawing(page, selector, minOpaque = 500) {
  await page.waitForFunction(([sel, min]) => {
    const c = document.querySelector(sel);
    if (!c || !c.width) return false;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0 && ++n >= min) return true;
    return false;
  }, [selector, minOpaque], { timeout: 15000 });
}

/** Etsii sivulta tekstisolmut, joiden sisältö on ohjelmointivirheen jälki (null, undefined, NaN, [object Object]). */
export async function strayTextNodes(page) {
  return page.evaluate(() => {
    const bad = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode.nodeValue.trim();
      if (/^(null|undefined|NaN|\[object Object\])$/.test(text) || /\b(undefined|NaN)\b/.test(text)) bad.push(text);
    }
    return bad;
  });
}
