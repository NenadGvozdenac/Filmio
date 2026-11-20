/**
 * Maps IPC channels to controller methods.
 * Every response is wrapped as { ok: true, data } or { ok: false, error: { code, message, params } }
 * so the renderer can translate errors (Electron otherwise prefixes the messages).
 */
export function registerIpcRoutes(ipcMain, { search, downloads, settings, system, window }, logger = console) {
  const routes = {
    'search:run': (p) => search.search(p),

    'downloads:add': (p) => downloads.add(p),
    'downloads:list': () => downloads.list(),
    'downloads:files': (p) => downloads.files(p),
    'downloads:pause': (p) => downloads.pause(p),
    'downloads:resume': (p) => downloads.resume(p),
    'downloads:stopSeeding': (p) => downloads.stopSeeding(p),
    'downloads:startSeeding': (p) => downloads.startSeeding(p),
    'downloads:remove': (p) => downloads.remove(p),

    'settings:get': () => settings.get(),
    'settings:update': (p) => settings.update(p),

    'system:chooseDirectory': () => system.chooseDirectory(),
    'system:openVideo': () => system.openVideo(),
    'system:openDownloadFolder': () => system.openDownloadFolder(),
    'system:showInFolder': (p) => system.showInFolder(p),
    'system:openExternal': (p) => system.openExternal(p),

    'window:toggleFullscreen': () => window.toggleFullscreen(),
    'window:exitFullscreen': () => window.exitFullscreen(),
    'window:isFullscreen': () => window.isFullscreen(),
  };

  for (const [channel, handler] of Object.entries(routes)) {
    ipcMain.handle(channel, async (_event, payload) => {
      try {
        return { ok: true, data: await handler(payload ?? {}) };
      } catch (err) {
        logger.error(`[ipc] ${channel}:`, err.message);
        return { ok: false, error: { code: err.code ?? null, message: err.message, params: err.params ?? {} } };
      }
    });
  }

  return Object.keys(routes);
}
