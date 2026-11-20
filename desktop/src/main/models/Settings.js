import { AppError, ErrorCode } from '../utils/AppError.js';

export const LANGUAGES = ['en', 'sr'];
export const THEMES = ['system', 'dark', 'light'];

/** Player keyboard shortcuts: action -> key (KeyboardEvent.key, letters upper-case, ' ' as 'Space'). */
export const DEFAULT_KEYBINDS = Object.freeze({
  playPause: 'Space',
  mute: 'M',
  nextEpisode: 'N',
  previousEpisode: 'B',
  seekBack: 'ArrowLeft',
  seekForward: 'ArrowRight',
  volumeUp: 'ArrowUp',
  volumeDown: 'ArrowDown',
  fullscreen: 'F',
});

/** Keeps known actions only; missing or invalid ones fall back to the defaults. */
function normalizeKeybinds(keybinds) {
  const result = { ...DEFAULT_KEYBINDS };
  if (keybinds && typeof keybinds === 'object') {
    for (const action of Object.keys(DEFAULT_KEYBINDS)) {
      const key = keybinds[action];
      if (typeof key === 'string' && key.length > 0 && key.length <= 20) result[action] = key;
    }
  }
  return result;
}

/** Live TV playlists: { name, url (http(s) URL or local .m3u path), enabled }. */
function normalizePlaylists(playlists) {
  return (Array.isArray(playlists) ? playlists : [])
    .map((p) => ({
      name: String(p?.name ?? '').trim().slice(0, 100),
      url: String(p?.url ?? '').trim().slice(0, 2048),
      enabled: p?.enabled !== false,
    }))
    .filter((p) => p.url)
    .map((p) => ({ ...p, name: p.name || p.url.split(/[\\/]/).filter(Boolean).pop() || 'Playlist' }));
}

/** User settings. */
export class Settings {
  constructor({
    downloadDir,
    language = 'en',
    theme = 'system',
    startFullscreen = false,
    launchOnStartup = false,
    keybinds = DEFAULT_KEYBINDS,
    tmdbApiKey = '',
    playlists = [],
    favoriteChannels = [],
  }) {
    if (!downloadDir) throw new AppError(ErrorCode.DOWNLOAD_DIR_REQUIRED, 'Download folder is required');
    this.downloadDir = String(downloadDir);
    this.language = LANGUAGES.includes(language) ? language : 'en';
    this.theme = THEMES.includes(theme) ? theme : 'system';
    this.startFullscreen = !!startFullscreen; // open the window in fullscreen
    this.launchOnStartup = !!launchOnStartup; // start with the operating system
    this.keybinds = normalizeKeybinds(keybinds);
    this.tmdbApiKey = String(tmdbApiKey ?? '').trim().slice(0, 512); // v3 key or v4 read access token (posters)
    this.playlists = normalizePlaylists(playlists);
    this.favoriteChannels = (Array.isArray(favoriteChannels) ? favoriteChannels : [])
      .filter((id) => /^[a-f0-9]{16}$/.test(id))
      .slice(0, 1000);
  }

  /** Returns a new Settings with the given fields replaced. */
  with(patch) {
    return new Settings({ ...this.toJSON(), ...patch });
  }

  toJSON() {
    const {
      downloadDir, language, theme, startFullscreen, launchOnStartup, keybinds, tmdbApiKey, playlists, favoriteChannels,
    } = this;
    return {
      downloadDir, language, theme, startFullscreen, launchOnStartup, keybinds, tmdbApiKey, playlists, favoriteChannels,
    };
  }
}
