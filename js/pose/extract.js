// Videotiedostosta liikeradaksi. Video avataan vain tässä selaimessa; mitään ei lähetetä verkkoon.

export const ANALYSIS_FPS = 10;
export const MAX_CLIP_SECONDS = 120;

const LOAD_TIMEOUT_MS = 30000;
const SEEK_TIMEOUT_MS = 10000;
const FRAME_READY_TIMEOUT_MS = 3000;

export class ExtractError extends Error {
  /**
   * @param {'unsupported'|'too-long'|'aborted'} code
   * @param {string} [message]
   * @param {string} [detail] tekninen lisätieto vianmääritystä varten
   */
  constructor(code, message, detail) {
    super(message || code);
    this.name = 'ExtractError';
    this.code = code;
    this.detail = detail || '';
  }
}

/** Selaimen ilmoittama videovirhe tekstinä, tai annettu varateksti. */
export function mediaErrorDetail(video, fallback) {
  const err = video.error;
  if (err) return `koodi ${err.code}${err.message ? `: ${err.message}` : ''}`;
  return `${fallback} (verkkotila ${video.networkState}, valmius ${video.readyState})`;
}

/** Avaa tiedoston piilotettuun videoelementtiin ja odottaa perustiedot. */
function openVideo(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('aria-hidden', 'true');
    video.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;';
    const url = URL.createObjectURL(file);
    const dispose = () => {
      video.removeAttribute('src');
      try {
        video.load();
      } catch { /* ei väliä */ }
      video.remove();
      URL.revokeObjectURL(url);
    };
    const fail = (detail) => {
      cleanup();
      dispose();
      reject(new ExtractError('unsupported', undefined, detail));
    };
    const onError = () => fail(mediaErrorDetail(video, 'virhe videon avauksessa'));
    const ok = () => {
      if (!(video.videoWidth > 0) || !Number.isFinite(video.duration) || !(video.duration > 0)) {
        return fail(`video ilman kuvaa tai kestoa (leveys ${video.videoWidth}, kesto ${video.duration})`);
      }
      cleanup();
      resolve({ video, dispose });
    };
    const timer = setTimeout(() => fail(mediaErrorDetail(video, 'aikakatkaisu videon avauksessa')), LOAD_TIMEOUT_MS);
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener('loadedmetadata', ok);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('loadedmetadata', ok);
    video.addEventListener('error', onError);
    document.body.appendChild(video);
    video.src = url;
  });
}

function seekTo(video, t) {
  return new Promise((resolve, reject) => {
    const max = Math.max(0, video.duration - 0.001);
    let target = Math.min(Math.max(0, t), max);
    // Sama aika ei välttämättä laukaise seeked-tapahtumaa, joten siirretään hiuksen verran.
    if (Math.abs(video.currentTime - target) < 1e-4) target = Math.min(target + 0.001, video.duration);
    const done = () => {
      cleanup();
      resolve();
    };
    const fail = (what) => {
      cleanup();
      reject(new ExtractError('unsupported', undefined, mediaErrorDetail(video, `${what} kohtaan ${target.toFixed(1)} s`)));
    };
    const onError = () => fail('virhe kelauksessa');
    const timer = setTimeout(() => fail('aikakatkaisu kelauksessa'), SEEK_TIMEOUT_MS);
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener('seeked', done);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('seeked', done);
    video.addEventListener('error', onError);
    video.currentTime = target;
  });
}

/**
 * Varmistaa, että videosta on purettu kuva ennen tunnistusta. Osa mobiiliselaimista ilmoittaa
 * kelauksen valmiiksi ennen kuin kuva on käytettävissä, jolloin tunnistus saisi tyhjän kuvan.
 */
function frameReady(video) {
  if (video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      video.removeEventListener('loadeddata', done);
      video.removeEventListener('canplay', done);
      resolve();
    };
    const timer = setTimeout(done, FRAME_READY_TIMEOUT_MS);
    video.addEventListener('loadeddata', done);
    video.addEventListener('canplay', done);
  });
}

/** Käynnistää ja pysäyttää äänettömän toiston kerran, jotta mobiiliselain alkaa purkaa kuvia. */
async function primeDecoder(video) {
  try {
    await video.play();
    video.pause();
  } catch { /* automaattinen toisto voi olla estetty; kelaus toimii useimmiten silti */ }
}

/**
 * @param {Blob} file
 * @returns {Promise<{duration: number, width: number, height: number}>}
 */
export async function probeVideo(file) {
  const { video, dispose } = await openVideo(file);
  try {
    return { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
  } finally {
    dispose();
  }
}

/**
 * @param {Blob} file
 * @param {{detect(source: HTMLVideoElement): Promise<import('../core/skeleton.js').Landmark[]|null>}} engine
 * @param {{start?: number, end?: number, fps?: number, onProgress?: (done: number, total: number) => void, onOpen?: (info: {width: number, height: number, duration: number}) => void, signal?: AbortSignal}} [opts]
 * @returns {Promise<import('../core/skeleton.js').Track>}
 */
export async function extractTrack(file, engine, opts = {}) {
  const fps = opts.fps ?? ANALYSIS_FPS;
  const start = Math.max(0, opts.start ?? 0);
  const checkAbort = () => {
    if (opts.signal?.aborted) throw new ExtractError('aborted');
  };
  checkAbort();
  const { video, dispose } = await openVideo(file);
  try {
    opts.onOpen?.({ width: video.videoWidth, height: video.videoHeight, duration: video.duration });
    const requestedEnd = opts.end ?? video.duration;
    if (requestedEnd - start > MAX_CLIP_SECONDS + 1e-6) throw new ExtractError('too-long');
    const end = Math.min(requestedEnd, video.duration);
    const total = Math.max(0, Math.round((end - start) * fps));
    const frames = [];
    if (total > 0) await primeDecoder(video);
    for (let i = 0; i < total; i++) {
      checkAbort();
      await seekTo(video, start + i / fps);
      await frameReady(video);
      checkAbort();
      const lm = await engine.detect(video);
      frames.push({ t: i / fps, lm });
      opts.onProgress?.(i + 1, total);
    }
    return { fps, width: video.videoWidth, height: video.videoHeight, frames };
  } finally {
    dispose();
  }
}
