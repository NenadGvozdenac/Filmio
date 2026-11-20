// Renderer entry point: applies language/theme, initializes views and connects shared actions.
import { initTabs } from './views/tabs.js';
import { initSearchView } from './views/searchView.js';
import { initLibraryView } from './views/libraryView.js';
import { initDownloadsView } from './views/downloadsView.js';
import { initPlayerView } from './views/playerView.js';
import { initSettingsView } from './views/settingsView.js';
import { addDownload, metaFromRelease } from './services/downloadService.js';
import { getSettings } from './services/settingsService.js';
import { applyTheme } from './services/themeService.js';
import { setKeybinds } from './services/keybindService.js';
import { toggleAppFullscreen, exitAppFullscreen, isAppFullscreen, onAppFullscreenChange } from './services/windowService.js';
import { t, setLanguage, applyTranslations, onLanguageChange } from './i18n/i18n.js';
import { hydrateIcons, setIcon } from './utils/icons.js';
import { $ } from './utils/dom.js';
import { toast, toastError } from './utils/toast.js';

/** Sidebar "Fullscreen" item, F11 to toggle and Esc to leave app fullscreen. */
function initAppFullscreen() {
  const button = $('#app-fullscreen');
  const label = $('#app-fullscreen-label');
  let fullscreen = false;

  const render = () => {
    setIcon(button, fullscreen ? 'minimize' : 'maximize');
    label.dataset.i18n = fullscreen ? 'nav.exitFullscreen' : 'nav.fullscreen';
    label.textContent = t(label.dataset.i18n);
  };

  const toggle = () => toggleAppFullscreen().catch(toastError);

  button.addEventListener('click', toggle);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'F11') {
      event.preventDefault();
      toggle();
    } else if (event.key === 'Escape' && fullscreen && !document.fullscreenElement && !document.querySelector('.dialog-overlay')) {
      exitAppFullscreen().catch(toastError);
    }
  });
  onAppFullscreenChange((value) => {
    // Player (HTML) fullscreen also makes the window fullscreen; only track the app-level one.
    fullscreen = value && !document.fullscreenElement;
    render();
  });
  onLanguageChange(render);
  isAppFullscreen().then((value) => { fullscreen = value; render(); }).catch(() => {});
}

async function main() {
  hydrateIcons();

  // Apply saved language + theme before anything else.
  let settings = null;
  try {
    settings = await getSettings();
  } catch (err) {
    toastError(err);
  }
  applyTheme(settings?.theme ?? 'system');
  setKeybinds(settings?.keybinds);
  applyTranslations();
  setLanguage(settings?.language ?? 'en');

  initTabs();
  initAppFullscreen();
  const player = initPlayerView();

  /** Actions used by the search results (movies and series). */
  const releaseActions = {
    /** Adds the release to downloads and starts streaming it in the player. */
    async watch(release, context) {
      try {
        const infoHash = await addDownload(release.source, metaFromRelease(release, context));
        await player.playTorrent(infoHash, { ...context, release });
      } catch (err) {
        toastError(err);
      }
    },

    /** Adds the release to the download folder only. */
    async download(release, context) {
      try {
        await addDownload(release.source, metaFromRelease(release, context));
        toast(t('downloads.addedRelease', { title: context.title, quality: release.quality.label }));
      } catch (err) {
        toastError(err);
      }
    },
  };

  const play = (infoHash, context) => player.playTorrent(infoHash, context);

  initSearchView(releaseActions);
  initLibraryView({ play });
  initDownloadsView({ play });
  initSettingsView(settings);
}

main();
