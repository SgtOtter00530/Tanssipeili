// Sivun omat dialogit (ei selaimen alert/confirm/prompt-ikkunoita).
import { h } from './dom.js';

function open(dialog) {
  document.body.append(dialog);
  dialog.showModal();
}

/**
 * @param {{title: string, body?: string, confirmLabel?: string, cancelLabel?: string, danger?: boolean}} opts
 * @returns {Promise<boolean>}
 */
export function confirmDialog(opts) {
  return new Promise((resolve) => {
    const dialog = h('dialog', { class: 'dialog', 'aria-labelledby': 'dialog-title' },
      h('h2', { id: 'dialog-title', text: opts.title }),
      opts.body ? h('p', { text: opts.body }) : null,
      h('div', { class: 'dialog-actions' },
        h('button', { type: 'button', class: 'btn', onClick: () => dialog.close('cancel') }, opts.cancelLabel || 'Peruuta'),
        h('button', { type: 'button', class: `btn ${opts.danger ? 'btn-danger' : 'btn-primary'}`, onClick: () => dialog.close('ok') }, opts.confirmLabel || 'OK'),
      ),
    );
    dialog.addEventListener('close', () => {
      const ok = dialog.returnValue === 'ok';
      dialog.remove();
      resolve(ok);
    });
    open(dialog);
  });
}

/**
 * Kysyy yhden tekstin. Tyhjää (pelkkiä välilyöntejä) ei voi tallentaa.
 * @param {{title: string, label: string, value?: string, maxLength?: number, confirmLabel?: string}} opts
 * @returns {Promise<string|null>} null, jos käyttäjä perui
 */
export function promptDialog(opts) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'text', id: 'dialog-input', class: 'input', maxlength: opts.maxLength || 30, autocomplete: 'off', value: opts.value || '' });
    const save = h('button', { type: 'submit', class: 'btn btn-primary' }, opts.confirmLabel || 'Tallenna');
    const sync = () => {
      save.disabled = input.value.trim() === '';
    };
    input.addEventListener('input', sync);
    sync();
    const dialog = h('dialog', { class: 'dialog', 'aria-labelledby': 'dialog-title' },
      h('form', { method: 'dialog', onSubmit: (e) => {
        e.preventDefault();
        if (input.value.trim() !== '') dialog.close('ok');
      } },
        h('h2', { id: 'dialog-title', text: opts.title }),
        h('label', { class: 'field-label', for: 'dialog-input', text: opts.label }),
        input,
        h('div', { class: 'dialog-actions' },
          h('button', { type: 'button', class: 'btn', onClick: () => dialog.close('cancel') }, 'Peruuta'),
          save,
        ),
      ),
    );
    dialog.addEventListener('close', () => {
      const value = dialog.returnValue === 'ok' ? input.value.trim() : null;
      dialog.remove();
      resolve(value);
    });
    open(dialog);
    input.select();
  });
}
