// Jaettu e2e-testien apu: palvelin, selain ja ulkoisten pyyntöjen seuranta.
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../tools/serve.mjs';

const require = createRequire(import.meta.url);
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const fixture = (name) => path.join(ROOT, 'tests/fixtures', name);

/**
 * @param {(ctx: {page: any, url: string, externalRequests: string[], pageErrors: string[], browser: any}) => Promise<void>} fn
 * @param {{viewport?: {width: number, height: number}}} [opts]
 */
export async function withPage(fn, opts = {}) {
  const { chromium } = require('playwright');
  const server = await startServer(ROOT, 0);
  const browser = await chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--disable-background-networking', '--disable-sync', '--no-first-run'],
  });
  try {
    const context = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 }, ...(opts.userAgent ? { userAgent: opts.userAgent } : {}) });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const externalRequests = [];
    const pageErrors = [];
    page.on('request', (r) => {
      const u = r.url();
      if (!u.startsWith(server.url) && !u.startsWith('blob:') && !u.startsWith('data:')) externalRequests.push(u);
    });
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await fn({ page, url: server.url, externalRequests, pageErrors, browser });
  } finally {
    await browser.close();
    await server.close();
  }
}

/** Ajaa nimetyt testit peräkkäin ja tulostaa tuloksen. Palauttaa epäonnistuneiden määrän. */
export async function runTests(name, tests) {
  let failed = 0;
  for (const [title, fn] of Object.entries(tests)) {
    const t0 = Date.now();
    try {
      await fn();
      console.log(`  ok   ${name} › ${title} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    } catch (e) {
      failed++;
      console.log(`  FAIL ${name} › ${title}\n       ${String(e && e.stack ? e.stack : e).split('\n').slice(0, 6).join('\n       ')}`);
    }
  }
  if (failed) process.exitCode = 1;
  return failed;
}
