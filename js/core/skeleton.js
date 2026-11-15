// Tikku-ukon rakenne: MediaPipen pisteindeksit, vertailtavat segmentit ja peilaus.

/** @typedef {{x:number, y:number, v:number}} Landmark   x,y 0..1 kuvan koordinaateissa, v näkyvyys 0..1 */
/** @typedef {{t:number, lm:(Landmark[]|null)}} Frame    lm null = ei löytynyt henkilöä */
/** @typedef {{fps:number, width:number, height:number, frames:Frame[]}} Track */
/** @typedef {'salliva'|'normaali'|'tarkka'} Strictness */
/** @typedef {'green'|'yellow'|'red'|'unknown'} Level */
/** @typedef {{id:string, name:string, order:number}} Style */
/** @typedef {{id:string, name:string, styleId:string, mirrored:boolean, track:Track, video:(Blob|null), createdAt:string}} Reference */
/** @typedef {number|'hipCenter'|'shoulderCenter'} PointRef */

export const LM = Object.freeze({
  NOSE: 0,
  L_SHOULDER: 11, R_SHOULDER: 12,
  L_ELBOW: 13, R_ELBOW: 14,
  L_WRIST: 15, R_WRIST: 16,
  L_HIP: 23, R_HIP: 24,
  L_KNEE: 25, R_KNEE: 26,
  L_ANKLE: 27, R_ANKLE: 28,
});

/** Vertailtavat segmentit. Suunta kulkee pisteestä `from` pisteeseen `to`. */
export const SEGMENTS = Object.freeze([
  { id: 'lUpperArm', from: LM.L_SHOULDER, to: LM.L_ELBOW, group: 'arms' },
  { id: 'lForearm', from: LM.L_ELBOW, to: LM.L_WRIST, group: 'arms' },
  { id: 'rUpperArm', from: LM.R_SHOULDER, to: LM.R_ELBOW, group: 'arms' },
  { id: 'rForearm', from: LM.R_ELBOW, to: LM.R_WRIST, group: 'arms' },
  { id: 'lThigh', from: LM.L_HIP, to: LM.L_KNEE, group: 'legs' },
  { id: 'lShin', from: LM.L_KNEE, to: LM.L_ANKLE, group: 'legs' },
  { id: 'rThigh', from: LM.R_HIP, to: LM.R_KNEE, group: 'legs' },
  { id: 'rShin', from: LM.R_KNEE, to: LM.R_ANKLE, group: 'legs' },
  { id: 'torso', from: 'hipCenter', to: 'shoulderCenter', group: 'core' },
  { id: 'head', from: 'shoulderCenter', to: LM.NOSE, group: 'core' },
]);

/** Vain piirrettävät viivat: hartialinja ja lantiolinja. Näitä ei vertailla. */
export const DRAW_EXTRA = Object.freeze([
  { id: 'shoulders', from: LM.L_SHOULDER, to: LM.R_SHOULDER },
  { id: 'hips', from: LM.L_HIP, to: LM.R_HIP },
]);

const VIRTUAL = {
  hipCenter: [LM.L_HIP, LM.R_HIP],
  shoulderCenter: [LM.L_SHOULDER, LM.R_SHOULDER],
};

/**
 * Palauttaa pisteen tai virtuaalipisteen (parin keskipiste, näkyvyys parin pienempi).
 * @param {Landmark[]} lm
 * @param {PointRef} ref
 * @returns {Landmark}
 */
export function point(lm, ref) {
  if (typeof ref === 'number') return lm[ref];
  const [a, b] = VIRTUAL[ref];
  return { x: (lm[a].x + lm[b].x) / 2, y: (lm[a].y + lm[b].y) / 2, v: Math.min(lm[a].v, lm[b].v) };
}

// MediaPipen vasen–oikea-parit: silmät, korvat, suu ja kaikki kehon pisteet 11–32.
const MIRROR_PAIRS = [[1, 4], [2, 5], [3, 6], [7, 8], [9, 10]];
for (let i = 11; i < 32; i += 2) MIRROR_PAIRS.push([i, i + 1]);

/**
 * Peilaa asennon vaakasuunnassa ja vaihtaa vasemman ja oikean puolen pisteet.
 * @param {Landmark[]} lm
 * @returns {Landmark[]}
 */
export function mirrorLandmarks(lm) {
  const out = lm.map((p) => ({ x: 1 - p.x, y: p.y, v: p.v }));
  for (const [a, b] of MIRROR_PAIRS) {
    const tmp = out[a];
    out[a] = out[b];
    out[b] = tmp;
  }
  return out;
}
