import { h } from '../../utils/dom.js';
import { t } from '../../i18n/i18n.js';
import { releaseList } from './releaseList.js';

/**
 * Movie search results: one card per title, best quality release first.
 * @param {object[]} groups
 * @param {{watch:Function, download:Function}} actions
 */
export function renderMovieResults(groups, actions) {
  return groups.map((group) => {
    const title = group.year ? `${group.title} (${group.year})` : group.title;
    const context = { title, kind: 'movie', year: group.year, alternatives: group.releases };
    return h('div', { class: 'card' },
      h('div', { class: 'card-header' },
        h('h3', { class: 'card-title' }, group.title, ' ', group.year && h('span', { class: 'muted' }, `(${group.year})`)),
        h('span', { class: 'badge badge-secondary card-meta' }, t('release.releases', { count: group.releases.length })),
      ),
      releaseList(group.releases, {
        onWatch: (release) => actions.watch(release, context),
        onDownload: (release) => actions.download(release, context),
      }),
    );
  });
}
