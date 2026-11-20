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

/**
 * User settings.
 * indexers: Torznab endpoints (Jackett / Prowlarr) -> { name, url, apiKey, enabled }
 */
export class Settings {
  constructor({
    downloadDir,
    archiveEnabled = true,
    mp4Only = true,
    indexers = [],
    language = 'en',
    theme = 'system',
    startFullscreen = false,
    launchOnStartup = false,
    keybinds = DEFAULT_KEYBINDS,
    tmdbApiKey = '',
  }) {
    if (!downloadDir) throw new AppError(ErrorCode.DOWNLOAD_DIR_REQUIRED, 'Download folder is required');
    this.downloadDir = String(downloadDir);
    this.archiveEnabled = !!archiveEnabled;
    this.mp4Only = !!mp4Only;
    this.language = LANGUAGES.includes(language) ? language : 'en';
    this.theme = THEMES.includes(theme) ? theme : 'system';
    this.startFullscreen = !!startFullscreen; // open the window in fullscreen
    this.launchOnStartup = !!launchOnStartup; // start with the operating system    this.keybinds = normalizeKeybinds(keybinds);
    this.tmdbApiKey = String(tmdbApiKey ?? '').trim().slice(0, 512); // v3 key or v4 read access token
    this.indexers = (Array.isArray(indexers) ? indexers : [])
      .map((ix) => ({
        name: String(ix?.name ?? '').trim() || 'Torznab',
        url: String(ix?.url ?? '').trim(),
        apiKey: String(ix?.apiKey ?? '').trim(),
        enabled: ix?.enabled !== false,
      }))
      .filter((ix) => /^https?:\/\//i.test(ix.url));
  }

  /** Returns a new Settings with the given fields replaced. */
  with(patch) {
    return new Settings({ ...this.toJSON(), ...patch });
  }

  toJSON() {
    const {
      downloadDir, archiveEnabled, mp4Only, indexers, language, theme,
      startFullscreen, launchOnStartup, keybinds, tmdbApiKey,
    } = this;
    return {
      downloadDir, archiveEnabled, mp4Only, indexers, language, theme,
      startFullscreen, launchOnStartup, keybinds, tmdbApiKey,
    };
  }
}
