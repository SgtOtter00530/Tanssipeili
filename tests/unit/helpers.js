// Testien apufunktiot: keinotekoisia asentoja ja liikeratoja tunnetuilla kulmilla.
import { LM } from '../../js/core/skeleton.js';

const DEFAULT_ANGLES = {
  torso: -90, head: -90,
  lUpperArm: 90, lForearm: 90, rUpperArm: 90, rForearm: 90,
  lThigh: 90, lShin: 90, rThigh: 90, rShin: 90,
};
const LEN = { torso: 0.25, head: 0.1, upperArm: 0.13, forearm: 0.12, thigh: 0.2, shin: 0.2 };

/**
 * Rakentaa 33 pisteen asennon segmenttikulmista (asteina, y kasvaa alaspäin, 90 = suoraan alas).
 * Oletus on seisova asento kädet alhaalla.
 * @param {Record<string, number>} [angles]
 * @param {{v?: number, hidden?: number[], aspect?: number}} [opts]
 */
export function poseFromAngles(angles = {}, opts = {}) {
  const a = { ...DEFAULT_ANGLES, ...angles };
  const v = opts.v ?? 1;
  const aspect = opts.aspect ?? 9 / 16;
  // Lasketaan yksiköissä, joissa kuvan korkeus on 1 ja leveys = aspect.
  const step = (p, deg, len) => {
    const r = (deg * Math.PI) / 180;
    return { x: p.x + Math.cos(r) * len, y: p.y + Math.sin(r) * len };
  };
  const hipC = { x: aspect / 2, y: 0.55 };
  const shC = step(hipC, a.torso, LEN.torso);
  const nose = step(shC, a.head, LEN.head);
  const pts = new Array(33).fill(null);
  pts[LM.NOSE] = nose;
  pts[LM.L_SHOULDER] = { x: shC.x + 0.07, y: shC.y };
  pts[LM.R_SHOULDER] = { x: shC.x - 0.07, y: shC.y };
  pts[LM.L_HIP] = { x: hipC.x + 0.05, y: hipC.y };
  pts[LM.R_HIP] = { x: hipC.x - 0.05, y: hipC.y };
  pts[LM.L_ELBOW] = step(pts[LM.L_SHOULDER], a.lUpperArm, LEN.upperArm);
  pts[LM.L_WRIST] = step(pts[LM.L_ELBOW], a.lForearm, LEN.forearm);
  pts[LM.R_ELBOW] = step(pts[LM.R_SHOULDER], a.rUpperArm, LEN.upperArm);
  pts[LM.R_WRIST] = step(pts[LM.R_ELBOW], a.rForearm, LEN.forearm);
  pts[LM.L_KNEE] = step(pts[LM.L_HIP], a.lThigh, LEN.thigh);
  pts[LM.L_ANKLE] = step(pts[LM.L_KNEE], a.lShin, LEN.shin);
  pts[LM.R_KNEE] = step(pts[LM.R_HIP], a.rThigh, LEN.thigh);
  pts[LM.R_ANKLE] = step(pts[LM.R_KNEE], a.rShin, LEN.shin);
  // Loput pisteet (kasvot, kädet, jalkaterät) lähimmän päänivelen kohdalle.
  const fill = (from, to, src) => {
    for (let i = from; i <= to; i++) if (!pts[i]) pts[i] = { ...pts[typeof src === 'function' ? src(i) : src] };
  };
  fill(1, 10, LM.NOSE);
  fill(17, 22, (i) => (i % 2 === 1 ? LM.L_WRIST : LM.R_WRIST));
  fill(29, 32, (i) => (i % 2 === 1 ? LM.L_ANKLE : LM.R_ANKLE));
  const hidden = new Set(opts.hidden || []);
  return pts.map((p, i) => ({ x: p.x / aspect, y: p.y, v: hidden.has(i) ? 0 : v }));
}

export const approx = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/** Liikerata, jossa vasen käsi nousee tasaisesti alhaalta sivun kautta ylös. */
export function sweepTrack(n, fps = 10) {
  const frames = [];
  for (let i = 0; i < n; i++) {
    const deg = 90 - (180 * i) / (n - 1);
    frames.push({ t: i / fps, lm: poseFromAngles({ lUpperArm: deg, lForearm: deg }) });
  }
  return { fps, width: 720, height: 1280, frames };
}

export const retime = (track) => ({ ...track, frames: track.frames.map((f, i) => ({ ...f, t: i / track.fps })) });

/** Lisää alkuun paikallaan pysyvän tauon (pad kuvaa). */
export function padStart(track, pad) {
  const hold = Array.from({ length: pad }, () => ({ t: 0, lm: track.frames[0].lm }));
  return retime({ ...track, frames: [...hold, ...track.frames] });
}

/** Sama rata, mutta annetut segmentit kulkevat koko ajan `delta` astetta sivussa (vain sweepTrackille). */
export function offsetSweep(n, deltas, fps = 10) {
  const frames = [];
  for (let i = 0; i < n; i++) {
    const deg = 90 - (180 * i) / (n - 1);
    const base = { lUpperArm: deg, lForearm: deg, rUpperArm: 90, rForearm: 90 };
    const angles = {};
    for (const k of Object.keys(base)) angles[k] = base[k] + (deltas[k] || 0);
    frames.push({ t: i / fps, lm: poseFromAngles(angles) });
  }
  return { fps, width: 720, height: 1280, frames };
}

/** Joka toinen kuva ilman tunnistettua henkilöä (share = 0.5) tai muu osuus. */
export function withNullFrames(track, share) {
  const every = Math.round(1 / share);
  return { ...track, frames: track.frames.map((f, i) => (i % every === 0 ? { t: f.t, lm: null } : f)) };
}

const LEG_POINTS = [LM.L_KNEE, LM.R_KNEE, LM.L_ANKLE, LM.R_ANKLE];
export function hideLegs(track) {
  return {
    ...track,
    frames: track.frames.map((f) => ({
      t: f.t,
      lm: f.lm && f.lm.map((p, i) => (LEG_POINTS.includes(i) ? { ...p, v: 0 } : p)),
    })),
  };
}

/** Kutistaa asennon kuvan keskipisteen suhteen ja siirtää sitä vaakasuunnassa. */
export function shrinkAndShift(lm, scale, dx) {
  return lm.map((p) => ({ x: 0.5 + (p.x - 0.5) * scale + dx, y: 0.5 + (p.y - 0.5) * scale, v: p.v }));
}
