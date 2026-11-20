import { Release } from '../models/Release.js';
import { ErrorCode } from '../utils/AppError.js';
import { groupMovies, groupSeries } from '../utils/releaseGrouping.js';
import {
  matchKey, releaseMatchesTitle, matchSeries, namedSeasons, seasonForQuery, looksLikePack,
} from '../utils/titleMatching.js';

const MAX_TITLE_CARDS = 6;
const MAX_SHOW_DETAILS = 3; // TMDB detail requests per search
const MAX_QUERIES = 4;

const pad = (n) => String(n).padStart(2, '0');

export class SearchService {
  /**
   * @param {import('./SettingsService.js').SettingsService} settingsService
   * @param {(settings) => {name:string, search:Function}[]} createProviders builds the enabled torrent providers
   * @param {(settings) => {searchTitles:Function, getShowDetails:Function}|null} createTitleProvider TMDB (null without key)
   */
  constructor(settingsService, createProviders, createTitleProvider = () => null) {
    this.settingsService = settingsService;
    this.createProviders = createProviders;
    this.createTitleProvider = createTitleProvider;
  }

  /**
   * 1. TMDB identifies what the query means (movies / shows, official titles); for shows
   *    it also loads seasons and the latest / next episode.
   * 2. Torrent providers are searched with the query plus targeted queries (official title,
   *    season name, latest episode).
   * 3. Releases matching a TMDB title are attached to it; the rest are "other results".
   * @param {string} query
   */
  async search(query) {
    const settings = this.settingsService.get();
    const providers = this.createProviders(settings);
    const titleProvider = this.createTitleProvider(settings);
    const errors = [];
    if (!titleProvider) errors.push({ code: ErrorCode.TMDB_MISSING_KEY, hint: true });
    if (!providers.length) {
      errors.push({ code: ErrorCode.NO_PROVIDERS });
      return { count: 0, hiddenNonMp4: 0, titles: [], movies: [], series: [], errors };
    }

    // 1. Identify titles (+ details of the top shows)
    let titles = [];
    const details = new Map(); // tmdbId -> show details
    if (titleProvider) {
      try {
        titles = await titleProvider.searchTitles(query);
        const shows = titles.filter((t) => t.kind === 'series').slice(0, MAX_SHOW_DETAILS);
        const loaded = await Promise.allSettled(shows.map((t) => titleProvider.getShowDetails(t.tmdbId)));
        loaded.forEach((r, i) => { if (r.status === 'fulfilled') details.set(shows[i].tmdbId, r.value); });
      } catch (err) {
        errors.push(err.code ? { code: err.code } : { provider: 'TMDB', message: err.message });
      }
    }

    // 2. Search releases
    let releases = await this.#searchReleases(providers, this.#buildQueries(query, titles[0], details), errors);
    const total = releases.length;
    if (settings.mp4Only) releases = releases.filter((r) => r.isMp4);

    // 3. Attach releases to titles
    const byTitle = new Map(titles.map((t) => [t.tmdbId, []]));
    const unmatched = [];
    for (const release of releases) {
      const title = this.#attach(release, titles, details);
      if (title) byTitle.get(title.tmdbId).push(release);
      else unmatched.push(release);
    }

    const cards = titles
      .filter((t, index) => index === 0 || byTitle.get(t.tmdbId).length)
      .slice(0, MAX_TITLE_CARDS)
      .map((t) => this.#titleCard(t, byTitle.get(t.tmdbId), details.get(t.tmdbId), query));

    return {
      count: releases.length,
      hiddenNonMp4: total - releases.length,
      // plain objects for IPC
      titles: JSON.parse(JSON.stringify(cards)),
      movies: JSON.parse(JSON.stringify(groupMovies(unmatched.filter((r) => !r.isSeries)))),
      series: JSON.parse(JSON.stringify(groupSeries(unmatched.filter((r) => r.isSeries)))),
      errors,
    };
  }

  /** The user's query plus official title, season name and latest episode of the best match. */
  #buildQueries(query, top, details) {
    const queries = [query];
    if (top) {
      queries.push(top.title);
      const show = top.kind === 'series' ? details.get(top.tmdbId) : null;
      if (show) {
        const seasonNo = seasonForQuery(query, show);
        const named = namedSeasons(show).find((s) => s.number === seasonNo);
        if (named) queries.push(`${top.title} ${named.name}`, named.name);
        const last = show.lastEpisode;
        if (last && last.season === seasonNo) queries.push(`${top.title} S${pad(last.season)}E${pad(last.episode)}`);
      }
    }
    // De-duplicate (by normalized text) and cap the number of provider calls.
    const seen = new Set();
    return queries.filter((q) => {
      const key = matchKey(q);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, MAX_QUERIES);
  }

  /**
   * Finds the TMDB title a release belongs to and normalizes it for grouping
   * (official title, season for anime-style absolute episode numbers).
   */
  #attach(release, titles, details) {
    for (const title of titles) {
      if (title.kind === 'movie') {
        if (!releaseMatchesTitle(release, title)) continue;
        release.title = title.title;
        return title;
      }
      const match = matchSeries(release, title, details.get(title.tmdbId));
      if (!match) continue;
      release.title = title.title;
      if (match.season != null) {
        if (release.episode) {
          release.episode = { ...release.episode, season: release.episode.season ?? match.season };
        } else if (looksLikePack(release)) {
          release.episode = { season: match.season, episode: null, episodeEnd: null, pack: true }; // whole season
        }
        // Otherwise it stays without episode info and is listed under "Other" for the show.
      }
      return title;
    }
    return null;
  }

  /** Runs every provider for every query in parallel; duplicates (same source) are dropped. */
  async #searchReleases(providers, queries, errors) {
    const jobs = providers.flatMap((provider) => queries.map((q) => ({ provider, promise: provider.search(q) })));
    const settled = await Promise.allSettled(jobs.map((j) => j.promise));
    const seen = new Set();
    const reported = new Set();
    const releases = [];
    settled.forEach((result, i) => {
      const { provider } = jobs[i];
      if (result.status === 'rejected') {
        if (!reported.has(provider.name)) {
          reported.add(provider.name);
          errors.push({ provider: provider.name, message: result.reason?.message ?? String(result.reason) });
        }
        return;
      }
      for (const raw of result.value) {
        if (seen.has(raw.source)) continue;
        seen.add(raw.source);
        try {
          releases.push(new Release(raw));
        } catch {
          // skip malformed provider result
        }
      }
    });
    return releases;
  }

  /**
   * A TMDB title with its releases. Movies: best quality first. Series: show -> season ->
   * episode, plus season info, the latest / next episode and releases of the latest episode.
   */
  #titleCard(title, releases, show, query) {
    const card = { ...title, releaseCount: releases.length, releases: [], show: null, details: null, latest: [] };
    if (title.kind !== 'series') {
      card.releases = releases.sort(Release.compare);
      return card;
    }

    card.show = groupSeries(releases)[0] ?? null;
    if (show) {
      const focusSeason = seasonForQuery(query, show);
      card.details = {
        focusSeason,
        seasons: show.seasons.filter((s) => s.number > 0),
        lastEpisode: show.lastEpisode,
        nextEpisode: show.nextEpisode,
      };
      const last = show.lastEpisode;
      if (last) {
        card.latest = releases
          .filter((r) => r.episode?.season === last.season && r.episode?.episode === last.episode)
          .sort(Release.compare);
      }
    }
    return card;
  }
}
