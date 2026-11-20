import path from 'node:path';

/** App configuration (paths and defaults). */
export function loadConfig(app) {
  const dataDir = app.getPath('userData');
  return {
    dataDir,
    stateFile: path.join(dataDir, 'state.json'),
    torrentCacheDir: path.join(dataDir, 'torrents'),
    defaultSettings: {
      downloadDir: path.join(app.getPath('downloads'), 'Filmio'),
      archiveEnabled: true,
      mp4Only: true,
      indexers: [],
      language: 'en',
      theme: 'system',
      startFullscreen: false,
      launchOnStartup: false,
    },
    progressIntervalMs: 1000,
  };
}
