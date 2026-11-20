import { invoke } from '../api/ipcClient.js';

export const chooseDirectory = () => invoke('system:chooseDirectory');
export const openVideoFile = () => invoke('system:openVideo');
/** Opens a file picker for .torrent files; resolves with their paths ([] when cancelled). */
export const openTorrentFiles = () => invoke('system:openTorrentFiles');
/** Local path of a File dropped onto the window. */
export const pathForFile = (file) => window.bridge.getPathForFile(file);
export const openDownloadFolder = () => invoke('system:openDownloadFolder');
export const showInFolder = (filePath) => invoke('system:showInFolder', { filePath });
export const openExternal = (url) => invoke('system:openExternal', { url });
