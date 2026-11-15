// Kääre MediaPipe Posen ympärille. Kaikki tiedostot ladataan sovelluksen omasta
// vendor-kansiosta, joten kuva ei poistu laitteesta eikä ulkoisia pyyntöjä tehdä.

const VENDOR_URL = new URL('../../vendor/mediapipe-pose/', import.meta.url).href;

let scriptPromise = null;

function loadPoseScript() {
  if (globalThis.Pose) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = VENDOR_URL + 'pose.js';
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error('Asennontunnistuksen lataus epäonnistui.'));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

/**
 * @param {{modelComplexity?: 0|1}} [opts] 0 = kevyt malli, 1 = täysi malli
 * @returns {Promise<{detect(source: HTMLVideoElement|HTMLImageElement|HTMLCanvasElement): Promise<import('../core/skeleton.js').Landmark[]|null>, close(): void}>}
 */
export async function createEngine(opts = {}) {
  const modelComplexity = opts.modelComplexity ?? 1;
  await loadPoseScript();
  const pose = new globalThis.Pose({ locateFile: (file) => VENDOR_URL + file });
  pose.setOptions({
    modelComplexity,
    smoothLandmarks: false,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  let latest = null;
  pose.onResults((results) => {
    latest = results.poseLandmarks || null;
  });
  await pose.initialize();

  // Kutsut ajetaan yksi kerrallaan: MediaPipe ei kestä päällekkäisiä send-kutsuja.
  let queue = Promise.resolve();
  let closed = false;

  return {
    detect(source) {
      const run = async () => {
        if (closed) throw new Error('Tunnistusmoottori on suljettu.');
        latest = null;
        await pose.send({ image: source });
        if (!latest) return null;
        return latest.map((p) => ({ x: p.x, y: p.y, v: p.visibility ?? 0 }));
      };
      const result = queue.then(run, run);
      queue = result.catch(() => {});
      return result;
    },
    close() {
      if (closed) return;
      closed = true;
      queue.then(() => pose.close()).catch(() => {});
    },
  };
}
