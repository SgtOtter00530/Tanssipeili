import assert from 'node:assert/strict';
import { withPage, runTests } from './harness.mjs';

await runTests('engine', {
  'löytää testikuvasta 33 pistettä ilman ulkoisia pyyntöjä': () =>
    withPage(async ({ page, url, externalRequests }) => {
      await page.goto(`${url}/tests/e2e/blank.html`);
      const result = await page.evaluate(async () => {
        const { createEngine } = await import('/js/pose/engine.js');
        const img = new Image();
        img.src = '/tests/fixtures/pose.jpg';
        await img.decode();
        const engine = await createEngine();
        const lm = await engine.detect(img);
        engine.close();
        return lm;
      });
      assert.equal(result.length, 33);
      assert.ok(result[0].v > 0.9);
      assert.deepEqual(Object.keys(result[0]).sort(), ['v', 'x', 'y']);
      assert.equal(externalRequests.length, 0);
    }),

  'palauttaa null, kun kuvassa ei ole ihmistä': () =>
    withPage(async ({ page, url }) => {
      await page.goto(`${url}/tests/e2e/blank.html`);
      const result = await page.evaluate(async () => {
        const { createEngine } = await import('/js/pose/engine.js');
        const c = document.createElement('canvas');
        c.width = 320;
        c.height = 480;
        c.getContext('2d').fillStyle = '#777';
        c.getContext('2d').fillRect(0, 0, 320, 480);
        const engine = await createEngine();
        return engine.detect(c);
      });
      assert.equal(result, null);
    }),
});
