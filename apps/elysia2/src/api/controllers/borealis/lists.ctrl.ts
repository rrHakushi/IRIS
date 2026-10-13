import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { BorealisListsModel } from '../../models/borealis/lists.model'
import { BorealisListsServ } from '../../../services/borealis/lists.serv'

export const borealisLists = new Elysia({ prefix: '/borealis/lists' })
  .use(session())

  // ===========================================================================
  // 1. Media Lists: Anime
  // ===========================================================================

  // GET /borealis/lists/anime (Get anime list - 40 per page)
  .get(
    '/anime',
    {
      query: BorealisListsModel.listQuery,
      detail: {
        summary: 'Get anime list (40 per page)',
        description: 'Retrieves user anime list with pagination and optional filters.',
        tags: ['Borealis Lists - Anime'],
      },
      response: {
        200: BorealisListsModel.listResponse,
        401: BorealisListsModel.unauthorizedError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getAnimeList(user.id, query)
    }
  )

  // GET /borealis/lists/anime/stats (Get anime list statistics)
  .get(
    '/anime/stats',
    {
      detail: {
        summary: 'Get anime list statistics',
        description: 'Aggregates statistics for the user anime list.',
        tags: ['Borealis Lists - Anime'],
      },
      response: {
        200: BorealisListsModel.statsResponse,
        401: BorealisListsModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getAnimeStats(user.id)
    }
  )

  // GET /borealis/lists/anime/filters (Get available anime list filters)
  .get(
    '/anime/filters',
    {
      detail: {
        summary: 'Get available anime list filters',
        description: 'Returns available filter facets from the user anime list.',
        tags: ['Borealis Lists - Anime'],
      },
      response: {
        200: BorealisListsModel.filtersResponse,
        401: BorealisListsModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getAnimeFilters(user.id)
    }
  )

  // GET /borealis/lists/anime/:animeId (Check / get anime in user list)
  .get(
    '/anime/:animeId',
    {
      params: BorealisListsModel.animeParam,
      detail: {
        summary: 'Check / get anime in user list',
        description: 'Retrieves a single anime list entry for the user if present.',
        tags: ['Borealis Lists - Anime'],
      },
      response: {
        200: BorealisListsModel.singleResponse,
        401: BorealisListsModel.unauthorizedError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { animeId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getAnimeEntry(user.id, animeId)
    }
  )

  // POST /borealis/lists/anime/:animeId (Add or update anime in list)
  .post(
    '/anime/:animeId',
    {
      params: BorealisListsModel.animeParam,
      body: BorealisListsModel.animeBody,
      detail: {
        summary: 'Add or update anime in list',
        description: 'Upserts an anime entry in the user list.',
        tags: ['Borealis Lists - Anime'],
      },
      response: {
        200: BorealisListsModel.upsertResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { animeId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.upsertAnimeEntry(user.id, animeId, body)
    }
  )

  // DELETE /borealis/lists/anime/:animeId (Remove anime from list)
  .delete(
    '/anime/:animeId',
    {
      params: BorealisListsModel.animeParam,
      detail: {
        summary: 'Remove anime from list',
        description: 'Deletes an anime entry from the user list.',
        tags: ['Borealis Lists - Anime'],
      },
      response: {
        200: BorealisListsModel.deleteResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { animeId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.deleteAnimeEntry(user.id, animeId)
    }
  )

  // POST /borealis/lists/anime/:animeId/increment (Increment episode progress)
  .post(
    '/anime/:animeId/increment',
    {
      params: BorealisListsModel.animeParam,
      body: BorealisListsModel.animeIncrementBody,
      detail: {
        summary: 'Increment episode progress',
        description: 'Increments the episodes watched count for an anime entry.',
        tags: ['Borealis Lists - Anime'],
      },
      response: {
        200: BorealisListsModel.upsertResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { animeId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.incrementAnime(user.id, animeId, body)
    }
  )

  // ===========================================================================
  // 2. Media Lists: Manga
  // ===========================================================================

  // GET /borealis/lists/manga (Get manga list - 40 per page)
  .get(
    '/manga',
    {
      query: BorealisListsModel.listQuery,
      detail: {
        summary: 'Get manga list (40 per page)',
        description: 'Retrieves user manga list with pagination and optional filters.',
        tags: ['Borealis Lists - Manga'],
      },
      response: {
        200: BorealisListsModel.listResponse,
        401: BorealisListsModel.unauthorizedError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getMangaList(user.id, query)
    }
  )

  // GET /borealis/lists/manga/stats (Get manga list statistics)
  .get(
    '/manga/stats',
    {
      detail: {
        summary: 'Get manga list statistics',
        description: 'Aggregates statistics for the user manga list.',
        tags: ['Borealis Lists - Manga'],
      },
      response: {
        200: BorealisListsModel.statsResponse,
        401: BorealisListsModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getMangaStats(user.id)
    }
  )

  // GET /borealis/lists/manga/filters (Get available manga list filters)
  .get(
    '/manga/filters',
    {
      detail: {
        summary: 'Get available manga list filters',
        description: 'Returns available filter facets from the user manga list.',
        tags: ['Borealis Lists - Manga'],
      },
      response: {
        200: BorealisListsModel.filtersResponse,
        401: BorealisListsModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getMangaFilters(user.id)
    }
  )

  // GET /borealis/lists/manga/:mangaId (Check / get manga in user list)
  .get(
    '/manga/:mangaId',
    {
      params: BorealisListsModel.mangaParam,
      detail: {
        summary: 'Check / get manga in user list',
        description: 'Retrieves a single manga list entry for the user if present.',
        tags: ['Borealis Lists - Manga'],
      },
      response: {
        200: BorealisListsModel.singleResponse,
        401: BorealisListsModel.unauthorizedError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { mangaId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getMangaEntry(user.id, mangaId)
    }
  )

  // POST /borealis/lists/manga/:mangaId (Add or update manga in list)
  .post(
    '/manga/:mangaId',
    {
      params: BorealisListsModel.mangaParam,
      body: BorealisListsModel.mangaBody,
      detail: {
        summary: 'Add or update manga in list',
        description: 'Upserts a manga entry in the user list.',
        tags: ['Borealis Lists - Manga'],
      },
      response: {
        200: BorealisListsModel.upsertResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { mangaId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.upsertMangaEntry(user.id, mangaId, body)
    }
  )

  // DELETE /borealis/lists/manga/:mangaId (Remove manga from list)
  .delete(
    '/manga/:mangaId',
    {
      params: BorealisListsModel.mangaParam,
      detail: {
        summary: 'Remove manga from list',
        description: 'Deletes a manga entry from the user list.',
        tags: ['Borealis Lists - Manga'],
      },
      response: {
        200: BorealisListsModel.deleteResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { mangaId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.deleteMangaEntry(user.id, mangaId)
    }
  )

  // POST /borealis/lists/manga/:mangaId/increment (Increment chapter/volume progress)
  .post(
    '/manga/:mangaId/increment',
    {
      params: BorealisListsModel.mangaParam,
      body: BorealisListsModel.mangaIncrementBody,
      detail: {
        summary: 'Increment chapter/volume progress',
        description: 'Increments the chapters or volumes read count for a manga entry.',
        tags: ['Borealis Lists - Manga'],
      },
      response: {
        200: BorealisListsModel.upsertResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { mangaId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.incrementManga(user.id, mangaId, body)
    }
  )

  // ===========================================================================
  // 3. Media Lists: Movies
  // ===========================================================================

  // GET /borealis/lists/movies (Get movies list - 40 per page)
  .get(
    '/movies',
    {
      query: BorealisListsModel.listQuery,
      detail: {
        summary: 'Get movies list (40 per page)',
        description: 'Retrieves user movies list with pagination and optional filters.',
        tags: ['Borealis Lists - Movies'],
      },
      response: {
        200: BorealisListsModel.listResponse,
        401: BorealisListsModel.unauthorizedError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getMovieList(user.id, query)
    }
  )

  // GET /borealis/lists/movies/stats (Get movies list statistics)
  .get(
    '/movies/stats',
    {
      detail: {
        summary: 'Get movies list statistics',
        description: 'Aggregates statistics for the user movie list.',
        tags: ['Borealis Lists - Movies'],
      },
      response: {
        200: BorealisListsModel.statsResponse,
        401: BorealisListsModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getMovieStats(user.id)
    }
  )

  // GET /borealis/lists/movies/filters (Get available movies list filters)
  .get(
    '/movies/filters',
    {
      detail: {
        summary: 'Get available movies list filters',
        description: 'Returns available filter facets from the user movie list.',
        tags: ['Borealis Lists - Movies'],
      },
      response: {
        200: BorealisListsModel.filtersResponse,
        401: BorealisListsModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getMovieFilters(user.id)
    }
  )

  // GET /borealis/lists/movies/:movieId (Check / get movie in user list)
  .get(
    '/movies/:movieId',
    {
      params: BorealisListsModel.movieParam,
      detail: {
        summary: 'Check / get movie in user list',
        description: 'Retrieves a single movie list entry for the user if present.',
        tags: ['Borealis Lists - Movies'],
      },
      response: {
        200: BorealisListsModel.singleResponse,
        401: BorealisListsModel.unauthorizedError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { movieId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getMovieEntry(user.id, movieId)
    }
  )

  // POST /borealis/lists/movies/:movieId (Add or update movie in list)
  .post(
    '/movies/:movieId',
    {
      params: BorealisListsModel.movieParam,
      body: BorealisListsModel.movieBody,
      detail: {
        summary: 'Add or update movie in list',
        description: 'Upserts a movie entry in the user list.',
        tags: ['Borealis Lists - Movies'],
      },
      response: {
        200: BorealisListsModel.upsertResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { movieId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.upsertMovieEntry(user.id, movieId, body)
    }
  )

  // DELETE /borealis/lists/movies/:movieId (Remove movie from list)
  .delete(
    '/movies/:movieId',
    {
      params: BorealisListsModel.movieParam,
      detail: {
        summary: 'Remove movie from list',
        description: 'Deletes a movie entry from the user list.',
        tags: ['Borealis Lists - Movies'],
      },
      response: {
        200: BorealisListsModel.deleteResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { movieId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.deleteMovieEntry(user.id, movieId)
    }
  )

  // POST /borealis/lists/movies/:movieId/increment (Increment rewatch progress)
  .post(
    '/movies/:movieId/increment',
    {
      params: BorealisListsModel.movieParam,
      body: BorealisListsModel.movieIncrementBody,
      detail: {
        summary: 'Increment rewatch progress',
        description: 'Increments the rewatched count for a movie entry.',
        tags: ['Borealis Lists - Movies'],
      },
      response: {
        200: BorealisListsModel.upsertResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { movieId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.incrementMovie(user.id, movieId, body)
    }
  )

  // ===========================================================================
  // 4. Media Lists: TV
  // ===========================================================================

  // GET /borealis/lists/tv (Get TV list - 40 per page)
  .get(
    '/tv',
    {
      query: BorealisListsModel.listQuery,
      detail: {
        summary: 'Get TV list (40 per page)',
        description: 'Retrieves user TV series list with pagination and optional filters.',
        tags: ['Borealis Lists - TV'],
      },
      response: {
        200: BorealisListsModel.listResponse,
        401: BorealisListsModel.unauthorizedError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getTvList(user.id, query)
    }
  )

  // GET /borealis/lists/tv/stats (Get TV list statistics)
  .get(
    '/tv/stats',
    {
      detail: {
        summary: 'Get TV list statistics',
        description: 'Aggregates statistics for the user TV list.',
        tags: ['Borealis Lists - TV'],
      },
      response: {
        200: BorealisListsModel.statsResponse,
        401: BorealisListsModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getTvStats(user.id)
    }
  )

  // GET /borealis/lists/tv/filters (Get available TV list filters)
  .get(
    '/tv/filters',
    {
      detail: {
        summary: 'Get available TV list filters',
        description: 'Returns available filter facets from the user TV list.',
        tags: ['Borealis Lists - TV'],
      },
      response: {
        200: BorealisListsModel.filtersResponse,
        401: BorealisListsModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getTvFilters(user.id)
    }
  )

  // GET /borealis/lists/tv/:tvId (Check / get TV series in user list)
  .get(
    '/tv/:tvId',
    {
      params: BorealisListsModel.tvParam,
      detail: {
        summary: 'Check / get TV series in user list',
        description: 'Retrieves a single TV series list entry for the user if present.',
        tags: ['Borealis Lists - TV'],
      },
      response: {
        200: BorealisListsModel.singleResponse,
        401: BorealisListsModel.unauthorizedError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { tvId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getTvEntry(user.id, tvId)
    }
  )

  // POST /borealis/lists/tv/:tvId (Add or update TV series in list)
  .post(
    '/tv/:tvId',
    {
      params: BorealisListsModel.tvParam,
      body: BorealisListsModel.tvBody,
      detail: {
        summary: 'Add or update TV series in list',
        description: 'Upserts a TV series entry in the user list.',
        tags: ['Borealis Lists - TV'],
      },
      response: {
        200: BorealisListsModel.upsertResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { tvId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.upsertTvEntry(user.id, tvId, body)
    }
  )

  // DELETE /borealis/lists/tv/:tvId (Remove TV series from list)
  .delete(
    '/tv/:tvId',
    {
      params: BorealisListsModel.tvParam,
      detail: {
        summary: 'Remove TV series from list',
        description: 'Deletes a TV series entry from the user list.',
        tags: ['Borealis Lists - TV'],
      },
      response: {
        200: BorealisListsModel.deleteResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { tvId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.deleteTvEntry(user.id, tvId)
    }
  )

  // POST /borealis/lists/tv/:tvId/increment (Increment episode progress)
  .post(
    '/tv/:tvId/increment',
    {
      params: BorealisListsModel.tvParam,
      body: BorealisListsModel.tvIncrementBody,
      detail: {
        summary: 'Increment episode progress',
        description: 'Increments the episodes watched count for a TV series entry.',
        tags: ['Borealis Lists - TV'],
      },
      response: {
        200: BorealisListsModel.upsertResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { tvId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.incrementTv(user.id, tvId, body)
    }
  )

  // ===========================================================================
  // 5. Media Lists: Games
  // ===========================================================================

  // GET /borealis/lists/games (Get games list - 40 per page)
  .get(
    '/games',
    {
      query: BorealisListsModel.listQuery,
      detail: {
        summary: 'Get games list (40 per page)',
        description: 'Retrieves user games list with pagination and optional filters.',
        tags: ['Borealis Lists - Games'],
      },
      response: {
        200: BorealisListsModel.listResponse,
        401: BorealisListsModel.unauthorizedError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getGameList(user.id, query)
    }
  )

  // GET /borealis/lists/games/stats (Get games list statistics)
  .get(
    '/games/stats',
    {
      detail: {
        summary: 'Get games list statistics',
        description: 'Aggregates statistics for the user game list.',
        tags: ['Borealis Lists - Games'],
      },
      response: {
        200: BorealisListsModel.statsResponse,
        401: BorealisListsModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getGameStats(user.id)
    }
  )

  // GET /borealis/lists/games/filters (Get available games list filters)
  .get(
    '/games/filters',
    {
      detail: {
        summary: 'Get available games list filters',
        description: 'Returns available filter facets from the user game list.',
        tags: ['Borealis Lists - Games'],
      },
      response: {
        200: BorealisListsModel.filtersResponse,
        401: BorealisListsModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getGameFilters(user.id)
    }
  )

  // GET /borealis/lists/games/:gameId (Check / get game in user list)
  .get(
    '/games/:gameId',
    {
      params: BorealisListsModel.gameParam,
      detail: {
        summary: 'Check / get game in user list',
        description: 'Retrieves a single game list entry for the user if present.',
        tags: ['Borealis Lists - Games'],
      },
      response: {
        200: BorealisListsModel.singleResponse,
        401: BorealisListsModel.unauthorizedError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { gameId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getGameEntry(user.id, gameId)
    }
  )

  // POST /borealis/lists/games/:gameId (Add or update game in list)
  .post(
    '/games/:gameId',
    {
      params: BorealisListsModel.gameParam,
      body: BorealisListsModel.gameBody,
      detail: {
        summary: 'Add or update game in list',
        description: 'Upserts a game entry in the user list.',
        tags: ['Borealis Lists - Games'],
      },
      response: {
        200: BorealisListsModel.upsertResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { gameId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.upsertGameEntry(user.id, gameId, body)
    }
  )

  // DELETE /borealis/lists/games/:gameId (Remove game from list)
  .delete(
    '/games/:gameId',
    {
      params: BorealisListsModel.gameParam,
      detail: {
        summary: 'Remove game from list',
        description: 'Deletes a game entry from the user list.',
        tags: ['Borealis Lists - Games'],
      },
      response: {
        200: BorealisListsModel.deleteResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { gameId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.deleteGameEntry(user.id, gameId)
    }
  )

  // POST /borealis/lists/games/:gameId/increment (Increment playtime / hours progress)
  .post(
    '/games/:gameId/increment',
    {
      params: BorealisListsModel.gameParam,
      body: BorealisListsModel.gameIncrementBody,
      detail: {
        summary: 'Increment playtime / hours progress',
        description: 'Increments the playtime progress for a game entry.',
        tags: ['Borealis Lists - Games'],
      },
      response: {
        200: BorealisListsModel.upsertResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { gameId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.incrementGame(user.id, gameId, body)
    }
  )

  // ===========================================================================
  // 6. Media Lists: Books
  // ===========================================================================

  // GET /borealis/lists/books (Get books list - 40 per page)
  .get(
    '/books',
    {
      query: BorealisListsModel.listQuery,
      detail: {
        summary: 'Get books list (40 per page)',
        description: 'Retrieves user books list with pagination and optional filters.',
        tags: ['Borealis Lists - Books'],
      },
      response: {
        200: BorealisListsModel.listResponse,
        401: BorealisListsModel.unauthorizedError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getBookList(user.id, query)
    }
  )

  // GET /borealis/lists/books/stats (Get books list statistics)
  .get(
    '/books/stats',
    {
      detail: {
        summary: 'Get books list statistics',
        description: 'Aggregates statistics for the user book list.',
        tags: ['Borealis Lists - Books'],
      },
      response: {
        200: BorealisListsModel.statsResponse,
        401: BorealisListsModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getBookStats(user.id)
    }
  )

  // GET /borealis/lists/books/filters (Get available books list filters)
  .get(
    '/books/filters',
    {
      detail: {
        summary: 'Get available books list filters',
        description: 'Returns available filter facets from the user book list.',
        tags: ['Borealis Lists - Books'],
      },
      response: {
        200: BorealisListsModel.filtersResponse,
        401: BorealisListsModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getBookFilters(user.id)
    }
  )

  // GET /borealis/lists/books/:bookId (Check / get book in user list)
  .get(
    '/books/:bookId',
    {
      params: BorealisListsModel.bookParam,
      detail: {
        summary: 'Check / get book in user list',
        description: 'Retrieves a single book list entry for the user if present.',
        tags: ['Borealis Lists - Books'],
      },
      response: {
        200: BorealisListsModel.singleResponse,
        401: BorealisListsModel.unauthorizedError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { bookId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getBookEntry(user.id, bookId)
    }
  )

  // POST /borealis/lists/books/:bookId (Add or update book in list)
  .post(
    '/books/:bookId',
    {
      params: BorealisListsModel.bookParam,
      body: BorealisListsModel.bookBody,
      detail: {
        summary: 'Add or update book in list',
        description: 'Upserts a book entry in the user list.',
        tags: ['Borealis Lists - Books'],
      },
      response: {
        200: BorealisListsModel.upsertResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { bookId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.upsertBookEntry(user.id, bookId, body)
    }
  )

  // DELETE /borealis/lists/books/:bookId (Remove book from list)
  .delete(
    '/books/:bookId',
    {
      params: BorealisListsModel.bookParam,
      detail: {
        summary: 'Remove book from list',
        description: 'Deletes a book entry from the user list.',
        tags: ['Borealis Lists - Books'],
      },
      response: {
        200: BorealisListsModel.deleteResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { bookId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.deleteBookEntry(user.id, bookId)
    }
  )

  // POST /borealis/lists/books/:bookId/increment (Increment page / chapter progress)
  .post(
    '/books/:bookId/increment',
    {
      params: BorealisListsModel.bookParam,
      body: BorealisListsModel.bookIncrementBody,
      detail: {
        summary: 'Increment page / chapter progress',
        description: 'Increments the pages or chapters read count for a book entry.',
        tags: ['Borealis Lists - Books'],
      },
      response: {
        200: BorealisListsModel.upsertResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { bookId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.incrementBook(user.id, bookId, body)
    }
  )

  // ===========================================================================
  // 7. Media Lists: Music
  // ===========================================================================

  // GET /borealis/lists/music (Get music list - 40 per page)
  .get(
    '/music',
    {
      query: BorealisListsModel.listQuery,
      detail: {
        summary: 'Get music list (40 per page)',
        description: 'Retrieves user music list with pagination and optional filters.',
        tags: ['Borealis Lists - Music'],
      },
      response: {
        200: BorealisListsModel.listResponse,
        401: BorealisListsModel.unauthorizedError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getMusicList(user.id, query)
    }
  )

  // GET /borealis/lists/music/stats (Get music list statistics)
  .get(
    '/music/stats',
    {
      detail: {
        summary: 'Get music list statistics',
        description: 'Aggregates statistics for the user music list.',
        tags: ['Borealis Lists - Music'],
      },
      response: {
        200: BorealisListsModel.statsResponse,
        401: BorealisListsModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getMusicStats(user.id)
    }
  )

  // GET /borealis/lists/music/filters (Get available music list filters)
  .get(
    '/music/filters',
    {
      detail: {
        summary: 'Get available music list filters',
        description: 'Returns available filter facets from the user music list.',
        tags: ['Borealis Lists - Music'],
      },
      response: {
        200: BorealisListsModel.filtersResponse,
        401: BorealisListsModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getMusicFilters(user.id)
    }
  )

  // GET /borealis/lists/music/:musicId (Check / get album/track in user list)
  .get(
    '/music/:musicId',
    {
      params: BorealisListsModel.musicParam,
      detail: {
        summary: 'Check / get album/track in user list',
        description: 'Retrieves a single music list entry for the user if present.',
        tags: ['Borealis Lists - Music'],
      },
      response: {
        200: BorealisListsModel.singleResponse,
        401: BorealisListsModel.unauthorizedError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { musicId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getMusicEntry(user.id, musicId)
    }
  )

  // POST /borealis/lists/music/:musicId (Add or update music in list)
  .post(
    '/music/:musicId',
    {
      params: BorealisListsModel.musicParam,
      body: BorealisListsModel.musicBody,
      detail: {
        summary: 'Add or update music in list',
        description: 'Upserts a music entry in the user list.',
        tags: ['Borealis Lists - Music'],
      },
      response: {
        200: BorealisListsModel.upsertResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { musicId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.upsertMusicEntry(user.id, musicId, body)
    }
  )

  // DELETE /borealis/lists/music/:musicId (Remove music from list)
  .delete(
    '/music/:musicId',
    {
      params: BorealisListsModel.musicParam,
      detail: {
        summary: 'Remove music from list',
        description: 'Deletes a music entry from the user list.',
        tags: ['Borealis Lists - Music'],
      },
      response: {
        200: BorealisListsModel.deleteResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { musicId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.deleteMusicEntry(user.id, musicId)
    }
  )

  // POST /borealis/lists/music/:musicId/increment (Increment listen count progress)
  .post(
    '/music/:musicId/increment',
    {
      params: BorealisListsModel.musicParam,
      body: BorealisListsModel.musicIncrementBody,
      detail: {
        summary: 'Increment listen count progress',
        description: 'Increments the listen count for a music entry.',
        tags: ['Borealis Lists - Music'],
      },
      response: {
        200: BorealisListsModel.upsertResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { musicId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.incrementMusic(user.id, musicId, body)
    }
  )
  // ===========================================================================
  // 8. Media Lists: Other (Blank Shells)
  // ===========================================================================

  // GET /borealis/lists/other (Get custom/other list - 40 per page)
  .get(
    '/other',
    {
      query: BorealisListsModel.listQuery,
      detail: {
        summary: 'Get custom/other list (40 per page)',
        description: 'Retrieves custom/other list items with pagination.',
        tags: ['Borealis Lists - Other'],
      },
      response: {
        200: BorealisListsModel.listResponse,
        401: BorealisListsModel.unauthorizedError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getOtherList(user.id, query)
    }
  )

  // GET /borealis/lists/other/stats (Get other list statistics)
  .get(
    '/other/stats',
    {
      detail: {
        summary: 'Get other list statistics',
        description: 'Aggregates statistics for the user other list.',
        tags: ['Borealis Lists - Other'],
      },
      response: {
        200: BorealisListsModel.statsResponse,
        401: BorealisListsModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getOtherStats(user.id)
    }
  )

  // GET /borealis/lists/other/filters (Get available other list filters)
  .get(
    '/other/filters',
    {
      detail: {
        summary: 'Get available other list filters',
        description: 'Returns available filter facets from the user other list.',
        tags: ['Borealis Lists - Other'],
      },
      response: {
        200: BorealisListsModel.filtersResponse,
        401: BorealisListsModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getOtherFilters(user.id)
    }
  )

  // GET /borealis/lists/other/:otherId (Check / get item in other list)
  .get(
    '/other/:otherId',
    {
      params: BorealisListsModel.otherParam,
      detail: {
        summary: 'Check / get item in other list',
        description: 'Retrieves a single entry in other list if present.',
        tags: ['Borealis Lists - Other'],
      },
      response: {
        200: BorealisListsModel.singleResponse,
        401: BorealisListsModel.unauthorizedError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { otherId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getOtherEntry(user.id, otherId)
    }
  )

  // POST /borealis/lists/other/:otherId (Add or update item in other list)
  .post(
    '/other/:otherId',
    {
      params: BorealisListsModel.otherParam,
      body: BorealisListsModel.otherBody,
      detail: {
        summary: 'Add or update item in other list',
        description: 'Upserts an item in the other list.',
        tags: ['Borealis Lists - Other'],
      },
      response: {
        200: BorealisListsModel.upsertResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { otherId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.upsertOtherEntry(user.id, otherId, body)
    }
  )

  // DELETE /borealis/lists/other/:otherId (Remove item from other list)
  .delete(
    '/other/:otherId',
    {
      params: BorealisListsModel.otherParam,
      detail: {
        summary: 'Remove item from other list',
        description: 'Deletes an item from the other list.',
        tags: ['Borealis Lists - Other'],
      },
      response: {
        200: BorealisListsModel.deleteResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { otherId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.deleteOtherEntry(user.id, otherId)
    }
  )

  // POST /borealis/lists/other/:otherId/increment (Increment custom progress)
  .post(
    '/other/:otherId/increment',
    {
      params: BorealisListsModel.otherParam,
      body: BorealisListsModel.otherIncrementBody,
      detail: {
        summary: 'Increment custom progress',
        description: 'Increments the progress value for an item in the other list.',
        tags: ['Borealis Lists - Other'],
      },
      response: {
        200: BorealisListsModel.upsertResponse,
        401: BorealisListsModel.unauthorizedError,
        404: BorealisListsModel.notFoundError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ params: { otherId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.incrementOther(user.id, otherId, body)
    }
  )

  // ===========================================================================
  // 9. Global List Operations (Export, Import, Combined Stats)
  // ===========================================================================

  // GET /borealis/lists/export (Export user lists to JSON)
  .get(
    '/export',
    {
      query: BorealisListsModel.exportQuery,
      detail: {
        summary: 'Export user lists to JSON',
        description: 'Exports all user media lists and custom lists as canonical IRIS JSON backup.',
        tags: ['Borealis Lists - Global'],
      },
      response: {
        200: BorealisListsModel.exportResponse,
        401: BorealisListsModel.unauthorizedError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.exportUserLists(user.id, query)
    }
  )

  // POST /borealis/lists/import (Import lists from JSON / external backups)
  .post(
    '/import',
    {
      body: BorealisListsModel.importBody,
      detail: {
        summary: 'Import lists from JSON / external backups',
        description: 'Imports or synchronizes user media lists from IRIS JSON backup or list items.',
        tags: ['Borealis Lists - Global'],
      },
      response: {
        200: BorealisListsModel.importResponse,
        401: BorealisListsModel.unauthorizedError,
        422: BorealisListsModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.importUserLists(user.id, body)
    }
  )

  // GET /borealis/lists/stats (Get aggregated multi-media list statistics)
  .get(
    '/stats',
    {
      query: BorealisListsModel.globalStatsQuery,
      detail: {
        summary: 'Get aggregated multi-media list statistics',
        description: 'Calculates overarching statistics across all 7 media types with optional period filtering.',
        tags: ['Borealis Lists - Global'],
      },
      response: {
        200: BorealisListsModel.globalStatsResponse,
        401: BorealisListsModel.unauthorizedError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisListsServ.getGlobalListStats(user.id, query)
    }
  )

export default borealisLists
