import { h } from '../../utils/dom.js';

/**
 * Modal dialog in the shadcn AlertDialog style.
 * Resolves with the `value` of the clicked action, or null when cancelled (Esc / backdrop).
 *
 * @param {{title:string, description?:string, actions:{label:string, value:any, variant?:string}[]}} options
 * @returns {Promise<any>}
 */
export function showDialog({ title, description, actions }) {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;

    const close = (value) => {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      previousFocus?.focus?.();
      resolve(value);
    };

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close(null);
      }
    };

    const buttons = actions.map((action) => h('button', {
      class: `btn btn-${action.variant ?? 'outline'}`,
      onClick: () => close(action.value),
    }, action.label));

    const panel = h('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true' },
      h('div', { class: 'dialog-header' },
        h('h2', { class: 'dialog-title' }, title),
        description && h('p', { class: 'dialog-description' }, description),
      ),
      h('div', { class: 'dialog-footer' }, buttons),
    );

    const overlay = h('div', { class: 'dialog-overlay', onMousedown: (e) => { if (e.target === overlay) close(null); } }, panel);
    document.body.append(overlay);
    document.addEventListener('keydown', onKey, true);
    buttons.at(-1)?.focus();
  });
}
