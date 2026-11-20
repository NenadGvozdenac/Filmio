import { h, $, $$, clear } from '../utils/dom.js';
import { icon, setIcon } from '../utils/icons.js';
import { toastError } from '../utils/toast.js';
import { t, onLanguageChange } from '../i18n/i18n.js';
import { getChannels, toggleFavorite } from '../services/liveService.js';
import { openExternal } from '../services/systemService.js';
import { showTab, onTabChange } from './tabs.js';

const YETTEL_TV_URL = 'https://ytv.rs';

/**
 * Live TV tab: channels from the M3U playlists configured in Settings.
 * Channels play in the Player tab; the subscription service opens in the browser.
 * @param {{playLive:(channel:object, list:object[]) => void}} actions
 */
export function initLiveView(actions) {
  const grid = $('#live-grid');
  const empty = $('#live-empty');
  const status = $('#live-status');
  const searchInput = $('#live-search');
  const groupSelect = $('#live-group');
  let channels = [];
  let errors = [];
  let playlistCount = 0;
  let filter = 'all';
  let loading = false;

  const visibleChannels = () => {
    const q = searchInput.value.trim().toLowerCase();
    const group = groupSelect.value;
    return channels.filter((c) => (filter !== 'favorites' || c.favorite)
      && (!group || c.group === group)
      && (!q || c.name.toLowerCase().includes(q)));
  };

  function channelCard(channel, list) {
    const star = h('button', {
      class: `btn btn-ghost btn-icon btn-sm channel-star ${channel.favorite ? 'active' : ''}`,
      title: t(channel.favorite ? 'live.removeFavorite' : 'live.addFavorite'),
      onClick: async (event) => {
        event.stopPropagation();
        try {
          channel.favorite = await toggleFavorite(channel.id);
          render();
        } catch (err) {
          toastError(err);
        }
      },
    }, icon('star'));

    const logo = channel.logo
      ? h('img', { src: channel.logo, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' })
      : icon('radio-tower', { size: 28 });
    if (channel.logo) {
      logo.addEventListener('error', () => logo.replaceWith(icon('radio-tower', { size: 28 })), { once: true });
    }

    return h('div', { class: 'card channel-card', role: 'button', tabindex: '0', title: channel.name,
      onClick: () => actions.playLive(channel, list),
      onKeydown: (e) => { if (e.key === 'Enter') actions.playLive(channel, list); },
    },
    h('div', { class: 'channel-logo' }, logo),
    h('div', { class: 'channel-info' },
      h('div', { class: 'channel-name' }, channel.name),
      h('div', { class: 'channel-group' }, channel.group || channel.playlist),
    ),
    star);
  }

  function renderGroups() {
    const current = groupSelect.value;
    const groups = [...new Set(channels.map((c) => c.group).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    clear(groupSelect).append(h('option', { value: '' }, t('live.allGroups')), ...groups.map((g) => h('option', { value: g }, g)));
    groupSelect.value = groups.includes(current) ? current : '';
    groupSelect.hidden = groups.length === 0;
  }

  function render() {
    const list = visibleChannels();
    clear(grid).append(...list.map((c) => channelCard(c, list)));

    clear(status);
    if (channels.length) status.append(h('span', {}, t('live.channelCount', { count: list.length })));
    for (const e of errors) {
      status.append(h('div', { class: 'alert destructive' }, icon('alert'), h('span', {}, t('live.playlistError', { name: e.playlist, message: e.message }))));
    }

    empty.hidden = list.length > 0 || loading;
    clear(empty);
    if (!list.length && !loading) {
      if (!playlistCount) {
        empty.append(icon('radio-tower'), h('span', {}, t('live.noPlaylists')),
          h('button', { class: 'btn btn-outline btn-sm', onClick: () => showTab('settings') }, icon('settings'), t('live.openSettings')));
      } else {
        empty.append(icon('radio-tower'), h('span', {}, t(filter === 'favorites' ? 'live.noFavorites' : 'live.noChannels')));
      }
    }
  }

  async function load(refresh = false) {
    if (loading) return;
    loading = true;
    const refreshBtn = $('#live-refresh');
    refreshBtn.disabled = true;
    if (!channels.length) {
      clear(status).append(h('span', {}, t('live.loading')));
      empty.hidden = true;
    }
    try {
      ({ channels, errors, playlistCount } = await getChannels({ refresh }));
      renderGroups();
    } catch (err) {
      toastError(err);
    } finally {
      loading = false;
      refreshBtn.disabled = false;
      render();
    }
  }

  for (const trigger of $$('#live-filter .tabs-trigger')) {
    trigger.addEventListener('click', () => {
      filter = trigger.dataset.filter;
      $$('#live-filter .tabs-trigger').forEach((x) => x.classList.toggle('active', x === trigger));
      render();
    });
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
