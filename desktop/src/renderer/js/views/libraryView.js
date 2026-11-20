import { h, $, $$, clear } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { formatBytes, formatPercent, episodeLabel } from '../utils/format.js';
import { t, onLanguageChange } from '../i18n/i18n.js';
import * as downloads from '../services/downloadService.js';
import { collapsible } from './components/collapsible.js';

const normalize = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Status badge for a download: downloading / paused / seeding / completed. */
function statusBadge(d) {
  if (d.error) return h('span', { class: 'badge badge-destructive' }, icon('alert'), t('library.error'));
  if (d.done) {
    return d.seeding
      ? h('span', { class: 'badge badge-success' }, icon('upload'), t('library.seeding'))
      : h('span', { class: 'badge badge-outline' }, icon('check'), t('library.completed'));
  }
  if (d.paused) return h('span', { class: 'badge badge-outline' }, icon('pause'), t('library.paused'));
  return h('span', { class: 'badge badge-secondary' }, icon('arrow-down'), formatPercent(d.progress));
}

/**
 * Groups downloads into movies and shows.
 * Every downloaded episode file becomes an entry; season packs are flagged so the
 * season is presented as one set.
 */
function buildLibrary(list) {
  const movies = [];
  const shows = new Map();

  for (const d of list) {
    if (!d.files?.length) continue;
    if (d.kind !== 'series') {
      movies.push(d);
      continue;
    }
    const name = d.show || d.title;
    const key = normalize(name);
    if (!shows.has(key)) shows.set(key, { title: name, seasons: new Map(), addedAt: 0, posterUrl: null });
    const show = shows.get(key);
    show.addedAt = Math.max(show.addedAt, d.addedAt);
    show.posterUrl ??= d.posterUrl ?? null;

    for (const file of d.files) {
      const seasonNo = file.episode?.season ?? d.season ?? 0;
      if (!show.seasons.has(seasonNo)) show.seasons.set(seasonNo, { season: seasonNo, episodes: [], packs: [] });
      const season = show.seasons.get(seasonNo);
      if (d.pack && !season.packs.includes(d)) season.packs.push(d);
      season.episodes.push({
        download: d,
        file,
        episode: file.episode?.episode ?? d.episode ?? null,
        episodeEnd: file.episode?.episodeEnd ?? null,
      });
    }
  }

  return {
    movies: movies.sort((a, b) => b.addedAt - a.addedAt),
    shows: [...shows.values()]
      .sort((a, b) => b.addedAt - a.addedAt)
      .map((show) => ({
        ...show,
        seasons: [...show.seasons.values()]
          .sort((a, b) => a.season - b.season)
          .map((s) => ({ ...s, episodes: s.episodes.sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0)) })),
      })),
  };
}

/**
 * Library tab: downloaded movies and series.
 * @param {{play:(infoHash:string, context:object) => void}} actions
 */
export function initLibraryView(actions) {
  const content = $('#library-content');
  const empty = $('#library-empty');
  const openSections = new Set(); // keeps expanded seasons open across re-renders
  let filter = 'all';
  let lastList = [];
  let lastSignature = '';

  for (const trigger of $$('#library-filter .tabs-trigger')) {
    trigger.addEventListener('click', () => {
      filter = trigger.dataset.filter;
      $$('#library-filter .tabs-trigger').forEach((x) => x.classList.toggle('active', x === trigger));
      render(lastList, true);
    });
  }

  function movieCard(d) {
    return h('div', { class: 'card library-card' },
      h('div', { class: 'library-poster' },
        d.posterUrl ? h('img', { src: d.posterUrl, alt: '', loading: 'lazy' }) : icon('film', { size: 32 })),
      h('div', { class: 'library-body' },
        h('div', { class: 'library-title', title: d.title }, d.title),
        h('div', { class: 'library-badges' },
          d.quality && h('span', { class: 'badge badge-secondary' }, d.quality),
          statusBadge(d),
        ),
        h('div', { class: 'library-meta' }, formatBytes(d.length)),
      ),
      h('div', { class: 'library-actions' },
        h('button', {
          class: 'btn btn-default btn-sm',
          disabled: d.playable === false,
          onClick: () => actions.play(d.infoHash, { title: d.title, kind: 'movie' }),
        }, icon('play'), t('library.play')),
      ),
    );
  }

  function episodeRow(show, seasonNo, entry) {
    const { download: d, file } = entry;
    const label = entry.episode != null ? episodeLabel(seasonNo, entry.episode, entry.episodeEnd) : file.name;
    return h('div', { class: 'release library-episode' },
      h('div', { class: 'episode-label' }, label),
      h('div', { class: 'name', title: file.name }, file.name),
      h('div', { class: 'meta' }, d.quality && h('span', { class: 'badge badge-outline' }, d.quality), formatBytes(file.length)),
      h('div', { class: 'meta' }, statusBadge(d)),
      h('div', { class: 'actions' },
        h('button', {
          class: 'btn btn-default btn-sm',
          disabled: !file.playable,
          onClick: () => actions.play(d.infoHash, {
            title: entry.episode != null ? `${show.title} ${label}` : show.title,
            kind: 'series',
            show: show.title,
            fileIndex: file.index,
          }),
        }, icon('play'), t('library.play')),
      ),
    );
  }

  function showCard(show) {
    const episodeCount = show.seasons.reduce((sum, s) => sum + s.episodes.length, 0);
    return h('div', { class: 'card' },
      h('div', { class: 'card-header' },
        show.posterUrl
          ? h('img', { class: 'library-show-poster', src: show.posterUrl, alt: '', loading: 'lazy' })
          : h('div', { class: 'library-show-icon' }, icon('tv')),
        h('h3', { class: 'card-title' }, show.title),
        h('span', { class: 'badge badge-secondary card-meta' }, t('series.episodes', { count: episodeCount })),
      ),
      show.seasons.map((season) => {
        const key = `${normalize(show.title)}|${season.season}`;
        const isSet = season.packs.length > 0;
        const section = collapsible(openSections.has(key) || show.seasons.length === 1, [
          season.season ? t('series.season', { n: season.season }) : t('series.other'),
          isSet && h('span', { class: 'badge badge-outline' }, icon('layers'), t('library.fullSeason')),
          h('span', { class: 'summary-meta' }, t('series.episodes', { count: season.episodes.length })),
        ], season.episodes.map((entry) => episodeRow(show, season.season, entry)));
        section.addEventListener('toggle', () => {
          if (section.open) openSections.add(key);
          else openSections.delete(key);
        });
        return section;
      }),
    );
  }

  /** Re-renders only when something visible changed (downloads update every second). */
  function render(list, force = false) {
    lastList = list;
    const signature = JSON.stringify(list.map((d) => [
      d.infoHash, d.title, d.show, d.kind, d.done, d.seeding, d.paused, !!d.error, d.files?.length, Math.floor(d.progress * 100),
    ]));
    if (!force && signature === lastSignature) return;
    lastSignature = signature;

    const { movies, shows } = buildLibrary(list);
    const showMovies = filter !== 'series' && movies.length > 0;
    const showSeries = filter !== 'movie' && shows.length > 0;

    clear(content);
    if (showMovies) {
      content.append(
        h('h2', { class: 'section-title' }, icon('film'), t('library.movies')),
        h('div', { class: 'library-grid' }, movies.map(movieCard)),
      );
    }
    if (showSeries) {
      content.append(
        h('h2', { class: 'section-title' }, icon('tv'), t('library.series')),
        h('div', { class: 'results' }, shows.map(showCard)),
      );
    }
    empty.hidden = showMovies || showSeries;
  }

  onLanguageChange(() => render(lastList, true));
  downloads.subscribe((list) => render(list));
}
