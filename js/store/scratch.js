// Työkopio valitusta videosta sovelluksen omaan tallennustilaan.
//
// Puhelimen tiedostovalitsin antaa selaimelle vain viittauksen tiedostoon. Joissain puhelimissa
// selain ei saa samaa tiedostoa enää myöhemmin luettua, jolloin video lakkaa aukeamasta kesken käytön.
// Siksi tiedosto kopioidaan heti valinnan jälkeen kerran, ja kaikki myöhempi käyttö tapahtuu kopiosta.
// Kopio pysyy tässä laitteessa ja poistetaan, kun uusi video valitaan tai sovellus avataan uudelleen.
import { diag } from '../core/diag.js';

const DIR = 'tyokopiot';
const CHUNK_BYTES = 4 * 1024 * 1024;
/** Tätä suurempaa tiedostoa ei kopioida muistiin, jos oma tallennustila ei ole käytössä. */
const MEMORY_MAX_BYTES = 250 * 1024 * 1024;
const EXTENSIONS = /\.(mp4|m4v|mov|webm|mkv|3gp)$/i;

const names = new WeakMap();
let counter = 0;

/** Valittua tiedostoa ei saatu luettua laitteen muistista. */
export class SourceReadError extends Error {
  constructor(detail) {
    super('Tiedoston luku ei onnistunut.');
    this.name = 'SourceReadError';
    this.detail = detail;
  }
}

const describe = (e) => `${e && e.name ? e.name : 'virhe'}: ${e && e.message ? e.message : e}`;
const megabytes = (bytes) => (bytes / (1024 * 1024)).toFixed(1);

async function readChunk(file, offset) {
  try {
    return await file.slice(offset, Math.min(file.size, offset + CHUNK_BYTES)).arrayBuffer();
  } catch (e) {
    throw new SourceReadError(`${describe(e)} (kohdassa ${megabytes(offset)} / ${megabytes(file.size)} Mt)`);
  }
}

async function scratchDir(create) {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(DIR, { create });
}

async function copyToOpfs(file, onProgress) {
  const dir = await scratchDir(true);
  const ext = (EXTENSIONS.exec(file.name || '') || ['.mp4'])[0].toLowerCase();
  const name = `video-${Date.now()}-${++counter}${ext}`;
  const handle = await dir.getFileHandle(name, { create: true });
  let writable = null;
  try {
    writable = await handle.createWritable();
    for (let offset = 0; offset < file.size; offset += CHUNK_BYTES) {
      await writable.write(await readChunk(file, offset));
      onProgress?.(Math.min(file.size, offset + CHUNK_BYTES), file.size);
    }
    await writable.close();
    writable = null;
    const copy = await handle.getFile();
    if (copy.size !== file.size) throw new Error(`kopion koko ${copy.size} ei vastaa alkuperäistä ${file.size}`);
    names.set(copy, name);
    return { file: copy, name, where: 'opfs' };
  } catch (e) {
    try {
      await writable?.abort();
    } catch { /* ei väliä */ }
    await dir.removeEntry(name).catch(() => {});
    throw e;
  }
}

async function copyToMemory(file, onProgress) {
  const parts = [];
  for (let offset = 0; offset < file.size; offset += CHUNK_BYTES) {
    parts.push(await readChunk(file, offset));
    onProgress?.(Math.min(file.size, offset + CHUNK_BYTES), file.size);
  }
  return { file: new File(parts, 'video', { type: file.type || 'video/mp4' }), name: null, where: 'muisti' };
}

/**
 * Kopioi valitun tiedoston. Ensisijaisesti sovelluksen omaan tallennustilaan, muuten muistiin;
 * jos kumpikaan ei onnistu (hyvin suuri tiedosto), käytetään alkuperäistä.
 * @param {File} file
 * @param {{onProgress?: (done: number, total: number) => void}} [opts]
 * @returns {Promise<{file: File, name: string|null, where: 'opfs'|'muisti'|'alkuperäinen'}>}
 * @throws {SourceReadError} jos alkuperäistä tiedostoa ei saa luettua tai se on tyhjä
 */
export async function stashFile(file, opts = {}) {
  const t0 = performance.now();
  const done = (result, extra = {}) => {
    diag.log('video-kopio', { tila: 'ok', paikka: result.where, 'koko-mt': megabytes(file.size), ms: Math.round(performance.now() - t0), ...extra });
    return result;
  };
  if (!(file.size > 0)) {
    diag.log('video-kopio', { tila: 'virhe', tieto: 'tyhjä tiedosto' });
    throw new SourceReadError('tyhjä tiedosto (koko 0)');
  }
  let opfsError = '';
  try {
    return done(await copyToOpfs(file, opts.onProgress));
  } catch (e) {
    if (e instanceof SourceReadError) {
      diag.log('video-kopio', { tila: 'virhe', tieto: e.detail });
      throw e;
    }
    opfsError = describe(e); // oma tallennustila ei käytössä tai täynnä: kokeillaan muistia
  }
  if (file.size <= MEMORY_MAX_BYTES) {
    try {
      return done(await copyToMemory(file, opts.onProgress), { 'opfs-virhe': opfsError });
    } catch (e) {
      if (e instanceof SourceReadError) {
        diag.log('video-kopio', { tila: 'virhe', tieto: e.detail });
        throw e;
      }
      opfsError += ` | muisti: ${describe(e)}`;
    }
  }
  return done({ file, name: null, where: 'alkuperäinen' }, { 'opfs-virhe': opfsError });
}

/** Työkopion nimi tallennustilassa, tai null jos tiedosto ei ole sinne tehty kopio. */
export function scratchNameOf(file) {
  return (file && names.get(file)) || null;
}

/**
 * Poistaa työkopiot. Säilytettävät annetaan nimillä.
 * @param {(string|null|undefined)[]} [keep]
 */
export async function clearScratch(keep = []) {
  try {
    const dir = await scratchDir(false);
    const keepSet = new Set(keep.filter(Boolean));
    const remove = [];
    for await (const [name] of dir.entries()) if (!keepSet.has(name)) remove.push(name);
    await Promise.all(remove.map((name) => dir.removeEntry(name).catch(() => {})));
  } catch { /* kansiota ei ole tai tallennustila ei ole käytössä */ }
}
