// Rules for video files inside a torrent.
import { parseEpisode } from './releaseName.js';

export const PLAYABLE_EXTENSIONS = ['.mp4', '.m4v', '.webm'];
export const VIDEO_EXTENSIONS = [...PLAYABLE_EXTENSIONS, '.mkv', '.avi', '.mov'];

export const MIME_TYPES = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
};

export function extensionOf(name = '') {
  const m = /\.[^./\\]+$/.exec(name);
  return m ? m[0].toLowerCase() : '';
}

export const isPlayable = (name) => PLAYABLE_EXTENSIONS.includes(extensionOf(name));
export const isVideo = (name) => VIDEO_EXTENSIONS.includes(extensionOf(name)) && !/\bsample\b/i.test(name);

/**
 * Picks the main video: largest .mp4, then largest other playable file, then any video.
 * @param {{name:string, length:number}[]} files
 * @returns {number} file index or -1
 */
export function pickMainFileIndex(files) {
  const candidates = files.map((f, index) => ({ ...f, index })).filter((f) => isVideo(f.name));
  const largest = (list) => list.sort((a, b) => b.length - a.length)[0];
  const best = largest(candidates.filter((f) => extensionOf(f.name) === '.mp4'))
    ?? largest(candidates.filter((f) => isPlayable(f.name)))
    ?? largest(candidates);
  return best ? best.index : -1;
}

/**
 * Decides which files of a torrent to download.
 * - Season / series packs (two or more episode files, or `pack` requested): every episode video.
 * - Anything else: only the main video.
 * @returns {number[]} file indexes, episodes sorted by season/episode
 */
export function pickDownloadFileIndexes(files, { pack = false } = {}) {
  const episodes = files
    .map((f, index) => ({ index, ep: isVideo(f.name) ? parseEpisode(f.name) : null }))
    .filter((f) => f.ep?.episode != null)
    .sort((a, b) => (a.ep.season - b.ep.season) || (a.ep.episode - b.ep.episode));

  if (episodes.length >= 2 || (pack && episodes.length)) return episodes.map((f) => f.index);
  const main = pickMainFileIndex(files);
  return main < 0 ? [] : [main];
}
