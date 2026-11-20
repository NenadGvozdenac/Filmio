import { BrowserWindow, shell } from 'electron';
import { appIconPath } from './tray.js';

/**
 * Opens a broadcaster's official live page (e.g. N1's YouTube player) in its own Filmio
 * window. The page runs without Node access or the Filmio bridge.
 */
export function openWebWindow(appRoot, url, parent) {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 400,
    title: 'Filmio',
    icon: appIconPath(appRoot),
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    parent: undefined, // independent window, so it can be moved to another screen
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.setMenu(null);
  // Links that open new windows go to the default browser.
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//i.test(target)) shell.openExternal(target);
    return { action: 'deny' };
  });
  // Close it together with the main window.
  parent?.once('closed', () => { if (!win.isDestroyed()) win.close(); });
  win.loadURL(url);
  return win;
}
