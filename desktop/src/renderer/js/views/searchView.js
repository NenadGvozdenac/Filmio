import { h, $, clear } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { searchReleases } from '../services/searchService.js';
import { t, errorText, onLanguageChange } from '../i18n/i18n.js';
import { renderMovieResults } from './components/movieResults.js';
import { renderSeriesResults } from './components/seriesResults.js';
import { renderTitleResults } from './components/titleResults.js';
import { showTab } from './tabs.js';

const errorAlert = (text) => h('div', { class: 'alert destructive' }, icon('alert'), h('span', {}, text));

/** Shown while no TMDB key is configured. */
const tmdbHint = () => h('div', { class: 'alert' }, icon('info'),
  h('span', {}, t('search.tmdbHint'), ' ',
    h('button', { class: 'link-button', type: 'button', onClick: () => showTab('settings') }, t('search.openSettings'))));

/**
 * Search tab: one search box. Results are split automatically into movies and
 * series, and re-rendered when the UI language changes.
 * @param {{watch:Function, download:Function}} actions
 */
export function initSearchView(actions) {
  const form = $('#search-form');
  const input = $('#search-query');
  const status = $('#search-status');
  const results = $('#search-results');
  let requestId = 0;
  let last = null; // { response } or { error }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) return;

    const id = ++requestId;
    clear(status).append(h('span', {}, t('search.searching')));
    clear(results);
    try {
      const response = await searchReleases(query);
      if (id !== requestId) return; // a newer search started meanwhile
      last = { response };
    } catch (error) {
      if (id !== requestId) return;
      last = { error };
    }
    render();
  });

  function render() {
    if (!last) return;
    clear(results);
    if (last.error) {
      clear(status).append(errorAlert(errorText(last.error)));
      return;
    }
    const { count, titles, movies, series, hiddenNonMp4, errors } = last.response;
    let summary = t('release.releases', { count });
    if (hiddenNonMp4) summary += t('search.hiddenNonMp4', { count: hiddenNonMp4 });
    clear(status).append(h('span', {}, summary));
    for (const error of errors) {
      if (error.hint) status.append(tmdbHint());
      else status.append(errorAlert(error.code ? errorText(error) : `${error.provider}: ${error.message}`));
    }

    if (!titles.length && !movies.length && !series.length) {
      results.append(h('div', { class: 'empty' }, icon('search'), h('span', {}, t('search.noResults'))));
      return;
    }
    // TMDB matches first: exactly what was searched for.
    if (titles.length) results.append(...renderTitleResults(titles, actions));

    // Everything that did not match a TMDB title.
    const hasOther = movies.length || series.length;
    if (hasOther && titles.length) results.append(h('h2', { class: 'section-title' }, icon('search'), t('search.otherResults')));
    if (movies.length) {
      if (!titles.length) results.append(h('h2', { class: 'section-title' }, icon('film'), t('library.movies')));
      results.append(...renderMovieResults(movies, actions));
    }
    if (series.length) {
      if (!titles.length) results.append(h('h2', { class: 'section-title' }, icon('tv'), t('library.series')));
      results.append(...renderSeriesResults(series, actions));
    }
  }

  onLanguageChange(render);
}
