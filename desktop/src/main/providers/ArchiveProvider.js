// Internet Archive (archive.org): public-domain / freely licensed movies and shows.
// Every item ships a .torrent with web seeds, so downloads work even without peers.

const HEADERS = { 'User-Agent': 'Filmio/1.0' };

export class ArchiveProvider {
  constructor({ fetchImpl = fetch, rows = 30 } = {}) {
    this.name = 'Internet Archive';
    this.fetch = fetchImpl;
    this.rows = rows;
  }

  async #json(url) {
    const res = await this.fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`archive.org HTTP ${res.status}`);
    return res.json();
  }

  /** Searches movies and TV items; classification happens in SearchService. */
  async search(query) {
    const terms = query.replace(/["()]/g, ' ').trim();
    const params = new URLSearchParams({
      q: `title:(${terms}) AND mediatype:(movies) AND format:(MPEG4)`,
      rows: String(this.rows),
      output: 'json',
    });
    for (const field of ['identifier', 'title', 'year', 'downloads']) params.append('fl[]', field);
    params.append('sort[]', 'downloads desc');

    const data = await this.#json(`https://archive.org/advancedsearch.php?${params}`);
    const docs = data?.response?.docs ?? [];
    const items = await Promise.all(docs.map((doc) => this.#toRelease(doc).catch(() => null)));
    return items.filter(Boolean);
  }

  // Item metadata gives the real resolution of each MP4 file.
  async #toRelease(doc) {
    const meta = await this.#json(`https://archive.org/metadata/${encodeURIComponent(doc.identifier)}`);
    const mp4s = (meta.files ?? []).filter((f) => /\.mp4$/i.test(f.name));
    if (!mp4s.length) return null;

    const rank = (f) => (Number(f.height) || 0) * 1e12 + (Number(f.size) || 0);
    const best = mp4s.reduce((a, b) => (rank(b) > rank(a) ? b : a));
    const title = String(Array.isArray(doc.title) ? doc.title[0] : doc.title ?? doc.identifier);

    return {
      provider: this.name,
      name: mp4s.length === 1 ? best.name : title,
      title,
      year: doc.year ? String(doc.year).slice(0, 4) : '',
      height: Number(best.height) || (/512kb/i.test(best.name) ? 240 : 0),
      size: mp4s.reduce((sum, f) => sum + (Number(f.size) || 0), 0),
      seeders: null,
      popularity: Number(doc.downloads) || 0,
      isMp4: true,
      source: `https://archive.org/download/${doc.identifier}/${doc.identifier}_archive.torrent`,
      infoUrl: `https://archive.org/details/${doc.identifier}`,
    };
  }
}
