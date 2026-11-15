// Videon käsittelyvaihe, jota sekä mallin lisäys että analyysi käyttävät.
import { extractTrack, ExtractError } from '../pose/extract.js';
import { StoreFullError } from '../store/db.js';
import { COPY } from './copy.js';
import { h, setChildren } from './dom.js';

/** Tätä pienemmällä tunnistusosuudella videota ei hyväksytä. */
export const MIN_DETECTED_SHARE = 0.3;
/** Tätä pienemmällä osuudella palaute merkitään suuntaa-antavaksi. */
export const PARTLY_DETECTED_SHARE = 0.7;

export function errorText(e) {
  if (e instanceof ExtractError) {
    if (e.code === 'unsupported') return COPY.unsupported;
    if (e.code === 'too-long') return COPY.tooLong;
  }
  if (e instanceof StoreFullError) return COPY.storeFull;
  if (e && e.userMessage) return e.userMessage;
  return COPY.genericError;
}

/**
 * Pitää näytön päällä käsittelyn ajan. Jos puhelin lukittuu kesken, selain pysäyttää sivun
 * ja käsittely katkeaa. Palauttaa funktion, jolla lukko vapautetaan.
 */
async function holdScreenAwake() {
  let lock = null;
  let done = false;
  const acquire = async () => {
    if (done || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    try {
      lock = await navigator.wakeLock.request('screen');
    } catch { /* selain voi kieltäytyä esim. virransäästötilassa */ }
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') acquire(); // lukko raukeaa, kun sivu käy piilossa
  };
  document.addEventListener('visibilitychange', onVisible);
  await acquire();
  return () => {
    done = true;
    document.removeEventListener('visibilitychange', onVisible);
    lock?.release().catch(() => {});
    lock = null;
  };
}

/**
 * Näyttää etenemisen ja peruutuspainikkeen ja poimii liikeradan.
 * @param {HTMLElement} body näkymän sisältöalue, joka korvataan
 * @param {{getEngine(): Promise<any>, resetEngine?: () => void}} ctx
 * @param {Blob} file
 * @param {{start: number, end: number}} range
 * @param {{abort: (() => void)|null}} running näkymä voi perua käsittelyn tämän kautta
 * @returns {Promise<import('../core/skeleton.js').Track|null>} null, jos käyttäjä perui
 */
export async function runExtraction(body, ctx, file, range, running) {
  const controller = new AbortController();
  running.abort = () => controller.abort();
  const progress = h('progress', { 'aria-label': 'Käsittelyn eteneminen' });
  const status = h('p', { class: 'hint', role: 'status', text: 'Käynnistetään tunnistusta…' });
  setChildren(body, h('h2', { text: 'Käsitellään videota' }),
    progress,
    status,
    h('p', { class: 'hint', text: 'Pidä tämä sivu auki. Käsittely tapahtuu puhelimessasi ja voi kestää hetken.' }),
    h('button', { type: 'button', class: 'btn btn-block', onClick: () => controller.abort() }, 'Peruuta'),
  );
  const releaseScreen = await holdScreenAwake();
  try {
    let engine;
    try {
      engine = await ctx.getEngine();
    } catch {
      throw Object.assign(new Error(COPY.engineFailed), { userMessage: COPY.engineFailed });
    }
    return await extractTrack(file, engine, {
      start: range.start,
      end: range.end,
      signal: controller.signal,
      onProgress(done, total) {
        progress.max = total;
        progress.value = done;
        status.textContent = `Käsitelty ${done} / ${total} kuvaa`;
      },
    });
  } catch (e) {
    if (e instanceof ExtractError && e.code === 'aborted') return null;
    if (e instanceof ExtractError || e.userMessage) throw e;
    // Tunnistus kaatui kesken (esim. grafiikkayhteys katkesi taustalla käynnin jälkeen):
    // hylätään moottori, jotta seuraava yritys luo uuden.
    ctx.resetEngine?.();
    throw Object.assign(new Error(COPY.engineFailed), { userMessage: COPY.engineFailed });
  } finally {
    running.abort = null;
    releaseScreen();
  }
}
