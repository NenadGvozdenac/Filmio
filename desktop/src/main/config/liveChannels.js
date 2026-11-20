/**
 * Built-in live TV channels. Only streams the broadcasters publish themselves are used.
 *
 * kind:
 *  - 'live'     HLS stream played in the Filmio player (through the HLS proxy)
 *  - 'web'      the broadcaster's official live page, opened in a Filmio window (e.g. a YouTube embed)
 *  - 'external' the broadcaster's official live page in the default browser
 *               (DRM-protected streams; Electron has no Widevine)
 */
export const BUILT_IN_CHANNELS = [
  {
    key: 'rts1',
    name: 'RTS 1',
    kind: 'external',
    url: 'https://www.rts.rs/tv/live.html',
    note: 'drm',
  },
  {
    key: 'rts2',
    name: 'RTS 2',
    kind: 'external',
    url: 'https://www.rts.rs/tv/live.html',
    note: 'drm',
  },
  {
    key: 'rtv1',
    name: 'RTV 1',
    kind: 'live',
    url: 'http://212.200.230.50:1935/RTV/rtv1/playlist.m3u8', // used by rtv.rs/sr_ci/uzivo
    referer: 'https://www.rtv.rs/',
    logo: 'https://i.imgur.com/CG44YT3.png',
  },
  {
    key: 'rtv2',
    name: 'RTV 2',
    kind: 'live',
    url: 'http://212.200.230.50:1935/RTV/rtv2/playlist.m3u8', // used by rtv.rs/sr_ci/uzivo
    referer: 'https://www.rtv.rs/',
  },
  {
    key: 'informer',
    name: 'Informer TV',
    kind: 'live',
    url: 'https://edge-rs-03.maksnet.tv/informertv-secure/web/playlist.m3u8', // used by informer.rs/tv
    referer: 'https://informer.rs/',
  },
  {
    key: 'n1',
    name: 'N1',
    kind: 'web',
    url: 'https://n1info.rs/n1-tv-live-stream/',
    note: 'youtube',
  },
];
