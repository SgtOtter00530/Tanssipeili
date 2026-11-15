// Sovelluksen käynnistys ja reititys. Näkymä vaihtuu osoitteen #-osan mukaan.
import { openStore } from './store/db.js';
import { createEngine } from './pose/engine.js';
import { COPY } from './ui/copy.js';

/** @typedef {{store: any, navigate(hash: string, params?: object): void, getEngine(): Promise<any>, resetEngine(): void, params: Record<string, any>, state: Record<string, any>}} AppContext */

const ROUTES = {
  kirjasto: { tab: 'kirjasto', load: () => import('./ui/library.js') },
  'lisaa-malli': { tab: 'kirjasto', load: () => import('./ui/add-reference.js') },
  analysoi: { tab: 'analysoi', load: () => import('./ui/analyze.js') },
  asetukset: { tab: 'asetukset', load: () => import('./ui/settings.js') },
};
const DEFAULT_ROUTE = 'kirjasto';

const viewRoot = document.getElementById('view');
const banner = document.getElementById('banner');
const tabs = [...document.querySelectorAll('nav.tabbar a')];

let cleanup = null;
let pendingParams = {};
let enginePromise = null;
let renderToken = 0;

/** @type {AppContext} */
const ctx = {
  store: null,
  params: {},
  state: { styleId: 'street', analysis: null },
  navigate(hash, params = {}) {
    pendingParams = params;
    if (location.hash === hash) scheduleRender();
    else location.hash = hash;
  },
  getEngine() {
    if (!enginePromise) {
      enginePromise = createEngine().catch((e) => {
        enginePromise = null;
        throw e;
      });
    }
    return enginePromise;
  },
  /** Hylkää nykyisen tunnistusmoottorin (esim. grafiikkayhteyden katkettua), jotta seuraava yritys luo uuden. */
  resetEngine() {
    const old = enginePromise;
    enginePromise = null;
    old?.then((engine) => engine.close()).catch(() => {});
  },
};

/** Näkymät piirretään yksi kerrallaan. Jos uusi vaihto ehtii jonoon, välivaiheet ohitetaan. */
let renderChain = Promise.resolve();
function scheduleRender() {
  const token = ++renderToken;
  renderChain = renderChain.then(() => renderRoute(token)).catch(() => {});
}

function showViewError() {
  viewRoot.replaceChildren(Object.assign(document.createElement('p'), { className: 'notice notice-error', textContent: COPY.genericError }));
}

async function renderRoute(token) {
  if (token !== renderToken) return; // jonossa on jo uudempi vaihto
  const name = location.hash.replace(/^#/, '');
  const route = ROUTES[name] || ROUTES[DEFAULT_ROUTE];
  ctx.params = pendingParams;
  pendingParams = {};
  for (const a of tabs) {
    if (a.getAttribute('href') === `#${route.tab}`) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  if (typeof cleanup === 'function') {
    try {
      cleanup();
    } catch { /* näkymän siivous ei saa estää vaihtoa */ }
  }
  cleanup = null;
  viewRoot.replaceChildren();
  window.scrollTo(0, 0);
  try {
    const mod = await route.load();
    cleanup = (await mod.render(viewRoot, ctx)) || null;
  } catch {
    showViewError();
  }
}

async function start() {
  ctx.store = await openStore();
  if (!ctx.store.persistent) {
    banner.textContent = COPY.notPersistent;
    banner.hidden = false;
  }
  window.addEventListener('hashchange', scheduleRender);
  scheduleRender();
}

start();
