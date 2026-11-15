// Kahden asennon vertailu raajojen suuntakulmien perusteella.
import { SEGMENTS, point } from './skeleton.js';

/** Tätä heikommin näkyvää pistettä ei käytetä vertailuun. */
export const MIN_VIS = 0.5;

/** Kuvan reunan yli saa mennä tämän verran (osuus kuvan mitasta), ennen kuin piste hylätään. */
export const FRAME_MARGIN = 0.02;

/**
 * Kelpaako piste vertailuun: riittävän näkyvä ja kuvan sisällä. Kuvan ulkopuolelle
 * arvattua pistettä ei käytetä, vaikka tunnistus ilmoittaisi sen näkyväksi.
 * @param {import('./skeleton.js').Landmark} p
 */
export function isUsable(p) {
  return p.v >= MIN_VIS
    && p.x >= -FRAME_MARGIN && p.x <= 1 + FRAME_MARGIN
    && p.y >= -FRAME_MARGIN && p.y <= 1 + FRAME_MARGIN;
}

/** Värirajat asteina tarkkuusasetuksen mukaan. Lähtöarvoja, säädetään oikeilla videoilla. */
export const THRESHOLDS = Object.freeze({
  salliva: Object.freeze({ green: 25, yellow: 45 }),
  normaali: Object.freeze({ green: 15, yellow: 30 }),
  tarkka: Object.freeze({ green: 10, yellow: 20 }),
});

/**
 * Segmentin suuntakulma asteina (y kasvaa alaspäin). null, jos jompikumpi pää ei näy.
 * @param {import('./skeleton.js').Landmark[]} lm
 * @param {{from: any, to: any}} seg
 * @param {number} aspect kuvan leveys / korkeus
 * @returns {number|null}
 */
export function segmentAngle(lm, seg, aspect) {
  const a = point(lm, seg.from);
  const b = point(lm, seg.to);
  if (!isUsable(a) || !isUsable(b)) return null;
  // Normalisoidut koordinaatit ovat akselikohtaisia, joten x skaalataan kuvasuhteella.
  return (Math.atan2(b.y - a.y, (b.x - a.x) * aspect) * 180) / Math.PI;
}

/** Kahden kulman pienin ero, 0–180 astetta. */
export function angleDiff(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Segmenttikohtaiset kulmaerot. null = segmenttiä ei voitu arvioida.
 * @returns {Record<string, number|null>}
 */
export function compareFrames(userLm, refLm, userAspect, refAspect) {
  const out = {};
  for (const seg of SEGMENTS) {
    const u = segmentAngle(userLm, seg, userAspect);
    const r = segmentAngle(refLm, seg, refAspect);
    out[seg.id] = u === null || r === null ? null : angleDiff(u, r);
  }
  return out;
}

/**
 * @param {number|null} diff
 * @param {import('./skeleton.js').Strictness} strictness
 * @returns {import('./skeleton.js').Level}
 */
export function levelOf(diff, strictness) {
  if (diff === null || diff === undefined) return 'unknown';
  const t = THRESHOLDS[strictness] || THRESHOLDS.normaali;
  if (diff <= t.green) return 'green';
  if (diff <= t.yellow) return 'yellow';
  return 'red';
}

/** Kuvaparin kustannus kohdistusta varten: tunnettujen erojen keskiarvo, 90 jos mitään ei tunneta. */
export function frameCost(diffs) {
  let sum = 0;
  let n = 0;
  for (const d of Object.values(diffs)) {
    if (d !== null && d !== undefined) {
      sum += d;
      n++;
    }
  }
  return n ? sum / n : 90;
}
