import fs from 'node:fs';
import path from 'node:path';
import WebTorrent from 'webtorrent';
import { AppError, ErrorCode } from '../utils/AppError.js';

/** Thin wrapper around the WebTorrent client. */
export class TorrentService {
  constructor({ logger = console, fetchImpl = fetch } = {}) {
    this.logger = logger;
    this.fetch = fetchImpl;
    this.client = new WebTorrent();
    this.client.on('error', (err) => logger.error('[webtorrent]', err.message));
    this.torrents = new Map(); // infoHash -> Torrent
  }

  /**
   * Turns a magnet / info hash / .torrent URL / local path into something WebTorrent accepts.
   * Follows HTTP redirects manually because Jackett often redirects to a magnet link.
   * @returns {Promise<string|Uint8Array>}
   */
  async resolveSource(source, depth = 0) {
    const s = String(source ?? '').trim();
    if (/^magnet:/i.test(s)) return s;
    if (/^[a-f0-9]{40}$/i.test(s)) return `magnet:?xt=urn:btih:${s.toLowerCase()}`;
    if (/^https?:\/\//i.test(s)) {
      if (depth > 5) throw new AppError(ErrorCode.TOO_MANY_REDIRECTS, 'Too many redirects');
      const res = await this.fetch(s, { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) throw new AppError(ErrorCode.INVALID_REDIRECT, 'Invalid redirect');
        return /^magnet:/i.test(location) ? location : this.resolveSource(new URL(location, s).href, depth + 1);
      }
      if (!res.ok) {
        throw new AppError(ErrorCode.TORRENT_FETCH_FAILED, `Failed to fetch .torrent file (HTTP ${res.status})`, { status: res.status });
      }
      return new Uint8Array(await res.arrayBuffer());
    }
    if (s && fs.existsSync(s)) return new Uint8Array(fs.readFileSync(s));
    throw new AppError(ErrorCode.UNKNOWN_SOURCE, 'Unknown source (expected a magnet link, .torrent URL or info hash)');
  }

  /**
   * Adds a torrent with nothing selected (the caller selects the main file later).
   * @returns {Promise<{infoHash:string, duplicate:boolean}>}
   */
  add(torrentId, { dir }) {
    return new Promise((resolve, reject) => {
      const torrent = this.client.add(torrentId, { path: dir, deselect: true });
      const onError = (err) => {
        const dup = /duplicate torrent ([a-f0-9]{40})/i.exec(err.message);
        if (dup) resolve({ infoHash: dup[1].toLowerCase(), duplicate: true });
        else reject(err);
      };
      torrent.once('error', onError);
      torrent.once('infoHash', () => {
        torrent.removeListener('error', onError);
        torrent.on('error', (e) => this.logger.error('[torrent]', e.message));
        this.torrents.set(torrent.infoHash, torrent);
        torrent.once('close', () => {
          if (this.torrents.get(torrent.infoHash) === torrent) this.torrents.delete(torrent.infoHash);
        });
        resolve({ infoHash: torrent.infoHash, duplicate: false });
      });
    });
  }

  has(infoHash) {
    return this.torrents.has(infoHash);
  }

  /**
   * Resolves with torrent metadata once it is available.
   * @returns {Promise<{name:string, files:{name:string,path:string,length:number}[], torrentFile:Uint8Array}>}
   */
  whenReady(infoHash, timeoutMs = 90_000) {
    const torrent = this.torrents.get(infoHash);
    if (!torrent) return Promise.reject(new AppError(ErrorCode.TORRENT_NOT_ACTIVE, 'Torrent is not active'));
    const toMeta = () => ({
      name: torrent.name,
      files: torrent.files.map((f) => ({ name: f.name, path: f.path, length: f.length })),
      torrentFile: torrent.torrentFile,
    });
    if (torrent.ready) return Promise.resolve(toMeta());

    return new Promise((resolve, reject) => {
      let timer = null;
      const cleanup = () => {
        clearTimeout(timer);
        torrent.removeListener('ready', onReady);
        torrent.removeListener('close', onClose);
      };
      const onReady = () => { cleanup(); resolve(toMeta()); };
      const onClose = () => { cleanup(); reject(new AppError(ErrorCode.TORRENT_STOPPED, 'Torrent was stopped')); };
      torrent.once('ready', onReady);
      torrent.once('close', onClose);
      if (Number.isFinite(timeoutMs)) {
        timer = setTimeout(() => {
          cleanup();
          reject(new AppError(ErrorCode.NO_PEERS, 'No peers - torrent metadata did not arrive'));
        }, timeoutMs);
      }
    });
  }

  /** Downloads only the given files. */
  selectOnly(infoHash, fileIndexes) {
    const torrent = this.torrents.get(infoHash);
    if (!torrent?.ready) return;
    torrent.deselect(0, torrent.pieces.length - 1);
    for (const index of fileIndexes) torrent.files[index]?.select();
  }

  /** Progress (0..1) over the given files, weighted by size. */
  #filesProgress(torrent, fileIndexes) {
    const files = fileIndexes.map((i) => torrent.files[i]).filter(Boolean);
    const total = files.reduce((sum, f) => sum + f.length, 0);
    if (!total) return 0;
    return Math.min(1, files.reduce((sum, f) => sum + f.downloaded, 0) / total);
  }

  /** Calls back once every given file is fully downloaded. */
  onFilesDone(infoHash, fileIndexes, callback) {
    const torrent = this.torrents.get(infoHash);
    const files = fileIndexes.map((i) => torrent?.files[i]).filter(Boolean);
    if (!files.length) return;
    let fired = false;
    const check = () => {
      if (fired || files.some((f) => f.progress < 1)) return;
      fired = true;
      torrent.removeListener('download', check);
      callback();
    };
    torrent.on('download', check);
    torrent.once('done', check);
    check();
  }

  /** Live stats; progress covers only the selected files. */
  stats(infoHash, fileIndexes = []) {
    const torrent = this.torrents.get(infoHash);
    if (!torrent) return null;
    return {
      ready: torrent.ready,
      progress: torrent.ready && fileIndexes.length ? this.#filesProgress(torrent, fileIndexes) : 0,
      downloadSpeed: torrent.downloadSpeed,
      uploadSpeed: torrent.uploadSpeed,
      numPeers: torrent.numPeers,
    };
  }

  /**
   * Completes files whose only missing pieces are shared with files we do not download.
   *
   * Such boundary pieces can fail hash verification forever when the other file changed
   * after the torrent was created (Internet Archive regenerates *_meta.xml, thumbnails...).
   * The missing bytes of our file are then fetched straight from the HTTP web seed.
   *
   * @returns {Promise<boolean>} true when the files were completed this way
   */
  async repairFromWebSeed(infoHash, fileIndexes) {
    const torrent = this.torrents.get(infoHash);
    const baseUrl = torrent?.urlList?.find((u) => /^https?:\/\//i.test(u));
    if (!torrent?.ready || !baseUrl) return false;

    const selected = new Set(fileIndexes);
    const pieceLength = torrent.pieceLength;
    const ranges = [];
    for (const index of fileIndexes) {
      const file = torrent.files[index];
      const first = Math.floor(file.offset / pieceLength);
      const last = Math.floor((file.offset + file.length - 1) / pieceLength);
      for (let piece = first; piece <= last; piece++) {
        if (torrent.bitfield.get(piece)) continue;
        const start = piece * pieceLength;
        const end = Math.min(start + pieceLength, torrent.length);
        const shared = torrent.files.some((other, j) => !selected.has(j) && other.length > 0
          && other.offset < end && other.offset + other.length > start);
        if (!shared) return false; // a regular piece is still downloading
        ranges.push({
          file,
          from: Math.max(start, file.offset) - file.offset,
          to: Math.min(end, file.offset + file.length) - file.offset - 1,
        });
      }
    }
    if (!ranges.length) return false;

    for (const { file, from, to } of ranges) {
      const bytes = await this.#fetchWebSeedRange(torrent, baseUrl, file, from, to);
      const handle = await fs.promises.open(path.join(torrent.path, file.path), 'r+');
      try {
        await handle.write(bytes, 0, bytes.length, from);
      } finally {
        await handle.close();
      }
    }
    this.logger.info?.(`[torrent] ${infoHash}: completed ${ranges.length} boundary piece(s) from web seed`);
    return true;
  }

  /** BEP 19 web seed URL: base + torrent name + file path for multi-file torrents. */
  async #fetchWebSeedRange(torrent, baseUrl, file, from, to) {
    const url = torrent.files.length > 1 || baseUrl.endsWith('/')
      ? baseUrl.replace(/\/?$/, '/') + file.path.split(/[\\/]/).map(encodeURIComponent).join('/')
      : baseUrl;
    const res = await this.fetch(url, { headers: { Range: `bytes=${from}-${to}` }, signal: AbortSignal.timeout(60_000) });
    if (res.status !== 206) throw new Error(`Web seed range request failed (HTTP ${res.status})`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length !== to - from + 1) throw new Error('Web seed returned an unexpected length');
    return bytes;
  }

  /** Returns the WebTorrent file object (used by the stream server). */
  getFile(infoHash, fileIndex) {
    const torrent = this.torrents.get(infoHash);
    return torrent?.ready ? torrent.files[fileIndex] ?? null : null;
  }

  /** Stops a torrent but keeps downloaded data on disk. */
  async remove(infoHash) {
    const torrent = this.torrents.get(infoHash);
    this.torrents.delete(infoHash);
    if (torrent) await new Promise((resolve) => torrent.destroy({ destroyStore: false }, resolve));
  }

  async destroy() {
    await new Promise((resolve) => this.client.destroy(resolve));
  }
}
