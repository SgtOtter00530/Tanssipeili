// Liikeradan käsittely: rajaus ja peilaus.
import { mirrorLandmarks } from './skeleton.js';

/**
 * Palauttaa välin [startSec, endSec) ja siirtää ajat alkamaan nollasta.
 * @param {import('./skeleton.js').Track} track
 * @returns {import('./skeleton.js').Track}
 */
export function sliceTrack(track, startSec, endSec) {
  const eps = 1e-9;
  const frames = track.frames
    .filter((f) => f.t >= startSec - eps && f.t < endSec - eps)
    .map((f, i) => ({ t: i / track.fps, lm: f.lm }));
  return { ...track, frames };
}

/**
 * @param {import('./skeleton.js').Track} track
 * @returns {import('./skeleton.js').Track}
 */
export function mirrorTrack(track) {
  return { ...track, frames: track.frames.map((f) => ({ t: f.t, lm: f.lm ? mirrorLandmarks(f.lm) : null })) };
}
