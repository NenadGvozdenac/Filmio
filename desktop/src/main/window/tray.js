import path from 'node:path';
import { Menu, Tray, nativeImage } from 'electron';

const LABELS = {
  en: { open: 'Open Filmio', quit: 'Quit Filmio' },
  sr: { open: 'Otvori Filmio', quit: 'Zatvori Filmio' },
};

/**
 * System tray icon while Filmio runs: click opens the window, the menu has Open / Quit.
 * @param {string} appRoot
 * @param {{getLanguage:() => string, onOpen:() => void, onQuit:() => void}} handlers
 * @returns {{refresh:() => void, destroy:() => void}}
 */
export function createTray(appRoot, { getLanguage, onOpen, onQuit }) {
  const file = process.platform === 'win32' ? 'tray.ico' : 'tray.png';
  const tray = new Tray(nativeImage.createFromPath(path.join(appRoot, 'assets', file)));
  tray.setToolTip('Filmio');
  tray.on('click', onOpen);

  const refresh = () => {
    const labels = LABELS[getLanguage()] ?? LABELS.en;
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: labels.open, click: onOpen },
      { type: 'separator' },
      { label: labels.quit, click: onQuit },
    ]));
  };
  refresh();

  return { refresh, destroy: () => tray.destroy() };
}

/** Window / taskbar icon. */
export function appIconPath(appRoot) {
  return path.join(appRoot, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
}
