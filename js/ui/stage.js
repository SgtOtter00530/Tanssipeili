// Videon toisto, jonka päälle piirretään tikku-ukot. Käytössä esikatselussa ja analyysin tuloksessa.
import { ExtractError } from '../pose/extract.js';
import { h, formatClock } from './dom.js';

/**
 * @param {HTMLElement} container
 * @param {Blob} file
 * @param {{start: number, end: number, overlayId: string, draw: (ctx: CanvasRenderingContext2D, tRel: number, width: number, height: number) => void}} opts
 * @returns {Promise<{video: HTMLVideoElement, getTime(): number, seek(tRel: number): void, setMirrored(on: boolean): void, redraw(): void, destroy(): void}>}
 */
export async function mountStage(container, file, opts) {
  const url = URL.createObjectURL(file);
  const video = h('video', { playsinline: true, preload: 'auto' });
  video.playsInline = true;

  await new Promise((resolve, reject) => {
    const fail = () => {
      URL.revokeObjectURL(url);
      reject(new ExtractError('unsupported'));
    };
    const timer = setTimeout(fail, 10000);
    video.addEventListener('loadedmetadata', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    video.addEventListener('error', () => {
      clearTimeout(timer);
      fail();
    }, { once: true });
    video.src = url;
  });

  const width = video.videoWidth;
  const height = video.videoHeight;
  const start = opts.start;
  const end = Math.min(opts.end, video.duration);
  const length = Math.max(0.1, end - start);

  const canvas = h('canvas', { id: opts.overlayId, width, height, 'aria-hidden': 'true' });
  const ctx2d = canvas.getContext('2d');
  const frame = h('div', { class: 'stage-frame' }, video, canvas);
  frame.style.aspectRatio = `${width} / ${height}`;
  frame.style.width = `min(100%, calc(60vh * ${width} / ${height}))`;

  const playBtn = h('button', { type: 'button', class: 'btn stage-play' }, 'Toista');
  const scrub = h('input', { type: 'range', min: 0, max: Math.round(length * 10) / 10, step: 0.1, value: 0, 'aria-label': 'Kohta videossa' });
  const clock = h('span', { class: 'stage-clock', text: formatClock(0) });
  const el = h('div', { class: 'stage' }, frame, h('div', { class: 'stage-controls' }, playBtn, scrub, clock));
  container.append(el);

  let draw = opts.draw;
  let dirty = true;
  let lastTime = -1;
  let raf = 0;
  let destroyed = false;

  const relTime = () => Math.min(length, Math.max(0, video.currentTime - start));

  function tick() {
    if (destroyed) return;
    if (!video.paused && video.currentTime >= end - 0.02) video.currentTime = start; // pätkä toistuu
    const t = relTime();
    if (dirty || t !== lastTime) {
      ctx2d.clearRect(0, 0, width, height);
      draw(ctx2d, t, width, height);
      if (document.activeElement !== scrub) scrub.value = String(Math.round(t * 10) / 10);
      clock.textContent = formatClock(t);
      lastTime = t;
      dirty = false;
    }
    raf = requestAnimationFrame(tick);
  }

  playBtn.addEventListener('click', () => {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  });
  video.addEventListener('play', () => {
    playBtn.textContent = 'Tauko';
  });
  video.addEventListener('pause', () => {
    playBtn.textContent = 'Toista';
  });
  scrub.addEventListener('input', () => {
    video.currentTime = start + Number(scrub.value);
  });

  video.currentTime = Math.max(start, 0.001);
  raf = requestAnimationFrame(tick);

  return {
    video,
    getTime: relTime,
    seek(tRel) {
      video.currentTime = start + Math.min(length, Math.max(0, tRel));
      dirty = true;
    },
    setMirrored(on) {
      video.style.transform = on ? 'scaleX(-1)' : '';
    },
    redraw() {
      dirty = true;
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
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
