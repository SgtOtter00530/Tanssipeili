// Ajallinen kohdistus kahdessa vaiheessa:
// 1) findShift etsii yhden siirtymän, joka selittää sen, että pätkät on rajattu käsin eri kohdista.
// 2) alignTracks sallii sen ympärillä vain pienen paikallisen jouston (kaista), ja joustosta maksetaan.
// Näin pieni etu- tai jälkijättöisyys ei näy asentovirheenä, mutta kohdistus ei myöskään
// pääse piilottamaan todellisia asentoeroja venyttämällä aikaa mielivaltaisesti.

/** Suurempi siirtymä hyväksytään vain, jos se on tämän verran (astetta) parempi kuin pienempi. */
const SHIFT_MARGIN = 0.5;

/**
 * Etsii siirtymän s, jolla käyttäjän kuva i vastaa parhaiten mallin kuvaa i + s.
 * @template U, R
 * @param {U[]} userFrames
 * @param {R[]} refFrames
 * @param {(u: U, r: R) => number} cost
 * @param {number} [maxShift] suurin siirtymä kuvina kumpaankin suuntaan
 * @returns {number}
 */
export function findShift(userFrames, refFrames, cost, maxShift = 20) {
  const n = userFrames.length;
  const m = refFrames.length;
  if (!n || !m) return 0;
  const minOverlap = Math.max(1, Math.ceil(Math.min(n, m) * 0.5));
  let best = 0;
  let bestCost = Infinity;
  // Järjestys 0, -1, +1, -2, +2 …: tasatilanteessa ja toistuvassa liikkeessä pienin siirtymä voittaa.
  for (let k = 0; k <= maxShift; k++) {
    for (const s of k === 0 ? [0] : [-k, k]) {
      const i0 = Math.max(0, -s);
      const i1 = Math.min(n - 1, m - 1 - s);
      const overlap = i1 - i0 + 1;
      if (overlap < minOverlap) continue;
      let sum = 0;
      for (let i = i0; i <= i1; i++) sum += cost(userFrames[i], refFrames[i + s]);
      const mean = sum / overlap;
      if (mean < bestCost - (bestCost === Infinity ? 0 : SHIFT_MARGIN)) {
        bestCost = mean;
        best = s;
      }
    }
  }
  return best;
}

/**
 * Kohdistaa käyttäjän kuvat mallin kuviin siirtymän ympärillä olevassa kaistassa.
 * Jokainen käyttäjän kuva saa enintään yhden mallin kuvan; malli voi pysyä paikallaan,
 * edetä yhden tai kaksi kuvaa. Paikallaan pysyminen ja hyppy maksavat warpPenalty-verran.
 * @template U, R
 * @param {U[]} userFrames
 * @param {R[]} refFrames
 * @param {(u: U, r: R) => number} cost
 * @param {{shift?: number, band?: number, warpPenalty?: number}} [opts]
 * @returns {Int32Array} alkio i = käyttäjän kuvaa i vastaava mallin kuva, tai -1 jos malli ei kata kohtaa
 */
export function alignTracks(userFrames, refFrames, cost, opts = {}) {
  const n = userFrames.length;
  const m = refFrames.length;
  const map = new Int32Array(n).fill(-1);
  if (!n || !m) return map;
  const s = opts.shift ?? 0;
  const b = Math.max(0, opts.band ?? 5);
  const penalty = opts.warpPenalty ?? 0;
  const lo = (i) => Math.max(0, i + s - b);
  const hi = (i) => Math.min(m - 1, i + s + b);

  let i0 = 0;
  while (i0 < n && lo(i0) > hi(i0)) i0++;
  let i1 = n - 1;
  while (i1 >= i0 && lo(i1) > hi(i1)) i1--;
  if (i0 > i1) return map;

  const W = 2 * b + 1;
  const rows = i1 - i0 + 1;
  const D = new Float64Array(rows * W).fill(Infinity);
  const prev = new Int32Array(rows * W).fill(-1);
  const col = (i, j) => j - (i + s) + b; // 0..W-1
  const TIE = 1e-9; // tasatilanteessa suositaan kaistan keskikohtaa

  for (let i = i0; i <= i1; i++) {
    const r = i - i0;
    for (let j = lo(i); j <= hi(i); j++) {
      const c = col(i, j);
      const here = cost(userFrames[i], refFrames[j]) + TIE * Math.abs(c - b);
      if (r === 0) {
        D[c] = here;
        continue;
      }
      let best = Infinity;
      let from = -1;
      // diagonaali (malli etenee yhden), paikallaan (0) ja hyppy (2)
      for (const [step, extra] of [[1, 0], [0, penalty], [2, penalty]]) {
        const pj = j - step;
        if (pj < lo(i - 1) || pj > hi(i - 1)) continue;
        const v = D[(r - 1) * W + col(i - 1, pj)] + extra;
        if (v < best) {
          best = v;
          from = pj;
        }
      }
      if (from === -1) continue;
      D[r * W + c] = best + here;
      prev[r * W + c] = from;
    }
  }

  let j = -1;
  let bestEnd = Infinity;
  for (let jj = lo(i1); jj <= hi(i1); jj++) {
    const v = D[(rows - 1) * W + col(i1, jj)];
    if (v < bestEnd) {
      bestEnd = v;
      j = jj;
    }
  }
  for (let i = i1; i >= i0 && j >= 0; i--) {
    map[i] = j;
    j = i > i0 ? prev[(i - i0) * W + col(i, j)] : -1;
  }
  return map;
}
