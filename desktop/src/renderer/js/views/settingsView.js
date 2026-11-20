import { h, $, clear } from '../utils/dom.js';
import { toast, toastError } from '../utils/toast.js';
import { t, setLanguage, onLanguageChange } from '../i18n/i18n.js';
import { applyTheme } from '../services/themeService.js';
import { getSettings, updateSettings } from '../services/settingsService.js';
import { chooseDirectory, openExternal } from '../services/systemService.js';
import { onTabChange } from './tabs.js';
import {
  DEFAULT_KEYBINDS, KEYBIND_ACTIONS, getKeybinds, setKeybinds, keyFromEvent, keyLabel,
} from '../services/keybindService.js';

/**
 * Keyboard shortcut editor: click a key, press the new key (Esc cancels).
 * A key already used by another action is swapped with it.
 */
function initKeybindEditor() {
  const container = $('#keybinds');
  let recording = null; // { action, button }

  const save = async (next) => {
    const previous = getKeybinds();
    setKeybinds(next);
    render();
    try {
      await updateSettings({ keybinds: next });
    } catch (err) {
      setKeybinds(previous);
      render();
      toastError(err);
    }
  };

  function stopRecording() {
    if (!recording) return;
    document.removeEventListener('keydown', onKey, true);
    recording = null;
    render();
  }

  function onKey(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      stopRecording();
      return;
    }
    const key = keyFromEvent(event);
    if (!key) return; // modifier or reserved key: keep waiting
    const { action } = recording;
    const binds = getKeybinds();
    const conflict = KEYBIND_ACTIONS.find((a) => a !== action && binds[a] === key);
    if (conflict) binds[conflict] = binds[action]; // swap
    binds[action] = key;
    document.removeEventListener('keydown', onKey, true);
    recording = null;
    save(binds);
  }

  function startRecording(action) {
    stopRecording();
    recording = { action };
    document.addEventListener('keydown', onKey, true);
    render();
  }

  function render() {
    const binds = getKeybinds();
    clear(container).append(...KEYBIND_ACTIONS.map((action) => {
      const isRecording = recording?.action === action;
      const button = h('button', {
        class: `kbd ${isRecording ? 'recording' : ''}`,
        title: t('settings.keybindChange'),
        onClick: () => (isRecording ? stopRecording() : startRecording(action)),
      }, isRecording ? t('settings.keybindPress') : keyLabel(binds[action]));
      return h('div', { class: 'keybind-row' }, h('span', {}, t(`keybinds.${action}`)), button);
    }));
  }

  $('#reset-keybinds').addEventListener('click', () => {
    stopRecording();
    save({ ...DEFAULT_KEYBINDS });
    toast(t('settings.keybindsReset'));
  });

  // Leaving the settings page cancels recording.
  onTabChange((tab) => {
    if (tab !== 'settings') stopRecording();
  });

  onLanguageChange(render);
  render();
}

/**
 * Settings tab. Appearance, startup options and shortcuts apply (and persist) immediately;
 * the download folder and the TMDB key are saved with the Save button.
 * @param {object} initial settings loaded at startup
 */
export function initSettingsView(initial) {
  const languageSelect = $('#set-language');
  const themeSelect = $('#set-theme');
  const startFullscreenInput = $('#set-start-fullscreen');
  const launchStartupInput = $('#set-launch-startup');
  const dirInput = $('#set-dir');
  const tmdbInput = $('#set-tmdb');

  function fill(settings) {
    languageSelect.value = settings.language;
    themeSelect.value = settings.theme;
    startFullscreenInput.checked = settings.startFullscreen;
    launchStartupInput.checked = settings.launchOnStartup;
    dirInput.value = settings.downloadDir;
    tmdbInput.value = settings.tmdbApiKey ?? '';
  }

  languageSelect.addEventListener('change', () => {
    setLanguage(languageSelect.value);
    updateSettings({ language: languageSelect.value }).catch(toastError);
  });

  themeSelect.addEventListener('change', () => {
    applyTheme(themeSelect.value);
    updateSettings({ theme: themeSelect.value }).catch(toastError);
  });

  /** Saves a single toggle right away; reverts the switch if saving fails. */
  const saveToggle = (input, field) => input.addEventListener('change', async () => {
    try {
      await updateSettings({ [field]: input.checked });
      toast(t('settings.saved'));
    } catch (err) {
      input.checked = !input.checked;
      toastError(err);
    }
  });
  saveToggle(startFullscreenInput, 'startFullscreen');
  saveToggle(launchStartupInput, 'launchOnStartup');

  $('#tmdb-get-key').addEventListener('click', () => {
    openExternal('https://www.themoviedb.org/settings/api').catch(toastError);
  });

  $('#set-dir-choose').addEventListener('click', async () => {
    try {
      const dir = await chooseDirectory();
      if (dir) dirInput.value = dir;
    } catch (err) {
      toastError(err);
    }
  });

  $('#save-settings').addEventListener('click', async () => {
    try {
      const saved = await updateSettings({
        downloadDir: dirInput.value,
        tmdbApiKey: tmdbInput.value.trim(),
      });
      fill(saved);
      toast(t('settings.saved'));
    } catch (err) {
      toastError(err);
    }
  });

  initKeybindEditor();

  if (initial) fill(initial);
  else getSettings().then(fill).catch(toastError);
}

