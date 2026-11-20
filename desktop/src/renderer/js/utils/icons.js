// Lucide icons (the icon set used by shadcn/ui), loaded straight from node_modules.
import createElement from '../../../../node_modules/lucide/dist/esm/createElement.mjs';
import ArrowDown from '../../../../node_modules/lucide/dist/esm/icons/arrow-down.mjs';
import ArrowUp from '../../../../node_modules/lucide/dist/esm/icons/arrow-up.mjs';
import Check from '../../../../node_modules/lucide/dist/esm/icons/check.mjs';
import ChevronDown from '../../../../node_modules/lucide/dist/esm/icons/chevron-down.mjs';
import ChevronUp from '../../../../node_modules/lucide/dist/esm/icons/chevron-up.mjs';
import CircleCheck from '../../../../node_modules/lucide/dist/esm/icons/circle-check.mjs';
import Clapperboard from '../../../../node_modules/lucide/dist/esm/icons/clapperboard.mjs';
import Download from '../../../../node_modules/lucide/dist/esm/icons/download.mjs';
import Expand from '../../../../node_modules/lucide/dist/esm/icons/expand.mjs';
import FileVideo from '../../../../node_modules/lucide/dist/esm/icons/file-video-camera.mjs';
import Film from '../../../../node_modules/lucide/dist/esm/icons/film.mjs';
import FolderOpen from '../../../../node_modules/lucide/dist/esm/icons/folder-open.mjs';
import Info from '../../../../node_modules/lucide/dist/esm/icons/info.mjs';
import Link from '../../../../node_modules/lucide/dist/esm/icons/link.mjs';
import LoaderCircle from '../../../../node_modules/lucide/dist/esm/icons/loader-circle.mjs';
import Maximize from '../../../../node_modules/lucide/dist/esm/icons/maximize.mjs';
import Minimize from '../../../../node_modules/lucide/dist/esm/icons/minimize.mjs';
import MonitorPlay from '../../../../node_modules/lucide/dist/esm/icons/monitor-play.mjs';
import Pause from '../../../../node_modules/lucide/dist/esm/icons/pause.mjs';
import Play from '../../../../node_modules/lucide/dist/esm/icons/play.mjs';
import Plus from '../../../../node_modules/lucide/dist/esm/icons/plus.mjs';
import RotateCcw from '../../../../node_modules/lucide/dist/esm/icons/rotate-ccw.mjs';
import RotateCw from '../../../../node_modules/lucide/dist/esm/icons/rotate-cw.mjs';
import Search from '../../../../node_modules/lucide/dist/esm/icons/search.mjs';
import Settings from '../../../../node_modules/lucide/dist/esm/icons/settings.mjs';
import Shrink from '../../../../node_modules/lucide/dist/esm/icons/shrink.mjs';
import Trash from '../../../../node_modules/lucide/dist/esm/icons/trash.mjs';
import TriangleAlert from '../../../../node_modules/lucide/dist/esm/icons/triangle-exclamation-point.mjs';
import Tv from '../../../../node_modules/lucide/dist/esm/icons/tv.mjs';
import Users from '../../../../node_modules/lucide/dist/esm/icons/users.mjs';
import Volume1 from '../../../../node_modules/lucide/dist/esm/icons/volume-1.mjs';
import Volume2 from '../../../../node_modules/lucide/dist/esm/icons/volume-2.mjs';
import VolumeX from '../../../../node_modules/lucide/dist/esm/icons/volume-x.mjs';
import X from '../../../../node_modules/lucide/dist/esm/icons/x.mjs';
import Upload from '../../../../node_modules/lucide/dist/esm/icons/upload.mjs';
import CircleStop from '../../../../node_modules/lucide/dist/esm/icons/circle-stop.mjs';
import Library from '../../../../node_modules/lucide/dist/esm/icons/library.mjs';
import Layers from '../../../../node_modules/lucide/dist/esm/icons/layers.mjs';
import CirclePlay from '../../../../node_modules/lucide/dist/esm/icons/circle-play.mjs';
import SkipBack from '../../../../node_modules/lucide/dist/esm/icons/skip-back.mjs';
import SkipForward from '../../../../node_modules/lucide/dist/esm/icons/skip-forward.mjs';
import Keyboard from '../../../../node_modules/lucide/dist/esm/icons/keyboard.mjs';
import Star from '../../../../node_modules/lucide/dist/esm/icons/star.mjs';
import ExternalLink from '../../../../node_modules/lucide/dist/esm/icons/external-link.mjs';

const ICONS = {
  'arrow-down': ArrowDown,
  'arrow-up': ArrowUp,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  'circle-check': CircleCheck,
  clapperboard: Clapperboard,
  download: Download,
  expand: Expand,
  'file-video': FileVideo,
  film: Film,
  'folder-open': FolderOpen,
  info: Info,
  link: Link,
  loader: LoaderCircle,
  maximize: Maximize,
  minimize: Minimize,
  'monitor-play': MonitorPlay,
  pause: Pause,
  play: Play,
  plus: Plus,
  'rotate-ccw': RotateCcw,
  'rotate-cw': RotateCw,
  search: Search,
  settings: Settings,
  shrink: Shrink,
  trash: Trash,
  alert: TriangleAlert,
  tv: Tv,
  users: Users,
  'volume-1': Volume1,
  'volume-2': Volume2,
  'volume-x': VolumeX,
  x: X,
  upload: Upload,
  'circle-stop': CircleStop,
  library: Library,
  layers: Layers,
  'circle-play': CirclePlay,
  'skip-back': SkipBack,
  'skip-forward': SkipForward,
  keyboard: Keyboard,
  star: Star,
  'external-link': ExternalLink,
};

/**
 * Creates an SVG icon element.
 * @param {keyof typeof ICONS} name
 * @param {{size?:number, class?:string}} options
 */
export function icon(name, { size = 16, class: className = '' } = {}) {
  const node = ICONS[name];
  if (!node) throw new Error(`Unknown icon: ${name}`);
  const svg = createElement(node, { width: size, height: size, 'aria-hidden': 'true' });
  svg.classList.add('icon');
  if (className) svg.classList.add(...className.split(' '));
  return svg;
}

/** Replaces every <i data-icon="name" data-size="16"> placeholder in static markup. */
export function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll('i[data-icon]')) {
    const svg = icon(el.dataset.icon, { size: Number(el.dataset.size) || 16, class: el.className });
    if (el.id) svg.id = el.id;
    el.replaceWith(svg);
  }
}

/** Swaps the icon inside a button (or other container) without touching its text. */
export function setIcon(container, name, options) {
  const next = icon(name, options);
  const current = container.querySelector(':scope > svg.icon');
  if (current) current.replaceWith(next);
  else container.prepend(next);
}
