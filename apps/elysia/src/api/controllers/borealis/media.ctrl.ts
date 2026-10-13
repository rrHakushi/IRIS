import { Elysia } from 'elysia'
import { BorealisMediaModel } from '../../models/borealis/media.model'
import { BorealisMediaServ } from '../../../services/borealis/media.serv'

export const borealisMedia = new Elysia({ prefix: '/borealis/media' })
  // ===========================================================================
  // 1. Media Metadata: Anime
  // ===========================================================================

  // GET /borealis/media/anime (Get anime catalog entries, 40 per page)
  .get(
    '/anime',
    {
      query: BorealisMediaModel.mediaCatalogQuery,
      detail: {
        summary: 'Get anime catalog entries (40 per page)',
        description: 'Browse paginated anime catalog with multi-factor filters and sorting.',
        tags: ['Borealis Media - Anime'],
      },
      response: {
        200: BorealisMediaModel.mediaCatalogResponse,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ query }) => {
      return await BorealisMediaServ.getAnimeCatalog(query)
    }
  )

  // GET /borealis/media/anime/filters (Get available catalog filters for anime)
  .get(
    '/anime/filters',
    {
      detail: {
        summary: 'Get available catalog filters for anime',
        description: 'Returns available filter facets and item counts across statuses, formats, genres, and years.',
        tags: ['Borealis Media - Anime'],
      },
      response: {
        200: BorealisMediaModel.mediaFiltersResponse,
      },
    },
    async () => {
      return await BorealisMediaServ.getAnimeFilters()
    }
  )

  // GET /borealis/media/anime/:id/similar (Get similar anime recommendations)
  .get(
    '/anime/:id/similar',
    {
      params: BorealisMediaModel.mediaDetailParam,
      query: BorealisMediaModel.similarQuery,
      detail: {
        summary: 'Get similar anime recommendations',
        description: 'Calculates high-accuracy similarity recommendations using genre/tag Jaccard overlap, studio alignment, and franchise context.',
        tags: ['Borealis Media - Anime'],
      },
      response: {
        200: BorealisMediaModel.similarResponse,
        404: BorealisMediaModel.notFoundError,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ params: { id }, query }) => {
      const limit = query?.limit ? Number(query.limit) : 10
      return await BorealisMediaServ.getSimilarAnime(id, limit)
    }
  )

  // POST /borealis/media/anime/:id/refresh (Refresh anime metadata from external providers)
  .post(
    '/anime/:id/refresh',
    {
      params: BorealisMediaModel.mediaDetailParam,
      detail: {
        summary: 'Refresh anime metadata from external providers',
        description: 'Queues a background metadata refresh to enrich anime details from external providers.',
        tags: ['Borealis Media - Anime'],
      },
      response: {
        200: BorealisMediaModel.mediaRefreshResponse,
        404: BorealisMediaModel.notFoundError,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ params: { id } }) => {
      return await BorealisMediaServ.refreshAnime(id)
    }
  )

  // GET /borealis/media/anime/:id (Get anime metadata by ID)
  .get(
    '/anime/:id',
    {
      params: BorealisMediaModel.mediaDetailParam,
      detail: {
        summary: 'Get anime metadata by ID',
        description: 'Fetches complete anime metadata including characters, staff, studios, episodes, and media relations.',
        tags: ['Borealis Media - Anime'],
      },
      response: {
        200: BorealisMediaModel.mediaDetailResponse,
        404: BorealisMediaModel.notFoundError,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ params: { id } }) => {
      return await BorealisMediaServ.getAnimeById(id)
    }
  )

  // ===========================================================================
  // 2. Media Metadata: Manga
  // ===========================================================================

  // GET /borealis/media/manga (Get manga catalog entries, 40 per page)
  .get(
    '/manga',
    {
      query: BorealisMediaModel.mediaCatalogQuery,
      detail: {
        summary: 'Get manga catalog entries (40 per page)',
        description: 'Browse paginated manga catalog with multi-factor filters and sorting.',
        tags: ['Borealis Media - Manga'],
      },
      response: {
        200: BorealisMediaModel.mediaCatalogResponse,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ query }) => {
      return await BorealisMediaServ.getMangaCatalog(query)
    }
  )

  // GET /borealis/media/manga/filters (Get available catalog filters for manga)
  .get(
    '/manga/filters',
    {
      detail: {
        summary: 'Get available catalog filters for manga',
        description: 'Returns available filter facets and item counts across statuses, formats, genres, and years.',
        tags: ['Borealis Media - Manga'],
      },
      response: {
        200: BorealisMediaModel.mediaFiltersResponse,
      },
    },
    async () => {
      return await BorealisMediaServ.getMangaFilters()
    }
  )

  // GET /borealis/media/manga/:id/similar (Get similar manga recommendations)
  .get(
    '/manga/:id/similar',
    {
      params: BorealisMediaModel.mediaDetailParam,
      query: BorealisMediaModel.similarQuery,
      detail: {
        summary: 'Get similar manga recommendations',
        description: 'Calculates high-accuracy similarity recommendations using genre/tag Jaccard overlap, creator matching, and demographic alignment.',
        tags: ['Borealis Media - Manga'],
      },
      response: {
        200: BorealisMediaModel.similarResponse,
        404: BorealisMediaModel.notFoundError,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ params: { id }, query }) => {
      const limit = query?.limit ? Number(query.limit) : 10
      return await BorealisMediaServ.getSimilarManga(id, limit)
    }
  )

  // POST /borealis/media/manga/:id/refresh (Refresh manga metadata from external providers)
  .post(
    '/manga/:id/refresh',
    {
      params: BorealisMediaModel.mediaDetailParam,
      detail: {
        summary: 'Refresh manga metadata from external providers',
        description: 'Queues a background metadata refresh to enrich manga details from external providers.',
        tags: ['Borealis Media - Manga'],
      },
      response: {
        200: BorealisMediaModel.mediaRefreshResponse,
        404: BorealisMediaModel.notFoundError,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ params: { id } }) => {
      return await BorealisMediaServ.refreshManga(id)
    }
  )

  // GET /borealis/media/manga/:id (Get manga metadata by ID)
  .get(
    '/manga/:id',
    {
      params: BorealisMediaModel.mediaDetailParam,
      detail: {
        summary: 'Get manga metadata by ID',
        description: 'Fetches complete manga metadata including characters, staff, author/illustrator, and media relations.',
        tags: ['Borealis Media - Manga'],
      },
      response: {
        200: BorealisMediaModel.mediaDetailResponse,
        404: BorealisMediaModel.notFoundError,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ params: { id } }) => {
      return await BorealisMediaServ.getMangaById(id)
    }
  )

  // ===========================================================================
  // 3. Media Metadata: Movies
  // ===========================================================================

  // GET /borealis/media/movies (Get movie catalog entries, 40 per page)
  .get(
    '/movies',
    {
      query: BorealisMediaModel.mediaCatalogQuery,
      detail: {
        summary: 'Get movie catalog entries (40 per page)',
        description: 'Browse paginated movie catalog with multi-factor filters and sorting.',
        tags: ['Borealis Media - Movies'],
      },
      response: {
        200: BorealisMediaModel.mediaCatalogResponse,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ query }) => {
      return await BorealisMediaServ.getMovieCatalog(query)
    }
  )

  // GET /borealis/media/movies/filters (Get available catalog filters for movies)
  .get(
    '/movies/filters',
    {
      detail: {
        summary: 'Get available catalog filters for movies',
        description: 'Returns available filter facets and item counts across statuses, genres, and years.',
        tags: ['Borealis Media - Movies'],
      },
      response: {
        200: BorealisMediaModel.mediaFiltersResponse,
      },
    },
    async () => {
      return await BorealisMediaServ.getMovieFilters()
    }
  )

  // GET /borealis/media/movies/:id/similar (Get similar movies recommendations)
  .get(
    '/movies/:id/similar',
    {
      params: BorealisMediaModel.mediaDetailParam,
      query: BorealisMediaModel.similarQuery,
      detail: {
        summary: 'Get similar movies recommendations',
        description: 'Calculates high-accuracy similarity recommendations using genre/tag Jaccard overlap, director/studio matching, and franchise context.',
        tags: ['Borealis Media - Movies'],
      },
      response: {
        200: BorealisMediaModel.similarResponse,
        404: BorealisMediaModel.notFoundError,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ params: { id }, query }) => {
      const limit = query?.limit ? Number(query.limit) : 10
      return await BorealisMediaServ.getSimilarMovies(id, limit)
    }
  )

  // POST /borealis/media/movies/:id/refresh (Refresh movie metadata from external providers)
  .post(
    '/movies/:id/refresh',
    {
      params: BorealisMediaModel.mediaDetailParam,
      detail: {
        summary: 'Refresh movie metadata from external providers',
        description: 'Queues a background metadata refresh to enrich movie details from external providers.',
        tags: ['Borealis Media - Movies'],
      },
      response: {
        200: BorealisMediaModel.mediaRefreshResponse,
        404: BorealisMediaModel.notFoundError,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ params: { id } }) => {
      return await BorealisMediaServ.refreshMovie(id)
    }
  )

  // GET /borealis/media/movies/:id (Get movie metadata by ID)
  .get(
    '/movies/:id',
    {
      params: BorealisMediaModel.mediaDetailParam,
      detail: {
        summary: 'Get movie metadata by ID',
        description: 'Fetches complete movie metadata including cast, crew, studios, runtime, and media relations.',
        tags: ['Borealis Media - Movies'],
      },
      response: {
        200: BorealisMediaModel.mediaDetailResponse,
        404: BorealisMediaModel.notFoundError,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ params: { id } }) => {
      return await BorealisMediaServ.getMovieById(id)
    }
  )

  // ===========================================================================
  // 4. Media Metadata: TV
  // ===========================================================================

  // GET /borealis/media/tv (Get TV catalog entries, 40 per page)
  .get(
    '/tv',
    {
      query: BorealisMediaModel.mediaCatalogQuery,
      detail: {
        summary: 'Get TV catalog entries (40 per page)',
        description: 'Browse paginated TV catalog with multi-factor filters and sorting.',
        tags: ['Borealis Media - TV'],
      },
      response: {
        200: BorealisMediaModel.mediaCatalogResponse,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ query }) => {
      return await BorealisMediaServ.getTvCatalog(query)
    }
  )

  // GET /borealis/media/tv/filters (Get available catalog filters for TV)
  .get(
    '/tv/filters',
    {
      detail: {
        summary: 'Get available catalog filters for TV',
        description: 'Returns available filter facets and item counts across statuses, formats/showTypes, genres, and years.',
        tags: ['Borealis Media - TV'],
      },
      response: {
        200: BorealisMediaModel.mediaFiltersResponse,
      },
    },
    async () => {
      return await BorealisMediaServ.getTvFilters()
    }
  )

  // GET /borealis/media/tv/:id/similar (Get similar TV recommendations)
  .get(
    '/tv/:id/similar',
    {
      params: BorealisMediaModel.mediaDetailParam,
      query: BorealisMediaModel.similarQuery,
      detail: {
        summary: 'Get similar TV recommendations',
        description: 'Calculates high-accuracy similarity recommendations using genre/tag Jaccard overlap, studio/network alignment, and creator matching.',
        tags: ['Borealis Media - TV'],
      },
      response: {
        200: BorealisMediaModel.similarResponse,
        404: BorealisMediaModel.notFoundError,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ params: { id }, query }) => {
      const limit = query?.limit ? Number(query.limit) : 10
      return await BorealisMediaServ.getSimilarTv(id, limit)
    }
  )

  // POST /borealis/media/tv/:id/refresh (Refresh TV metadata from external providers)
  .post(
    '/tv/:id/refresh',
    {
      params: BorealisMediaModel.mediaDetailParam,
      detail: {
        summary: 'Refresh TV metadata from external providers',
        description: 'Queues a background metadata refresh to enrich TV details from external providers.',
        tags: ['Borealis Media - TV'],
      },
      response: {
        200: BorealisMediaModel.mediaRefreshResponse,
        404: BorealisMediaModel.notFoundError,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ params: { id } }) => {
      return await BorealisMediaServ.refreshTv(id)
    }
  )

  // GET /borealis/media/tv/:id (Get TV metadata by ID)
  .get(
    '/tv/:id',
    {
      params: BorealisMediaModel.mediaDetailParam,
      detail: {
        summary: 'Get TV metadata by ID',
        description: 'Fetches complete TV metadata including seasons, episodes, cast, crew, studios, and media relations.',
        tags: ['Borealis Media - TV'],
      },
      response: {
        200: BorealisMediaModel.mediaDetailResponse,
        404: BorealisMediaModel.notFoundError,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ params: { id } }) => {
      return await BorealisMediaServ.getTvById(id)
    }
  )

  // ===========================================================================
  // 5. Media Metadata: Books
  // ===========================================================================

  // GET /borealis/media/books (Get books catalog entries, 40 per page)
  .get(
    '/books',
    {
      query: BorealisMediaModel.mediaCatalogQuery,
      detail: {
        summary: 'Get books catalog entries (40 per page)',
        description: 'Browse paginated books catalog with multi-factor filters and sorting.',
        tags: ['Borealis Media - Books'],
      },
      response: {
        200: BorealisMediaModel.mediaCatalogResponse,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ query }) => {
      return await BorealisMediaServ.getBookCatalog(query)
    }
  )

  // GET /borealis/media/books/filters (Get available catalog filters for books)
  .get(
    '/books/filters',
    {
      detail: {
        summary: 'Get available catalog filters for books',
        description: 'Returns available filter facets and item counts across statuses, formats, genres, and years.',
        tags: ['Borealis Media - Books'],
      },
      response: {
        200: BorealisMediaModel.mediaFiltersResponse,
      },
    },
    async () => {
      return await BorealisMediaServ.getBookFilters()
    }
  )

  // GET /borealis/media/books/:id/similar (Get similar books recommendations)
  .get(
    '/books/:id/similar',
    {
      params: BorealisMediaModel.mediaDetailParam,
      query: BorealisMediaModel.similarQuery,
      detail: {
        summary: 'Get similar books recommendations',
        description: 'Calculates high-accuracy similarity recommendations using genre/tag Jaccard overlap, author matching, and series connections.',
        tags: ['Borealis Media - Books'],
      },
      response: {
        200: BorealisMediaModel.similarResponse,
        404: BorealisMediaModel.notFoundError,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ params: { id }, query }) => {
      const limit = query?.limit ? Number(query.limit) : 10
      return await BorealisMediaServ.getSimilarBooks(id, limit)
    }
  )

  // POST /borealis/media/books/:id/refresh (Refresh book metadata from external providers)
  .post(
    '/books/:id/refresh',
    {
      params: BorealisMediaModel.mediaDetailParam,
      detail: {
        summary: 'Refresh book metadata from external providers',
        description: 'Queues a background metadata refresh to enrich book details from external providers.',
        tags: ['Borealis Media - Books'],
      },
      response: {
        200: BorealisMediaModel.mediaRefreshResponse,
        404: BorealisMediaModel.notFoundError,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ params: { id } }) => {
      return await BorealisMediaServ.refreshBook(id)
    }
  )

  // GET /borealis/media/books/:id (Get book metadata by ID)
  .get(
    '/books/:id',
    {
      params: BorealisMediaModel.mediaDetailParam,
      detail: {
        summary: 'Get book metadata by ID',
        description: 'Fetches complete book metadata including authors, publishers, page count, and media relations.',
        tags: ['Borealis Media - Books'],
      },
      response: {
        200: BorealisMediaModel.mediaDetailResponse,
        404: BorealisMediaModel.notFoundError,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ params: { id } }) => {
      return await BorealisMediaServ.getBookById(id)
    }
  )

  // ===========================================================================
  // 6. Media Metadata: Games
  // ===========================================================================

  // GET /borealis/media/games (Get games catalog entries, 40 per page)
  .get(
    '/games',
    {
      query: BorealisMediaModel.mediaCatalogQuery,
      detail: {
        summary: 'Get games catalog entries (40 per page)',
        description: 'Browse paginated games catalog with multi-factor filters and sorting.',
        tags: ['Borealis Media - Games'],
      },
      response: {
        200: BorealisMediaModel.mediaCatalogResponse,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ query }) => {
      return await BorealisMediaServ.getGameCatalog(query)
    }
  )

  // GET /borealis/media/games/filters (Get available catalog filters for games)
  .get(
    '/games/filters',
    {
      detail: {
        summary: 'Get available catalog filters for games',
        description: 'Returns available filter facets and item counts across statuses, formats, genres, and years.',
        tags: ['Borealis Media - Games'],
      },
      response: {
        200: BorealisMediaModel.mediaFiltersResponse,
      },
    },
    async () => {
      return await BorealisMediaServ.getGameFilters()
    }
  )

  // GET /borealis/media/games/:id/similar (Get similar games recommendations)
  .get(
    '/games/:id/similar',
    {
      params: BorealisMediaModel.mediaDetailParam,
      query: BorealisMediaModel.similarQuery,
      detail: {
        summary: 'Get similar games recommendations',
        description: 'Calculates high-accuracy similarity recommendations using genre/tag Jaccard overlap, developer/publisher alignment, and gameplay mechanics.',
        tags: ['Borealis Media - Games'],
      },
      response: {
        200: BorealisMediaModel.similarResponse,
        404: BorealisMediaModel.notFoundError,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ params: { id }, query }) => {
      const limit = query?.limit ? Number(query.limit) : 10
      return await BorealisMediaServ.getSimilarGames(id, limit)
    }
  )

  // POST /borealis/media/games/:id/refresh (Refresh game metadata from external providers)
  .post(
    '/games/:id/refresh',
    {
      params: BorealisMediaModel.mediaDetailParam,
      detail: {
        summary: 'Refresh game metadata from external providers',
        description: 'Queues a background metadata refresh to enrich game details from external providers.',
        tags: ['Borealis Media - Games'],
      },
      response: {
        200: BorealisMediaModel.mediaRefreshResponse,
        404: BorealisMediaModel.notFoundError,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ params: { id } }) => {
      return await BorealisMediaServ.refreshGame(id)
    }
  )

  // GET /borealis/media/games/:id (Get game metadata by ID)
  .get(
    '/games/:id',
    {
      params: BorealisMediaModel.mediaDetailParam,
      detail: {
        summary: 'Get game metadata by ID',
        description: 'Fetches complete game metadata including platforms, developers, publishers, requirements, and media relations.',
        tags: ['Borealis Media - Games'],
      },
      response: {
        200: BorealisMediaModel.mediaDetailResponse,
        404: BorealisMediaModel.notFoundError,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ params: { id } }) => {
      return await BorealisMediaServ.getGameById(id)
    }
  )

  // ===========================================================================
  // 7. Media Metadata: Music
  // ===========================================================================

  // GET /borealis/media/music (Get music catalog entries, 40 per page)
  .get(
    '/music',
    {
      query: BorealisMediaModel.mediaCatalogQuery,
      detail: {
        summary: 'Get music catalog entries (40 per page)',
        description: 'Browse paginated music catalog with multi-factor filters and sorting.',
        tags: ['Borealis Media - Music'],
      },
      response: {
        200: BorealisMediaModel.mediaCatalogResponse,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ query }) => {
      return await BorealisMediaServ.getMusicCatalog(query)
    }
  )

  // GET /borealis/media/music/filters (Get available catalog filters for music)
  .get(
    '/music/filters',
    {
      detail: {
        summary: 'Get available catalog filters for music',
        description: 'Returns available filter facets and item counts across statuses, types (TRACK/ALBUM), genres, and years.',
        tags: ['Borealis Media - Music'],
      },
      response: {
        200: BorealisMediaModel.mediaFiltersResponse,
      },
    },
    async () => {
      return await BorealisMediaServ.getMusicFilters()
    }
  )

  // GET /borealis/media/music/:id/similar (Get similar music recommendations)
  .get(
    '/music/:id/similar',
    {
      params: BorealisMediaModel.mediaDetailParam,
      query: BorealisMediaModel.similarQuery,
      detail: {
        summary: 'Get similar music recommendations',
        description: 'Calculates high-accuracy similarity recommendations using genre/mood Jaccard overlap, artist alignment, and release era.',
        tags: ['Borealis Media - Music'],
      },
      response: {
        200: BorealisMediaModel.similarResponse,
        404: BorealisMediaModel.notFoundError,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ params: { id }, query }) => {
      const limit = query?.limit ? Number(query.limit) : 10
      return await BorealisMediaServ.getSimilarMusic(id, limit)
    }
  )

  // POST /borealis/media/music/:id/refresh (Refresh music metadata from external providers)
  .post(
    '/music/:id/refresh',
    {
      params: BorealisMediaModel.mediaDetailParam,
      detail: {
        summary: 'Refresh music metadata from external providers',
        description: 'Queues a background metadata refresh to enrich music details from external providers.',
        tags: ['Borealis Media - Music'],
      },
      response: {
        200: BorealisMediaModel.mediaRefreshResponse,
        404: BorealisMediaModel.notFoundError,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ params: { id } }) => {
      return await BorealisMediaServ.refreshMusic(id)
    }
  )

  // GET /borealis/media/music/:id (Get music metadata by ID)
  .get(
    '/music/:id',
    {
      params: BorealisMediaModel.mediaDetailParam,
      detail: {
        summary: 'Get music metadata by ID',
        description: 'Fetches complete music metadata including artist, album, tracks, duration, and media relations.',
        tags: ['Borealis Media - Music'],
      },
      response: {
        200: BorealisMediaModel.mediaDetailResponse,
        404: BorealisMediaModel.notFoundError,
        422: BorealisMediaModel.validationError,
      },
    },
    async ({ params: { id } }) => {
      return await BorealisMediaServ.getMusicById(id)
    }
  )

export default borealisMedia
