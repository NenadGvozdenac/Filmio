// Applies the light/dark theme. 'system' follows the OS preference live.

const media = window.matchMedia('(prefers-color-scheme: dark)');
let preference = 'system';

function resolve() {
  return preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
}

function render() {
  document.documentElement.dataset.theme = resolve();
}

media.addEventListener('change', () => {
  if (preference === 'system') render();
});

/** @param {'system'|'dark'|'light'} theme */
export function applyTheme(theme) {
  preference = ['system', 'dark', 'light'].includes(theme) ? theme : 'system';
  render();
}
