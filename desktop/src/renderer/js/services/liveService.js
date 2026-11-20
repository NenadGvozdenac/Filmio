import { invoke } from '../api/ipcClient.js';

/** Built-in channels plus channels of all enabled M3U playlists: { channels, errors }. */
export const getChannels = ({ refresh = false } = {}) => invoke('live:channels', { refresh });

/** Opens a channel that is watched on the broadcaster's own page (window or browser). */
export const openChannelPage = (id) => invoke('live:open', { id });
