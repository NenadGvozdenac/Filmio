import fs from 'node:fs';
import path from 'node:path';

/** Stores .torrent metadata so downloads can resume after a restart without peers/HTTP. */
export class TorrentFileRepository {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
  }

  #path(infoHash) {
    return path.join(this.dir, `${infoHash}.torrent`);
  }

  load(infoHash) {
    try {
      return new Uint8Array(fs.readFileSync(this.#path(infoHash)));
    } catch {
      return null;
    }
  }

  save(infoHash, data) {
    if (data) fs.writeFileSync(this.#path(infoHash), data);
  }

  remove(infoHash) {
    fs.rmSync(this.#path(infoHash), { force: true });
  }
}
