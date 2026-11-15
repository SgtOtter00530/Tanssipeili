// Jaettu rajauskomponentti: video ja liukusäätimet pätkän alulle ja lopulle.
import { ExtractError } from '../pose/extract.js';
import { COPY } from './copy.js';
import { h, formatClock, formatDuration } from './dom.js';

const STEP = 0.1;
const MIN_CLIP_SECONDS = 1;
const round1 = (v) => Math.round(v * 10) / 10;

function loadVideo(video, url) {
  return new Promise((resolve, reject) => {
    const fail = () => {
      cleanup();
      reject(new ExtractError('unsupported'));
    };
    const ok = () => {
      cleanup();
      if (!(video.videoWidth > 0) || !Number.isFinite(video.duration) || !(video.duration > 0)) reject(new ExtractError('unsupported'));
      else resolve();
    };
    const timer = setTimeout(fail, 10000);
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener('loadedmetadata', ok);
      video.removeEventListener('error', fail);
    };
    video.addEventListener('loadedmetadata', ok);
    video.addEventListener('error', fail);
    video.src = url;
  });
}

/**
 * @param {HTMLElement} container
 * @param {Blob} file
 * @param {{maxSeconds: number, initial?: {start: number, end: number}}} opts
 * @returns {Promise<{getRange(): {start: number, end: number}, destroy(): void}>}
 */
export async function mountTrim(container, file, opts) {
  const url = URL.createObjectURL(file);
  const video = h('video', { class: 'trim-video', playsinline: true, preload: 'auto' });
  video.playsInline = true;
  try {
    await loadVideo(video, url);
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }

  const duration = Math.floor(video.duration * 10) / 10;
  const minLen = Math.min(MIN_CLIP_SECONDS, duration);
  const maxLen = opts.maxSeconds;
  let start = 0;
  let end = Math.min(duration, maxLen);
  if (opts.initial) {
    start = Math.min(Math.max(0, opts.initial.start), duration);
    end = Math.min(Math.max(start, opts.initial.end), duration);
  }

  const startInput = h('input', { type: 'range', id: 'trim-start', min: 0, max: duration, step: STEP });
  const endInput = h('input', { type: 'range', id: 'trim-end', min: 0, max: duration, step: STEP });
  const startOut = h('output', { for: 'trim-start' });
  const endOut = h('output', { for: 'trim-end' });
  const summary = h('p', { class: 'trim-summary' });
  const playBtn = h('button', { type: 'button', class: 'btn' }, 'Toista pätkä');

  function sync() {
    start = round1(start);
    end = round1(end);
    startInput.value = String(start);
    endInput.value = String(end);
    startOut.textContent = formatClock(start);
    endOut.textContent = formatClock(end);
    summary.textContent = `Valittu pätkä: ${formatDuration(end - start)}`;
  }

  // Liikutettu pää pysyy paikallaan, toinen pää joustaa tarvittaessa.
  function moveStart(value) {
    start = Math.min(Math.max(0, value), duration - minLen);
    if (end - start < minLen) end = Math.min(duration, start + minLen);
    if (end - start > maxLen) end = start + maxLen;
    sync();
    video.currentTime = start;
  }
  function moveEnd(value) {
    end = Math.max(Math.min(duration, value), minLen);
    if (end - start < minLen) start = Math.max(0, end - minLen);
    if (end - start > maxLen) start = end - maxLen;
    sync();
    video.currentTime = Math.max(0, end - 0.05);
  }

  startInput.addEventListener('input', () => moveStart(Number(startInput.value)));
  endInput.addEventListener('input', () => moveEnd(Number(endInput.value)));

  const onTime = () => {
    if (!video.paused && video.currentTime >= end) {
      video.pause();
      playBtn.textContent = 'Toista pätkä';
    }
  };
  video.addEventListener('timeupdate', onTime);
  playBtn.addEventListener('click', () => {
    if (!video.paused) {
      video.pause();
      playBtn.textContent = 'Toista pätkä';
      return;
    }
    video.currentTime = start;
    video.play().then(() => {
      playBtn.textContent = 'Pysäytä';
    }).catch(() => {});
  });

  const el = h('div', { class: 'trim' },
    h('div', { class: 'video-frame' }, video),
    video.duration > maxLen ? h('p', { class: 'notice notice-info', text: COPY.tooLong }) : null,
    h('div', { class: 'range-row' }, h('label', { for: 'trim-start', text: 'Alku' }), startInput, startOut),
    h('div', { class: 'range-row' }, h('label', { for: 'trim-end', text: 'Loppu' }), endInput, endOut),
    h('div', { class: 'trim-footer' }, summary, playBtn),
  );
  container.append(el);
  sync();
  video.currentTime = Math.max(start, 0.001);

  return {
    getRange: () => ({ start, end }),
    destroy() {
      video.removeEventListener('timeupdate', onTime);
      video.pause();
      video.removeAttribute('src');
      try {
        video.load();
      } catch { /* ei väliä */ }
      el.remove();
      URL.revokeObjectURL(url);
    },
  };
}
