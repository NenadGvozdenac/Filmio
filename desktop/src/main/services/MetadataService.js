import { parseTitle } from '../utils/releaseName.js';

/**
 * Adds TMDB info (official title, poster, overview) to downloads, so the library looks
 * nice. The title is recognized from the torrent / file names. Each download is looked
 * up once; changing the TMDB key retries the ones without a match.
 */
export class MetadataService {
  /**
   * @param {object} deps
   * @param {import('./SettingsService.js').SettingsService} deps.settingsService
   * @param {import('../repositories/DownloadRepository.js').DownloadRepository} deps.downloadRepository
   * @param {(apiKey:string) => {searchTitles:Function}} deps.createTmdb
   * @param {Console} [deps.logger]
   */
  constructor({ settingsService, downloadRepository, createTmdb, logger = console }) {
    this.settings = settingsService;
    this.downloads = downloadRepository;
    this.createTmdb = createTmdb;
    this.logger = logger;
    this.running = new Set();
  }

  /** Looks up one download (no-op without a TMDB key or when already looked up). */
  async enrich(infoHash) {
    const download = this.downloads.get(infoHash);
    const apiKey = this.settings.get().tmdbApiKey;
    if (!download || !apiKey || download.tmdbChecked || !download.hasFiles || this.running.has(infoHash)) return;

    this.running.add(infoHash);
    try {
      const isSeries = download.kind === 'series';
      const query = isSeries ? download.show || parseTitle(download.title).title : parseTitle(download.title).title;
      if (!query) return;

      const results = await this.createTmdb(apiKey).searchTitles(query);
      const kind = isSeries ? 'series' : 'movie';
      const sameKind = results.filter((r) => r.kind === kind);
      const year = Number(download.year);
      const match = sameKind.find((r) => !year || !r.year || Math.abs(Number(r.year) - year) <= 1) ?? sameKind[0];

      const current = this.downloads.get(infoHash); // may have changed while waiting
      if (!current) return;
      current.applyMetadata(match ?? null);
      this.downloads.save(current);
    } catch (err) {
      // Network or key problems: try again next time.
      this.logger.error('[metadata]', err.message);
    } finally {
      this.running.delete(infoHash);
    }
  }

  /** Looks up every download that has not been looked up yet. */
  async enrichAll() {
    for (const download of this.downloads.getAll()) await this.enrich(download.infoHash);
  }

  /** After the TMDB key changed: retry downloads that did not get a match. */
  async retryUnmatched() {
    for (const download of this.downloads.getAll()) {
      if (download.tmdbChecked && !download.tmdbId) {
        download.tmdbChecked = false;
        this.downloads.save(download);
      }
    }
    await this.enrichAll();
  }
}
