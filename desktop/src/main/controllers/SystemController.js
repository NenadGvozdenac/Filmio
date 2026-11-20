import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { dialog, shell } from 'electron';

/** Native OS integrations: dialogs, file explorer, external browser. */
export class SystemController {
  /**
   * @param {() => import('electron').BrowserWindow|null} getWindow
   * @param {import('../services/SettingsService.js').SettingsService} settingsService
   */
  constructor(getWindow, settingsService) {
    this.getWindow = getWindow;
    this.settingsService = settingsService;
  }

  async chooseDirectory() {
    const result = await dialog.showOpenDialog(this.getWindow(), {
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: this.settingsService.get().downloadDir,
    });
    return result.canceled ? null : result.filePaths[0];
  }

  async openVideo() {
    const result = await dialog.showOpenDialog(this.getWindow(), {
      defaultPath: this.settingsService.get().downloadDir,
      properties: ['openFile'],
      filters: [{ name: 'Video', extensions: ['mp4', 'm4v', 'webm', 'mkv', 'mov'] }],
    });
    if (result.canceled) return null;
    const file = result.filePaths[0];
    return { name: path.basename(file), url: pathToFileURL(file).href };
  }

  /** Lets the user pick one or more .torrent files; returns their paths. */
  async openTorrentFiles() {
    const result = await dialog.showOpenDialog(this.getWindow(), {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Torrent', extensions: ['torrent'] }],
    });
    return result.canceled ? [] : result.filePaths;
  }

  /** Lets the user pick a local M3U playlist; returns its path or null. */
  async openPlaylistFile() {
    const result = await dialog.showOpenDialog(this.getWindow(), {
      properties: ['openFile'],
      filters: [{ name: 'M3U playlist', extensions: ['m3u', 'm3u8'] }],
    });
    return result.canceled ? null : result.filePaths[0];
  }

  async openDownloadFolder() {
    const dir = this.settingsService.get().downloadDir;
    fs.mkdirSync(dir, { recursive: true });
    const error = await shell.openPath(dir);
    if (error) throw new Error(error);
  }

  showInFolder({ filePath } = {}) {
    if (filePath && fs.existsSync(filePath)) shell.showItemInFolder(filePath);
  }

  openExternal({ url } = {}) {
    if (/^https?:\/\//i.test(url ?? '')) return shell.openExternal(url);
  }
}
