import { invoke } from '../api/ipcClient.js';

export const toggleAppFullscreen = () => invoke('window:toggleFullscreen');
export const exitAppFullscreen = () => invoke('window:exitFullscreen');
export const isAppFullscreen = () => invoke('window:isFullscreen');
export const onAppFullscreenChange = (callback) => window.bridge.onFullscreenChange(callback);