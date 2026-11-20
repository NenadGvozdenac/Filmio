export class SettingsController {
  /**
   * @param {import('../services/SettingsService.js').SettingsService} settingsService
   * @param {import('../services/StartupService.js').StartupService} startupService
   * @param {(settings) => void} [onChange] called after every successful update (e.g. tray labels)
   */
  constructor(settingsService, startupService, onChange = () => {}) {
    this.settingsService = settingsService;
    this.startupService = startupService;
    this.onChange = onChange;
  }

  get() {
    return this.settingsService.get().toJSON();
  }

  update(patch = {}) {
    const settings = this.settingsService.update(patch);
    if ('launchOnStartup' in patch) this.startupService.setLaunchOnStartup(settings.launchOnStartup);
    this.onChange(settings);
    return settings.toJSON();
  }
}
