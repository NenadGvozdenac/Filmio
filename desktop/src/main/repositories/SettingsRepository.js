import { Settings } from '../models/Settings.js';

export class SettingsRepository {
  /**
   * @param {import('./JsonFileStore.js').JsonFileStore} store
   * @param {object} defaults default settings values
   */
  constructor(store, defaults) {
    this.store = store;
    this.defaults = defaults;
  }

  get() {
    return new Settings({ ...this.defaults, ...this.store.get('settings', {}) });
  }

  save(settings) {
    this.store.set('settings', settings.toJSON());
  }
}
