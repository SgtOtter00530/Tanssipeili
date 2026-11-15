// Mallin tikku-ukon sovitus tanssijan kehon kohdalle ja kokoon.
import { point } from './skeleton.js';
import { MIN_VIS } from './compare.js';

function anchor(lm, aspect) {
  const hip = point(lm, 'hipCenter');
  const sh = point(lm, 'shoulderCenter');
  if (hip.v < MIN_VIS || sh.v < MIN_VIS) return null;
  const torso = Math.hypot((sh.x - hip.x) * aspect, sh.y - hip.y);
  if (!(torso > 1e-6)) return null;
  return { hip, torso };
}

/**
 * Palauttaa mallin pisteet tanssijan kuvan koordinaateissa: lantion keskipisteet
 * kohdakkain ja vartalon pituudet yhtä suuriksi skaalattuina.
 * @param {import('./skeleton.js').Landmark[]} refLm
 * @param {number} refAspect mallin kuvan leveys / korkeus
 * @param {import('./skeleton.js').Landmark[]} userLm
 * @param {number} userAspect
 * @returns {import('./skeleton.js').Landmark[]|null} null, jos jommankumman lantio tai hartiat eivät näy
 */
export function projectReference(refLm, refAspect, userLm, userAspect) {
  const r = anchor(refLm, refAspect);
  const u = anchor(userLm, userAspect);
  if (!r || !u) return null;
  const s = u.torso / r.torso;
  return refLm.map((p) => ({
    x: u.hip.x + ((p.x - r.hip.x) * refAspect * s) / userAspect,
    y: u.hip.y + (p.y - r.hip.y) * s,
    v: p.v,
  }));
}
