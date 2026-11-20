import { h, $, $$ } from '../utils/dom.js';
import { icon, setIcon } from '../utils/icons.js';
import { formatBytes, formatSpeed, formatEta, formatPercent } from '../utils/format.js';
import { toast, toastError } from '../utils/toast.js';
import { t, errorText, onLanguageChange } from '../i18n/i18n.js';
import { showDialog } from './components/dialog.js';
import * as downloads from '../services/downloadService.js';
import { openDownloadFolder, showInFolder } from '../services/systemService.js';

const stat = (iconName, text, cls = '') => h('span', { class: cls }, iconName && icon(iconName), text);

const FILTERS = {
  all: () => true,
  active: (d) => !d.done,
  seeding: (d) => d.done && d.seeding,
  completed: (d) => d.done && !d.seeding,
};

/**
 * Downloads tab. Rows are created once per torrent and updated in place every
 * second, so buttons keep working while progress changes.
 * @param {{play:(infoHash:string, context:object) => void}} actions
 */
export function initDownloadsView(actions) {
  const list = $('#downloads-list');
  const empty = $('#downloads-empty');
  const badge = $('#downloads-count');
  const rows = new Map(); // infoHash -> { root, refs }
  let filter = 'all';
  let lastList = [];

  for (const trigger of $$('#downloads-filter .tabs-trigger')) {
    trigger.addEventListener('click', () => {
      filter = trigger.dataset.filter;
      $$('#downloads-filter .tabs-trigger').forEach((c) => c.classList.toggle('active', c === trigger));
      render(lastList);
    });
  }

  $('#open-folder').addEventListener('click', () => openDownloadFolder().catch(toastError));

  /** Runs an action, then refreshes the list immediately instead of waiting for the next tick. */
  const run = (fn) => async () => {
    try {
      await fn();
      await downloads.refresh();
    } catch (err) {
      toastError(err);
    }
  };

  function createRow(infoHash) {
    const refs = {
      title: h('span', { class: 'text' }),
      quality: h('span', { class: 'badge badge-secondary' }),
      kind: h('span', { class: 'badge badge-outline' }),
      pack: h('span', { class: 'badge badge-outline' }, icon('layers')),
      packLabel: h('span'),
      file: h('div', { class: 'file' }),
      bar: h('div'),
      stats: h('div', { class: 'stats' }),
      playLabel: h('span'),
      seedLabel: h('span'),
    };
    refs.pack.append(refs.packLabel);

    const getDownload = () => downloads.getDownload(infoHash);
    refs.play = h('button', {
      class: 'btn btn-default btn-sm',
      onClick: () => {
        const d = getDownload();
        actions.play(infoHash, { title: d?.title, kind: d?.kind, show: d?.show });
      },
    }, icon('play'), refs.playLabel);
    // Pause / resume while downloading.
    refs.toggle = h('button', {
      class: 'btn btn-ghost btn-icon btn-sm',
      onClick: run(() => (getDownload()?.paused ? downloads.resumeDownload(infoHash) : downloads.pauseDownload(infoHash))),
    }, icon('pause'));
    // Stop / start seeding once finished.
    refs.seed = h('button', {
      class: 'btn btn-outline btn-sm',
      onClick: run(() => (getDownload()?.seeding ? downloads.stopSeeding(infoHash) : downloads.startSeeding(infoHash))),
    }, icon('circle-stop'), refs.seedLabel);
    refs.folder = h('button', {
      class: 'btn btn-ghost btn-icon btn-sm',
      onClick: () => showInFolder(getDownload()?.files?.[0]?.path).catch(toastError),
    }, icon('folder-open'));
    refs.remove = h('button', { class: 'btn btn-ghost btn-icon btn-sm', onClick: () => remove(infoHash) }, icon('trash'));

    const root = h('div', { class: 'card download' },
      h('div', {}, h('div', { class: 'title' }, refs.quality, refs.kind, refs.pack, refs.title), refs.file),
      h('div', { class: 'actions' }, refs.play, refs.toggle, refs.seed, refs.folder, refs.remove),
      h('div', { class: 'progress' }, refs.bar),
      refs.stats,
    );
    return { root, refs };
  }

  function updateRow({ root, refs }, d) {
    const files = d.files ?? [];
    root.classList.toggle('done', d.done);
    root.classList.toggle('paused', d.paused || (d.done && !d.seeding));
    refs.title.textContent = d.title;
    refs.title.title = d.title;
    refs.quality.textContent = d.quality || '?';
    refs.quality.hidden = !d.quality;
    refs.kind.textContent = d.kind === 'series' ? t('downloads.kindSeries') : t('downloads.kindMovie');
    refs.pack.hidden = !(d.pack && files.length > 1);
    refs.packLabel.textContent = t('library.fullSeason');
    refs.file.textContent = files.length > 1
      ? t('downloads.files', { count: files.length })
      : files[0]?.name ?? t('downloads.waitingMetadata');
    refs.file.title = files.map((f) => f.name).join('\n');
    refs.bar.style.width = `${(d.progress * 100).toFixed(1)}%`;

    refs.playLabel.textContent = t('downloads.watch');
    refs.play.disabled = d.playable === false;
    refs.play.title = d.playable === false ? t('downloads.unsupported') : '';

    // Pause/resume only while downloading; seeding toggle only when finished.
    refs.toggle.hidden = d.done;
    const toggleIcon = d.paused ? 'play' : 'pause';
    if (refs.toggle.dataset.icon !== toggleIcon) {
      setIcon(refs.toggle, toggleIcon);
      refs.toggle.dataset.icon = toggleIcon;
    }
    refs.toggle.title = d.paused ? t('downloads.resume') : t('downloads.pause');

    refs.seed.hidden = !d.done;
    const seedIcon = d.seeding ? 'circle-stop' : 'upload';
    if (refs.seed.dataset.icon !== seedIcon) {
      setIcon(refs.seed, seedIcon);
      refs.seed.dataset.icon = seedIcon;
    }
    refs.seedLabel.textContent = d.seeding ? t('downloads.stopSeeding') : t('downloads.startSeeding');

    refs.folder.disabled = !files.length;
    refs.folder.title = t('downloads.showInFolder');
    refs.remove.title = t('downloads.remove');

    const parts = [stat(null, t('downloads.progressOf', { percent: formatPercent(d.progress), size: formatBytes(d.length) }))];
    if (d.error) parts.push(stat('alert', errorText(d.error), 'err'));
    else if (d.done && d.seeding) {
      parts.push(
        stat('upload', t('downloads.seeding'), 'ok'),
        stat('arrow-up', formatSpeed(d.uploadSpeed)),
        stat('users', t('downloads.peers', { count: d.numPeers })),
      );
    } else if (d.done) parts.push(stat('circle-check', t('downloads.doneNotSeeding'), 'ok'));
    else if (d.paused) parts.push(stat('pause', t('downloads.paused')));
    else {
      parts.push(
        stat('arrow-down', formatSpeed(d.downloadSpeed)),
        stat('arrow-up', formatSpeed(d.uploadSpeed)),
        stat('users', t('downloads.peers', { count: d.numPeers })),
      );
      if (d.timeRemaining) parts.push(stat(null, t('downloads.eta', { eta: formatEta(d.timeRemaining) })));
    }
    refs.stats.replaceChildren(...parts);
  }

  function render(all) {
    lastList = all;
    const active = all.filter((d) => !d.done && !d.paused).length;
    badge.hidden = active === 0;
    badge.textContent = String(active);

    const visible = all.filter(FILTERS[filter]);
    const seen = new Set();
    visible.forEach((d, index) => {
      seen.add(d.infoHash);
      let row = rows.get(d.infoHash);
      if (!row) {
        row = createRow(d.infoHash);
        rows.set(d.infoHash, row);
      }
      updateRow(row, d);
      if (list.children[index] !== row.root) list.insertBefore(row.root, list.children[index] ?? null);
    });
    for (const [hash, row] of rows) {
      if (!seen.has(hash)) {
        row.root.remove();
        if (!all.some((d) => d.infoHash === hash)) rows.delete(hash);
      }
    }
    empty.hidden = visible.length > 0;
  }

  async function remove(infoHash) {
    const d = downloads.getDownload(infoHash);
    const title = d?.title ?? infoHash;
    const hasFile = !!d?.files?.length;
    const choice = await showDialog({
      title: t('downloads.removeTitle'),
      description: hasFile ? t('downloads.removeDescription', { title }) : t('downloads.removeDescriptionNoFile', { title }),
      actions: [
        { label: t('dialog.cancel'), value: null, variant: 'outline' },
        hasFile && { label: t('downloads.removeDeleteFile'), value: 'delete', variant: 'destructive' },
        { label: t('downloads.removeKeepFile'), value: 'keep', variant: 'default' },
      ].filter(Boolean),
    });
    if (!choice) return;

    const deleteFiles = choice === 'delete';
    try {
      await downloads.removeDownload(infoHash, deleteFiles);
      await downloads.refresh();
      toast(deleteFiles ? t('downloads.removedWithFile') : t('downloads.removed'));
    } catch (err) {
      toastError(err);
    }
  }

  onLanguageChange(() => render(lastList));
  downloads.subscribe(render);
  downloads.refresh().catch(toastError);
}
