import { h, $, clear } from '../utils/dom.js';
import { icon, setIcon } from '../utils/icons.js';
import { toastError } from '../utils/toast.js';
import { t, onLanguageChange } from '../i18n/i18n.js';
import { getChannels, openChannelPage } from '../services/liveService.js';
import { openExternal } from '../services/systemService.js';
import { onTabChange } from './tabs.js';

const YETTEL_TV_URL = 'https://ytv.rs';

/** Short text logo for channels without an image ("RTS 1", "N1", "Informer"). */
function monogram(name) {
  const clean = name.replace(/\s*\(.*$/, '');
  const text = clean.length <= 7 ? clean : clean.split(/\s+/)[0].slice(0, 8);
  return h('span', { class: 'channel-monogram' }, text);
}

/**
 * Live TV tab: one row per channel. Built-in channels come first, then channels from the
 * M3U playlists configured in Settings. Live channels play in the Player tab; channels
 * that only work on the broadcaster's page open in a Filmio window or the browser.
 * @param {{playLive:(channel:object, list:object[]) => void}} actions
 */
export function initLiveView(actions) {
  const list = $('#live-list');
  const empty = $('#live-empty');
  const status = $('#live-status');
  const searchInput = $('#live-search');
  const groupSelect = $('#live-group');
  let channels = [];
  let errors = [];
  let loading = false;

  const matches = (c) => {
    const q = searchInput.value.trim().toLowerCase();
    const group = groupSelect.value;
    return (!q || c.name.toLowerCase().includes(q)) && (!group || c.builtIn || c.group === group);
  };

  /** Where / how the channel is watched, shown under its name. */
  function description(channel) {
    if (channel.kind === 'external') return t(channel.note === 'drm' ? 'live.opensOfficialSiteDrm' : 'live.opensOfficialSite');
    if (channel.kind === 'web') return t('live.opensWindow');
    return channel.builtIn ? t('live.watchInFilmio') : channel.group;
  }

  function open(channel, liveChannels) {
    if (channel.kind === 'live') actions.playLive(channel, liveChannels);
    else openChannelPage(channel.id).catch(toastError);
  }

  function channelRow(channel, liveChannels) {
    // Built-in logos are bundled with the app ("assets/channels/..."); playlist logos are URLs.
    const src = channel.logo && (/^https?:\/\//i.test(channel.logo) ? channel.logo : `../../${channel.logo}`);
    const tile = h('div', { class: `channel-logo ${src ? 'has-image' : ''}` });
    if (src) {
      const img = h('img', { src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
      img.addEventListener('error', () => {
        tile.classList.remove('has-image');
        img.replaceWith(monogram(channel.name));
      }, { once: true });
      tile.append(img);
    } else {
      tile.append(monogram(channel.name));
    }

    const isLive = channel.kind === 'live';
    return h('div', { class: 'channel-row', role: 'button', tabindex: '0', title: channel.name,
      onClick: () => open(channel, liveChannels),
      onKeydown: (e) => { if (e.key === 'Enter') open(channel, liveChannels); },
    },
    tile,
    h('div', { class: 'channel-info' },
      h('div', { class: 'channel-name' }, channel.name),
      h('div', { class: 'channel-group' }, description(channel)),
    ),
    isLive && h('span', { class: 'badge badge-outline channel-live' }, t('player.live')),
    h('button', {
      class: `btn btn-sm ${isLive ? 'btn-default' : 'btn-outline'}`,
      onClick: (e) => { e.stopPropagation(); open(channel, liveChannels); },
    }, icon(isLive ? 'play' : 'external-link'), t(isLive ? 'live.watch' : 'live.open')));
  }

  function renderGroups() {
    const current = groupSelect.value;
    const groups = [...new Set(channels.filter((c) => !c.builtIn).map((c) => c.group).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
    clear(groupSelect).append(h('option', { value: '' }, t('live.allGroups')), ...groups.map((g) => h('option', { value: g }, g)));
    groupSelect.value = groups.includes(current) ? current : '';
    groupSelect.hidden = groups.length === 0;
  }

  function render() {
    const visible = channels.filter(matches);
    // Next / previous channel in the player cycles through the playable ones.
    const liveChannels = visible.filter((c) => c.kind === 'live');
    const builtIn = visible.filter((c) => c.builtIn);
    const fromPlaylists = visible.filter((c) => !c.builtIn);

    clear(list);
    if (builtIn.length) {
      list.append(h('h2', { class: 'section-title' }, icon('radio-tower'), t('live.channels')),
        h('div', { class: 'card channel-list' }, builtIn.map((c) => channelRow(c, liveChannels))));
    }
    if (fromPlaylists.length) {
      list.append(h('h2', { class: 'section-title' }, icon('layers'), t('live.myPlaylists')),
        h('div', { class: 'card channel-list' }, fromPlaylists.map((c) => channelRow(c, liveChannels))));
    }

    clear(status);
    for (const e of errors) {
      status.append(h('div', { class: 'alert destructive' }, icon('alert'), h('span', {}, t('live.playlistError', { name: e.playlist, message: e.message }))));
    }
    empty.hidden = visible.length > 0 || loading;
    clear(empty);
    if (!visible.length && !loading) empty.append(icon('radio-tower'), h('span', {}, t('live.noChannels')));
  }

  async function load(refresh = false) {
    if (loading) return;
    loading = true;
    const refreshBtn = $('#live-refresh');
    refreshBtn.disabled = true;
    if (!channels.length) clear(status).append(h('span', {}, t('live.loading')));
    try {
      ({ channels, errors } = await getChannels({ refresh }));
      renderGroups();
    } catch (err) {
      toastError(err);
    } finally {
      loading = false;
      refreshBtn.disabled = false;
      render();
    }
  }

  searchInput.addEventListener('input', render);
  groupSelect.addEventListener('change', render);
  $('#live-refresh').addEventListener('click', () => load(true));
  $('#live-yettel').addEventListener('click', () => openExternal(YETTEL_TV_URL).catch(toastError));

  // Reload when the tab is opened (playlists may have changed in Settings; the main process caches them).
  onTabChange((tab) => { if (tab === 'live') load(); });
  onLanguageChange(() => { renderGroups(); render(); });
  setIcon($('#live-refresh'), 'refresh-cw');
}
