// Kokonaisanalyysi: kohdistus, kuvakohtaiset tasot, aikajana, kehonosayhteenveto ja ajoitus.
import { SEGMENTS } from './skeleton.js';
import { segmentAngle, angleDiff, levelOf } from './compare.js';
import { findShift, alignTracks } from './dtw.js';

/** @typedef {{dots: 0|1|2|3|4, label: string}} GroupRating */
/** @typedef {{
 *   map: Int32Array,
 *   perFrame: {diffs: Record<string, number|null>, levels: Record<string, import('./skeleton.js').Level>, worst: number|null}[],
 *   timeline: (number|null)[],
 *   groups: {arms: GroupRating, legs: GroupRating, core: GroupRating},
 *   timing: {driftSec: number, shiftSec: number, label: string},
 *   detectedShare: number
 * }} Analysis */

/** Kohdistuksen rajat. Lähtöarvoja, säädetään oikeilla videoilla. */
// Ajallinen jousto ei saa olla suuri osa pätkästä: lyhyessä pätkässä rajat kiristyvät (osuus pätkän pituudesta).
export const ALIGN_RULES = Object.freeze({ maxShiftSec: 2, maxShiftShare: 0.15, bandSec: 0.5, bandShare: 0.08, warpPenaltyDeg: 6 });
/** Ryhmän arvio: heikoimman raajan vihreiden osuus tunnetuista havainnoista. */
export const GROUP_RULES = Object.freeze({ minKnownShare: 0.3, four: 0.85, three: 0.65, two: 0.4 });
/** Ajoituksen rajat sekunteina. */
export const TIMING_RULES = Object.freeze({ steady: 0.15, slight: 0.4 });

const NO_PERSON_COST = 90;

function anglesOf(frame, aspect) {
  if (!frame.lm) return null;
  return SEGMENTS.map((seg) => segmentAngle(frame.lm, seg, aspect));
}

function diffsOf(ua, ra) {
  const diffs = {};
  SEGMENTS.forEach((seg, k) => {
    diffs[seg.id] = ua && ra && ua[k] !== null && ra[k] !== null ? angleDiff(ua[k], ra[k]) : null;
  });
  return diffs;
}

function pairCost(ua, ra) {
  if (!ua || !ra) return NO_PERSON_COST;
  let sum = 0;
  let n = 0;
  for (let k = 0; k < ua.length; k++) {
    if (ua[k] !== null && ra[k] !== null) {
      sum += angleDiff(ua[k], ra[k]);
      n++;
    }
  }
  return n ? sum / n : NO_PERSON_COST;
}

/**
 * Ryhmän arvio lasketaan raajoittain ja heikoin raaja ratkaisee. Näin yksi koko ajan
 * väärässä asennossa oleva raaja ei huku muiden hyvien joukkoon.
 */
function rateGroup(perFrame, group) {
  const ids = SEGMENTS.filter((s) => s.group === group).map((s) => s.id);
  const total = perFrame.length;
  let weakest = null;
  for (const id of ids) {
    let known = 0;
    let green = 0;
    for (const f of perFrame) {
      const level = f.levels[id];
      if (level !== 'unknown') known++;
      if (level === 'green') green++;
    }
    if (!total || known / total < GROUP_RULES.minKnownShare) continue; // tätä raajaa ei nähty tarpeeksi
    const share = green / known;
    if (weakest === null || share < weakest) weakest = share;
  }
  if (weakest === null) return { dots: 0, label: 'ei pystytty arvioimaan' };
  if (weakest >= GROUP_RULES.four) return { dots: 4, label: 'lähellä mallia' };
  if (weakest >= GROUP_RULES.three) return { dots: 3, label: 'lähellä mallia' };
  if (weakest >= GROUP_RULES.two) return { dots: 2, label: 'eroja' };
  return { dots: 1, label: 'paljon eroja' };
}

const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Ajoitus kertoo vain, muuttuiko tahti pätkän aikana. Alun eroa ei voi mitata, koska
 * pätkät rajataan käsin; se sisältyy siirtymään (shiftSec), eikä sitä esitetä virheenä.
 */
function timingOf(map, shift, fps) {
  const lags = [];
  for (let i = 0; i < map.length; i++) {
    if (map[i] >= 0) lags.push((i + shift - map[i]) / fps); // positiivinen = jäljessä mallista
  }
  const third = Math.floor(lags.length / 3);
  const drift = third >= 1 ? median(lags.slice(lags.length - third)) - median(lags.slice(0, third)) : 0;
  const abs = Math.abs(drift);
  let label = 'tahti pysyi tasaisena';
  if (abs >= TIMING_RULES.steady) {
    const amount = abs > TIMING_RULES.slight ? 'selvästi' : 'hieman';
    label = drift > 0 ? `jäit loppua kohti ${amount} jälkeen` : `nopeutit loppua kohti ${amount}`;
  }
  return { driftSec: drift, shiftSec: shift / fps, label };
}

/**
 * @param {import('./skeleton.js').Track} userTrack
 * @param {import('./skeleton.js').Track} refTrack
 * @param {import('./skeleton.js').Strictness} strictness
 * @returns {Analysis}
 */
export function analyze(userTrack, refTrack, strictness) {
  const fps = userTrack.fps;
  const uAspect = userTrack.width / userTrack.height;
  const rAspect = refTrack.width / refTrack.height;
  const uAngles = userTrack.frames.map((f) => anglesOf(f, uAspect));
  const rAngles = refTrack.frames.map((f) => anglesOf(f, rAspect));
  const shorter = Math.min(uAngles.length, rAngles.length);
  const maxShift = Math.min(Math.round(ALIGN_RULES.maxShiftSec * fps), Math.floor(ALIGN_RULES.maxShiftShare * shorter));
  const band = Math.min(Math.round(ALIGN_RULES.bandSec * fps), Math.max(1, Math.floor(ALIGN_RULES.bandShare * shorter)));
  const shift = findShift(uAngles, rAngles, pairCost, maxShift);
  const map = alignTracks(uAngles, rAngles, pairCost, { shift, band, warpPenalty: ALIGN_RULES.warpPenaltyDeg });

  const perFrame = uAngles.map((ua, i) => {
    const diffs = diffsOf(ua, map[i] >= 0 ? rAngles[map[i]] : null);
    const levels = {};
    let worst = null;
    for (const [id, d] of Object.entries(diffs)) {
      levels[id] = levelOf(d, strictness);
      if (d !== null && (worst === null || d > worst)) worst = d;
    }
    return { diffs, levels, worst };
  });

  const detected = userTrack.frames.filter((f) => f.lm).length;
  return {
    map,
    perFrame,
    // Aikajana näyttää kunkin hetken suurimman eron, jotta yhden raajan virhe ei laimene keskiarvoon.
    timeline: perFrame.map((f) => f.worst),
    groups: { arms: rateGroup(perFrame, 'arms'), legs: rateGroup(perFrame, 'legs'), core: rateGroup(perFrame, 'core') },
    timing: timingOf(map, shift, fps),
    detectedShare: userTrack.frames.length ? detected / userTrack.frames.length : 0,
  };
}
