import { invoke } from '../api/ipcClient.js';

/** Channels of all enabled M3U playlists: { channels, errors, playlistCount }. */
export const getChannels = ({ refresh = false } = {}) => invoke('live:channels', { refresh });

/** Toggles a favorite channel; resolves with the new state (true = favorite). */
export const toggleFavorite = (id) => invoke('live:toggleFavorite', { id });
