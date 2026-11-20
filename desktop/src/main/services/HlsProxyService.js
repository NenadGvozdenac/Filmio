import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const PLAYLIST_TYPE = 'application/vnd.apple.mpegurl';

/**
 * Local proxy for live TV streams (HLS). It lets the player load streams that
 * - need custom headers (User-Agent / Referer from the M3U playlist),
 * - do not allow cross-origin requests (CORS).
 * HLS playlists are rewritten so every segment / key / sub-playlist also goes through the proxy.
 * Only registered channels can be proxied, and every URL carries a random per-session token,
 * so other programs cannot use it as an open proxy.
 */
export class HlsProxyService {
  constructor({ fetchImpl = fetch, logger = console } = {}) {
    this.fetch = fetchImpl;
    this.logger = logger;
    this.token = randomBytes(16).toString('hex');
    this.channels = new Map(); // channel id -> { url, userAgent, referer }
    this.port = null;
  }

  async start() {
    this.server = http.createServer((req, res) => {
      this.#handle(req, res).catch((err) => {
        this.logger.error('[live]', err.message);
        if (!res.headersSent) res.writeHead(502);
        res.end();
      });
    });
    await new Promise((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    this.port = this.server.address().port;
  }

  stop() {
    this.server?.close();
  }

  /** Makes a channel playable; returns the local URL for the player. */
  register(channel) {
    this.channels.set(channel.id, { url: channel.url, userAgent: channel.userAgent, referer: channel.referer });
    return this.#proxied(channel.id, channel.url);
  }

  #proxied(id, upstreamUrl) {
    return `http://127.0.0.1:${this.port}/${this.token}/${id}/stream?u=${encodeURIComponent(upstreamUrl)}`;
  }

  async #handle(req, res) {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      res.end();
      return;
    }

    const url = new URL(req.url, 'http://127.0.0.1');
    const [token, id] = url.pathname.split('/').filter(Boolean);
    const channel = token === this.token ? this.channels.get(id) : null;
    const upstreamUrl = url.searchParams.get('u') ?? '';
    if (!channel || !/^https?:\/\//i.test(upstreamUrl)) {
      res.writeHead(404, cors);
      res.end();
      return;
    }

    const headers = { 'User-Agent': channel.userAgent || DEFAULT_USER_AGENT, Accept: '*/*' };
    if (channel.referer) {
      headers.Referer = channel.referer;
      try { headers.Origin = new URL(channel.referer).origin; } catch { /* invalid referer */ }
    }
    if (req.headers.range) headers.Range = req.headers.range;

    const controller = new AbortController();
    res.on('close', () => controller.abort());
    const upstream = await this.fetch(upstreamUrl, { headers, redirect: 'follow', signal: controller.signal });
    if (!upstream.ok && upstream.status !== 206) {
      res.writeHead(upstream.status === 404 ? 404 : 502, cors);
      res.end();
      return;
    }

    const type = upstream.headers.get('content-type') ?? '';
    const finalUrl = upstream.url || upstreamUrl;
    const isPlaylist = /mpegurl/i.test(type) || /\.m3u8?$/i.test(new URL(finalUrl).pathname);

    if (isPlaylist) {
      const text = await upstream.text();
      res.writeHead(200, { ...cors, 'Content-Type': PLAYLIST_TYPE, 'Cache-Control': 'no-cache' });
      res.end(this.#rewrite(text, finalUrl, id));
      return;
    }

    const out = { ...cors, 'Content-Type': type || 'application/octet-stream' };
    for (const name of ['content-length', 'content-range', 'accept-ranges']) {
      const value = upstream.headers.get(name);
      if (value) out[name] = value;
    }
    res.writeHead(upstream.status, out);
    if (!upstream.body) {
      res.end();
      return;
    }
    Readable.fromWeb(upstream.body).on('error', () => res.destroy()).pipe(res);
  }

  /** Points every URI in an HLS playlist (segments, keys, variants, maps) back at the proxy. */
  #rewrite(text, baseUrl, id) {
    const absolute = (uri) => {
      try {
        return this.#proxied(id, new URL(uri, baseUrl).href);
      } catch {
        return uri;
      }
    };
    return text.split(/\r?\n/).map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${absolute(uri)}"`);
      return absolute(trimmed);
    }).join('\n');
  }
}
