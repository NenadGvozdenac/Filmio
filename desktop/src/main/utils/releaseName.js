// Helpers for extracting title, year and episode info from torrent names.

const CUT_TOKENS = /\b(2160p|1440p|1080[pi]|720p|576p|480p|4k|uhd|remux|blu-?ray|bdrip|brrip|web-?dl|webrip|web|hdtv|dvdrip|x26[45]|h ?26[45]|hevc|xvid|complete|season|s\s?\d{1,2}(\s?[-.]?\s?ep?\s?\d{1,3})?|\d{1,2}x\d{2})\b/i;

// S05E18, S 05 E 18, s5-ep10, S5 Ep 10, Season 1 Episode 2
const EPISODE_RE = /\bS(?:eason)?\s?(\d{1,2})\s?[-.]?\s?E(?:p(?:isode)?)?\s?(\d{1,3})(?:\s?-?\s?E(\d{1,3}))?\b/i;

// Anime fansub style: "[Group] Show Name - 09 (1080p)" or "Show - 09v2" (absolute episode number).
const ANIME_EPISODE_RE = /\s-\s(\d{1,4})(?:v\d)?(?=\s|$|[([])/;
// "Episode 9", "Ep 09", "Episode 1 + 2", "Episodes 1-3" without a season.
const BARE_EPISODE_RE = /\bEp(?:isodes?)?\.?\s?(\d{1,4})(?:\s?[+&-]\s?(\d{1,4}))?\b/i;

/** Anime episode markers only count for fansub-style names ([Group] prefix). */
function animeEpisodeMatch(rawName, cleaned) {
  return /^\s*\[[^\]]+\]/.test(String(rawName)) ? cleaned.match(ANIME_EPISODE_RE) : null;
}

export function cleanName(name = '') {
  return String(name)
    .replace(/\.(mp4|mkv|avi|m4v|webm|mov)$/i, '')
    .replace(/^\[[^\]]*\]\s*/, '') // leading [Group] tag
    .replace(/[._]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "The.Matrix.1999.1080p.BluRay.x264" -> { title: "The Matrix", year: "1999" } */
export function parseTitle(name = '') {
  const n = cleanName(name);
  const cuts = [];
  const year = n.match(/[\s(\[]((?:19|20)\d{2})(?=[\s)\]]|$)/);
  if (year && year.index > 0) cuts.push(year.index);
  const token = n.match(CUT_TOKENS);
  if (token && token.index > 0) cuts.push(token.index);
  const anime = animeEpisodeMatch(name, n);
  if (anime && anime.index > 0) cuts.push(anime.index);
  const bare = n.match(BARE_EPISODE_RE);
  if (bare && bare.index > 0) cuts.push(bare.index);
  const cut = cuts.length ? Math.min(...cuts) : n.length;
  let title = n.slice(0, cut);
  // Drop an unclosed bracket left by the cut: "The Lucy Show (The Complete Series)" -> "The Lucy Show".
  const open = Math.max(title.lastIndexOf('('), title.lastIndexOf('['));
  if (open > 0 && !/[)\]]/.test(title.slice(open))) title = title.slice(0, open);
  title = title.replace(/[\s\-–:([]+$/, '').trim() || n;
  return { title, year: year ? year[1] : '' };
}

/**
 * Detects S01E02, 1x02, S01 (season pack), "complete" packs and anime-style absolute
 * episode numbers ("[Group] Show - 09", "Episode 9"); those have season null.
 * @returns {{season:number|null, episode:number|null, episodeEnd:number|null, pack:boolean}|null}
 */
export function parseEpisode(name = '') {
  const n = cleanName(name);
  let m = n.match(EPISODE_RE);
  if (m) return { season: +m[1], episode: +m[2], episodeEnd: m[3] ? +m[3] : null, pack: false };
  m = n.match(/\b(\d{1,2})x(\d{2,3})\b/);
  if (m) return { season: +m[1], episode: +m[2], episodeEnd: null, pack: false };
  m = animeEpisodeMatch(name, n) || n.match(BARE_EPISODE_RE);
  if (m) return { season: null, episode: +m[1], episodeEnd: m[2] && +m[2] > +m[1] ? +m[2] : null, pack: false };
  m = n.match(/\bS(\d{1,2})\b/i) || n.match(/\bseason\s?(\d{1,2})\b/i);
  if (m) return { season: +m[1], episode: null, episodeEnd: null, pack: true };
  if (/\bcomplete\b/i.test(n)) return { season: null, episode: null, episodeEnd: null, pack: true };
  return null;
}

/** Key used to group releases of the same title. */
export function normalizeKey(title, year = '') {
  return `${String(title).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim()}|${year}`;
}
