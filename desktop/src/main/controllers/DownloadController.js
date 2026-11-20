import { AppError, ErrorCode } from '../utils/AppError.js';

const HASH_RE = /^[a-f0-9]{40}$/;

function requireHash(infoHash) {
  const hash = String(infoHash ?? '').toLowerCase();
  if (!HASH_RE.test(hash)) throw new AppError(ErrorCode.INVALID_HASH, 'Invalid info hash');
  return hash;
}

const text = (value, max) => String(value ?? '').trim().slice(0, max) || undefined;
const int = (value) => (Number.isInteger(value) && value >= 0 && value < 1e9 ? value : undefined);

export class DownloadController {
  /** @param {import('../services/DownloadService.js').DownloadService} downloadService */
  constructor(downloadService) {
    this.downloadService = downloadService;
  }

  add({ source, meta } = {}) {
    if (!source || typeof source !== 'string') throw new AppError(ErrorCode.MISSING_SOURCE, 'Missing source (magnet or .torrent URL)');
    // Without metadata (e.g. a pasted magnet) the kind is inferred from the file names later.
    const safeMeta = Object.fromEntries(Object.entries({
      title: text(meta?.title, 300),
      kind: meta?.kind === 'series' ? 'series' : meta?.kind === 'movie' ? 'movie' : undefined,
      year: text(meta?.year, 4),
      show: text(meta?.show, 300),
      season: int(meta?.season),
      episode: int(meta?.episode),
      pack: meta?.pack === true ? true : undefined,
      tmdbId: int(meta?.tmdbId),
      // Only TMDB image URLs are accepted (the page CSP allows no other remote images).
      posterUrl: /^https:\/\/image\.tmdb\.org\/t\/p\/[\w/.-]+$/.test(meta?.posterUrl ?? '') ? meta.posterUrl : undefined,
      quality: text(meta?.quality, 20),
      provider: text(meta?.provider, 100),
    }).filter(([, value]) => value !== undefined));
    return this.downloadService.add(source, safeMeta);
  }

  list() {
    return this.downloadService.list();
  }

  files({ infoHash } = {}) {
    return this.downloadService.playableFiles(requireHash(infoHash));
  }

  pause({ infoHash } = {}) {
    return this.downloadService.pause(requireHash(infoHash));
  }

  resume({ infoHash } = {}) {
    return this.downloadService.resume(requireHash(infoHash));
  }

  stopSeeding({ infoHash } = {}) {
    return this.downloadService.stopSeeding(requireHash(infoHash));
  }

  startSeeding({ infoHash } = {}) {
    return this.downloadService.startSeeding(requireHash(infoHash));
  }

  remove({ infoHash, deleteFiles } = {}) {
    return this.downloadService.remove(requireHash(infoHash), !!deleteFiles);
  }
}
