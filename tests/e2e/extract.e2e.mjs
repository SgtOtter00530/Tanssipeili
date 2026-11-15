import assert from 'node:assert/strict';
import { withPage, runTests } from './harness.mjs';

// Sivulla ajettava apu: hakee testitiedoston Blobiksi ja palauttaa virheen koodin.
const PRELUDE = `
  const { createEngine } = await import('/js/pose/engine.js');
  const X = await import('/js/pose/extract.js');
  const blob = async (name) => (await fetch('/tests/fixtures/' + name)).blob();
  const codeOf = async (fn) => { try { await fn(); return 'ei virhettä'; } catch (e) { return e instanceof X.ExtractError ? e.code : 'muu: ' + e; } };
`;
const run = (page, body) => page.evaluate(`(async () => { ${PRELUDE} ${body} })()`);

await runTests('extract', {
  'vakiot ja videon perustiedot': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/tests/e2e/blank.html`);
      const r = await run(page, `
        return { max: X.MAX_CLIP_SECONDS, fps: X.ANALYSIS_FPS, probe: await X.probeVideo(await blob('pose_squats.mp4')) };
      `);
      assert.equal(r.max, 120);
      assert.equal(r.fps, 10);
      assert.equal(r.probe.width, 720);
      assert.equal(r.probe.height, 1280);
      assert.ok(Math.abs(r.probe.duration - 13) < 0.3, `kesto ${r.probe.duration}`);
    }),

  'poimii liikeradan väliltä 2–6 s': () =>
    withPage(async ({ page, url, externalRequests }) => {
      await page.goto(`${url}/tests/e2e/blank.html`);
      const r = await run(page, `
        const engine = await createEngine();
        const progress = [];
        const track = await X.extractTrack(await blob('pose_squats.mp4'), engine, { start: 2, end: 6, onProgress: (d, t) => progress.push([d, t]) });
        return { track, progress, leftoverVideos: document.querySelectorAll('video').length };
      `);
      const { track, progress } = r;
      assert.equal(track.fps, 10);
      assert.equal(track.frames.length, 40);
      assert.equal(track.width, 720);
      assert.equal(track.height, 1280);
      assert.ok(track.frames.filter((f) => f.lm).length >= 36, 'henkilö löytyy vähintään 90 %:ssa kuvista');
      assert.ok(Math.abs(track.frames[10].t - 1.0) < 0.001);
      assert.equal(track.frames[0].t, 0);
      assert.equal(track.frames.find((f) => f.lm).lm.length, 33);
      assert.ok(progress.length >= 40);
      assert.deepEqual(progress.at(-1), [40, 40]);
      assert.equal(r.leftoverVideos, 0, 'apuvideo siivotaan pois');
      // Liike näkyy radassa: lantio käy kyykyssä alempana kuin seistessä.
      const hipY = track.frames.filter((f) => f.lm).map((f) => (f.lm[23].y + f.lm[24].y) / 2);
      assert.ok(Math.max(...hipY) - Math.min(...hipY) > 0.03, 'lantion korkeus vaihtelee');
      assert.equal(externalRequests.length, 0);
    }),

  'virhetilanteet: ei video, liian pitkä väli, peruutus': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/tests/e2e/blank.html`);
      const r = await run(page, `
        const engine = await createEngine();
        const squats = await blob('pose_squats.mp4');
        const notVideo = await blob('not-a-video.mp4');
        const ac = new AbortController();
        const calls = [];
        return {
          probeBad: await codeOf(() => X.probeVideo(notVideo)),
          extractBad: await codeOf(() => X.extractTrack(notVideo, engine)),
          tooLong: await codeOf(() => X.extractTrack(squats, engine, { start: 0, end: 121 })),
          aborted: await codeOf(() => X.extractTrack(squats, engine, { start: 0, end: 5, signal: ac.signal, onProgress: (d) => { calls.push(d); if (d === 3) ac.abort(); } })),
          framesBeforeAbort: calls.length,
          leftoverVideos: document.querySelectorAll('video').length,
        };
      `);
      assert.equal(r.probeBad, 'unsupported');
      assert.equal(r.extractBad, 'unsupported');
      assert.equal(r.tooLong, 'too-long');
      assert.equal(r.aborted, 'aborted');
      assert.equal(r.framesBeforeAbort, 3);
      assert.equal(r.leftoverVideos, 0);
    }),

  'video ilman ihmistä: ei virhettä, kaikki kuvat tyhjiä': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/tests/e2e/blank.html`);
      const frames = await run(page, `
        const engine = await createEngine();
        return (await X.extractTrack(await blob('no-person.mp4'), engine)).frames;
      `);
      assert.equal(frames.length, 20);
      assert.ok(frames.every((f) => f.lm === null));
    }),
});
