import { invoke, onProgress } from '../api/ipcClient.js';

// Latest snapshot of downloads pushed by the main process + subscribers.
let snapshot = [];
const listeners = new Set();

onProgress((list) => {
  snapshot = list;
  for (const listener of listeners) listener(snapshot);
});

export function subscribe(listener) {
  listeners.add(listener);
  listener(snapshot);
  return () => listeners.delete(listener);
}

export const getDownloads = () => snapshot;

export function getDownload(infoHash) {
  return snapshot.find((d) => d.infoHash === infoHash) ?? null;
}

export async function refresh() {
  snapshot = await invoke('downloads:list');
  for (const listener of listeners) listener(snapshot);
  return snapshot;
}

/** Adds a release (or a raw magnet/URL) to the download folder. Resolves with infoHash. */
export function addDownload(source, meta = {}) {
  return invoke('downloads:add', { source, meta });
}

/**
 * Builds download metadata from a search release and its context
 * ({ title, kind, year, show, season, episode, pack, tmdbId, posterUrl }).
 */
export function metaFromRelease(release, context) {
  const { title, kind, year, show, season, episode, pack, tmdbId, posterUrl } = context;
  return {
    title, kind, year, show, season, episode, pack, tmdbId, posterUrl,
    quality: release.quality?.label ?? '',
    provider: release.provider,
  };
}

export const getPlayableFiles = (infoHash) => invoke('downloads:files', { infoHash });
export const pauseDownload = (infoHash) => invoke('downloads:pause', { infoHash });
export const resumeDownload = (infoHash) => invoke('downloads:resume', { infoHash });
export const stopSeeding = (infoHash) => invoke('downloads:stopSeeding', { infoHash });
export const startSeeding = (infoHash) => invoke('downloads:startSeeding', { infoHash });
const removedListeners = new Set();

/** Called with the infoHash after a download was removed (e.g. so the player can stop it). */
export function onRemoved(listener) {
  removedListeners.add(listener);
  return () => removedListeners.delete(listener);
}

export async function removeDownload(infoHash, deleteFiles) {
  await invoke('downloads:remove', { infoHash, deleteFiles });
  for (const listener of removedListeners) listener(infoHash);
}
