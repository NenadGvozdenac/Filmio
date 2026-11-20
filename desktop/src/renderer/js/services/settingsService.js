import { invoke } from '../api/ipcClient.js';

export const getSettings = () => invoke('settings:get');
export const updateSettings = (patch) => invoke('settings:update', patch);
