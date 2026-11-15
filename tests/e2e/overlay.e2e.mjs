import assert from 'node:assert/strict';
import { withPage, runTests } from './harness.mjs';

// Sivulla: piirretään 360×640-canvasiin ja luetaan pikseleitä.
const PRELUDE = `
  const { drawSkeleton, COLORS } = await import('/js/render/overlay.js');
  const { poseFromAngles } = await import('/tests/unit/helpers.js');
  const { LM, SEGMENTS } = await import('/js/core/skeleton.js');
  const W = 360, H = 640;
  const make = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c.getContext('2d', { willReadFrequently: true }); };
  const px = (ctx, x, y) => [...ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data];
  const at = (lm, i) => ({ x: lm[i].x * W, y: lm[i].y * H });
  const mid = (lm, a, b) => ({ x: (lm[a].x + lm[b].x) / 2 * W, y: (lm[a].y + lm[b].y) / 2 * H });
  // Pystysuoran viivan leveys: lasketaan vaakarivin läpinäkymättömät pikselit keskikohdan ympäriltä.
  const widthAt = (ctx, p) => { const d = ctx.getImageData(Math.round(p.x) - 20, Math.round(p.y), 41, 1).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++; return n; };
  const countOpaque = (ctx, y0, y1) => { const d = ctx.getImageData(0, y0, W, y1 - y0).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; };
  const allLevels = (level, over = {}) => ({ ...Object.fromEntries(SEGMENTS.map((s) => [s.id, level])), ...over });
  const pose = poseFromAngles({});
`;
const run = (page, body) => page.evaluate(`(async () => { ${PRELUDE} ${body} })()`);
const isClose = (rgba, rgb, tol = 6) => rgb.every((v, i) => Math.abs(rgba[i] - v) <= tol) && rgba[3] > 200;

await runTests('overlay', {
  'tasojen värit ja paksuudet: punainen on paksumpi kuin keltainen ja vihreä': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/tests/e2e/blank.html`);
      const r = await run(page, `
        const ctx = make();
        drawSkeleton(ctx, pose, { width: W, height: H, variant: 'user', levels: allLevels('green', { lUpperArm: 'red', rUpperArm: 'yellow' }) });
        const red = mid(pose, LM.L_SHOULDER, LM.L_ELBOW), green = mid(pose, LM.R_HIP, LM.R_KNEE), yellow = mid(pose, LM.R_SHOULDER, LM.R_ELBOW);
        return {
          colors: COLORS,
          red: px(ctx, red.x, red.y), green: px(ctx, green.x, green.y), yellow: px(ctx, yellow.x, yellow.y),
          ...(() => {
            // Paksuuserot mitataan 720 px leveästä kuvasta (puhelinvideon tavallinen koko).
            const c = document.createElement('canvas'); c.width = 720; c.height = 1280;
            const big = c.getContext('2d', { willReadFrequently: true });
            drawSkeleton(big, pose, { width: 720, height: 1280, variant: 'user', levels: allLevels('green', { lUpperArm: 'red', rUpperArm: 'yellow' }) });
            const w = (p) => { const d = big.getImageData(Math.round(p.x * 2) - 30, Math.round(p.y * 2), 61, 1).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++; return n; };
            return { wRed: w(red), wGreen: w(green), wYellow: w(yellow), wRedSmall: widthAt(ctx, red), wGreenSmall: widthAt(ctx, green) };
          })(),
          elbowJoint: px(ctx, at(pose, LM.L_ELBOW).x, at(pose, LM.L_ELBOW).y),
          wristJoint: px(ctx, at(pose, LM.L_WRIST).x, at(pose, LM.L_WRIST).y),
        };
      `);
      assert.deepEqual(r.colors, { green: '#2ecc71', yellow: '#f1c40f', red: '#e74c3c', unknown: '#9aa0a6', ghost: 'rgba(80,160,255,0.75)' });
      assert.ok(isClose(r.red, [231, 76, 60]), `punainen ${r.red}`);
      assert.ok(isClose(r.green, [46, 204, 113]), `vihreä ${r.green}`);
      assert.ok(isClose(r.yellow, [241, 196, 15]), `keltainen ${r.yellow}`);
      assert.ok(r.wRed > r.wYellow && r.wYellow > r.wGreen, `leveydet ${r.wRed} ${r.wYellow} ${r.wGreen}`);
      assert.ok(r.wRedSmall > r.wGreenSmall, `pienessä kuvassa punainen on silti paksumpi: ${r.wRedSmall} ${r.wGreenSmall}`);
      // Kyynärpää liittyy punaiseen olkavarteen ja vihreään kyynärvarteen: huonompi taso voittaa.
      assert.ok(isClose(r.elbowJoint, [231, 76, 60]), `kyynärpää ${r.elbowJoint}`);
      assert.ok(isClose(r.wristJoint, [46, 204, 113]), `ranne ${r.wristJoint}`);
    }),

  'tuntematon segmentti on harmaa katkoviiva, ei punainen': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/tests/e2e/blank.html`);
      const r = await run(page, `
        const ctx = make();
        drawSkeleton(ctx, pose, { width: W, height: H, variant: 'user', levels: allLevels('green', { lThigh: 'unknown', lShin: 'unknown' }) });
        const a = at(pose, LM.L_HIP), b = at(pose, LM.L_KNEE);
        const samples = [];
        for (let k = 0.15; k <= 0.85; k += 0.01) samples.push(px(ctx, a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k));
        return { samples, knee: px(ctx, b.x, b.y) };
      `);
      const grey = r.samples.filter((p) => isClose(p, [154, 160, 166])).length;
      const gaps = r.samples.filter((p) => p[3] === 0).length;
      const red = r.samples.filter((p) => isClose(p, [231, 76, 60], 30)).length;
      assert.ok(grey > 10, `harmaita ${grey}`);
      assert.ok(gaps > 10, `katkoja ${gaps}`);
      assert.equal(red, 0);
      assert.ok(isClose(r.knee, [154, 160, 166]), `polvi, jonka kaikki segmentit ovat tuntemattomia: ${r.knee}`);
    }),

  'ilman tasoja oma ukko on valkoinen': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/tests/e2e/blank.html`);
      const r = await run(page, `
        const ctx = make();
        drawSkeleton(ctx, pose, { width: W, height: H, variant: 'user' });
        const m = mid(pose, LM.L_HIP, LM.L_KNEE);
        return px(ctx, m.x, m.y);
      `);
      assert.ok(isClose(r, [255, 255, 255]), `väri ${r}`);
    }),

  'mallin ukko on sininen ja jättää näkymättömät raajat piirtämättä': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/tests/e2e/blank.html`);
      const r = await run(page, `
        const full = make();
        drawSkeleton(full, pose, { width: W, height: H, variant: 'ghost' });
        const m = mid(pose, LM.L_HIP, LM.L_KNEE);
        const hidden = make();
        const noLegs = poseFromAngles({}, { hidden: [LM.L_KNEE, LM.R_KNEE, LM.L_ANKLE, LM.R_ANKLE] });
        drawSkeleton(hidden, noLegs, { width: W, height: H, variant: 'ghost' });
        const hipY = Math.round(pose[LM.L_HIP].y * H);
        return {
          thigh: px(full, m.x, m.y),
          fullLegPixels: countOpaque(full, hipY + 20, H), hiddenLegPixels: countOpaque(hidden, hipY + 20, H),
          hiddenUpperPixels: countOpaque(hidden, 0, hipY),
        };
      `);
      assert.ok(Math.abs(r.thigh[0] - 80) <= 6 && Math.abs(r.thigh[1] - 160) <= 6 && Math.abs(r.thigh[2] - 255) <= 6, `väri ${r.thigh}`);
      assert.ok(r.thigh[3] > 150 && r.thigh[3] < 230, `läpikuultava ${r.thigh[3]}`);
      assert.ok(r.fullLegPixels > 500);
      assert.equal(r.hiddenLegPixels, 0);
      assert.ok(r.hiddenUpperPixels > 500);
    }),

  'viivan leveys skaalautuu kuvan koon mukaan': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/tests/e2e/blank.html`);
      const r = await run(page, `
        const small = make();
        drawSkeleton(small, pose, { width: W, height: H, variant: 'user', levels: allLevels('green') });
        const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
        const big = c.getContext('2d');
        drawSkeleton(big, pose, { width: 1080, height: 1920, variant: 'user', levels: allLevels('green') });
        const m = mid(pose, LM.R_HIP, LM.R_KNEE);
        const d = big.getImageData(Math.round(m.x * 3) - 30, Math.round(m.y * 3), 61, 1).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++;
        return { small: widthAt(small, m), big: n };
      `);
      assert.ok(r.small >= 3 && r.small <= 4, `pieni ${r.small}`);
      assert.ok(r.big >= 8 && r.big <= 10, `iso ${r.big}`);
    }),
});
