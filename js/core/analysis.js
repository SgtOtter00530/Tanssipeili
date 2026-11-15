// Kokonaisanalyysi: kohdistus, kuvakohtaiset tasot, aikajana, kehonosayhteenveto ja ajoitus.
import { SEGMENTS } from './skeleton.js';
import { segmentAngle, angleDiff, levelOf } from './compare.js';
import { alignTracks } from './dtw.js';

/** @typedef {{dots: 0|1|2|3|4, label: string}} GroupRating */
/** @typedef {{
 *   map: Int32Array,
 *   perFrame: {diffs: Record<string, number|null>, levels: Record<string, import('./skeleton.js').Level>, mean: number|null}[],
 *   timeline: (number|null)[],
 *   groups: {arms: GroupRating, legs: GroupRating, core: GroupRating},
 *   timing: {medianLagSec: number, label: string},
 *   detectedShare: number
 * }} Analysis */

/** Ryhmän arvioinnin rajat: vihreiden osuus tunnetuista havainnoista. */
export const GROUP_RULES = Object.freeze({ minKnownShare: 0.3, four: 0.85, three: 0.65, two: 0.4 });
/** Ajoituksen rajat sekunteina. */
export const TIMING_RULES = Object.freeze({ inSync: 0.15, slight: 0.4 });

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

function rateGroup(perFrame, group) {
  const ids = SEGMENTS.filter((s) => s.group === group).map((s) => s.id);
  let total = 0;
  let known = 0;
  let green = 0;
  for (const f of perFrame) {
    for (const id of ids) {
      total++;
      const level = f.levels[id];
      if (level !== 'unknown') known++;
      if (level === 'green') green++;
    }
  }
  if (total === 0 || known / total < GROUP_RULES.minKnownShare) return { dots: 0, label: 'ei pystytty arvioimaan' };
  const share = green / known;
  if (share >= GROUP_RULES.four) return { dots: 4, label: 'lähellä mallia' };
  if (share >= GROUP_RULES.three) return { dots: 3, label: 'lähellä mallia' };
  if (share >= GROUP_RULES.two) return { dots: 2, label: 'eroja' };
  return { dots: 1, label: 'paljon eroja' };
}

function timingOf(userTrack, refTrack, map) {
  const lags = [];
  for (let i = 0; i < map.length; i++) {
    if (map[i] >= 0) lags.push(userTrack.frames[i].t - refTrack.frames[map[i]].t);
  }
  if (!lags.length) return { medianLagSec: 0, label: 'tahdissa' };
  lags.sort((a, b) => a - b);
  const mid = lags.length >> 1;
  const median = lags.length % 2 ? lags[mid] : (lags[mid - 1] + lags[mid]) / 2;
  const abs = Math.abs(median);
  let label = 'tahdissa';
  if (abs >= TIMING_RULES.inSync) {
    const amount = abs > TIMING_RULES.slight ? 'selvästi' : 'hieman';
    label = `${amount} ${median > 0 ? 'jäljessä' : 'edellä'}`;
  }
  return { medianLagSec: median, label };
}

/**
 * @param {import('./skeleton.js').Track} userTrack
 * @param {import('./skeleton.js').Track} refTrack
 * @param {import('./skeleton.js').Strictness} strictness
 * @returns {Analysis}
 */
export function analyze(userTrack, refTrack, strictness) {
  const uAspect = userTrack.width / userTrack.height;
  const rAspect = refTrack.width / refTrack.height;
  const uAngles = userTrack.frames.map((f) => anglesOf(f, uAspect));
  const rAngles = refTrack.frames.map((f) => anglesOf(f, rAspect));
  const map = alignTracks(uAngles, rAngles, pairCost);

  const perFrame = uAngles.map((ua, i) => {
    const diffs = diffsOf(ua, map[i] >= 0 ? rAngles[map[i]] : null);
    const levels = {};
    let sum = 0;
    let n = 0;
    for (const [id, d] of Object.entries(diffs)) {
      levels[id] = levelOf(d, strictness);
      if (d !== null) {
        sum += d;
        n++;
      }
    }
    return { diffs, levels, mean: n ? sum / n : null };
  });

  const detected = userTrack.frames.filter((f) => f.lm).length;
  return {
    map,
    perFrame,
    timeline: perFrame.map((f) => f.mean),
    groups: { arms: rateGroup(perFrame, 'arms'), legs: rateGroup(perFrame, 'legs'), core: rateGroup(perFrame, 'core') },
    timing: timingOf(userTrack, refTrack, map),
    detectedShare: userTrack.frames.length ? detected / userTrack.frames.length : 0,
  };
}
