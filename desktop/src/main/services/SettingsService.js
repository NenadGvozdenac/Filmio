const EDITABLE_FIELDS = [
  'downloadDir', 'language', 'theme', 'startFullscreen', 'launchOnStartup', 'keybinds', 'tmdbApiKey',
];

export class SettingsService {
  /** @param {import('../repositories/SettingsRepository.js').SettingsRepository} settingsRepository */
  constructor(settingsRepository) {
    this.repo = settingsRepository;
  }

  get() {
    return this.repo.get();
  }

  update(patch = {}) {
    const clean = Object.fromEntries(Object.entries(patch).filter(([key]) => EDITABLE_FIELDS.includes(key)));
    const next = this.repo.get().with(clean);
    this.repo.save(next);
    return next;
  }
}
