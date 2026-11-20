import { h } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { episodeLabel, formatDate } from '../../utils/format.js';
import { t } from '../../i18n/i18n.js';
import { releaseList } from './releaseList.js';
import { renderShowSections } from './seriesResults.js';

/** Focused season, latest episode (with its releases) and next episode of a show. */
function renderShowInfo(title, actions, base) {
  const { details, latest } = title;
  if (!details) return null;
  const season = details.seasons.find((s) => s.number === details.focusSeason);
  const last = details.lastEpisode;
  const next = details.nextEpisode;
  const parts = [];

  if (season) {
    parts.push(h('div', { class: 'show-season' },
      h('span', { class: 'badge badge-default' }, t('series.season', { n: season.number })),
      h('span', { class: 'show-season-name' }, season.name),
      h('span', { class: 'summary-meta' }, t('series.episodes', { count: season.episodeCount })),
    ));
  }

  if (last) {
    const label = episodeLabel(last.season, last.episode);
    const context = {
      ...base,
      title: `${title.title} ${label}`,
      kind: 'series',
      show: title.title,
      season: last.season,
      episode: last.episode,
      alternatives: latest,
    };
    parts.push(h('div', { class: 'latest-episode' },
      h('div', { class: 'latest-head' },
        h('span', { class: 'latest-label' }, icon('circle-play'), t('series.latestEpisode')),
        h('span', { class: 'latest-title' }, `${label}${last.name ? ` · ${last.name}` : ''}`),
        last.airDate && h('span', { class: 'summary-meta' }, t('series.aired', { date: formatDate(last.airDate) })),
      ),
      latest.length
        ? releaseList(latest, {
          visible: 2,
          onWatch: (release) => actions.watch(release, context),
          onDownload: (release) => actions.download(release, context),
        })
        : h('div', { class: 'title-empty' }, icon('info'), t('series.latestNotAvailable')),
    ));
  }

  if (next) {
    parts.push(h('div', { class: 'next-episode' }, icon('info'),
      t('series.nextEpisode', { label: episodeLabel(next.season, next.episode), date: formatDate(next.airDate) })));
  }
  return parts;
}

/**
 * TMDB-identified titles: poster, title, year, rating and overview, followed by
 * the matching releases (movies) or season info + seasons/episodes (series).
 * @param {object[]} titles
 * @param {{watch:Function, download:Function}} actions
 */
export function renderTitleResults(titles, actions) {
  return titles.map((title) => {
    const isSeries = title.kind === 'series';
    const displayTitle = title.year ? `${title.title} (${title.year})` : title.title;
    const base = { tmdbId: title.tmdbId, posterUrl: title.posterUrl, year: title.year };

    const header = h('div', { class: 'title-card-header' },
      title.posterUrl
        ? h('img', { class: 'title-poster', src: title.posterUrl, alt: '', loading: 'lazy' })
        : h('div', { class: 'title-poster placeholder' }, icon(isSeries ? 'tv' : 'film', { size: 28 })),
      h('div', { class: 'title-info' },
        h('div', { class: 'title-heading' },
          h('h3', { class: 'card-title' }, title.title, ' ', title.year && h('span', { class: 'muted' }, `(${title.year})`)),
        ),
        h('div', { class: 'library-badges' },
          h('span', { class: 'badge badge-outline' }, icon(isSeries ? 'tv' : 'film'), t(isSeries ? 'search.kindSeries' : 'search.kindMovie')),
          title.rating > 0 && h('span', { class: 'badge badge-outline' }, `TMDB ${title.rating.toFixed(1)}`),
          isSeries && title.details && h('span', { class: 'badge badge-outline' }, t('series.seasons', { count: title.details.seasons.length })),
          h('span', { class: 'badge badge-secondary' }, t('release.releases', { count: title.releaseCount })),
        ),
        title.overview && h('p', { class: 'title-overview' }, title.overview),
        isSeries && renderShowInfo(title, actions, base),
      ),
    );

    let body;
    if (!title.releaseCount) {
      body = h('div', { class: 'title-empty' }, icon('info'), t('search.noReleasesForTitle'));
    } else if (isSeries) {
      body = title.show ? renderShowSections(title.show, actions, base, { openSeason: title.details?.focusSeason }) : null;
    } else {
      const context = { ...base, title: displayTitle, kind: 'movie', alternatives: title.releases };
      body = releaseList(title.releases, {
        onWatch: (release) => actions.watch(release, context),
        onDownload: (release) => actions.download(release, context),
      });
    }

    return h('div', { class: 'card title-card' }, header, body);
  });
}
