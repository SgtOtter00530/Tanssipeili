// Sovelluksen käynnistys ja reititys. Näkymä vaihtuu osoitteen #-osan mukaan.
import { openStore } from './store/db.js';
import { createEngine } from './pose/engine.js';
import { COPY } from './ui/copy.js';

/** @typedef {{store: any, navigate(hash: string, params?: object): void, getEngine(): Promise<any>, params: Record<string, any>, state: Record<string, any>}} AppContext */

const ROUTES = {
  kirjasto: { tab: 'kirjasto', load: () => import('./ui/library.js') },
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
  state: { styleId: 'street' },
  navigate(hash, params = {}) {
    pendingParams = params;
    if (location.hash === hash) renderRoute();
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
};

async function renderRoute() {
  const token = ++renderToken;
  const name = location.hash.replace(/^#/, '');
  const route = ROUTES[name] || ROUTES[DEFAULT_ROUTE];
  ctx.params = pendingParams;
  pendingParams = {};
  for (const a of tabs) {
    if (a.getAttribute('href') === `#${route.tab}`) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  let mod;
  try {
    mod = await route.load();
  } catch {
    if (token === renderToken) viewRoot.replaceChildren(Object.assign(document.createElement('p'), { className: 'notice notice-error', textContent: COPY.genericError }));
    return;
  }
  if (token !== renderToken) return;
  if (typeof cleanup === 'function') {
    try {
      cleanup();
    } catch { /* näkymän siivous ei saa estää vaihtoa */ }
  }
  cleanup = null;
  viewRoot.replaceChildren();
  window.scrollTo(0, 0);
  cleanup = (await mod.render(viewRoot, ctx)) || null;
}

async function start() {
  ctx.store = await openStore();
  if (!ctx.store.persistent) {
    banner.textContent = COPY.notPersistent;
    banner.hidden = false;
  }
  window.addEventListener('hashchange', renderRoute);
  await renderRoute();
}

start();
