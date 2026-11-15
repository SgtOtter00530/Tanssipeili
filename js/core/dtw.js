// Dynaaminen aikakohdistus: sovittaa käyttäjän kuvat mallin kuviin niin,
// että pieni etu- tai jälkijättöisyys ei näy asentovirheenä.

/**
 * @template U, R
 * @param {U[]} userFrames
 * @param {R[]} refFrames
 * @param {(u: U, r: R) => number} cost kuvaparin kustannus, pienempi = lähempänä
 * @param {{band?: number}} [opts] kaistan leveys osuutena pidemmän radan pituudesta
 * @returns {Int32Array} alkio i = käyttäjän kuvaa i vastaava mallin kuvan indeksi (-1, jos mallia ei ole)
 */
export function alignTracks(userFrames, refFrames, cost, opts = {}) {
  const n = userFrames.length;
  const m = refFrames.length;
  const map = new Int32Array(n);
  if (n === 0) return map;
  if (m === 0) return map.fill(-1);
  if (n === 1) return map; // yksi kuva kohdistuu mallin alkuun
  if (m === 1) return map; // kaikki kohdistuvat mallin ainoaan kuvaan (0)

  const band = opts.band ?? 0.25;
  const w = Math.max(2, Math.ceil(band * Math.max(n, m)));
  const slope = (m - 1) / (n - 1);
  const D = new Float64Array(n * m).fill(Infinity);

  for (let i = 0; i < n; i++) {
    const c = i * slope;
    const j0 = Math.max(0, Math.floor(c - w));
    const j1 = Math.min(m - 1, Math.ceil(c + w));
    for (let j = j0; j <= j1; j++) {
      let best;
      if (i === 0 && j === 0) {
        best = 0;
      } else {
        best = Infinity;
        if (i > 0 && j > 0) best = D[(i - 1) * m + (j - 1)];
        if (i > 0 && D[(i - 1) * m + j] < best) best = D[(i - 1) * m + j];
        if (j > 0 && D[i * m + (j - 1)] < best) best = D[i * m + (j - 1)];
        if (best === Infinity) continue;
      }
      D[i * m + j] = best + cost(userFrames[i], refFrames[j]);
    }
  }

  // Paluu lopusta alkuun. Kun yhtä käyttäjän kuvaa vastaa usea mallin kuva,
  // valitaan polun viimeinen (suurin indeksi), eli ensimmäinen paluusuunnassa vastaan tuleva.
  let i = n - 1;
  let j = m - 1;
  map.fill(-1);
  map[i] = j;
  while (i > 0 || j > 0) {
    const diag = i > 0 && j > 0 ? D[(i - 1) * m + (j - 1)] : Infinity;
    const up = i > 0 ? D[(i - 1) * m + j] : Infinity;
    const left = j > 0 ? D[i * m + (j - 1)] : Infinity;
    if (diag <= up && diag <= left) {
      i--;
      j--;
    } else if (up <= left) {
      i--;
    } else {
      j--;
    }
    if (map[i] === -1) map[i] = j;
  }
  map[0] = 0; // alku kohdistuu aina alkuun
  return map;
}
