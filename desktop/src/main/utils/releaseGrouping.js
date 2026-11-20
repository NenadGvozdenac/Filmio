import { Release } from '../models/Release.js';
import { normalizeKey } from './releaseName.js';

/** Movies: group by title + year, best quality first inside each group. */
export function groupMovies(releases) {
  const map = new Map();
  for (const r of releases) {
    const key = normalizeKey(r.title, r.year);
    if (!map.has(key)) map.set(key, { key, title: r.title, year: r.year, releases: [] });
    map.get(key).releases.push(r);
  }
  return [...map.values()]
    .map((g) => ({
      ...g,
      releases: g.releases.sort(Release.compare),
      popularity: Math.max(...g.releases.map((r) => r.popularity)),
    }))
    .sort((a, b) => b.popularity - a.popularity);
}

/** Series: show -> season -> (season packs, episodes); best quality first everywhere. */
export function groupSeries(releases) {
  const shows = new Map();
  for (const r of releases) {
    const key = normalizeKey(r.title);
    if (!shows.has(key)) shows.set(key, { title: r.title, seasons: new Map(), other: [], popularity: 0 });
    const show = shows.get(key);
    show.popularity = Math.max(show.popularity, r.popularity);

    const ep = r.episode;
    if (!ep || ep.season == null) { show.other.push(r); continue; }
    if (!show.seasons.has(ep.season)) show.seasons.set(ep.season, { season: ep.season, packs: [], episodes: new Map() });
    const season = show.seasons.get(ep.season);
    if (ep.pack) { season.packs.push(r); continue; }

    const epKey = ep.episodeEnd ? `${ep.episode}-${ep.episodeEnd}` : String(ep.episode);
    if (!season.episodes.has(epKey)) season.episodes.set(epKey, { episode: ep.episode, episodeEnd: ep.episodeEnd, releases: [] });
    season.episodes.get(epKey).releases.push(r);
  }

  return [...shows.values()]
    .sort((a, b) => b.popularity - a.popularity)
    .map((show) => ({
      title: show.title,
      other: show.other.sort(Release.compare),
      seasons: [...show.seasons.values()]
        .sort((a, b) => a.season - b.season)
        .map((s) => ({
          season: s.season,
          packs: s.packs.sort(Release.compare),
          episodes: [...s.episodes.values()]
            .sort((a, b) => a.episode - b.episode)
            .map((e) => ({ ...e, releases: e.releases.sort(Release.compare) })),
        })),
    }));
}
