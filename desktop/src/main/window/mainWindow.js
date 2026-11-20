import path from 'node:path';
import { BrowserWindow, nativeTheme, screen, shell } from 'electron';
import { appIconPath } from './tray.js';

const BACKGROUND = { dark: '#09090b', light: '#ffffff' };

/** Window takes 2/3 of the screen width, keeps a 16:10 ratio and fits the screen height. */
function initialSize() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const w = Math.round(width * (2 / 3));
  const h = Math.min(Math.round(w * 0.625), Math.round(height * 0.9));
  return { width: w, height: h };
}

/** @param {{theme?:'system'|'dark'|'light', fullscreen?:boolean}} options */
export function createMainWindow(appRoot, { theme = 'system', fullscreen = false } = {}) {
  const resolved = theme === 'system' ? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light') : theme;
  const win = new BrowserWindow({
    ...initialSize(),
    minWidth: 960,
    minHeight: 600,
    center: true,
    fullscreenable: true,
    backgroundColor: BACKGROUND[resolved],
    title: 'Filmio',
    icon: appIconPath(appRoot),
    show: false,
    webPreferences: {
      preload: path.join(appRoot, 'src', 'preload', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // No native menu bar; shortcuts (F11 etc.) are handled by the renderer.
  win.setMenu(null);
  win.once('ready-to-show', () => {
    win.show();
    if (fullscreen) win.setFullScreen(true);
  });

  // Let the UI know when fullscreen changes (F11, Esc, OS controls).
  const notifyFullscreen = () => win.webContents.send('window:fullscreen', win.isFullScreen());
  win.on('enter-full-screen', notifyFullscreen);
  win.on('leave-full-screen', notifyFullscreen);

  // Never open new Electron windows; external links go to the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event) => event.preventDefault());

  win.loadFile(path.join(appRoot, 'src', 'renderer', 'index.html'));
  return win;
}
