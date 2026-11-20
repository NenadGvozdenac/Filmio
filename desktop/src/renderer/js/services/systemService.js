import { invoke } from '../api/ipcClient.js';

export const chooseDirectory = () => invoke('system:chooseDirectory');
export const openVideoFile = () => invoke('system:openVideo');
export const openDownloadFolder = () => invoke('system:openDownloadFolder');
export const showInFolder = (filePath) => invoke('system:showInFolder', { filePath });
export const openExternal = (url) => invoke('system:openExternal', { url });
