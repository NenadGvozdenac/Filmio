// Low-level client for the preload bridge. Unwraps { ok, data, error } responses.

export class IpcError extends Error {
  constructor({ code = null, message = '', params = {} } = {}) {
    super(message);
    this.code = code;
    this.params = params;
  }
}

export async function invoke(channel, payload) {
  const response = await window.bridge.invoke(channel, payload);
  if (!response?.ok) throw new IpcError(response?.error);
  return response.data;
}

export function onProgress(callback) {
  return window.bridge.onProgress(callback);
}
