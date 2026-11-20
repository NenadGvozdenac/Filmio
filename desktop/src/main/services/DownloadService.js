import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Download, MediaKind } from '../models/Download.js';
import { Quality } from '../models/Quality.js';
import { isVideo, isPlayable, pickDownloadFileIndexes } from '../utils/videoFiles.js';
import { parseTitle, parseEpisode } from '../utils/releaseName.js';
import { AppError, ErrorCode } from '../utils/AppError.js';

const notFound = () => new AppError(ErrorCode.DOWNLOAD_NOT_FOUND, 'Download not found');

/** Business logic for downloads: add, pause/resume, seeding, remove, list, playable files. */
export class DownloadService {
  #repairTimers = new Map(); // infoHash -> interval id

  /**
   * @param {object} deps
   * @param {import('../repositories/DownloadRepository.js').DownloadRepository} deps.downloadRepository
   * @param {import('../repositories/TorrentFileRepository.js').TorrentFileRepository} deps.torrentFileRepository
   * @param {import('./SettingsService.js').SettingsService} deps.settingsService
   * @param {import('./TorrentService.js').TorrentService} deps.torrentService
   * @param {import('./StreamService.js').StreamService} deps.streamService
   * @param {(infoHash:string) => void} [deps.onReady] called once a new download knows its files
   */
  constructor({ downloadRepository, torrentFileRepository, settingsService, torrentService, streamService, onReady = () => {} }) {
    this.downloads = downloadRepository;
    this.torrentFiles = torrentFileRepository;
    this.settings = settingsService;
    this.torrents = torrentService;
    this.streams = streamService;
    this.onReady = onReady;
  }

  /**
   * Adds a magnet link / .torrent URL / .torrent file to the download folder (everything
   * goes into one folder). Movie / series info is recognized from the names later.
   * @param {string} source magnet link, .torrent URL, local .torrent path or info hash
   * @param {{title?:string}} [meta]
   * @returns {Promise<string>} infoHash
   */
  async add(source, meta = {}) {
    const torrentId = await this.torrents.resolveSource(source);
    const dir = this.settings.get().downloadDir;
    fs.mkdirSync(dir, { recursive: true });

    const { infoHash, duplicate } = await this.torrents.add(torrentId, { dir });
    const existing = this.downloads.get(infoHash);
    if (existing) {
      if (!existing.shouldRun) {
        existing.resume();
        existing.startSeeding();
        this.downloads.save(existing);
      }
      if (!duplicate) this.#attach(infoHash);
      return infoHash;
    }

    this.downloads.save(new Download({
      infoHash,
      source: typeof torrentId === 'string' ? torrentId : String(source),
      dir,
      ...meta,
    }));
    this.#attach(infoHash);
    return infoHash;
  }

  /** Starts every download that should be running (not paused, not finished with seeding stopped). */
  async restore() {
    const active = this.downloads.getAll().filter((d) => d.shouldRun);
    await Promise.allSettled(active.map((d) => this.#start(d).catch((err) => {
      d.fail(err.code ?? err.message);
      this.downloads.save(d);
    })));
  }

  async pause(infoHash) {
    const download = this.#get(infoHash);
    download.pause();
    this.downloads.save(download);
    await this.torrents.remove(infoHash); // files stay on disk
  }

  async resume(infoHash) {
    const download = this.#get(infoHash);
    download.resume();
    this.downloads.save(download);
    await this.#start(download);
  }

  /** Stops sharing a finished download; the files stay in the library. */
  async stopSeeding(infoHash) {
    const download = this.#get(infoHash);
    download.stopSeeding();
    this.downloads.save(download);
    await this.torrents.remove(infoHash);
  }

  async startSeeding(infoHash) {
    const download = this.#get(infoHash);
    download.startSeeding();
    this.downloads.save(download);
    await this.#start(download);
  }

  async remove(infoHash, deleteFiles = false) {
    const download = this.#get(infoHash);
    await this.torrents.remove(infoHash);
    this.downloads.remove(infoHash);
    this.torrentFiles.remove(infoHash);
    if (deleteFiles) this.#deleteFiles(download);
  }

  /** Downloads merged with live torrent stats, newest first. */
  list() {
    return this.downloads.getAll()
      .sort((a, b) => b.addedAt - a.addedAt)
      .map((d) => {
        const stats = d.shouldRun ? this.torrents.stats(d.infoHash, d.fileIndexes) : null;
        const progress = d.done ? 1 : stats?.progress ?? 0;
        const length = d.length;
        return {
          ...d.toJSON(),
          files: d.files.map((f) => ({ ...f, episode: parseEpisode(f.name), playable: isPlayable(f.name) })),
          length,
          playable: d.playable,
          active: !!stats,
          ready: !!stats?.ready,
          progress,
          downloadSpeed: stats?.downloadSpeed ?? 0,
          uploadSpeed: stats?.uploadSpeed ?? 0,
          numPeers: stats?.numPeers ?? 0,
          timeRemaining: stats && progress < 1 && stats.downloadSpeed > 0
            ? ((1 - progress) * length / stats.downloadSpeed) * 1000
            : null,
        };
      });
  }

  /**
   * Video files of a download with URLs for the player.
   * Finished downloads play straight from disk (no torrent needed); others stream
   * through the local HTTP server, starting the torrent if necessary.
   */
  async playableFiles(infoHash) {
    const download = this.#get(infoHash);
    const describe = (f, url) => ({
      index: f.index,
      name: f.name,
      length: f.length,
      quality: Quality.fromName(f.name).label,
      playable: isPlayable(f.name),
      episode: parseEpisode(f.name),
      url,
    });

    if (download.done && download.hasFiles && download.files.every((f) => fs.existsSync(f.path))) {
      return {
        infoHash,
        title: download.title,
        defaultIndex: download.files[0].index,
        files: download.files.map((f) => describe(f, pathToFileURL(f.path).href)),
      };
    }

    if (download.paused) {
      download.resume();
      this.downloads.save(download);
    }
    await this.#start(download);

    const meta = await this.torrents.whenReady(infoHash, 90_000);
    const files = meta.files
      .map((f, index) => ({ ...f, index }))
      .filter((f) => isVideo(f.name))
      .map((f) => describe(f, this.streams.urlFor(infoHash, f.index)));
    // Re-read: the title / show are recognized from the names once metadata arrived.
    const current = this.downloads.get(infoHash) ?? download;
    const defaultIndex = current.fileIndexes[0] ?? pickDownloadFileIndexes(meta.files)[0];
    return { infoHash, title: current.title, show: current.show, defaultIndex, files };
  }

  // ---- internals ----

  #get(infoHash) {
    const download = this.downloads.get(infoHash);
    if (!download) throw notFound();
    return download;
  }

  /** Starts an existing download in the torrent client if it is not running yet. */
  async #start(download) {
    if (this.torrents.has(download.infoHash)) return;
    const torrentId = this.torrentFiles.load(download.infoHash) ?? await this.torrents.resolveSource(download.source);
    fs.mkdirSync(download.dir, { recursive: true });
    await this.torrents.add(torrentId, { dir: download.dir });
    this.#attach(download.infoHash);
  }

  /** Waits for metadata (in background), then selects the files and tracks completion. */
  #attach(infoHash) {
    this.torrents.whenReady(infoHash, Infinity)
      .then((meta) => this.#onReady(infoHash, meta))
      .catch((err) => this.#fail(infoHash, err.code ?? err.message));
  }

  #onReady(infoHash, meta) {
    const download = this.downloads.get(infoHash);
    if (!download) return;

    const indexes = download.hasFiles ? download.fileIndexes : pickDownloadFileIndexes(meta.files, { pack: download.pack });
    if (!indexes.length) {
      this.#fail(infoHash, ErrorCode.NO_VIDEO_FILE);
      return;
    }

    const isFirstTime = !download.hasFiles;
    download.assignFiles(indexes.map((index) => {
      const f = meta.files[index];
      return { index, name: f.name, path: path.join(download.dir, f.path), length: f.length };
    }));
    download.describe(this.#describeContent(meta.name, download.files));
    if (download.title === infoHash) download.title = meta.name;
    this.torrents.selectOnly(infoHash, indexes);
    this.torrentFiles.save(infoHash, meta.torrentFile);
    this.downloads.save(download);
    if (isFirstTime) this.onReady(infoHash); // e.g. TMDB poster lookup

    this.torrents.onFilesDone(infoHash, indexes, () => {
      const d = this.downloads.get(infoHash);
      if (d?.markDone()) this.downloads.save(d);
    });
    this.#watchBoundaryPieces(infoHash, indexes);
  }

  /**
   * Periodically checks whether the download is stuck only on boundary pieces that
   * can never verify (see TorrentService.repairFromWebSeed) and completes it over HTTP.
   */
  #watchBoundaryPieces(infoHash, indexes) {
    clearInterval(this.#repairTimers.get(infoHash));
    let busy = false;
    const stop = () => {
      clearInterval(timer);
      this.#repairTimers.delete(infoHash);
    };
    const timer = setInterval(async () => {
      const download = this.downloads.get(infoHash);
      if (!download || download.done || !this.torrents.has(infoHash)) return stop();
      if (busy) return;
      busy = true;
      try {
        if (await this.torrents.repairFromWebSeed(infoHash, indexes)) {
          if (download.markDone()) this.downloads.save(download);
          stop();
        }
      } catch (err) {
        console.error('[download] web seed repair failed:', err.message);
      } finally {
        busy = false;
      }
    }, 10_000);
    timer.unref?.();
    this.#repairTimers.set(infoHash, timer);
  }

  /** Infers movie/series info from the torrent and file names (used by the library). */
  #describeContent(torrentName, files) {
    const episodes = files.map((f) => parseEpisode(f.name)).filter((e) => e?.episode != null);
    const fromName = parseEpisode(torrentName);
    if (episodes.length || fromName) {
      const first = episodes[0] ?? fromName;
      const show = parseTitle(torrentName).title || parseTitle(files[0].name).title;
      const season = first?.season ?? null;
      const episode = files.length === 1 ? first?.episode ?? null : null;
      const pad = (n) => String(n).padStart(2, '0');
      let label = '';
      if (season != null && episode != null) label = ` S${pad(season)}E${pad(episode)}`;
      else if (episode != null) label = ` E${pad(episode)}`;
      else if (season != null && new Set(episodes.map((e) => e.season)).size <= 1) label = ` S${pad(season)}`;
      return { kind: MediaKind.SERIES, title: `${show}${label}`, show, season, episode, pack: files.length > 1 };
    }
    const { title, year } = parseTitle(torrentName);
    return { kind: MediaKind.MOVIE, title: year ? `${title} (${year})` : title, year };
  }

  #fail(infoHash, error) {
    const download = this.downloads.get(infoHash);
    if (!download) return;
    download.fail(error);
    this.downloads.save(download);
  }

  /** Deletes the downloaded files and any now-empty torrent folders (never the root folder). */
  #deleteFiles(download) {
    const root = path.resolve(download.dir);
    const folders = new Set();
    for (const file of download.files) {
      if (!file.path) continue;
      fs.rmSync(file.path, { force: true });
      folders.add(path.dirname(path.resolve(file.path)));
    }
    // Remove empty folders bottom-up, stopping at the download root.
    const sorted = [...folders].sort((a, b) => b.length - a.length);
    for (let dir of sorted) {
      while (dir.startsWith(root) && dir !== root) {
        try {
          if (fs.readdirSync(dir).length) break;
          fs.rmdirSync(dir);
        } catch {
          break;
        }
        dir = path.dirname(dir);
      }
    }
  }
}
