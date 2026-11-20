import fs from 'node:fs';
import path from 'node:path';

/** Tiny JSON file store with atomic writes. Shared by the repositories. */
export class JsonFileStore {
  constructor(filePath) {
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    try {
      this.data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      this.data = {}; // first run or corrupted file
    }
  }

  get(key, fallback) {
    return this.data[key] ?? fallback;
  }

  set(key, value) {
    this.data[key] = value;
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.filePath);
  }
}
