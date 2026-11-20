import { t, getLanguage } from '../i18n/i18n.js';

/** "2026-11-13" -> "Nov 13, 2026" / "13. nov 2026." in the UI language. */
export function formatDate(isoDate) {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat(getLanguage() === 'sr' ? 'sr-Latn' : 'en', { dateStyle: 'medium' }).format(date);
}

export function formatBytes(bytes) {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i >= 3 ? 2 : i ? 1 : 0)} ${units[i]}`;
}

export const formatSpeed = (bytesPerSecond) => `${formatBytes(bytesPerSecond || 0).replace('—', '0 B')}/s`;

/** Seconds -> "1:02:03" / "4:05". */
export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const hours = Math.floor(seconds / 3600);
  const pad = (n) => String(n).padStart(2, '0');
  return hours ? `${hours}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Milliseconds remaining -> "12 min" / "1 h 5 min". */
export function formatEta(ms) {
  if (ms == null || !Number.isFinite(ms)) return '';
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return t('time.lessThanMinute');
  if (minutes < 60) return t('time.minutes', { m: minutes });
  return t('time.hours', { h: Math.floor(minutes / 60), m: minutes % 60 });
}

export const formatPercent = (fraction) => `${Math.floor((fraction || 0) * 1000) / 10}%`;

export function episodeLabel(season, episode, episodeEnd) {
  const pad = (n) => String(n).padStart(2, '0');
  let label = `S${pad(season)}`;
  if (episode != null) label += `E${pad(episode)}`;
  if (episodeEnd != null) label += `-E${pad(episodeEnd)}`;
  return label;
}
