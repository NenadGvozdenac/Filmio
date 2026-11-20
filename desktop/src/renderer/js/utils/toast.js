import { h, $ } from './dom.js';
import { icon } from './icons.js';
import { errorText } from '../i18n/i18n.js';

/** Shows a short notification in the bottom-right corner (sonner style). */
export function toast(message, type = 'success', durationMs = 3500) {
  const el = h('div', { class: `toast ${type}`, role: 'status' },
    icon(type === 'error' ? 'alert' : type === 'info' ? 'info' : 'circle-check'),
    h('span', {}, message),
  );
  $('#toasts').append(el);
  setTimeout(() => el.remove(), durationMs);
}

export const toastError = (err) => toast(errorText(err), 'error', 6000);
