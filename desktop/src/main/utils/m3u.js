// M3U / M3U8 IPTV playlist parsing (the format used by VLC, Kodi and IPTV providers).
import { createHash } from 'node:crypto';

const ATTR_RE = /([\w-]+)="([^"]*)"/g;

/** Stable channel id derived from its stream URL. */
export const channelId = (url) => createHash('sha1').update(url).digest('hex').slice(0, 16);

/**
 * Kodi-style headers appended to the URL: "http://host/live.m3u8|User-Agent=X&Referer=Y".
 * @returns {{url:string, userAgent?:string, referer?:string}}
 */
function splitPipeHeaders(raw) {
  const [url, extra] = raw.split('|');
  const result = { url: url.trim() };
  if (extra) {
    for (const pair of extra.split('&')) {
      const [key, ...rest] = pair.split('=');
      const value = decodeURIComponent(rest.join('=') || '');
      if (/^user-agent$/i.test(key)) result.userAgent = value;
      if (/^referr?er$/i.test(key)) result.referer = value;
    }
  }
  return result;
}

/**
 * Parses an M3U playlist into channels.
 * @param {string} text playlist contents
 * @param {string} playlistName shown as the channel's source
 * @returns {{id:string, name:string, logo:string|null, group:string, url:string,
 *   userAgent:string|null, referer:string|null, playlist:string}[]}
 */
export function parseM3u(text, playlistName) {
  const channels = [];
  let pending = null; // info from #EXTINF / #EXTVLCOPT / #EXTGRP until the URL line

  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF')) {
      const comma = line.lastIndexOf(',');
      const attrs = Object.fromEntries([...line.slice(0, comma < 0 ? undefined : comma).matchAll(ATTR_RE)].map((m) => [m[1].toLowerCase(), m[2]]));
      pending = {
        name: (comma >= 0 ? line.slice(comma + 1) : '').trim() || attrs['tvg-name'] || '',
        logo: attrs['tvg-logo'] || null,
        group: (attrs['group-title'] || '').split(';')[0].trim(),
        userAgent: attrs['http-user-agent'] || null,
        referer: attrs['http-referrer'] || attrs['http-referer'] || null,
      };
      continue;
    }
    if (line.startsWith('#EXTVLCOPT:') && pending) {
      const [key, ...rest] = line.slice('#EXTVLCOPT:'.length).split('=');
      const value = rest.join('=').trim();
      if (/^http-user-agent$/i.test(key)) pending.userAgent = value;
      if (/^http-referr?er$/i.test(key)) pending.referer = value;
      continue;
    }
    if (line.startsWith('#EXTGRP:') && pending && !pending.group) {
      pending.group = line.slice('#EXTGRP:'.length).trim();
      continue;
    }
    if (line.startsWith('#')) continue;

    // URL line
    const { url, userAgent, referer } = splitPipeHeaders(line);
    if (!/^https?:\/\//i.test(url)) {
      pending = null;
      continue;
    }
    channels.push({
      id: channelId(url),
      name: pending?.name || url,
      logo: pending?.logo && /^https?:\/\//i.test(pending.logo) ? pending.logo : null,
      group: pending?.group || '',
      url,
      userAgent: userAgent || pending?.userAgent || null,
      referer: referer || pending?.referer || null,
      playlist: playlistName,
    });
    pending = null;
  }
  return channels;
}
