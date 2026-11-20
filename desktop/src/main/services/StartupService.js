/** Registers / unregisters Filmio as an app that starts when the user signs in. */
export class StartupService {
  /** @param {import('electron').App} app */
  constructor(app) {
    this.app = app;
  }

  setLaunchOnStartup(enabled) {
    const options = { openAtLogin: !!enabled };
    // In development (`electron .`) Electron itself must be started with the app folder as argument.
    if (process.defaultApp) {
      options.path = process.execPath;
      options.args = [this.app.getAppPath()];
    }
    this.app.setLoginItemSettings(options);
  }

  isLaunchOnStartupEnabled() {
    const query = process.defaultApp ? { path: process.execPath, args: [this.app.getAppPath()] } : {};
    return this.app.getLoginItemSettings(query).openAtLogin;
  }
}
