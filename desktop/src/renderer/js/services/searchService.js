import { invoke } from '../api/ipcClient.js';

/** Searches all sources; resolves with { movies, series, count, hiddenNonMp4, errors }. */
export function searchReleases(query) {
  return invoke('search:run', { query });
}
