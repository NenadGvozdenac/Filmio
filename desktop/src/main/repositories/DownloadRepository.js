import { Download } from '../models/Download.js';

/** Keeps downloads in memory and persists them to the JSON store. */
export class DownloadRepository {
  /** @param {import('./JsonFileStore.js').JsonFileStore} store */
  constructor(store) {
    this.store = store;
    this.items = new Map();
    for (const raw of store.get('downloads', [])) {
      try {
        const d = new Download(raw);
        this.items.set(d.infoHash, d);
      } catch {
        // skip invalid records
      }
    }
  }

  getAll() {
    return [...this.items.values()];
  }

  get(infoHash) {
    return this.items.get(infoHash) ?? null;
  }

  save(download) {
    this.items.set(download.infoHash, download);
    this.#flush();
  }

  remove(infoHash) {
    this.items.delete(infoHash);
    this.#flush();
  }

  #flush() {
    this.store.set('downloads', this.getAll().map((d) => d.toJSON()));
  }
}
