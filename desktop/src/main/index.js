// Electron main process entry point: wires repositories, services and controllers together.
import { app, BrowserWindow, ipcMain } from 'electron';
import { loadConfig } from './config/index.js';
import { JsonFileStore } from './repositories/JsonFileStore.js';
import { SettingsRepository } from './repositories/SettingsRepository.js';
import { DownloadRepository } from './repositories/DownloadRepository.js';
import { TorrentFileRepository } from './repositories/TorrentFileRepository.js';
import { ArchiveProvider } from './providers/ArchiveProvider.js';
import { TorznabProvider } from './providers/TorznabProvider.js';
import { TmdbProvider } from './providers/TmdbProvider.js';
import { SettingsService } from './services/SettingsService.js';
import { SearchService } from './services/SearchService.js';
import { TorrentService } from './services/TorrentService.js';
import { StreamService } from './services/StreamService.js';
import { DownloadService } from './services/DownloadService.js';
import { StartupService } from './services/StartupService.js';
import { SearchController } from './controllers/SearchController.js';
import { DownloadController } from './controllers/DownloadController.js';
import { SettingsController } from './controllers/SettingsController.js';
import { SystemController } from './controllers/SystemController.js';
import { WindowController } from './controllers/WindowController.js';
import { registerIpcRoutes } from './routes/ipcRoutes.js';
import { createMainWindow } from './window/mainWindow.js';
import { createTray } from './window/tray.js';

const config = loadConfig(app);

let mainWindow = null;
let torrentService = null;
let streamService = null;
let settingsService = null;
let tray = null;

// Groups the taskbar button and notifications under Filmio's own icon on Windows.
app.setAppUserModelId('app.filmio.desktop');

// A second launch focuses the running instance instead of starting another torrent client.
const isPrimaryInstance = app.requestSingleInstanceLock();
if (!isPrimaryInstance) app.quit();
else app.on('second-instance', () => showMainWindow());

/** Builds the enabled search providers from the current settings. */
function createProviders(settings) {
  const providers = [];
  if (settings.archiveEnabled) providers.push(new ArchiveProvider());
  for (const indexer of settings.indexers) {
    if (indexer.enabled) providers.push(new TorznabProvider(indexer));
  }
  return providers;
}

async function bootstrap() {
  // Repositories
  const store = new JsonFileStore(config.stateFile);
  const settingsRepository = new SettingsRepository(store, config.defaultSettings);
  const downloadRepository = new DownloadRepository(store);
  const torrentFileRepository = new TorrentFileRepository(config.torrentCacheDir);

  // Services
  settingsService = new SettingsService(settingsRepository);
  const searchService = new SearchService(
    settingsService,
    createProviders,
    (settings) => (settings.tmdbApiKey ? new TmdbProvider({ apiKey: settings.tmdbApiKey }) : null),
  );
  torrentService = new TorrentService();
  streamService = new StreamService(torrentService);
  await streamService.start();
  const downloadService = new DownloadService({
    downloadRepository,
    torrentFileRepository,
    settingsService,
    torrentService,
    streamService,
  });
  const startupService = new StartupService(app);

  // Controllers + routes
  registerIpcRoutes(ipcMain, {
    search: new SearchController(searchService),
    downloads: new DownloadController(downloadService),
    settings: new SettingsController(settingsService, startupService, () => tray?.refresh()),
    system: new SystemController(() => mainWindow, settingsService),
    window: new WindowController(() => mainWindow),
  });

  const settings = settingsService.get();
  // Keep the OS login item in sync with the saved setting.
  if (startupService.isLaunchOnStartupEnabled() !== settings.launchOnStartup) {
    startupService.setLaunchOnStartup(settings.launchOnStartup);
  }

  openMainWindow({ fullscreen: settings.startFullscreen });

  tray = createTray(app.getAppPath(), {
    getLanguage: () => settingsService.get().language,
    onOpen: showMainWindow,
    onQuit: () => app.quit(),
  });

  // Push live download progress to the UI.
  setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('downloads:progress', downloadService.list());
    }
  }, config.progressIntervalMs);

  downloadService.restore();
}

if (isPrimaryInstance) {
  app.whenReady().then(bootstrap).catch((err) => {
    console.error('Startup failed:', err);
    app.exit(1);
  });
}

let quitting = false;

/** Creates the main window. Closing it quits Filmio completely (see window-all-closed). */
function openMainWindow({ fullscreen = false } = {}) {
  const settings = settingsService.get();
  mainWindow = createMainWindow(app.getAppPath(), { theme: settings.theme, fullscreen });
  mainWindow.on('closed', () => { mainWindow = null; });
}

/** Brings the window to the front (or recreates it). */
function showMainWindow() {
  if (!settingsService) return; // still starting up
  if (!mainWindow || mainWindow.isDestroyed()) {
    openMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && torrentService) showMainWindow();
});
/**
 * Quitting stops everything: all torrents (downloads and seeding), the stream server
 * and the tray. The process is then terminated so nothing keeps running in the background.
 */
app.on('before-quit', (event) => {
  if (quitting || !torrentService) return;
  event.preventDefault();
  quitting = true;
  for (const win of BrowserWindow.getAllWindows()) win.destroy();
  streamService?.stop();
  tray?.destroy();
  const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
  Promise.race([torrentService.destroy(), timeout]).finally(() => app.exit(0));
});

// Closing the window quits the whole app.
app.on('window-all-closed', () => app.quit());
