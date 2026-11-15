// Mallin lisäys: videon valinta, rajaus, käsittely, esikatselu ja tallennus.
import { MAX_CLIP_SECONDS } from '../pose/extract.js';
import { mirrorTrack } from '../core/track.js';
import { mirrorLandmarks } from '../core/skeleton.js';
import { drawSkeleton } from '../render/overlay.js';
import { StoreFullError } from '../store/db.js';
import { diag } from '../core/diag.js';
import { SourceReadError } from '../store/scratch.js';
import { defaultKeepVideo, formatBytes } from '../core/limits.js';
import { COPY } from './copy.js';
import { h, newId, setChildren } from './dom.js';
import { mountTrim } from './trim.js';
import { mountStage } from './stage.js';
import { runExtraction, errorText, errorDetail, setError, openChosenFile, describeFile, videoAccept, MIN_DETECTED_SHARE } from './process.js';

/** @param {HTMLElement} root @param {import('../app.js').AppContext} ctx */
export async function render(root, ctx) {
  const styles = await ctx.store.listStyles();
  const defaultStyle = ctx.params.styleId || ctx.state.styleId;
  const body = h('div', {});
  const errorBox = h('p', { class: 'notice notice-error', role: 'alert', hidden: true });
  root.append(h('h1', { tabindex: '-1', text: 'Lisää malli' }), errorBox, body);

  let trim = null;
  let stage = null;
  let sourceName = 'Malli'; // valitun tiedoston nimi ilman päätettä, mallin oletusnimeksi
  const running = { abort: null };
  let disposed = false;

  const showError = (text, detail) => setError(errorBox, text, detail);
  const dispose = () => {
    trim?.destroy();
    trim = null;
    stage?.destroy();
    stage = null;
  };

  /** @param {boolean} [offerBrowse] näytetäänkö varavalinta tiedostoselaimesta (lukuvirheen jälkeen) */
  function stepPick(offerBrowse = false) {
    dispose();
    const fileInput = (id, accept, picker) => {
      const input = h('input', { type: 'file', id, accept, class: 'visually-hidden' });
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (file) stepOpen(file, picker);
      });
      return input;
    };
    setChildren(body, h('p', { text: 'Valitse video, jota haluat käyttää mallina. Sovellus poimii siitä tanssijan liikkeet.' }),
      h('label', { class: 'btn btn-primary btn-block file-btn' }, fileInput('ref-file', videoAccept(), 'tavallinen'), 'Valitse video'),
      // Ilman tyyppirajausta puhelin avaa tiedostoselaimen, jonka antama tiedosto pysyy luettavana.
      offerBrowse ? h('label', { class: 'btn btn-block file-btn' }, fileInput('ref-file-any', null, 'tiedostoselain'), COPY.browseFiles) : null,
      offerBrowse ? h('p', { class: 'hint', text: COPY.browseFilesHint }) : null,
      h('p', { class: 'hint', text: COPY.privacy }),
    );
  }

  /** Tekee valitusta videosta työkopion. Jos tiedostoa ei saa luettua, palataan valintaan. */
  async function stepOpen(picked, picker) {
    dispose();
    showError('');
    let file;
    try {
      file = await openChosenFile(body, ctx, picked, 'malli', picker);
    } catch (e) {
      if (disposed) return;
      stepPick(e instanceof SourceReadError);
      showError(errorText(e), errorDetail(e));
      return;
    }
    if (disposed) return;
    sourceName = (picked.name || 'Malli').replace(/\.[^.]+$/, '');
    await stepTrim(file, null);
  }

  async function stepTrim(file, initial) {
    dispose();
    const holder = h('div', {});
    try {
      trim = await mountTrim(holder, file, { maxSeconds: MAX_CLIP_SECONDS, initial: initial || undefined });
    } catch (e) {
      const info = await describeFile(file).catch(() => '');
      if (disposed) return;
      stepPick();
      showError(errorText(e), [errorDetail(e), info].filter(Boolean).join(' · '));
      return;
    }
    if (disposed) return void dispose();
    showError('');
    setChildren(body, h('h2', { text: 'Rajaa mallin pätkä' }),
      h('p', { class: 'hint', text: 'Valitse kohta, jossa tanssi alkaa ja loppuu.' }),
      holder,
      h('button', { type: 'button', class: 'btn btn-primary btn-block', onClick: () => stepProcess(file, trim.getRange()) }, 'Jatka'),
      h('button', { type: 'button', class: 'btn btn-block', onClick: () => stepPick() }, 'Vaihda video'),
    );
  }

  async function stepProcess(file, range) {
    dispose();
    showError('');
    let track;
    try {
      track = await runExtraction(body, ctx, file, range, running);
    } catch (e) {
      if (disposed) return;
      await stepTrim(file, range);
      showError(errorText(e), errorDetail(e));
      return;
    }
    if (disposed) return;
    if (!track) return void stepTrim(file, range);
    await stepPreview(file, range, track);
  }

  async function stepPreview(file, range, track) {
    dispose();
    const detected = track.frames.filter((f) => f.lm).length;
    const usable = track.frames.length > 0 && detected / track.frames.length >= MIN_DETECTED_SHARE;
    let mirrored = false;

    const holder = h('div', {});
    const nameInput = h('input', { type: 'text', id: 'ref-name', class: 'input', maxlength: 40, autocomplete: 'off', value: sourceName });
    const styleSelect = h('select', { id: 'ref-style', class: 'input' },
      ...styles.map((s) => h('option', { value: s.id, selected: s.id === defaultStyle }, s.name)));
    const mirrorBox = h('input', { type: 'checkbox', id: 'ref-mirror' });
    const keepBox = h('input', { type: 'checkbox', id: 'ref-keep', checked: defaultKeepVideo(file.size) });
    const saveBtn = h('button', { type: 'button', class: 'btn btn-primary btn-block' }, 'Tallenna');
    let saving = false;
    const syncSave = () => {
      saveBtn.disabled = saving || !usable || nameInput.value.trim() === '';
      saveBtn.textContent = saving ? 'Tallennetaan…' : 'Tallenna';
    };
    nameInput.addEventListener('input', syncSave);

    setChildren(body, h('h2', { text: 'Esikatselu' }),
      usable ? null : h('p', { class: 'notice notice-error', text: COPY.noPerson }),
      holder,
      h('label', { class: 'option', for: 'ref-mirror' }, mirrorBox,
        h('span', { class: 'option-text' },
          h('span', { class: 'option-label', text: 'Malli on peilikuva' }),
          h('span', { class: 'option-hint', text: 'Valitse, jos opetusvideo on kuvattu peilikuvana.' }))),
      h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'ref-name', text: 'Nimi' }), nameInput),
      h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'ref-style', text: 'Laji' }), styleSelect),
      h('label', { class: 'option', for: 'ref-keep' }, keepBox,
        h('span', { class: 'option-text' },
          h('span', { class: 'option-label', text: 'Tallenna myös video puhelimeen' }),
          h('span', { class: 'option-hint', text: `${COPY.keepVideoHint} Koko video tallennetaan: ${formatBytes(file.size)}.` }))),
      saveBtn,
      h('button', { type: 'button', class: 'btn btn-block', onClick: () => stepTrim(file, range) }, 'Takaisin rajaukseen'),
    );
    syncSave();

    try {
      stage = await mountStage(holder, file, {
        start: range.start,
        end: range.end,
        overlayId: 'preview-overlay',
        onError: (detail) => showError(COPY.playbackFailed, detail),
        draw(ctx2d, t, width, height) {
          const frame = track.frames[Math.min(track.frames.length - 1, Math.round(t * track.fps))];
          if (!frame || !frame.lm) return;
          drawSkeleton(ctx2d, mirrored ? mirrorLandmarks(frame.lm) : frame.lm, { width, height, variant: 'user' });
        },
      });
    } catch (e) {
      if (!disposed) showError(errorText(e), errorDetail(e));
    }
    if (disposed) return void dispose();

    mirrorBox.addEventListener('change', () => {
      mirrored = mirrorBox.checked;
      stage?.setMirrored(mirrored);
      stage?.redraw();
    });

    saveBtn.addEventListener('click', async () => {
      if (saveBtn.disabled) return;
      saving = true;
      syncSave();
      showError('');
      const styleId = styleSelect.value;
      try {
        await ctx.store.saveReference({
          id: newId(),
          name: nameInput.value.trim(),
          styleId,
          mirrored,
          track: mirrored ? mirrorTrack(track) : track,
          clip: { start: range.start, end: range.end },
          video: keepBox.checked ? file : null,
          createdAt: new Date().toISOString(),
        });
      } catch (e) {
        saving = false;
        syncSave();
        // Suuren videon tallennus voi epäonnistua muustakin syystä kuin tilan loppumisesta.
        diag.log('tallennus-virhe', { tieto: errorDetail(e), video: keepBox.checked, 'koko-mt': (file.size / (1024 * 1024)).toFixed(1) });
        showError(!(e instanceof StoreFullError) && keepBox.checked ? COPY.saveFailedWithVideo : errorText(e), errorDetail(e));
        errorBox.scrollIntoView({ block: 'center' });
        return;
      }
      ctx.navigate('#kirjasto', { styleId });
    });
  }

  stepPick();

  return () => {
    disposed = true;
    running.abort?.();
    dispose();
  };
}
