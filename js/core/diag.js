// Vianmäärityksen loki. Pysyy tässä laitteessa: mitään ei lähetetä verkkoon.
// Käyttäjä voi lukea ja kopioida lokin asetuksista, jos jokin ei toimi.

const KEY = 'tanssipeili-diag';
const MAX_ENTRIES = 200;
const MAX_VALUE_LENGTH = 160;

const pad = (n, width = 2) => String(n).padStart(width, '0');

/**
 * @param {{storage?: {getItem(k: string): string|null, setItem(k: string, v: string): void, removeItem(k: string): void}|null, now?: () => number}} [opts]
 */
export function createDiag(opts = {}) {
  const storage = opts.storage ?? null;
  const now = opts.now || Date.now;
  let items = [];
  try {
    const parsed = JSON.parse(storage?.getItem(KEY) || '[]');
    if (Array.isArray(parsed)) items = parsed.slice(-MAX_ENTRIES);
  } catch { /* rikkinäinen loki aloitetaan alusta */ }

  const save = () => {
    try {
      storage?.setItem(KEY, JSON.stringify(items));
    } catch { /* loki toimii muistissa, vaikka tallennus ei onnistu */ }
  };

  return {
    /** @param {string} event @param {Record<string, any>} [data] */
    log(event, data = {}) {
      const clean = {};
      for (const [key, value] of Object.entries(data || {})) {
        if (value === undefined || value === null) continue;
        let text = typeof value === 'object' ? JSON.stringify(value) : String(value);
        if (text.length > MAX_VALUE_LENGTH) text = `${text.slice(0, MAX_VALUE_LENGTH)}…`;
        clean[key] = text;
      }
      items.push({ t: now(), e: event, d: clean });
      if (items.length > MAX_ENTRIES) items = items.slice(-MAX_ENTRIES);
      save();
    },
    entries: () => items.map((x) => ({ t: x.t, e: x.e, d: { ...x.d } })),
    /** Rivit muodossa "14:03:05.120 tapahtuma avain=arvo". */
    format() {
      return items.map((x) => {
        const d = new Date(x.t);
        const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
        const fields = Object.entries(x.d).map(([k, v]) => `${k}=${v}`).join(' ');
        return fields ? `${time} ${x.e} ${fields}` : `${time} ${x.e}`;
      }).join('\n');
    },
    clear() {
      items = [];
      try {
        storage?.removeItem(KEY);
      } catch { /* ei väliä */ }
    },
  };
}

function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // tallennus voi olla estetty
  }
}

/** Sovelluksen yhteinen loki. */
export const diag = createDiag({ storage: browserStorage() });
