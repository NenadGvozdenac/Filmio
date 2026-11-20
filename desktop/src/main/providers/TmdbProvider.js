// The Movie Database (TMDB): finds the official title, poster and overview for content
// recognized from torrent names (used by MetadataService for the library).
import { AppError, ErrorCode } from '../utils/AppError.js';

const API = 'https://api.themoviedb.org/3';
const IMAGES = 'https://image.tmdb.org/t/p';

export class TmdbProvider {
  /** @param {{apiKey:string}} options v3 API key or v4 read access token */
  constructor({ apiKey, fetchImpl = fetch }) {
    this.name = 'TMDB';
    this.apiKey = apiKey.trim();
    this.fetch = fetchImpl;
  }

  async #get(pathname, params = {}) {
    const url = new URL(`${API}${pathname}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const headers = { Accept: 'application/json' };
    // v4 read access tokens are JWTs; v3 keys go in the query string.
    if (this.apiKey.startsWith('eyJ')) headers.Authorization = `Bearer ${this.apiKey}`;
    else url.searchParams.set('api_key', this.apiKey);

    const res = await this.fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    if (res.status === 401) throw new AppError(ErrorCode.TMDB_INVALID_KEY, 'Invalid TMDB API key');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  /**
   * Movies and TV shows matching the query, in TMDB relevance order.
   * Titles are requested in English because torrent names use English titles.
   * @returns {Promise<TmdbTitle[]>}
   *
   * @typedef {object} TmdbTitle
   * @property {number} tmdbId
   * @property {'movie'|'series'} kind
   * @property {string} title
   * @property {string} originalTitle
   * @property {string} year
   * @property {string} overview
   * @property {string|null} posterUrl
   * @property {number} rating        0..10
   */
  async searchTitles(query) {
    const data = await this.#get('/search/multi', { query, include_adult: 'false', language: 'en-US', page: '1' });
    return (data.results ?? [])
      .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
      .map((r) => {
        const isMovie = r.media_type === 'movie';
        const date = (isMovie ? r.release_date : r.first_air_date) ?? '';
        return {
          tmdbId: r.id,
          kind: isMovie ? 'movie' : 'series',
          title: (isMovie ? r.title : r.name) ?? '',
          originalTitle: (isMovie ? r.original_title : r.original_name) ?? '',
          year: date.slice(0, 4),
          overview: r.overview ?? '',
          posterUrl: r.poster_path ? `${IMAGES}/w342${r.poster_path}` : null,
          rating: Number(r.vote_average) || 0,
          popularity: Number(r.popularity) || 0,
        };
      })
      .filter((t) => t.title);
  }
}
