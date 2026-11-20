import { $$ } from '../utils/dom.js';

const listeners = new Set();
let current = 'search';

/** Sidebar navigation: every element with data-tab switches the visible view. */
export function initTabs() {
  for (const item of $$('.sidebar [data-tab]')) {
    item.addEventListener('click', () => showTab(item.dataset.tab));
  }
}

export function showTab(name) {
  if (name === current) return;
  const previous = current;
  current = name;
  for (const item of $$('.sidebar [data-tab]')) item.classList.toggle('active', item.dataset.tab === name);
  for (const view of $$('main > .view')) view.classList.toggle('active', view.id === `view-${name}`);
  for (const listener of listeners) listener(name, previous);
}

export const currentTab = () => current;

export function onTabChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
