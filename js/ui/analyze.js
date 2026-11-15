// Jälkianalyysi: oman videon vertailu valittuun malliin.
import { MAX_CLIP_SECONDS } from '../pose/extract.js';
import { analyze } from '../core/analysis.js';
import { projectReference } from '../core/normalize.js';
import { levelOf } from '../core/compare.js';
import { drawSkeleton, COLORS } from '../render/overlay.js';
import { diag } from '../core/diag.js';
import { COPY } from './copy.js';
import { h, formatDuration, setChildren } from './dom.js';
import { mountTrim } from './trim.js';
import { mountStage } from './stage.js';
import { runExtraction, errorText, errorDetail, setError, logChosenFile, MIN_DETECTED_SHARE, PARTLY_DETECTED_SHARE } from './process.js';

const GROUP_NAMES = [['arms', 'Kädet'], ['legs', 'Jalat'], ['core', 'Vartalo']];
/** Aikajanan palkki on täysikorkea, kun keskimääräinen ero on tämän verran asteita. */
const TIMELINE_FULL_DEG = 60;
const STRICTNESS_OPTIONS = [['salliva', 'Salliva'], ['normaali', 'Normaali'], ['tarkka', 'Tarkka']];

/** @param {HTMLElement} root @param {import('../app.js').AppContext} ctx */
export async function render(root, ctx) {
  const { store } = ctx;
  const body = h('div', {});
  const errorBox = h('p', { class: 'notice notice-error', role: 'alert', hidden: true });
  root.append(h('h1', { tabindex: '-1', text: 'Analysoi' }), errorBox, body);

  let trim = null;
  let stage = null;
  const running = { abort: null };
  let disposed = false;

  const showError = (text, detail) => setError(errorBox, text, detail);
  const dispose = () => {
    trim?.destroy();
    trim = null;
    stage?.destroy();
    stage = null;
  };

  /** @param {{file: Blob, range: {start: number, end: number}, track: any}|null} [pending] jo käsitelty oma video, jota verrataan valittavaan malliin */
  async function stepPickReference(pending = null) {
    dispose();
    showError('');
    const [styles, refs] = await Promise.all([store.listStyles(), store.listReferences()]);
    if (disposed) return;
    if (!refs.length) {
      setChildren(body, h('p', { text: 'Kirjastossa ei ole vielä malleja. Lisää ensin mallivideo, johon vertaat omaa tanssiasi.' }),
        h('button', { type: 'button', class: 'btn btn-primary btn-block', onClick: () => ctx.navigate('#lisaa-malli', {}) }, 'Lisää malli'),
      );
      return;
    }
    const hasRefs = (id) => refs.some((r) => r.styleId === id);
    let styleId = hasRefs(ctx.state.styleId) ? ctx.state.styleId : styles.find((s) => hasRefs(s.id))?.id || styles[0].id;
    const select = h('select', { id: 'pick-style', class: 'input' }, ...styles.map((s) => h('option', { value: s.id, selected: s.id === styleId }, s.name)));
    const list = h('div', {});
    const renderList = () => {
      const inStyle = refs.filter((r) => r.styleId === styleId);
      setChildren(list, ...(inStyle.length
        ? inStyle.map((r) => h('button', { type: 'button', class: 'btn btn-block pick-ref', onClick: () => (pending ? stepResult(r, pending.file, pending.range, pending.track) : stepPickVideo(r)) },
          h('span', { text: r.name }),
          h('span', { class: 'meta', text: formatDuration(r.track.frames.length / r.track.fps) })))
        : [h('p', { class: 'empty', text: COPY.emptyStyle })]));
    };
    select.addEventListener('change', () => {
      styleId = select.value;
      ctx.state.styleId = styleId;
      renderList();
    });
    setChildren(body, h('h2', { text: 'Valitse malli' }),
      h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'pick-style', text: 'Laji' }), select),
      list,
    );
    renderList();
  }

  function stepPickVideo(ref) {
    dispose();
    const onFile = (input) => input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (file) {
        logChosenFile(file, input.id === 'pick-camera' ? 'oma-kamera' : 'oma-galleria');
        stepTrim(ref, file, null);
      }
    });
    const camera = h('input', { type: 'file', id: 'pick-camera', accept: 'video/*', capture: 'environment', class: 'visually-hidden' });
    const gallery = h('input', { type: 'file', id: 'pick-gallery', accept: 'video/*', class: 'visually-hidden' });
    onFile(camera);
    onFile(gallery);
    setChildren(body, h('div', { class: 'chosen-ref' },
        h('p', { text: `Malli: ${ref.name}` }),
        h('button', { type: 'button', class: 'btn btn-quiet', onClick: () => stepPickReference() }, 'Vaihda malli')),
      h('p', { class: 'notice notice-info', text: COPY.filmingGuide }),
      h('div', { class: 'file-actions' },
        h('label', { class: 'btn btn-primary btn-block file-btn' }, camera, 'Kuvaa nyt'),
        h('label', { class: 'btn btn-block file-btn' }, gallery, 'Valitse galleriasta')),
      h('p', { class: 'hint', text: COPY.privacy }),
    );
  }

  async function stepTrim(ref, file, initial) {
    dispose();
    const holder = h('div', {});
    try {
      trim = await mountTrim(holder, file, { maxSeconds: MAX_CLIP_SECONDS, initial: initial || undefined });
    } catch (e) {
      if (disposed) return;
      stepPickVideo(ref);
      showError(errorText(e), errorDetail(e));
      return;
    }
    if (disposed) return void dispose();
    showError('');
    setChildren(body, h('h2', { text: 'Rajaa oma suorituksesi' }),
      h('p', { class: 'hint', text: 'Valitse kohta, jossa tanssi alkaa ja loppuu. Jätä pois kävely paikalle ja pois.' }),
      holder,
      h('button', { type: 'button', class: 'btn btn-primary btn-block', onClick: () => stepProcess(ref, file, trim.getRange()) }, 'Analysoi'),
      h('button', { type: 'button', class: 'btn btn-block', onClick: () => stepPickVideo(ref) }, 'Vaihda video'),
    );
  }

  async function stepProcess(ref, file, range) {
    dispose();
    showError('');
    let track;
    try {
      track = await runExtraction(body, ctx, file, range, running);
    } catch (e) {
      if (disposed) return;
      await stepTrim(ref, file, range);
      showError(errorText(e), errorDetail(e));
      return;
    }
    if (disposed) return;
    if (!track) return void stepTrim(ref, file, range);
    await stepResult(ref, file, range, track);
  }

  async function stepResult(ref, file, range, track) {
    dispose();
    showError('');
    // Tulos säilytetään, jotta näkymästä poistuminen (esim. asetuksiin) ei hävitä minuuttien käsittelyä.
    ctx.state.analysis = { ref, file, range, track };
    const again = h('button', { type: 'button', class: 'btn btn-primary btn-block', onClick: () => stepPickVideo(ref) }, 'Analysoi toinen video');
    const change = h('button', { type: 'button', class: 'btn btn-block', onClick: () => stepPickReference({ file, range, track }) }, 'Vaihda malli');

    let settings = { strictness: 'normaali' };
    try {
      settings = await store.getSettings();
    } catch { /* asetusten luku epäonnistui: käytetään oletustarkkuutta */ }
    if (disposed) return;
    let strictness = settings.strictness || 'normaali';
    let result = analyze(track, ref.track, strictness);
    diag.log('analyysi', {
      kuvia: track.frames.length, 'mallin-kuvia': ref.track.frames.length,
      'tunnistettu-osuus': result.detectedShare.toFixed(2), siirtymä: result.timing.shiftSec.toFixed(1),
      kädet: result.groups.arms.dots, jalat: result.groups.legs.dots, vartalo: result.groups.core.dots,
    });

    if (result.detectedShare < MIN_DETECTED_SHARE) {
      ctx.state.analysis = null;
      setChildren(body, h('p', { class: 'notice notice-error', text: COPY.noPerson }), again, h('button', { type: 'button', class: 'btn btn-block', onClick: () => stepPickReference() }, 'Vaihda malli'));
      return;
    }

    const n = track.frames.length;
    const userAspect = track.width / track.height;
    const refAspect = ref.track.width / ref.track.height;
    const indexAt = (t) => Math.min(n - 1, Math.max(0, Math.round(t * track.fps)));

    const holder = h('div', {});
    const showRef = h('input', { type: 'checkbox', id: 'show-ref', checked: true });
    const playhead = h('div', { class: 'timeline-playhead' });
    const timeline = h('div', { class: 'timeline', 'aria-hidden': 'true' });
    timeline.addEventListener('click', (e) => {
      const bar = e.target.closest('.timeline-bar');
      if (bar && stage) stage.seek(Number(bar.dataset.index) / track.fps);
    });
    const summary = h('div', { class: 'summary' });

    const summaryRow = (name, value, dots) => h('div', { class: 'summary-row' },
      h('span', { class: 'summary-name', text: name }),
      h('span', { class: 'summary-value' },
        dots === null ? null : h('span', { class: 'summary-dots', 'aria-hidden': 'true', text: '●'.repeat(dots) + '○'.repeat(4 - dots) }),
        dots === null ? value : ` ${value}`));

    // Tarkkuuden vaihto laskee tuloksen uudelleen heti; videota ei käsitellä toista kertaa.
    function renderResult() {
      setChildren(timeline,
        ...result.timeline.map((worst, i) => {
          const fill = h('div', { class: 'timeline-fill' });
          fill.style.height = `${worst === null ? 8 : 8 + Math.min(1, worst / TIMELINE_FULL_DEG) * 92}%`;
          fill.style.background = COLORS[levelOf(worst, strictness)];
          return h('div', { class: 'timeline-bar', 'data-index': i }, fill);
        }),
        playhead);
      setChildren(summary,
        ...GROUP_NAMES.map(([key, name]) => summaryRow(name, result.groups[key].label, result.groups[key].dots)),
        summaryRow('Ajoitus', result.timing.label, null));
      stage?.redraw();
    }

    const strictnessSelect = h('select', { id: 'result-strictness', class: 'input' },
      ...STRICTNESS_OPTIONS.map(([value, label]) => h('option', { value, selected: value === strictness }, label)));
    strictnessSelect.addEventListener('change', () => {
      strictness = strictnessSelect.value;
      result = analyze(track, ref.track, strictness);
      renderResult();
      store.saveSettings({ ...settings, strictness }).catch(() => {});
    });

    setChildren(body,
      h('div', { class: 'chosen-ref' }, h('p', { text: `Malli: ${ref.name}` })),
      result.detectedShare < PARTLY_DETECTED_SHARE ? h('p', { class: 'notice', text: COPY.partlyDetected }) : null,
      holder,
      h('label', { class: 'option', for: 'show-ref' }, showRef, h('span', { class: 'option-text' }, h('span', { class: 'option-label', text: 'Näytä malli' }))),
      h('h2', { text: 'Missä kohdissa erosit mallista' }),
      h('p', { class: 'hint', text: 'Korkea palkki tarkoittaa, että jokin raaja oli sillä hetkellä kaukana mallista. Napauta palkkia siirtyäksesi kohtaan.' }),
      h('div', { class: 'timeline-wrap' }, timeline),
      h('ul', { class: 'legend' },
        h('li', {}, h('span', { class: 'swatch', style: `background:${COLORS.green}` }), 'lähellä'),
        h('li', {}, h('span', { class: 'swatch', style: `background:${COLORS.yellow}` }), 'eroa'),
        h('li', {}, h('span', { class: 'swatch', style: `background:${COLORS.red}` }), 'selvä ero'),
        h('li', {}, h('span', { class: 'swatch swatch-dashed' }), 'ei tunnistettu'),
        h('li', {}, h('span', { class: 'swatch', style: `background:${COLORS.ghost}` }), 'malli')),
      h('h2', { text: 'Yhteenveto' }),
      summary,
      h('p', { class: 'hint', text: COPY.timingHint }),
      h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'result-strictness', text: 'Tarkkuus' }), strictnessSelect),
      h('p', { class: 'hint', text: COPY.honesty }),
      again,
      change,
    );
    renderResult();

    try {
      stage = await mountStage(holder, file, {
        start: range.start,
        end: range.end,
        overlayId: 'result-overlay',
        onError: (detail) => showError(COPY.playbackFailed, detail),
        draw(ctx2d, t, width, height) {
          const i = indexAt(t);
          playhead.style.left = `${((i + 0.5) / n) * 100}%`;
          const frame = track.frames[i];
          if (!frame || !frame.lm) return;
          const refFrame = result.map[i] >= 0 ? ref.track.frames[result.map[i]] : null;
          if (showRef.checked && refFrame && refFrame.lm) {
            const projected = projectReference(refFrame.lm, refAspect, frame.lm, userAspect);
            if (projected) drawSkeleton(ctx2d, projected, { width, height, variant: 'ghost' });
          }
          drawSkeleton(ctx2d, frame.lm, { width, height, variant: 'user', levels: result.perFrame[i].levels });
        },
      });
    } catch (e) {
      if (!disposed) showError(errorText(e), errorDetail(e));
    }
    if (disposed) return void dispose();
    showRef.addEventListener('change', () => stage?.redraw());
  }

  // Kirjaston Analysoi-painike tuo mallin tunnisteen mukanaan.
  let preset = null;
  if (ctx.params.referenceId) preset = (await store.listReferences()).find((r) => r.id === ctx.params.referenceId) || null;
  const kept = ctx.state.analysis;
  if (preset) stepPickVideo(preset);
  else if (kept) await stepResult(kept.ref, kept.file, kept.range, kept.track); // palataan aiempaan tulokseen
  else await stepPickReference();

  return () => {
    disposed = true;
    running.abort?.();
    dispose();
  };
}
