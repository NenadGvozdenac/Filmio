import http from 'node:http';
import { MIME_TYPES, extensionOf } from '../utils/videoFiles.js';

/**
 * Local HTTP server that streams torrent files to the <video> element.
 * Supports Range requests, so seeking works while the file is still downloading
 * (WebTorrent prioritizes the requested pieces).
 */
export class StreamService {
  /** @param {import('./TorrentService.js').TorrentService} torrentService */
  constructor(torrentService, { host = '127.0.0.1' } = {}) {
    this.torrents = torrentService;
    this.host = host;
    this.port = null;
  }

  async start() {
    this.server = http.createServer((req, res) => this.#handle(req, res));
    await new Promise((resolve) => this.server.listen(0, this.host, resolve));
    this.port = this.server.address().port;
  }

  urlFor(infoHash, fileIndex) {
    return `http://${this.host}:${this.port}/stream/${infoHash}/${fileIndex}`;
  }

  stop() {
    this.server?.close();
  }

  #handle(req, res) {
    const match = /^\/stream\/([a-f0-9]{40})\/(\d+)/i.exec(req.url);
    const file = match ? this.torrents.getFile(match[1].toLowerCase(), Number(match[2])) : null;
    if (!file) {
      res.writeHead(404);
      res.end();
      return;
    }

    const total = file.length;
    const headers = {
      'Accept-Ranges': 'bytes',
      'Content-Type': MIME_TYPES[extensionOf(file.name)] ?? 'application/octet-stream',
    };
    let start = 0;
    let end = total - 1;
    let status = 200;

    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
    if (range) {
      if (range[1]) {
        start = Number(range[1]);
        if (range[2]) end = Math.min(Number(range[2]), total - 1);
      } else if (range[2]) {
        start = Math.max(0, total - Number(range[2])); // suffix range: last N bytes
      }
      if (start >= total || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${total}` });
        res.end();
        return;
      }
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${total}`;
    }

    headers['Content-Length'] = end - start + 1;
    res.writeHead(status, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const stream = file.createReadStream({ start, end });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  }
}
