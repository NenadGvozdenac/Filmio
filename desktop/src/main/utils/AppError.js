/**
 * Error with a stable code; the renderer translates the code into the UI language.
 * `message` is an English fallback (logs, unknown codes).
 */
export class AppError extends Error {
  constructor(code, message, params = {}) {
    super(message);
    this.code = code;
    this.params = params;
  }
}

export const ErrorCode = Object.freeze({
  MISSING_SOURCE: 'MISSING_SOURCE',
  INVALID_HASH: 'INVALID_HASH',
  UNKNOWN_SOURCE: 'UNKNOWN_SOURCE',
  TOO_MANY_REDIRECTS: 'TOO_MANY_REDIRECTS',
  INVALID_REDIRECT: 'INVALID_REDIRECT',
  TORRENT_FETCH_FAILED: 'TORRENT_FETCH_FAILED',
  TORRENT_NOT_ACTIVE: 'TORRENT_NOT_ACTIVE',
  TORRENT_STOPPED: 'TORRENT_STOPPED',
  NO_PEERS: 'NO_PEERS',
  NO_VIDEO_FILE: 'NO_VIDEO_FILE',
  DOWNLOAD_NOT_FOUND: 'DOWNLOAD_NOT_FOUND',
  DOWNLOAD_DIR_REQUIRED: 'DOWNLOAD_DIR_REQUIRED',
  TMDB_INVALID_KEY: 'TMDB_INVALID_KEY',
  INVALID_CHANNEL: 'INVALID_CHANNEL',
});
