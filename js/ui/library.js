// Kirjasto: lajit kansioina ja niiden alla tallennetut mallit.
import { COPY } from './copy.js';
import { h, formatDuration, newId, setChildren } from './dom.js';
import { confirmDialog, promptDialog } from './dialog.js';

const PROTECTED_STYLE = 'muu';

/** @param {HTMLElement} root @param {import('../app.js').AppContext} ctx */
export async function render(root, ctx) {
  const { store } = ctx;
  if (ctx.params.styleId) ctx.state.styleId = ctx.params.styleId;

  const chipRow = h('div', { class: 'chip-row', role: 'group', 'aria-label': 'Tanssilajit' });
  const styleActions = h('div', { class: 'style-actions' });
  const list = h('div', { class: 'ref-list' });
  const heading = h('h1', { tabindex: '-1', text: 'Kirjasto' });

  root.append(
    heading,
    chipRow,
    styleActions,
    h('button', { type: 'button', class: 'btn btn-primary btn-block', onClick: () => ctx.navigate('#lisaa-malli', { styleId: ctx.state.styleId }) }, 'Lisää malli'),
    list,
  );

  async function refresh() {
    const styles = await store.listStyles();
    if (!styles.some((s) => s.id === ctx.state.styleId)) ctx.state.styleId = styles[0]?.id || PROTECTED_STYLE;
    const current = styles.find((s) => s.id === ctx.state.styleId);

    setChildren(chipRow, ...styles.map((s) => h('button', {
        type: 'button', class: 'chip', 'data-style': s.id, 'aria-pressed': String(s.id === current.id),
        onClick: () => {
          ctx.state.styleId = s.id;
          refresh();
        },
      }, s.name)),
      h('button', { type: 'button', class: 'chip chip-add', 'aria-label': 'Lisää laji', onClick: addStyle }, '+ Laji'),
    );

    setChildren(styleActions, h('button', { type: 'button', class: 'btn btn-quiet', onClick: () => renameStyle(current) }, 'Nimeä uudelleen'),
      current.id !== PROTECTED_STYLE
        ? h('button', { type: 'button', class: 'btn btn-quiet', onClick: () => removeStyle(current) }, 'Poista laji')
        : null,
    );

    const refs = await store.listReferences(current.id);
    if (!refs.length) {
      setChildren(list, h('p', { class: 'empty', text: COPY.emptyStyle }));
      return;
    }
    setChildren(list, ...refs.map((r) => h('article', { class: 'ref-card' },
      h('div', { class: 'ref-info' },
        h('h2', { text: r.name }),
        h('p', { class: 'meta' },
          formatDuration(r.track.frames.length / r.track.fps),
          r.mirrored ? ' · peilikuva' : '',
        ),
      ),
      h('div', { class: 'ref-actions' },
        h('button', { type: 'button', class: 'btn btn-primary', 'aria-label': `Analysoi mallilla ${r.name}`, onClick: () => ctx.navigate('#analysoi', { referenceId: r.id }) }, 'Analysoi'),
        h('button', { type: 'button', class: 'btn btn-quiet', 'aria-label': `Poista ${r.name}`, onClick: () => removeReference(r) }, 'Poista'),
      ),
    )));
  }

  async function addStyle() {
    const name = await promptDialog({ title: 'Uusi laji', label: 'Lajin nimi' });
    if (!name) return;
    const styles = await store.listStyles();
    const id = newId();
    await store.saveStyle({ id, name, order: Math.max(-1, ...styles.map((s) => s.order)) + 1 });
    ctx.state.styleId = id;
    await refresh();
  }

  async function renameStyle(style) {
    const name = await promptDialog({ title: 'Nimeä laji uudelleen', label: 'Lajin nimi', value: style.name });
    if (!name) return;
    await store.saveStyle({ ...style, name });
    await refresh();
  }

  async function removeStyle(style) {
    const ok = await confirmDialog({
      title: `Poistetaanko laji ${style.name}?`,
      body: 'Mallit siirtyvät lajiin Muu.',
      confirmLabel: 'Poista',
      danger: true,
    });
    if (!ok) return;
    await store.deleteStyle(style.id);
    ctx.state.styleId = PROTECTED_STYLE;
    await refresh();
  }

  async function removeReference(ref) {
    const ok = await confirmDialog({
      title: `Poistetaanko malli ${ref.name}?`,
      body: 'Poistoa ei voi perua.',
      confirmLabel: 'Poista',
      danger: true,
    });
    if (!ok) return;
    await store.deleteReference(ref.id);
    await refresh();
  }

  await refresh();
}
