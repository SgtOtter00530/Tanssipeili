// Videon käsittelyvaihe, jota sekä mallin lisäys että analyysi käyttävät.
import { extractTrack, ExtractError } from '../pose/extract.js';
import { StoreFullError } from '../store/db.js';
import { diag } from '../core/diag.js';
import { sniffVideo, describeSniff } from '../core/sniff.js';
import { stashFile, clearScratch, scratchNameOf, SourceReadError } from '../store/scratch.js';
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
  if (e instanceof SourceReadError) return COPY.readFailed;
  if (e && e.userMessage) return e.userMessage;
  return COPY.genericError;
}

/** Tekninen lisätieto virheestä näytettäväksi käyttäjälle ja kirjattavaksi lokiin. */
export function errorDetail(e) {
  if (!e) return '';
  if (e.detail) return String(e.detail);
  if (e instanceof ExtractError) return '';
  return [e.name, e.message].filter(Boolean).join(': ');
}

/** Asettaa virheilmoituksen ja sen alle teknisen lisätiedon. Tyhjä teksti piilottaa ilmoituksen. */
export function setError(box, text, detail) {
  setChildren(box,
    text ? h('span', { text }) : null,
    text && detail ? h('span', { class: 'error-detail', text: `Tekninen tieto: ${detail}` }) : null);
  box.hidden = !text;
}

const SNIFF_BYTES = 2 * 1024 * 1024;
const PLAY_TYPES = {
  h264: 'video/mp4; codecs="avc1.640028"',
  hevc: 'video/mp4; codecs="hvc1.1.6.L120.90"',
  'hevc-10bit': 'video/mp4; codecs="hvc1.2.4.L120.90"',
  av1: 'video/mp4; codecs="av01.0.08M.08"',
  vp9: 'video/webm; codecs="vp09.00.40.08"',
};
let playSupportLogged = false;

/**
 * Selvittää, saako tiedoston luettua ja mitä se sisältää (säiliö ja koodekit).
 * Kun selain ei avaa videota, tästä näkee, onko syy tiedoston lukemisessa vai sen muodossa.
 * @param {Blob} file
 * @returns {Promise<string>} tiivis kuvaus
 */
export async function describeFile(file) {
  let text;
  try {
    const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
    const tail = file.size > SNIFF_BYTES ? new Uint8Array(await file.slice(Math.max(0, file.size - SNIFF_BYTES)).arrayBuffer()) : head;
    const content = describeSniff(sniffVideo(head, tail));
    diag.log('tiedosto-tieto', { luku: 'ok', sisältö: content });
    text = `tiedosto luettavissa, ${content}`;
  } catch (e) {
    const why = `${e && e.name}: ${e && e.message}`;
    diag.log('tiedosto-tieto', { luku: 'virhe', virhe: why });
    text = `tiedoston luku ei onnistunut (${why})`;
  }
  return text;
}

/** Kirjaa valitun tiedoston tyypin ja koon sekä selaimen toistokyvyn. Nimeä ei kirjata. */
export function logChosenFile(file, purpose) {
  diag.log('video-valittu', { käyttö: purpose, tyyppi: file.type || 'tuntematon', 'koko-mt': (file.size / (1024 * 1024)).toFixed(1) });
  if (!playSupportLogged) {
    playSupportLogged = true;
    const probe = document.createElement('video');
    const support = {};
    for (const [name, type] of Object.entries(PLAY_TYPES)) support[name] = probe.canPlayType(type) || 'ei';
    diag.log('toistokyky', support);
  }
}

/**
 * Tekee valitusta videosta työkopion ja näyttää sen ajan etenemisen. Kaikki myöhempi käyttö
 * (rajaus, käsittely, toisto, tallennus) tapahtuu kopiosta, ei puhelimen antamasta alkuperäisestä viittauksesta.
 * @param {HTMLElement} body
 * @param {{state: {analysis?: {file: Blob}|null}}} ctx
 * @param {File} picked
 * @param {string} purpose
 * @returns {Promise<File>}
 */
export async function openChosenFile(body, ctx, picked, purpose) {
  const progress = h('progress', { 'aria-label': 'Videon avaamisen eteneminen' });
  setChildren(body, h('h2', { text: 'Avataan videota' }), progress, h('p', { class: 'hint', role: 'status', text: 'Video kopioidaan sovelluksen käyttöön tässä puhelimessa.' }));
  logChosenFile(picked, purpose);
  // Aiemmat työkopiot poistetaan, paitsi se, jota näkyvissä pidettävä analyysin tulos vielä käyttää.
  await clearScratch([scratchNameOf(ctx.state?.analysis?.file)]);
  const stash = await stashFile(picked, {
    onProgress(done, total) {
      progress.max = total;
      progress.value = done;
    },
  });
  describeFile(stash.file); // kirjaa lokiin säiliön ja koodekit
  return stash.file;
}

/**
 * Pitää näytön päällä käsittelyn ajan. Jos puhelin lukittuu kesken, selain pysäyttää sivun
 * ja käsittely katkeaa. Palauttaa funktion, jolla lukko vapautetaan.
 */
async function holdScreenAwake() {
  let lock = null;
  let done = false;
  let reported = false;
  const report = (state) => {
    if (!reported) diag.log('näyttölukko', { tila: state });
    reported = true;
  };
  const acquire = async () => {
    if (done || document.visibilityState !== 'visible') return;
    if (!('wakeLock' in navigator)) return void report('ei-tuettu');
    try {
      lock = await navigator.wakeLock.request('screen');
      report('saatu');
    } catch (e) {
      report(`evätty ${e && e.name ? e.name : ''}`.trim()); // esim. virransäästötilassa
    }
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
  setChildren(body,
    h('h2', { text: 'Käsitellään videota' }),
    progress,
    status,
    h('p', { class: 'hint', text: 'Pidä tämä sivu auki. Käsittely tapahtuu puhelimessasi ja voi kestää hetken.' }),
    h('button', { type: 'button', class: 'btn btn-block', onClick: () => controller.abort() }, 'Peruuta'),
  );
  diag.log('käsittely-alku', { alku: range.start, loppu: range.end });
  const startedAt = performance.now();
  const releaseScreen = await holdScreenAwake();
  try {
    let engine;
    try {
      const t0 = performance.now();
      engine = await ctx.getEngine();
      diag.log('tunnistus-valmiina', { ms: Math.round(performance.now() - t0) });
    } catch (e) {
      throw Object.assign(new Error(COPY.engineFailed), { userMessage: COPY.engineFailed, detail: `tunnistuksen käynnistys: ${errorDetail(e)}` });
    }
    let extractStart = performance.now();
    const track = await extractTrack(file, engine, {
      start: range.start,
      end: range.end,
      signal: controller.signal,
      onOpen(info) {
        diag.log('video-auki', { vaihe: 'käsittely', leveys: info.width, korkeus: info.height, kesto: info.duration.toFixed(1) });
        extractStart = performance.now();
      },
      onProgress(done, total) {
        progress.max = total;
        progress.value = done;
        status.textContent = `Käsitelty ${done} / ${total} kuvaa`;
      },
    });
    const n = track.frames.length;
    diag.log('käsittely-valmis', {
      kuvia: n,
      tunnistettu: track.frames.filter((f) => f.lm).length,
      ms: Math.round(performance.now() - startedAt),
      'ms-per-kuva': n ? Math.round((performance.now() - extractStart) / n) : 0,
    });
    return track;
  } catch (e) {
    if (e instanceof ExtractError && e.code === 'aborted') {
      diag.log('käsittely-peruttu', { ms: Math.round(performance.now() - startedAt) });
      return null;
    }
    diag.log('käsittely-virhe', { tyyppi: e instanceof ExtractError ? e.code : e.name, tieto: errorDetail(e), ms: Math.round(performance.now() - startedAt) });
    if (e instanceof ExtractError || e.userMessage) throw e;
    // Tunnistus kaatui kesken (esim. grafiikkayhteys katkesi taustalla käynnin jälkeen):
    // hylätään moottori, jotta seuraava yritys luo uuden.
    ctx.resetEngine?.();
    throw Object.assign(new Error(COPY.engineFailed), { userMessage: COPY.engineFailed, detail: `tunnistus: ${errorDetail(e)}` });
  } finally {
    running.abort = null;
    releaseScreen();
  }
}
