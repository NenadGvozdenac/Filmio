/** Window-level actions requested by the UI. */
export class WindowController {
  /** @param {() => import('electron').BrowserWindow|null} getWindow */
  constructor(getWindow) {
    this.getWindow = getWindow;
  }

  /** @returns {boolean} new fullscreen state */
  toggleFullscreen() {
    const win = this.getWindow();
    if (!win) return false;
    win.setFullScreen(!win.isFullScreen());
    return win.isFullScreen();
  }

  /** @returns {boolean} new fullscreen state */
  exitFullscreen() {
    const win = this.getWindow();
    if (win?.isFullScreen()) win.setFullScreen(false);
    return false;
  }

  isFullscreen() {
    return !!this.getWindow()?.isFullScreen();
  }
}
