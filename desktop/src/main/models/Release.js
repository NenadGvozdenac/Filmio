import { Quality } from './Quality.js';
import { parseTitle, parseEpisode } from '../utils/releaseName.js';

/**
 * A single release (version) of a movie or episode returned by a provider.
 *
 * Raw provider shape:
 * { provider, name, source, title?, year?, height?, size?, seeders?, peers?, popularity?, isMp4?, infoUrl? }
 * `source` is a magnet link, a .torrent URL or an info hash.
 */
export class Release {
  constructor(raw) {
    if (!raw?.name || !raw?.source) throw new Error('Release requires a name and a source');
    // Provider titles can still contain a year ("Movie 1968"), so they are parsed too.
    const parsed = parseTitle(raw.title || raw.name);
    this.provider = raw.provider ?? 'Unknown';
    this.name = raw.name;
    this.source = raw.source;
    this.title = parsed.title;
    this.year = raw.year || parsed.year;
    this.size = Number(raw.size) || 0;
    this.seeders = raw.seeders ?? null;
    this.peers = raw.peers ?? null;
    this.popularity = Number(raw.popularity) || 0;
    this.infoUrl = raw.infoUrl;
    this.quality = Quality.fromName(raw.name, raw.height);
    this.isMp4 = raw.isMp4 ?? /\bmp4\b/i.test(raw.name);
    this.episode = parseEpisode(raw.name);
  }

  /** Episode markers (S01E02, 1x02, S01, Season 1, Complete) mean it is a series. */
  get isSeries() {
    return this.episode != null;
  }

  /** Sort comparator, best first: non-CAM, resolution, source, seeders, size. */
  static compare(a, b) {
    return (Number(a.quality.isCam) - Number(b.quality.isCam))
      || (b.quality.height - a.quality.height)
      || (b.quality.sourceRank - a.quality.sourceRank)
      || ((b.seeders ?? 0) - (a.seeders ?? 0))
      || (b.size - a.size);
  }

  toJSON() {
    return {
      provider: this.provider,
      name: this.name,
      source: this.source,
      title: this.title,
      year: this.year,
      size: this.size,
      seeders: this.seeders,
      peers: this.peers,
      popularity: this.popularity,
      infoUrl: this.infoUrl,
      quality: this.quality.toJSON(),
      isMp4: this.isMp4,
      episode: this.episode,
    };
  }
}
