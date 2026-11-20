// Torznab API client (Jackett / Prowlarr). The user configures their own indexers.
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

// Newznab category ids: 2000 = Movies, 5000 = TV.
const CATEGORIES = '2000,5000';

export class TorznabProvider {
  /** @param {{name:string, url:string, apiKey:string}} indexer */
  constructor(indexer, { fetchImpl = fetch } = {}) {
    this.name = indexer.name || 'Torznab';
    this.indexer = indexer;
    this.fetch = fetchImpl;
  }

  async search(query) {
    const url = new URL(this.indexer.url);
    url.searchParams.set('apikey', this.indexer.apiKey ?? '');
    url.searchParams.set('t', 'search');
    url.searchParams.set('q', query);
    url.searchParams.set('cat', CATEGORIES);

    const res = await this.fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const doc = parser.parse(await res.text());
    if (doc.error) throw new Error(doc.error.description ?? 'Torznab error');

    const items = [].concat(doc?.rss?.channel?.item ?? []);
    return items.map((item) => this.#toRelease(item)).filter((r) => r.source && r.name);
  }

  #toRelease(item) {
    const attrs = {};
    for (const a of [].concat(item['torznab:attr'] ?? [])) attrs[a.name] = a.value;
    const enclosure = [].concat(item.enclosure ?? [])[0];
    const seeders = Number(attrs.seeders ?? 0);
    return {
      provider: this.name,
      name: String(item.title ?? ''),
      size: Number(attrs.size ?? item.size ?? enclosure?.length ?? 0),
      seeders,
      peers: Number(attrs.peers ?? 0),
      popularity: seeders,
      source: attrs.magneturl || enclosure?.url || item.link,
      infoUrl: typeof item.comments === 'string' ? item.comments : undefined,
    };
  }
}
