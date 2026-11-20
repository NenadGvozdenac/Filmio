import { shell } from 'electron';
import { AppError, ErrorCode } from '../utils/AppError.js';
import { openWebWindow } from '../window/webWindow.js';

export class LiveTvController {
  /**
   * @param {import('../services/LiveTvService.js').LiveTvService} liveTvService
   * @param {{appRoot:string, getWindow:() => import('electron').BrowserWindow|null}} options
   */
  constructor(liveTvService, { appRoot, getWindow }) {
    this.liveTvService = liveTvService;
    this.appRoot = appRoot;
    this.getWindow = getWindow;
  }

  channels({ refresh } = {}) {
    return this.liveTvService.channels({ refresh: !!refresh });
  }

  /** Opens a 'web' channel in a Filmio window and an 'external' channel in the browser. */
  async open({ id } = {}) {
    if (!/^[a-f0-9]{16}$/.test(String(id ?? ''))) throw new AppError(ErrorCode.INVALID_CHANNEL, 'Invalid channel id');
    const page = this.liveTvService.page(id);
    if (page.kind === 'web') openWebWindow(this.appRoot, page.url, this.getWindow());
    else await shell.openExternal(page.url);
  }
}
