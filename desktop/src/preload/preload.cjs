// Exposes a minimal, safe IPC bridge to the renderer (window.bridge).
const { contextBridge, ipcRenderer, webUtils } = require('electron');

function subscribe(channel, callback) {
  const handler = (_event, data) => callback(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('bridge', {
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
  onProgress: (callback) => subscribe('downloads:progress', callback),
  onFullscreenChange: (callback) => subscribe('window:fullscreen', callback),
  /** Local path of a file dropped onto the window (drag and drop of .torrent files). */
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return '';
    }
  },
});
