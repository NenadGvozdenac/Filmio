import fs from 'node:fs/promises';
import { parseM3u, channelId } from '../utils/m3u.js';
import { BUILT_IN_CHANNELS } from '../config/liveChannels.js';
import { AppError, ErrorCode } from '../utils/AppError.js';

const CACHE_MS = 10 * 60 * 1000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

/**
 * Live TV: built-in channels (official broadcaster streams / pages) plus channels from the
 * user's M3U playlists. Streams play through the HLS proxy.
 */
export class LiveTvService {
  /**
   * @param {object} deps
   * @param {import('./SettingsService.js').SettingsService} deps.settingsService
   * @param {import('./HlsProxyService.js').HlsProxyService} deps.proxy
   */
  constructor({ settingsService, proxy, fetchImpl = fetch }) {
    this.settings = settingsService;
    this.proxy = proxy;
    this.fetch = fetchImpl;
    this.cache = new Map(); // playlist url -> { at, channels }
    this.pages = new Map(); // channel id -> { url, kind } for 'web' / 'external' channels
  }

  /** Built-in channels as DTOs for the UI. */
  #builtIn() {
    return BUILT_IN_CHANNELS.map((c) => {
      const id = channelId(`builtin:${c.key}`);
      const base = { id, name: c.name, logo: c.logo ?? null, group: '', builtIn: true, kind: c.kind, note: c.note ?? null };
      if (c.kind === 'live') {
        return { ...base, streamUrl: this.proxy.register({ id, url: c.url, referer: c.referer ?? null, userAgent: null }) };
      }
      this.pages.set(id, { url: c.url, kind: c.kind });
      return base;
    });
  }

  /**
   * Built-in channels followed by the channels of every enabled playlist
   * (playlists are cached for 10 minutes unless `refresh`). A playlist that fails to load
   * is reported in `errors`; everything else still works.
   */
  async channels({ refresh = false } = {}) {
    const settings = this.settings.get();
    const playlists = settings.playlists.filter((p) => p.enabled);
    const errors = [];
    const channels = this.#builtIn();
    const seen = new Set(channels.map((c) => c.id));

    const results = await Promise.allSettled(playlists.map(async (playlist) => {
      const cached = this.cache.get(playlist.url);
      if (!refresh && cached && Date.now() - cached.at < CACHE_MS) return cached.channels;
      const list = parseM3u(await this.#read(playlist.url), playlist.name);
      this.cache.set(playlist.url, { at: Date.now(), channels: list });
      return list;
    }));

    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        errors.push({ playlist: playlists[i].name, message: result.reason?.message ?? String(result.reason) });
        return;
      }
      for (const channel of result.value) {
        if (seen.has(channel.id)) continue; // same stream in several playlists
        seen.add(channel.id);
        channels.push({
          id: channel.id,
          name: channel.name,
          logo: channel.logo,
          group: channel.group || channel.playlist,
          builtIn: false,
          kind: 'live',
          note: null,
          streamUrl: this.proxy.register(channel),
        });
      }
    });

    return { channels, errors };
  }

  /** Official page of a 'web' / 'external' channel. */
  page(id) {
    if (!this.pages.size) this.#builtIn();
    const page = this.pages.get(id);
    if (!page) throw new AppError(ErrorCode.INVALID_CHANNEL, 'Unknown channel');
    return page;
  }

  async #read(location) {
    if (/^https?:\/\//i.test(location)) {
      const res = await this.fetch(location, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    }
    return fs.readFile(location, 'utf8'); // local .m3u file
  }
}
