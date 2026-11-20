import { h } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { episodeLabel } from '../../utils/format.js';
import { t } from '../../i18n/i18n.js';
import { releaseList } from './releaseList.js';

/** Collapsible section (details/summary) with a rotating chevron. */
export function collapsible(open, summary, children) {
  return h('details', { class: 'collapsible', open },
    h('summary', {}, icon('chevron-down', { class: 'chevron' }), summary),
    children,
  );
}

/**
 * Seasons of one show (packs + episodes) as collapsible sections.
 * @param {{title:string, seasons:object[], other:object[]}} show
 * @param {{watch:Function, download:Function}} actions
 * @param {object} base extra download context (e.g. tmdbId, posterUrl)
 * @param {{openSeason?:number|null}} options season to expand (default: the first one)
 */
export function renderShowSections(show, actions, base = {}, { openSeason = null } = {}) {
  const listFor = (releases, context, visible) => releaseList(releases, {
    visible,
    onWatch: (release) => actions.watch(release, { ...base, ...context }),
    onDownload: (release) => actions.download(release, { ...base, ...context }),
  });

  const sections = show.seasons.map((season, i) => {
    const children = [];
    if (season.packs.length) {
      const context = {
        title: `${show.title} ${episodeLabel(season.season)} ${t('series.fullSeasonSuffix')}`,
        kind: 'series',
        show: show.title,
        season: season.season,
        pack: true,
        alternatives: season.packs,
      };
      children.push(h('div', { class: 'sub-head' }, t('series.fullSeason')), listFor(season.packs, context, 2));
    }
    for (const ep of season.episodes) {
      const label = episodeLabel(season.season, ep.episode, ep.episodeEnd);
      const context = {
        title: `${show.title} ${label}`,
        kind: 'series',
        show: show.title,
        season: season.season,
        episode: ep.episode,
        alternatives: ep.releases,
      };
      children.push(
        h('div', { class: 'sub-head' }, t('series.episodeHead', { label, releases: t('release.releases', { count: ep.releases.length }) })),
        listFor(ep.releases, context, 1),
      );
    }
    // "3 episodes", "3 episodes + full season" or just "Full season".
    let info = season.episodes.length ? t('series.episodes', { count: season.episodes.length }) : '';
    if (season.packs.length) info = info ? info + t('series.withPacks') : t('series.fullSeason');
    const open = openSeason != null && show.seasons.some((s) => s.season === openSeason)
      ? season.season === openSeason
      : i === 0;
    return collapsible(open, [t('series.season', { n: season.season }), h('span', { class: 'summary-meta' }, info)], children);
  });

  if (show.other.length) {
    const context = { title: show.title, kind: 'series', show: show.title, pack: true, alternatives: show.other };
    sections.push(collapsible(!show.seasons.length, t('series.other'), listFor(show.other, context, 4)));
  }
  return sections;
}

/**
 * Series search results (without TMDB match): one card per show.
 * @param {object[]} shows
 * @param {{watch:Function, download:Function}} actions
 */
export function renderSeriesResults(shows, actions) {
  return shows.map((show) => h('div', { class: 'card' },
    h('div', { class: 'card-header' },
      h('h3', { class: 'card-title' }, show.title),
      h('span', { class: 'badge badge-secondary card-meta' }, t('series.seasons', { count: show.seasons.length })),
    ),
    renderShowSections(show, actions),
  ));
}
