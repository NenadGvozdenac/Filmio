// Video quality derived from a release/file name.

const RESOLUTIONS = [
  [/\b(2160p|4k|uhd)\b/i, 2160],
  [/\b1440p\b/i, 1440],
  [/\b1080[pi]\b/i, 1080],
  [/\b720p\b/i, 720],
  [/\b576p\b/i, 576],
  [/\b480p\b/i, 480],
  [/\b360p\b/i, 360],
  [/\b240p\b/i, 240],
];

// Higher rank = better source. Camera rips get a negative rank so they always sort last.
const SOURCES = [
  [/\bremux\b/i, 'REMUX', 7],
  [/\b(blu-?ray|bdrip|brrip|bdremux)\b/i, 'BluRay', 6],
  [/\bweb-?dl\b/i, 'WEB-DL', 5],
  [/\b(webrip|web)\b/i, 'WEBRip', 4],
  [/\bhdtv\b/i, 'HDTV', 3],
  [/\b(dvdrip|dvd)\b/i, 'DVD', 2],
  [/\b(hdcam|cam|camrip|ts|telesync|hdts|tc|telecine)\b/i, 'CAM', -10],
];

const CODECS = [
  [/\b(x265|h\.?265|hevc)\b/i, 'HEVC'],
  [/\b(x264|h\.?264|avc)\b/i, 'H.264'],
  [/\bav1\b/i, 'AV1'],
  [/\bxvid\b/i, 'XviD'],
];

export class Quality {
  constructor({ height = 0, source = '', sourceRank = 0, codec = '', hdr = false }) {
    this.height = height;
    this.source = source;
    this.sourceRank = sourceRank;
    this.codec = codec;
    this.hdr = hdr;
    this.label = height >= 2160 ? '4K' : height ? `${height}p` : '?';
  }

  get isCam() {
    return this.sourceRank < 0;
  }

  /** Parses quality from a name; `knownHeight` wins when the provider already knows it. */
  static fromName(name = '', knownHeight = 0) {
    let height = Number(knownHeight) || 0;
    if (!height) {
      for (const [re, h] of RESOLUTIONS) if (re.test(name)) { height = h; break; }
    }
    let source = '';
    let sourceRank = 0;
    for (const [re, label, rank] of SOURCES) if (re.test(name)) { source = label; sourceRank = rank; break; }
    let codec = '';
    for (const [re, label] of CODECS) if (re.test(name)) { codec = label; break; }
    const hdr = /\b(hdr10\+?|hdr|dolby ?vision|dv)\b/i.test(name);
    return new Quality({ height, source, sourceRank, codec, hdr });
  }

  toJSON() {
    const { height, label, source, sourceRank, codec, hdr } = this;
    return { height, label, source, sourceRank, codec, hdr };
  }
}
