import en from './locales/en.js';
import sr from './locales/sr.js';

const LOCALES = { en, sr };
const listeners = new Set();
let language = 'en';

function lookup(dict, key) {
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dict);
}

/**
 * Picks a plural form ({ one, few, other, ... }) for `count` using the language's plural rules.
 * Serbian, for example, uses one / few / other: 1 verzija, 2 verzije, 5 verzija.
 */
function pluralize(forms, count, lang) {
  const category = new Intl.PluralRules(lang).select(Number(count) || 0);
  return forms[category] ?? forms.other;
}

/**
 * Translates a dotted key, e.g. t('downloads.peers', { count: 5 }).
 * Values can be strings or plural objects. Falls back to English, then the key itself.
 */
export function t(key, params = {}) {
  let template = lookup(LOCALES[language], key);
  let lang = language;
  if (template == null) {
    template = lookup(en, key);
    lang = 'en';
  }
  if (template == null) return key;
  if (typeof template === 'object') template = pluralize(template, params.count, lang);
  return String(template).replace(/\{(\w+)\}/g, (_, name) => (params[name] ?? `{${name}}`));
}

export const getLanguage = () => language;

export function setLanguage(next) {
  if (!LOCALES[next] || next === language) return;
  language = next;
  document.documentElement.lang = next;
  applyTranslations();
  for (const listener of listeners) listener(language);
}

export function onLanguageChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Translates static markup:
 *   data-i18n="key"             -> textContent
 *   data-i18n-placeholder="key" -> placeholder
 *   data-i18n-title="key"       -> title
 */
export function applyTranslations(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
}

/** Error (or error code / message string) -> text in the current language. */
export function errorText(error) {
  const code = typeof error === 'string' ? error : error?.code;
  if (code && lookup(en.errors, code) != null) return t(`errors.${code}`, error?.params ?? {});
  if (typeof error === 'string') return error;
  return error?.message || t('errors.unknown');
}
