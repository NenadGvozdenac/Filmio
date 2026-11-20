// Matching torrent releases to a known title (from TMDB).

/** "The Avengers: Endgame (2019)" -> "avengers endgame" */
export function matchKey(title) {
  return String(title ?? '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/&/g, ' and ')
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^(the|a|an) /, '')
    .trim();
}

// Extras that share the title but are not the movie/episode itself.
const EXTRAS_RE = /\b(trailers?|teasers?|featurettes?|reviews?|reactions?|behind the scenes|making of|clips?|scenes?|fan ?edits?|recaps?|explained|interviews?|soundtrack|ost|parody|leak(ed)?|spoilers?|promos?|tv spots?|bloopers?|deleted|super ?cuts?|audio dramas?|drama cds?|amvs?|abridged|compilations?|openings?|endings?|ncop|nced|podcasts?)\b/i;

// Evidence that a release without an episode number really is a whole season / series.
const PACK_RE = /\b(batch|complete|season|s\d{1,2}|series|\d{1,3}\s?(-|~|to)\s?\d{1,3})\b/i;

/** True when the release name looks like a season or series pack. */
export const looksLikePack = (release) => PACK_RE.test(release.name) || !!release.episode?.pack;

// Anything smaller cannot be a full movie / episode (only checked when the size is known).
const MIN_SIZE = { movie: 300 * 1024 ** 2, series: 50 * 1024 ** 2 };

/** True for trailers, reviews, fan edits and other extras, or files too small to be the real thing. */
export function isExtra(release, kind) {
  if (EXTRAS_RE.test(`${release.name} ${release.title}`)) return true;
  // Season packs are large; only single movies / episodes are checked for size.
  return release.size > 0 && !release.episode?.pack && release.size < (MIN_SIZE[kind] ?? 0);
}

const LATIN_RE = /^[\x20-\x7eÀ-ɏ]+$/;
const GENERIC_SEASON_RE = /^(season|series|part|specials?|extras?|ova|ovas)( \d+)?$/;

/** Seasons with a distinctive name ("Steel Ball Run"), usable to recognize releases and queries. */
export function namedSeasons(details) {
  return (details?.seasons ?? [])
    .filter((s) => s.number > 0)
    .map((s) => ({ number: s.number, name: s.name, key: matchKey(s.name) }))
    .filter((s) => s.key.length >= 6 && !GENERIC_SEASON_RE.test(s.key));
}

/** The season a query refers to by name ("steel ball run" -> season 6), else the latest aired season. */
export function seasonForQuery(query, details) {
  const q = matchKey(query);
  const named = namedSeasons(details).find((s) => q.includes(s.key) || (q.length >= 6 && s.key.includes(q)));
  return named?.number ?? details?.lastEpisode?.season ?? null;
}

/**
 * Series matching. A release belongs to the show when its title starts with the show's
 * name (official, original or a Latin alternative title) or contains a distinctive season
 * name. Returns the season it belongs to (from the name or the matched season), or null.
 * @returns {{season:number|null}|null}
 */
export function matchSeries(release, title, details) {
  if (isExtra(release, 'series')) return null;
  const key = matchKey(release.title);
  if (!key) return null;

  const showNames = [title.title, title.originalTitle, ...(details?.altTitles ?? []).filter((n) => LATIN_RE.test(n))]
    .map(matchKey)
    .filter((n) => n.length >= 3);
  const showHit = showNames.some((n) => key === n || key.startsWith(`${n} `));
  const seasonHit = namedSeasons(details).find((s) => key.includes(s.key));
  if (!showHit && !seasonHit) return null;

  return { season: release.episode?.season ?? seasonHit?.number ?? null };
}

/**
 * True when a release belongs to the title: the names must match exactly (after
 * normalization), it must not be an extra (trailer, review...), and for movies the
 * years must be within one year when both are known.
 * @param {import('../models/Release.js').Release} release
 * @param {{kind:string, title:string, originalTitle?:string, year?:string}} title
 */
export function releaseMatchesTitle(release, title) {
  const key = matchKey(release.title);
  if (!key || isExtra(release, title.kind)) return false;
  const names = [title.title, title.originalTitle].filter(Boolean).map(matchKey);
  if (!names.includes(key)) return false;
  if (title.kind === 'movie' && release.year && title.year) {
    return Math.abs(Number(release.year) - Number(title.year)) <= 1;
  }
  return true;
}
