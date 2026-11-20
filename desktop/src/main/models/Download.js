import { isPlayable } from '../utils/videoFiles.js';
import { Quality } from './Quality.js';

export const MediaKind = Object.freeze({ MOVIE: 'movie', SERIES: 'series' });

/**
 * A torrent downloaded into the shared download folder.
 * `files` are the video files selected for download: one for a movie or episode,
 * every episode for a season/series pack.
 */
export class Download {
  constructor(props) {
    if (!/^[a-f0-9]{40}$/.test(props.infoHash ?? '')) throw new Error('Invalid infoHash');
    this.infoHash = props.infoHash;
    this.source = props.source;
    this.dir = props.dir;
    this.title = props.title || props.infoHash;
    this.kind = props.kind === MediaKind.SERIES ? MediaKind.SERIES : MediaKind.MOVIE;
    this.year = props.year ?? '';
    // Series info (library grouping)
    this.show = props.show ?? null;
    this.season = props.season ?? null;
    this.episode = props.episode ?? null;
    this.pack = !!props.pack;
    // TMDB info (library posters)
    this.tmdbId = props.tmdbId ?? null;
    this.posterUrl = props.posterUrl ?? null;

    this.quality = props.quality ?? '';
    this.provider = props.provider ?? '';
    this.addedAt = props.addedAt ?? Date.now();
    this.paused = !!props.paused;
    this.seeding = props.seeding !== false; // keep sharing after completion until the user stops it
    this.done = !!props.done;
    this.doneAt = props.doneAt ?? null;
    this.error = props.error ?? null;

    // Older records stored a single file (fileIndex/fileName/filePath/length).
    this.files = Array.isArray(props.files)
      ? props.files
      : props.fileIndex != null
        ? [{ index: props.fileIndex, name: props.fileName, path: props.filePath, length: props.length ?? 0 }]
        : [];
  }

  get hasFiles() {
    return this.files.length > 0;
  }

  get fileIndexes() {
    return this.files.map((f) => f.index);
  }

  get length() {
    return this.files.reduce((sum, f) => sum + (f.length || 0), 0);
  }

  get playable() {
    return this.hasFiles ? this.files.some((f) => isPlayable(f.name)) : null;
  }

  /** Whether the torrent should be running in the client right now. */
  get shouldRun() {
    return !this.paused && !(this.done && !this.seeding);
  }

  /** @param {{index:number, name:string, path:string, length:number}[]} files */
  assignFiles(files, torrentName) {
    this.files = files;
    if (!this.quality && files[0]) this.quality = Quality.fromName(files[0].name).label;
    if (this.title === this.infoHash && torrentName) this.title = torrentName;
    this.error = null;
  }

  /** Fills in series/movie info when the download was added without search metadata. */
  describe({ kind, title, year, show, season, episode, pack }) {
    if (kind) this.kind = kind;
    if (title && this.title === this.infoHash) this.title = title;
    if (year && !this.year) this.year = year;
    if (show && !this.show) this.show = show;
    if (season != null && this.season == null) this.season = season;
    if (episode != null && this.episode == null) this.episode = episode;
    if (pack) this.pack = true;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.error = null;
  }

  stopSeeding() {
    this.seeding = false;
  }

  startSeeding() {
    this.seeding = true;
    this.paused = false;
    this.error = null;
  }

  /** @returns {boolean} true if the state changed */
  markDone(now = Date.now()) {
    if (this.done) return false;
    this.done = true;
    this.doneAt = now;
    return true;
  }

  /** @param {string} error error code (translated in the UI) or raw message */
  fail(error) {
    this.error = error;
  }

  toJSON() {
    const {
      infoHash, source, dir, title, kind, year, show, season, episode, pack, tmdbId, posterUrl,
      quality, provider, addedAt, paused, seeding, done, doneAt, error, files,
    } = this;
    return {
      infoHash, source, dir, title, kind, year, show, season, episode, pack, tmdbId, posterUrl,
      quality, provider, addedAt, paused, seeding, done, doneAt, error, files,
    };
  }
}
