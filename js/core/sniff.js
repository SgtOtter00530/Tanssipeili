// Videotiedoston säiliön ja koodekkien tunnistus tiedoston alusta ja lopusta luetuista tavuista.
// Käytetään vain vianmääritykseen: kun selain ei avaa videota, tästä näkee, mitä tiedosto sisältää.

const QUICKTIME_BRANDS = new Set(['qt  ']);
const ascii = (bytes, at, len) => {
  let s = '';
  for (let i = at; i < at + len && i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
};
const isFourcc = (s) => s.length === 4 && /^[A-Za-z0-9 .\-]{4}$/.test(s);

function findCodecs(bytes, found) {
  // stsd-laatikko: 'stsd' versio(4) lukumäärä(4), sitten ensimmäinen merkintä: koko(4) nelimerkki(4).
  for (let i = 0; i + 4 <= bytes.length; i++) {
    if (bytes[i] !== 0x73 || bytes[i + 1] !== 0x74 || bytes[i + 2] !== 0x73 || bytes[i + 3] !== 0x64) continue;
    const fourcc = ascii(bytes, i + 16, 4);
    if (isFourcc(fourcc) && !found.includes(fourcc)) found.push(fourcc);
  }
}

/**
 * @param {Uint8Array} head tiedoston alku
 * @param {Uint8Array} tail tiedoston loppu (voi olla sama kuin alku lyhyessä tiedostossa)
 * @returns {{empty: boolean, container: string, brand: string, codecs: string[]}}
 */
export function sniffVideo(head, tail) {
  const result = { empty: head.length === 0, container: 'tuntematon', brand: '', codecs: [] };
  if (result.empty) return result;
  if (ascii(head, 4, 4) === 'ftyp') {
    result.brand = ascii(head, 8, 4);
    result.container = QUICKTIME_BRANDS.has(result.brand) ? 'mov' : 'mp4';
  } else if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) {
    result.container = 'webm/mkv';
  } else if (['moov', 'mdat', 'wide', 'free'].includes(ascii(head, 4, 4))) {
    result.container = 'mov';
  }
  findCodecs(head, result.codecs);
  findCodecs(tail, result.codecs);
  return result;
}

/** Tiivis kuvaus lokiin ja virheilmoituksen tekniseen tietoon. */
export function describeSniff(r) {
  if (r.empty) return 'tyhjä tiedosto';
  const container = r.container === 'tuntematon' ? 'säiliö tuntematon' : `${r.container}${r.brand ? ` (${r.brand.trim()})` : ''}`;
  return `${container}, ${r.codecs.length ? `koodekit ${r.codecs.join('+')}` : 'koodekkeja ei löytynyt'}`;
}
