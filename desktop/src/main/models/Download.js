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
    // TMDB info (library posters); tmdbChecked = looked up already (match or not)
    this.tmdbId = props.tmdbId ?? null;
    this.posterUrl = props.posterUrl ?? null;
    this.overview = props.overview ?? '';
    this.tmdbChecked = !!props.tmdbChecked;

    this.quality = props.quality ?? '';
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
  assignFiles(files) {
    this.files = files;
    const label = files[0] ? Quality.fromName(files[0].name).label : '?';
    if (!this.quality && label !== '?') this.quality = label; // unknown quality: no badge
    this.error = null;
  }

  /**
   * Content recognized from the torrent / file names. Fields given when the download
   * was added (e.g. a custom title) are kept.
   */
  describe({ kind, title, year, show, season, episode, pack }) {
    if (kind) this.kind = kind;
    if (title && this.title === this.infoHash) this.title = title;
    if (year && !this.year) this.year = year;
    if (show && !this.show) this.show = show;
    if (season != null && this.season == null) this.season = season;
    if (episode != null && this.episode == null) this.episode = episode;
    if (pack) this.pack = true;
  }

  /**
   * TMDB result for this download (or null when nothing matched).
   * The official title replaces the name parsed from the torrent.
   */
  applyMetadata(match) {
    this.tmdbChecked = true;
    if (!match) return;
    this.tmdbId = match.tmdbId;
    this.posterUrl = match.posterUrl;
    this.overview = match.overview ?? '';
    if (this.kind === MediaKind.SERIES) {
      const oldShow = this.show;
      this.show = match.title;
      if (oldShow && this.title.startsWith(oldShow)) this.title = match.title + this.title.slice(oldShow.length);
    } else {
      this.year = match.year || this.year;
      this.title = match.year ? `${match.title} (${match.year})` : match.title;
    }
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
      infoHash, source, dir, title, kind, year, show, season, episode, pack,
      tmdbId, posterUrl, overview, tmdbChecked,
      quality, addedAt, paused, seeding, done, doneAt, error, files,
    } = this;
    return {
      infoHash, source, dir, title, kind, year, show, season, episode, pack,
      tmdbId, posterUrl, overview, tmdbChecked,
      quality, addedAt, paused, seeding, done, doneAt, error, files,
    };
  }
}
