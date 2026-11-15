// Kirjaston tallennus tähän selaimeen (IndexedDB). Jos tietokanta ei aukea,
// käytetään muistissa toimivaa versiota, jolloin tiedot säilyvät vain käyttökerran ajan.

const DB_NAME = 'tanssipeili';
const DB_VERSION = 1;
const PROTECTED_STYLE = 'muu';

const DEFAULT_STYLES = Object.freeze([
  { id: 'street', name: 'Street', order: 0 },
  { id: 'commercial', name: 'Commercial', order: 1 },
  { id: 'hiphop', name: 'Hip-hop', order: 2 },
  { id: PROTECTED_STYLE, name: 'Muu', order: 3 },
]);
const DEFAULT_SETTINGS = Object.freeze({ strictness: 'normaali' });

export class StoreFullError extends Error {
  constructor() {
    super('Tallennustila ei riittänyt.');
    this.name = 'StoreFullError';
  }
}

const byOrder = (a, b) => a.order - b.order || a.name.localeCompare(b.name, 'fi');
const byCreated = (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id.localeCompare(b.id));
const mapError = (e) => (e && e.name === 'QuotaExceededError' ? new StoreFullError() : e || new Error('Tallennus epäonnistui.'));
const splitVideo = (ref) => {
  const { video, ...meta } = ref;
  return { meta, video: video || null };
};

function openDb() {
  return new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      const styles = db.createObjectStore('styles', { keyPath: 'id' });
      db.createObjectStore('references', { keyPath: 'id' }).createIndex('styleId', 'styleId');
      db.createObjectStore('videos');
      db.createObjectStore('settings');
      for (const s of DEFAULT_STYLES) styles.put({ ...s });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Tietokanta on varattu.'));
  });
}

/** Ajaa työn yhdessä transaktiossa. Epäonnistuessaan transaktio perutaan kokonaan. */
function withTx(db, stores, mode, work) {
  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(stores, mode);
    } catch (e) {
      reject(mapError(e));
      return;
    }
    let result;
    let failure = null;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(mapError(failure || tx.error));
    tx.onerror = () => {
      failure = failure || tx.error;
    };
    try {
      result = work(tx);
    } catch (e) {
      failure = e;
      try {
        tx.abort();
      } catch {
        reject(mapError(e));
      }
    }
  });
}

const req = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

function idbStore(db) {
  return {
    persistent: true,

    async listStyles() {
      return (await req(db.transaction('styles').objectStore('styles').getAll())).sort(byOrder);
    },
    saveStyle(style) {
      return withTx(db, ['styles'], 'readwrite', (tx) => void tx.objectStore('styles').put({ id: style.id, name: style.name, order: style.order }));
    },
    async deleteStyle(id) {
      if (id === PROTECTED_STYLE) throw new Error('Lajia Muu ei voi poistaa.');
      return withTx(db, ['styles', 'references'], 'readwrite', (tx) => {
        const refs = tx.objectStore('references');
        const cursorReq = refs.index('styleId').openCursor(IDBKeyRange.only(id));
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor) return;
          cursor.update({ ...cursor.value, styleId: PROTECTED_STYLE });
          cursor.continue();
        };
        tx.objectStore('styles').delete(id);
      });
    },

    async listReferences(styleId) {
      const store = db.transaction('references').objectStore('references');
      const all = await req(styleId ? store.index('styleId').getAll(IDBKeyRange.only(styleId)) : store.getAll());
      return all.sort(byCreated);
    },
    async getReference(id) {
      const tx = db.transaction(['references', 'videos']);
      const [meta, video] = await Promise.all([
        req(tx.objectStore('references').get(id)),
        req(tx.objectStore('videos').get(id)),
      ]);
      return meta ? { ...meta, video: video || null } : null;
    },
    saveReference(ref) {
      const { meta, video } = splitVideo(ref);
      return withTx(db, ['references', 'videos'], 'readwrite', (tx) => {
        tx.objectStore('references').put(meta);
        if (video) tx.objectStore('videos').put(video, meta.id);
        else tx.objectStore('videos').delete(meta.id);
      });
    },
    deleteReference(id) {
      return withTx(db, ['references', 'videos'], 'readwrite', (tx) => {
        tx.objectStore('references').delete(id);
        tx.objectStore('videos').delete(id);
      });
    },

    async getSettings() {
      const saved = await req(db.transaction('settings').objectStore('settings').get('settings'));
      return { ...DEFAULT_SETTINGS, ...(saved || {}) };
    },
    saveSettings(settings) {
      return withTx(db, ['settings'], 'readwrite', (tx) => void tx.objectStore('settings').put({ ...settings }, 'settings'));
    },
  };
}

function memoryStore() {
  const styles = new Map(DEFAULT_STYLES.map((s) => [s.id, { ...s }]));
  const refs = new Map();
  const videos = new Map();
  let settings = { ...DEFAULT_SETTINGS };
  return {
    persistent: false,
    async listStyles() {
      return [...styles.values()].map((s) => ({ ...s })).sort(byOrder);
    },
    async saveStyle(style) {
      styles.set(style.id, { id: style.id, name: style.name, order: style.order });
    },
    async deleteStyle(id) {
      if (id === PROTECTED_STYLE) throw new Error('Lajia Muu ei voi poistaa.');
      for (const r of refs.values()) if (r.styleId === id) r.styleId = PROTECTED_STYLE;
      styles.delete(id);
    },
    async listReferences(styleId) {
      return [...refs.values()].filter((r) => !styleId || r.styleId === styleId).map((r) => ({ ...r })).sort(byCreated);
    },
    async getReference(id) {
      const meta = refs.get(id);
      return meta ? { ...meta, video: videos.get(id) || null } : null;
    },
    async saveReference(ref) {
      const { meta, video } = splitVideo(ref);
      refs.set(meta.id, meta);
      if (video) videos.set(meta.id, video);
      else videos.delete(meta.id);
    },
    async deleteReference(id) {
      refs.delete(id);
      videos.delete(id);
    },
    async getSettings() {
      return { ...settings };
    },
    async saveSettings(next) {
      settings = { ...next };
    },
  };
}

/**
 * @param {{forceMemory?: boolean}} [opts]
 * @returns {Promise<ReturnType<typeof idbStore>>}
 */
export async function openStore(opts = {}) {
  if (opts.forceMemory || typeof indexedDB === 'undefined') return memoryStore();
  try {
    return idbStore(await openDb());
  } catch {
    return memoryStore();
  }
}
