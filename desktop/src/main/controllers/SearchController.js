import { AppError, ErrorCode } from '../utils/AppError.js';

export class SearchController {
  /** @param {import('../services/SearchService.js').SearchService} searchService */
  constructor(searchService) {
    this.searchService = searchService;
  }

  search({ query } = {}) {
    const q = String(query ?? '').trim().slice(0, 200);
    if (!q) throw new AppError(ErrorCode.EMPTY_QUERY, 'Search query is empty');
    return this.searchService.search(q);
  }
}
