// Tiedostokokoihin liittyvät rajat ja esitysmuodot.

/** Tätä suuremman mallivideon tallennus puhelimeen ei ole oletuksena päällä. */
export const KEEP_VIDEO_DEFAULT_MAX_BYTES = 150 * 1024 * 1024;

/** @param {number|undefined} sizeBytes */
export function defaultKeepVideo(sizeBytes) {
  return !(sizeBytes > KEEP_VIDEO_DEFAULT_MAX_BYTES);
}

/** Tavut luettavaan muotoon: "0,5 Mt", "150 Mt", "2,5 Gt". */
export function formatBytes(bytes) {
  const MB = 1024 * 1024;
  const fi = (value, digits) => value.toFixed(digits).replace('.', ',');
  if (bytes >= 1024 * MB) return `${fi(bytes / (1024 * MB), 1)} Gt`;
  if (bytes >= 100 * MB) return `${Math.round(bytes / MB)} Mt`;
  if (bytes >= 0.05 * MB) return `${fi(bytes / MB, 1)} Mt`;
  return `${Math.round(bytes / 1024)} kt`;
}
