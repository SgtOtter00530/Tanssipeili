// Asetukset: palautteen tarkkuus ja tietoa sovelluksen rajoista.
import { COPY } from './copy.js';
import { h } from './dom.js';
import { diag } from '../core/diag.js';
import { VERSION } from '../version.js';

const OPTIONS = [
  { value: 'salliva', label: 'Salliva', hint: 'Pienet erot hyväksytään. Hyvä uutta liikettä opetellessa.' },
  { value: 'normaali', label: 'Normaali', hint: 'Sopii useimpiin harjoituksiin.' },
  { value: 'tarkka', label: 'Tarkka', hint: 'Pienetkin erot näkyvät. Hiomiseen.' },
];

/** @param {HTMLElement} root @param {import('../app.js').AppContext} ctx */
export async function render(root, ctx) {
  const settings = await ctx.store.getSettings();

  const options = OPTIONS.map((o) => {
    const input = h('input', { type: 'radio', name: 'strictness', value: o.value, id: `strictness-${o.value}`, checked: settings.strictness === o.value });
    input.addEventListener('change', () => {
      if (!input.checked) return;
      // Tallennus käynnistetään heti samassa tapahtumassa, jotta se ehtii ennen sivulta poistumista.
      settings.strictness = o.value;
      ctx.store.saveSettings({ ...settings }).catch(() => {});
    });
    return h('label', { class: 'option', for: `strictness-${o.value}` },
      input,
      h('span', { class: 'option-text' }, h('span', { class: 'option-label', text: o.label }), h('span', { class: 'option-hint', text: o.hint })),
    );
  });

  root.append(
    h('h1', { tabindex: '-1', text: 'Asetukset' }),
    h('section', {},
      h('h2', { text: 'Palautteen tarkkuus' }),
      h('fieldset', { class: 'options' }, h('legend', { class: 'visually-hidden', text: 'Palautteen tarkkuus' }), ...options),
    ),
    h('section', {},
      h('h2', { text: 'Mitä Tanssipeili tekee' }),
      h('p', { text: COPY.honesty }),
      h('p', { text: 'Jos mallivideo on huono, palaute ohjaa kohti huonoa mallia. Valitse malliksi suoritus, jota haluat tavoitella.' }),
    ),
    h('section', {},
      h('h2', { text: 'Milloin palaute toimii parhaiten' }),
      h('ul', {},
        h('li', { text: 'Oma video on kuvattu samasta kulmasta kuin malli.' }),
        h('li', { text: 'Koko keho näkyy koko ajan ja valoa on riittävästi.' }),
        h('li', { text: 'Kuvassa on vain yksi tanssija.' }),
        h('li', { text: 'Hyvin nopeat liikkeet ja löysät vaatteet voivat heikentää tunnistusta. Epävarmat kohdat näkyvät harmaina.' }),
      ),
    ),
    h('section', {},
      h('h2', { text: 'Yksityisyys' }),
      h('p', { text: COPY.privacy }),
    ),
    diagSection(),
  );
}

function diagSection() {
  const area = h('textarea', { id: 'diag-log', class: 'input diag-log', readonly: true, rows: 8, 'aria-label': 'Vianmäärityksen loki' });
  const status = h('span', { class: 'hint', role: 'status' });
  const refresh = () => {
    area.value = diag.format() || 'Loki on tyhjä.';
  };
  refresh();
  const copy = h('button', { type: 'button', class: 'btn', onClick: async () => {
    try {
      await navigator.clipboard.writeText(area.value);
      status.textContent = 'Kopioitu.';
    } catch {
      // Jos leikepöytä ei ole käytettävissä, valitaan teksti käsin kopioitavaksi.
      area.focus();
      area.select();
      status.textContent = 'Valitse Kopioi puhelimen valikosta.';
    }
  } }, 'Kopioi loki');
  const clear = h('button', { type: 'button', class: 'btn btn-quiet', onClick: () => {
    diag.clear();
    refresh();
    status.textContent = 'Tyhjennetty.';
  } }, 'Tyhjennä loki');
  return h('section', {},
    h('h2', { text: 'Vianmääritys' }),
    h('p', { id: 'app-version', class: 'hint', text: `Versio ${VERSION}` }),
    h('p', { class: 'hint', text: COPY.diagIntro }),
    area,
    h('div', { class: 'diag-actions' }, copy, clear, status),
  );
}
