import { h } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { formatBytes } from '../../utils/format.js';
import { t } from '../../i18n/i18n.js';

function seedersCell(release) {
  if (release.seeders == null) return h('span', { class: 'seeds', title: t('release.webSeedTitle') }, t('release.webSeed'));
  const cls = release.seeders === 0 ? 'none' : release.seeders < 5 ? 'low' : '';
  return h('span', { class: `seeds ${cls}`, title: t('release.seedersTitle') }, icon('arrow-up'), String(release.seeders));
}

function qualityBadges(release, isBest) {
  const q = release.quality;
  return [
    isBest && h('span', { class: 'badge badge-default' }, icon('check'), t('release.best')),
    h('span', { class: `badge ${q.height >= 1080 ? 'badge-secondary' : 'badge-outline'}` }, q.label),
    q.source && h('span', { class: `badge ${q.sourceRank < 0 ? 'badge-destructive' : 'badge-outline'}` }, q.source),
    q.codec && h('span', { class: 'badge badge-outline' }, q.codec),
    q.hdr && h('span', { class: 'badge badge-outline' }, 'HDR'),
    release.isMp4 && h('span', { class: 'badge badge-outline' }, 'MP4'),
  ];
}

/**
 * One release row with quality badges and Watch/Download actions.
 * @param {object} release  release DTO from the search service
 * @param {{isBest?:boolean, onWatch:Function, onDownload:Function}} options
 */
export function releaseRow(release, { isBest = false, onWatch, onDownload }) {
  return h('div', { class: `release ${isBest ? 'best' : ''}` },
    h('div', { class: 'tags' }, qualityBadges(release, isBest)),
    h('div', { class: 'name', title: release.name }, release.name),
    h('div', { class: 'meta' }, formatBytes(release.size), seedersCell(release)),
    h('div', { class: 'meta' }, release.provider),
    h('div', { class: 'actions' },
      h('button', { class: 'btn btn-default btn-sm', onClick: () => onWatch(release) }, icon('play'), t('release.watch')),
      h('button', { class: 'btn btn-outline btn-sm', onClick: () => onDownload(release) }, icon('download'), t('release.download')),
    ),
  );
}

/**
 * Releases sorted best-first (the main process already sorts them); the first one is
 * highlighted as the best quality. Extra releases are collapsed behind a toggle.
 */
export function releaseList(releases, { visible = 4, onWatch, onDownload }) {
  const container = h('div', { class: 'release-list' });
  const rows = releases.map((r, i) => releaseRow(r, { isBest: i === 0 && releases.length > 1, onWatch, onDownload }));
  container.append(...rows.slice(0, visible));

  const hidden = rows.slice(visible);
  if (hidden.length) {
    const toggle = h('button', { class: 'more-toggle' });
    let expanded = false;
    const renderToggle = () => toggle.replaceChildren(
      expanded ? t('release.showLess') : t('release.showMore', { count: hidden.length }),
      icon(expanded ? 'chevron-up' : 'chevron-down'),
    );
    toggle.addEventListener('click', () => {
      expanded = !expanded;
      if (expanded) toggle.before(...hidden);
      else hidden.forEach((row) => row.remove());
      renderToggle();
    });
    renderToggle();
    container.append(toggle);
  }
  return container;
}
