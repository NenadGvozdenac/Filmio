import { h, $, clear } from '../utils/dom.js';
import { icon, setIcon } from '../utils/icons.js';
import { formatTime, formatSpeed, formatPercent, formatBytes, episodeLabel } from '../utils/format.js';
import { toast, toastError } from '../utils/toast.js';
import { t, errorText, onLanguageChange } from '../i18n/i18n.js';
import * as downloads from '../services/downloadService.js';
import { openVideoFile } from '../services/systemService.js';
import { actionForEvent, getKeybinds, keyLabel, onKeybindsChange } from '../services/keybindService.js';
import { showTab, currentTab, onTabChange } from './tabs.js';

const SEEK_STEP = 10;
const VOLUME_STEP = 0.05;
const IDLE_MS = 3000;
const ICON_SIZE = { size: 20 };

const episodeKey = (f) => (f?.episode?.episode != null ? `${f.episode.season}x${f.episode.episode}` : null);
const normalizeShow = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Paints the filled part of a .slider (shadcn Slider look). */
function paintSlider(input) {
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 1;
  input.style.setProperty('--value', `${((Number(input.value) - min) / (max - min)) * 100}%`);
}

/**
 * Video player with custom controls.
 * Quality switching offers (a) other video files inside the same torrent and
 * (b) other releases of the same title from the search results.
 */
export function initPlayerView() {
  const player = $('#player');
  const video = $('#video');
  const overlay = $('#player-overlay');
  const spinner = $('#player-spinner');
  const message = $('#player-message');
  const openLocalBtn = $('#open-local');
  const titleEl = $('#player-title');
  const statsEl = $('#player-stats');
  const seek = $('#seek');
  const seekBuffer = $('#seek-buffer');
  const timeEl = $('#time');
  const playBtn = $('#btn-play');
  const prevBtn = $('#btn-prev');
  const nextBtn = $('#btn-next');
  const muteBtn = $('#btn-mute');
  const fullscreenBtn = $('#btn-fullscreen');
  const volume = $('#volume');
  const speed = $('#speed');
  const quality = $('#quality');
  const episodeSelect = $('#episode');

  /** @type {{infoHash?:string, files:object[], fileIndex?:number, context:object}|null} */
  let session = null;
  let loadToken = 0;
  let seeking = false;
  let idleTimer = null;
  // Overlay content as a translatable descriptor, re-rendered on language change.
  let overlayState = { key: 'player.idle', allowOpen: true };

  // ---------- Overlay ----------

  const setSpinner = (visible, floating = false) => {
    spinner.toggleAttribute('hidden', !visible);
    spinner.classList.toggle('floating', floating);
  };

  /**
   * @param {{key?:string, params?:object, error?:any, isError?:boolean, busy?:boolean, allowOpen?:boolean}} state
   *   key: i18n key; error: error object/code translated via errorText
   */
  function showOverlay(state) {
    overlayState = state;
    overlay.classList.remove('hidden');
    renderOverlay();
  }

  function renderOverlay() {
    const { key, params, error, isError = false, busy = false, allowOpen = false } = overlayState;
    message.textContent = error != null ? errorText(error) : key ? t(key, params) : '';
    message.classList.toggle('error', error != null || isError);
    setSpinner(busy);
    openLocalBtn.hidden = !allowOpen;
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  // ---------- Loading ----------

  function loadSource(url, startAt = 0) {
    video.src = url;
    video.addEventListener('loadedmetadata', () => {
      if (startAt > 0 && startAt < video.duration) video.currentTime = startAt;
      video.play().catch(() => {});
    }, { once: true });
  }

  /**
   * Plays a download (streams it while downloading, or from disk when finished).
   * @param {string} infoHash
   * @param {{title?:string, kind?:string, show?:string, fileIndex?:number, alternatives?:object[], release?:object}} context
   *   fileIndex picks a specific file, e.g. an episode inside a season pack
   */
  async function playTorrent(infoHash, context = {}, startAt = 0) {
    const token = ++loadToken;
    showTab('player');
    video.pause();
    titleEl.textContent = context.title ?? '';
    showOverlay({ key: 'player.connecting', busy: true });
    try {
      const info = await downloads.getPlayableFiles(infoHash);
      if (token !== loadToken) return;
      const file = info.files.find((f) => f.index === context.fileIndex)
        ?? info.files.find((f) => f.index === info.defaultIndex)
        ?? info.files[0];
      if (!file) {
        showOverlay({ error: 'NO_VIDEO_FILE', allowOpen: true });
        return;
      }

      const show = context.show ?? downloads.getDownload(infoHash)?.show ?? null;
      session = { infoHash, files: info.files, fileIndex: file.index, context: { ...context, show, title: context.title || info.title } };
      titleEl.textContent = session.context.title;
      buildEpisodeMenu();
      buildQualityMenu();
      updateEpisodeNav();
      if (!file.playable) {
        showOverlay({ key: 'player.unsupportedFormat', isError: true });
        return;
      }
      showOverlay({ key: 'player.buffering', busy: true });
      loadSource(file.url, startAt);
    } catch (err) {
      if (token === loadToken) showOverlay({ error: err, allowOpen: true });
    }
  }

  async function playLocalFile() {
    try {
      const file = await openVideoFile();
      if (!file) return;
      ++loadToken;
      session = { files: [], context: { title: file.name, alternatives: [] } };
      titleEl.textContent = file.name;
      statsEl.replaceChildren();
      buildEpisodeMenu();
      buildQualityMenu();
      updateEpisodeNav();
      showOverlay({ key: 'player.loading', busy: true });
      loadSource(file.url);
    } catch (err) {
      toastError(err);
    }
  }

  // ---------- Episode menu (season packs) ----------

  const currentFile = () => session?.files.find((f) => f.index === session.fileIndex) ?? null;

  /** One option per episode in the torrent; hidden for movies and single episodes. */
  function buildEpisodeMenu() {
    clear(episodeSelect);
    const byEpisode = new Map();
    for (const f of session?.files ?? []) {
      const key = episodeKey(f);
      if (!key || !f.playable) continue;
      const existing = byEpisode.get(key);
      if (!existing || f.length > existing.length) byEpisode.set(key, f); // best (largest) file per episode
    }
    const episodes = [...byEpisode.values()]
      .sort((a, b) => (a.episode.season - b.episode.season) || (a.episode.episode - b.episode.episode));
    episodeSelect.hidden = episodes.length < 2;
    if (episodes.length < 2) return;

    const currentKey = episodeKey(currentFile());
    for (const f of episodes) {
      episodeSelect.append(h('option', { value: String(f.index) }, episodeLabel(f.episode.season, f.episode.episode, f.episode.episodeEnd)));
      if (episodeKey(f) === currentKey) episodeSelect.value = String(f.index);
    }
  }

  /** Switches to another episode file inside the current torrent. */
  function switchToFile(file) {
    session.fileIndex = file.index;
    const label = episodeLabel(file.episode.season, file.episode.episode, file.episode.episodeEnd);
    session.context.title = session.context.show ? `${session.context.show} ${label}` : label;
    titleEl.textContent = session.context.title;
    episodeSelect.value = String(file.index);
    buildQualityMenu();
    updateEpisodeNav();
    showOverlay({ key: 'player.loading', busy: true });
    loadSource(file.url, 0);
  }

  episodeSelect.addEventListener('change', () => {
    const file = session?.files.find((f) => f.index === Number(episodeSelect.value));
    if (file) switchToFile(file);
  });

  // ---------- Next / previous episode ----------

  /**
   * Every episode of the current show we can play: files of the current torrent
   * (season pack) plus episodes of the same show in other downloads.
   */
  function episodePlaylist() {
    if (!session?.infoHash) return [];
    const entries = new Map();
    const add = (infoHash, file) => {
      const key = episodeKey(file);
      if (!key || !file.playable || entries.has(key)) return;
      entries.set(key, { key, infoHash, fileIndex: file.index, episode: file.episode });
    };
    for (const file of session.files) add(session.infoHash, file); // current torrent wins
    const show = normalizeShow(session.context.show);
    if (show) {
      for (const d of downloads.getDownloads()) {
        if (d.infoHash === session.infoHash || d.kind !== 'series') continue;
        if (normalizeShow(d.show || d.title) !== show) continue;
        for (const file of d.files ?? []) add(d.infoHash, file);
      }
    }
    return [...entries.values()]
      .sort((a, b) => (a.episode.season - b.episode.season) || (a.episode.episode - b.episode.episode));
  }

  function neighbourEpisode(step) {
    const key = episodeKey(currentFile());
    if (!key) return null;
    const list = episodePlaylist();
    const index = list.findIndex((e) => e.key === key);
    return index < 0 ? null : list[index + step] ?? null;
  }

  /** Plays the next (step = 1) or previous (step = -1) episode. */
  function playNeighbourEpisode(step) {
    if (!session?.infoHash || !episodeKey(currentFile())) return; // movies: nothing to do
    const entry = neighbourEpisode(step);
    if (!entry) {
      toast(t(step > 0 ? 'player.noNextEpisode' : 'player.noPreviousEpisode'), 'info');
      return;
    }
    if (entry.infoHash === session.infoHash) {
      switchToFile(session.files.find((f) => f.index === entry.fileIndex));
      return;
    }
    const label = episodeLabel(entry.episode.season, entry.episode.episode, entry.episode.episodeEnd);
    const show = session.context.show;
    playTorrent(entry.infoHash, { title: show ? `${show} ${label}` : label, kind: 'series', show, fileIndex: entry.fileIndex });
  }

  /** Prev/next buttons are shown only for series. */
  function updateEpisodeNav() {
    const isEpisode = !!session?.infoHash && !!episodeKey(currentFile());
    prevBtn.hidden = !isEpisode;
    nextBtn.hidden = !isEpisode;
    if (!isEpisode) return;
    prevBtn.disabled = !neighbourEpisode(-1);
    nextBtn.disabled = !neighbourEpisode(1);
  }

  prevBtn.addEventListener('click', () => playNeighbourEpisode(-1));
  nextBtn.addEventListener('click', () => playNeighbourEpisode(1));

  // ---------- Quality menu ----------

  function buildQualityMenu() {
    clear(quality);
    if (!session) {
      quality.hidden = true;
      return;
    }
    // In a season pack only files of the current episode are quality options.
    const key = episodeKey(currentFile());
    const files = session.files.filter((f) => f.playable && (!key || episodeKey(f) === key));
    const current = session.context.release;
    const all = session.context.alternatives ?? [];
    const alternatives = all.filter((r) => r.source !== current?.source);

    if (files.length) {
      const group = h('optgroup', { label: t('player.thisTorrent') });
      for (const f of files) {
        group.append(h('option', { value: `file:${f.index}` }, `${f.quality} · ${formatBytes(f.length)}${files.length > 1 ? ` · ${f.name}` : ''}`));
      }
      quality.append(group);
    }
    if (alternatives.length) {
      const group = h('optgroup', { label: t('player.otherReleases') });
      for (const r of alternatives) {
        const seeds = r.seeders == null ? t('release.webSeed') : `${r.seeders} ${t('release.seedersTitle').toLowerCase()}`;
        group.append(h('option', { value: `alt:${all.indexOf(r)}` }, `${r.quality.label} ${r.quality.source} · ${formatBytes(r.size)} · ${seeds}`));
      }
      quality.append(group);
    }
    if (session.fileIndex != null) quality.value = `file:${session.fileIndex}`;
    quality.disabled = quality.options.length <= 1;
    quality.hidden = quality.options.length === 0;
  }

  quality.addEventListener('change', async () => {
    if (!session) return;
    const [type, raw] = quality.value.split(':');
    const index = Number(raw);
    const position = video.currentTime;

    if (type === 'file') {
      const file = session.files.find((f) => f.index === index);
      if (!file) return;
      session.fileIndex = index;
      showOverlay({ key: 'player.switchingQuality', busy: true });
      loadSource(file.url, position);
      return;
    }

    // Switch to another release: add it to downloads and continue at the same position.
    const release = session.context.alternatives[index];
    if (!release) return;
    showOverlay({ key: 'player.switchingTo', params: { quality: release.quality.label }, busy: true });
    try {
      const meta = downloads.metaFromRelease(release, session.context);
      const infoHash = await downloads.addDownload(release.source, meta);
      await playTorrent(infoHash, { ...session.context, release }, position);
    } catch (err) {
      toastError(err);
      buildQualityMenu();
      hideOverlay();
    }
  });

  // ---------- Controls ----------

  const togglePlay = () => {
    if (!video.getAttribute('src')) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  const seekBy = (seconds) => {
    if (!Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  };

  const setVolume = (value) => {
    video.volume = Math.max(0, Math.min(1, value));
    video.muted = video.volume === 0;
  };

  /** Toggles mute; unmuting at volume 0 restores an audible level. */
  const toggleMute = () => {
    if (video.muted || video.volume === 0) {
      if (video.volume === 0) video.volume = 0.5;
      video.muted = false;
    } else {
      video.muted = true;
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else player.requestFullscreen().catch(() => {});
  };

  playBtn.addEventListener('click', togglePlay);
  video.addEventListener('click', togglePlay);
  video.addEventListener('dblclick', toggleFullscreen);
  $('#btn-back').addEventListener('click', () => seekBy(-SEEK_STEP));
  $('#btn-forward').addEventListener('click', () => seekBy(SEEK_STEP));
  fullscreenBtn.addEventListener('click', toggleFullscreen);
  openLocalBtn.addEventListener('click', playLocalFile);
  muteBtn.addEventListener('click', toggleMute);
  volume.addEventListener('input', () => { setVolume(Number(volume.value)); paintSlider(volume); });
  speed.addEventListener('change', () => { video.playbackRate = Number(speed.value); });

  document.addEventListener('fullscreenchange', () => {
    setIcon(fullscreenBtn, document.fullscreenElement === player ? 'shrink' : 'expand', ICON_SIZE);
  });

  seek.addEventListener('input', () => {
    seeking = true;
    paintSlider(seek);
    if (Number.isFinite(video.duration)) timeEl.textContent = `${formatTime((seek.value / 1000) * video.duration)} / ${formatTime(video.duration)}`;
  });
  seek.addEventListener('change', () => {
    if (Number.isFinite(video.duration)) video.currentTime = (seek.value / 1000) * video.duration;
    seeking = false;
  });

  // ---------- Video events ----------

  video.addEventListener('play', () => { setIcon(playBtn, 'pause', ICON_SIZE); scheduleIdle(); });
  video.addEventListener('pause', () => { setIcon(playBtn, 'play', ICON_SIZE); wake(); });
  video.addEventListener('playing', hideOverlay);
  video.addEventListener('canplay', () => { if (!video.paused) hideOverlay(); });
  video.addEventListener('waiting', () => {
    overlay.classList.remove('hidden');
    message.textContent = '';
    openLocalBtn.hidden = true;
    setSpinner(true, true);
  });
  video.addEventListener('volumechange', () => {
    const muted = video.muted || video.volume === 0;
    setIcon(muteBtn, muted ? 'volume-x' : video.volume < 0.5 ? 'volume-1' : 'volume-2', ICON_SIZE);
    volume.value = muted ? 0 : video.volume;
    paintSlider(volume);
    try { localStorage.setItem('player.volume', String(video.volume)); } catch { /* storage unavailable */ }
  });
  video.addEventListener('timeupdate', updateTime);
  video.addEventListener('durationchange', updateTime);
  video.addEventListener('progress', updateBuffer);
  video.addEventListener('error', () => {
    if (!video.getAttribute('src')) return;
    const key = video.error?.code === 4 ? 'player.decodeError' : 'player.playbackError';
    showOverlay({ key, isError: true, allowOpen: true });
  });

  function updateTime() {
    if (seeking) return;
    const d = video.duration;
    seek.value = Number.isFinite(d) && d > 0 ? Math.round((video.currentTime / d) * 1000) : 0;
    paintSlider(seek);
    timeEl.textContent = `${formatTime(video.currentTime)} / ${formatTime(d)}`;
    updateBuffer();
  }

  function updateBuffer() {
    const d = video.duration;
    if (!Number.isFinite(d) || d <= 0) { seekBuffer.style.width = '0'; return; }
    let end = 0;
    for (let i = 0; i < video.buffered.length; i++) {
      if (video.buffered.start(i) <= video.currentTime + 1) end = Math.max(end, video.buffered.end(i));
    }
    seekBuffer.style.width = `${(end / d) * 100}%`;
  }

  // Live torrent stats in the top bar.
  function renderStats() {
    if (!session?.infoHash) { statsEl.replaceChildren(); return; }
    const d = downloads.getDownload(session.infoHash);
    if (!d) return;
    const item = (name, text) => h('span', {}, icon(name), text);
    statsEl.replaceChildren(...(d.done
      ? [item('circle-check', t('player.downloaded', { size: formatBytes(d.length) }))]
      : [
        h('span', {}, formatPercent(d.progress)),
        item('arrow-down', formatSpeed(d.downloadSpeed)),
        item('users', t('player.peers', { count: d.numPeers })),
      ]));
  }
  downloads.subscribe(() => {
    renderStats();
    updateEpisodeNav(); // newly downloaded episodes can become next/previous
  });

  // ---------- Auto-hide controls ----------

  function wake() {
    player.classList.remove('idle');
    scheduleIdle();
  }

  const controlsEl = $('#controls');
  const topEl = $('#player-top');

  /** Controls stay visible while paused, hovered, or while one of their menus is in use. */
  const mustStayVisible = () => video.paused
    || controlsEl.matches(':hover')
    || topEl.matches(':hover')
    || controlsEl.contains(document.activeElement) && document.activeElement.tagName === 'SELECT';

  function scheduleIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function hide() {
      if (mustStayVisible()) {
        idleTimer = setTimeout(hide, IDLE_MS); // check again later
        return;
      }
      player.classList.add('idle');
    }, IDLE_MS);
  }

  player.addEventListener('mousemove', wake);
  player.addEventListener('mousedown', wake);
  controlsEl.addEventListener('focusin', wake);

  // ---------- Keyboard shortcuts ----------

  // Keys are configurable in Settings (see keybindService).
  const actions = {
    playPause: togglePlay,
    mute: toggleMute,
    nextEpisode: () => playNeighbourEpisode(1),
    previousEpisode: () => playNeighbourEpisode(-1),
    seekBack: () => seekBy(-SEEK_STEP),
    seekForward: () => seekBy(SEEK_STEP),
    volumeUp: () => setVolume(video.volume + VOLUME_STEP),
    volumeDown: () => setVolume(video.volume - VOLUME_STEP),
    fullscreen: toggleFullscreen,
  };

  document.addEventListener('keydown', (event) => {
    if (currentTab() !== 'player' || document.querySelector('.dialog-overlay')) return;
    if (event.target.closest('input[type="text"], input[type="search"], input[type="password"], select')) return;
    wake(); // any key shows the controls
    const action = actionForEvent(event);
    if (!action || !actions[action]) return;
    event.preventDefault();
    actions[action]();
    wake();
  });

  /** Button tooltips show the current key, e.g. "Next episode (N)". */
  function renderTitles() {
    const keys = getKeybinds();
    const title = (key, action) => t(key, { key: keyLabel(keys[action]) });
    playBtn.title = title('player.playPause', 'playPause');
    prevBtn.title = title('player.previousEpisode', 'previousEpisode');
    nextBtn.title = title('player.nextEpisode', 'nextEpisode');
    $('#btn-back').title = title('player.back', 'seekBack');
    $('#btn-forward').title = title('player.forward', 'seekForward');
    muteBtn.title = title('player.mute', 'mute');
    fullscreenBtn.title = title('player.fullscreen', 'fullscreen');
    speed.title = t('player.speed');
    quality.title = t('player.quality');
    episodeSelect.title = t('player.episode');
  }
  onKeybindsChange(renderTitles);

  // Pause when leaving the player tab.
  onTabChange((tab, previous) => {
    if (previous === 'player' && tab !== 'player') video.pause();
  });

  /** Stops playback and returns the player to its empty state. */
  function resetPlayer(overlay = { key: 'player.idle', allowOpen: true }) {
    ++loadToken; // cancels a load that may still be in progress
    session = null;
    video.pause();
    video.removeAttribute('src');
    video.load();
    titleEl.textContent = '';
    statsEl.replaceChildren();
    timeEl.textContent = '0:00 / 0:00';
    seek.value = 0;
    paintSlider(seek);
    seekBuffer.style.width = '0';
    buildEpisodeMenu();
    buildQualityMenu();
    updateEpisodeNav();
    showOverlay(overlay);
  }

  // Deleting the download that is playing stops the player instead of showing a playback error.
  downloads.onRemoved((infoHash) => {
    if (session?.infoHash === infoHash) resetPlayer({ key: 'player.removed', allowOpen: true });
  });

  onLanguageChange(() => {
    renderOverlay();
    renderStats();
    renderTitles();
    const selected = quality.value;
    buildQualityMenu();
    if (selected) quality.value = selected;
  });

  episodeSelect.hidden = true;
  updateEpisodeNav();
  renderTitles();

  // Restore last volume.
  try {
    const saved = localStorage.getItem('player.volume');
    if (saved !== null && Number(saved) >= 0 && Number(saved) <= 1) video.volume = Number(saved);
  } catch { /* storage unavailable */ }

  volume.value = video.volume;
  paintSlider(volume);
  paintSlider(seek);
  buildQualityMenu();
  renderOverlay();

  return { playTorrent, playLocalFile };
}
