import { h, $, clear } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { formatBytes, formatPercent } from '../utils/format.js';
import { toast, toastError } from '../utils/toast.js';
import { t, onLanguageChange } from '../i18n/i18n.js';
import * as downloads from '../services/downloadService.js';
import { openTorrentFiles, pathForFile } from '../services/systemService.js';
import { showTab } from './tabs.js';

const RECENT_COUNT = 5;

/** Magnet links, http(s) .torrent URLs and info hashes found in pasted text (one per line or space separated). */
function extractSources(text) {
  return String(text ?? '')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => /^magnet:\?/i.test(s) || /^https?:\/\/\S+/i.test(s) || /^[a-f0-9]{40}$/i.test(s));
}

/**
 * Add tab: paste magnet links / .torrent URLs, open or drop .torrent files.
 * Movies and series are recognized from the names after the metadata arrives.
 * @param {{play:(infoHash:string, context:object) => void}} actions
 */
export function initAddView(actions) {
  const input = $('#add-input');
  const dropZone = $('#add-drop');
  const recentEl = $('#add-recent');
  let busy = false;

  /** Adds every source; optionally starts playing the first one. */
  async function addAll(sources, { watch = false } = {}) {
    if (!sources.length) {
      toastError(t('add.nothingToAdd'));
      return;
    }
    if (busy) return;
    busy = true;
    let added = 0;
    let first = null;
    for (const source of sources) {
      try {
        const infoHash = await downloads.addDownload(source);
        first ??= infoHash;
        added += 1;
      } catch (err) {
        toastError(err);
      }
    }
    busy = false;
    if (!added) return;
    input.value = '';
    await downloads.refresh().catch(() => {});
    toast(t('add.added', { count: added }));
    if (watch && first) actions.play(first, {});
  }

  $('#add-form').addEventListener('submit', (event) => {
    event.preventDefault();
    addAll(extractSources(input.value), { watch: event.submitter?.dataset.watch === 'true' });
  });

  $('#add-open-file').addEventListener('click', async () => {
    try {
      addAll(await openTorrentFiles());
    } catch (err) {
      toastError(err);
    }
  });

  // Drag and drop anywhere in the window: .torrent files or magnet text.
  let dragDepth = 0;
  const hasDroppable = (event) => [...(event.dataTransfer?.types ?? [])].some((type) => type === 'Files' || type === 'text/plain' || type === 'text/uri-list');
  document.addEventListener('dragenter', (event) => {
    if (!hasDroppable(event)) return;
    event.preventDefault();
    dragDepth += 1;
    document.body.classList.add('dragging');
  });
  document.addEventListener('dragover', (event) => {
    if (hasDroppable(event)) event.preventDefault(); // allow drop (and never navigate to the file)
  });
  document.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) document.body.classList.remove('dragging');
  });
  document.addEventListener('drop', (event) => {
    event.preventDefault();
    dragDepth = 0;
    document.body.classList.remove('dragging');
    const files = [...(event.dataTransfer?.files ?? [])]
      .filter((f) => /\.torrent$/i.test(f.name))
      .map(pathForFile)
      .filter(Boolean);
    const text = event.dataTransfer?.getData('text/uri-list') || event.dataTransfer?.getData('text/plain') || '';
    const sources = [...files, ...extractSources(text)];
    if (!sources.length) return;
    showTab('add');
    addAll(sources);
  });
  dropZone.addEventListener('click', () => $('#add-open-file').click());

  // Recently added downloads, so it is visible what Filmio recognized.
  let lastList = [];
  let lastSignature = '';
  function renderRecent(list, force = false) {
    lastList = list;
    const recent = [...list].sort((a, b) => b.addedAt - a.addedAt).slice(0, RECENT_COUNT);
    const signature = JSON.stringify(recent.map((d) => [d.infoHash, d.title, d.kind, d.done, d.posterUrl, Math.floor(d.progress * 100), d.files?.length]));
    if (!force && signature === lastSignature) return;
    lastSignature = signature;

    clear(recentEl);
    if (!recent.length) return;
    recentEl.append(
      h('h2', { class: 'section-title' }, icon('download'), t('add.recent')),
      h('div', { class: 'card' }, recent.map((d) => h('div', { class: 'recent-row' },
        d.posterUrl
          ? h('img', { class: 'recent-poster', src: d.posterUrl, alt: '', loading: 'lazy' })
          : h('div', { class: 'recent-poster placeholder' }, icon(d.kind === 'series' ? 'tv' : 'film')),
        h('div', { class: 'recent-info' },
          h('div', { class: 'recent-title', title: d.title }, d.files?.length ? d.title : t('downloads.waitingMetadata')),
          h('div', { class: 'library-badges' },
            h('span', { class: 'badge badge-outline' }, d.kind === 'series' ? t('downloads.kindSeries') : t('downloads.kindMovie')),
            d.quality && h('span', { class: 'badge badge-secondary' }, d.quality),
            d.files?.length > 1 && h('span', { class: 'badge badge-outline' }, icon('layers'), t('downloads.files', { count: d.files.length })),
            h('span', { class: 'summary-meta' }, d.done ? t('downloads.done') : `${formatPercent(d.progress)} · ${formatBytes(d.length)}`),
          ),
        ),
        h('button', {
          class: 'btn btn-default btn-sm',
          disabled: d.playable === false,
          onClick: () => actions.play(d.infoHash, { title: d.title, kind: d.kind, show: d.show }),
        }, icon('play'), t('downloads.watch')),
      ))),
    );
  }

  downloads.subscribe((list) => renderRecent(list));
  onLanguageChange(() => renderRecent(lastList, true));
}
