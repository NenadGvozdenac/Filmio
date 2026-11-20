import { h } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';

/** Collapsible section (details/summary) with a rotating chevron. */
export function collapsible(open, summary, children) {
  return h('details', { class: 'collapsible', open },
    h('summary', {}, icon('chevron-down', { class: 'chevron' }), summary),
    children,
  );
}
