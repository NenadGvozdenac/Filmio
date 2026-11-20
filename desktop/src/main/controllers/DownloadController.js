import { AppError, ErrorCode } from '../utils/AppError.js';

const HASH_RE = /^[a-f0-9]{40}$/;

function requireHash(infoHash) {
  const hash = String(infoHash ?? '').toLowerCase();
  if (!HASH_RE.test(hash)) throw new AppError(ErrorCode.INVALID_HASH, 'Invalid info hash');
  return hash;
}

const text = (value, max) => String(value ?? '').trim().slice(0, max) || undefined;

export class DownloadController {
  /** @param {import('../services/DownloadService.js').DownloadService} downloadService */
  constructor(downloadService) {
    this.downloadService = downloadService;
  }

  add({ source, meta } = {}) {
    const value = String(source ?? '').trim();
    if (!value || value.length > 8192) throw new AppError(ErrorCode.MISSING_SOURCE, 'Missing source (magnet link or .torrent)');
    // Movie / series info is recognized from the torrent names once metadata arrives.
    const title = text(meta?.title, 300);
    return this.downloadService.add(value, title ? { title } : {});
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
