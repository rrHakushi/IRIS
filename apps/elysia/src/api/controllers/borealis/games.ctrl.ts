import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { BorealisGamesModel } from '../../models/borealis/games.model'
import { BorealisGamesServ } from '../../../services/borealis/games.serv'

// Split into several small Elysia instances: one long chain makes TypeScript
// accumulate every route type and fail with TS2589 (excessively deep instantiation).
const coreRoutes = new Elysia()
  .use(session())

  .get(
    '',
    {
      query: BorealisGamesModel.catalogQuery,
      response: {
        200: BorealisGamesModel.catalogResponse,
        422: BorealisGamesModel.validationError,
      },
      detail: {
        summary: 'Get game catalog',
        description: 'Retrieves paginated game catalog with cursor or page, supporting comprehensive multi-field filtering.',
        tags: ['Borealis - Games'],
      },
    },
    async ({ query }) => {
      return await BorealisGamesServ.getCatalog(query)
    }
  )

  .get(
    '/filters',
    {
      response: {
        200: BorealisGamesModel.filtersResponse,
      },
      detail: {
        summary: 'Get game catalog filters',
        description: 'Returns available filter facets and value counts for game catalog.',
        tags: ['Borealis - Games'],
      },
    },
    async () => {
      return await BorealisGamesServ.getFilters()
    }
  )

  .get(
    '/:gameId',
    {
      params: BorealisGamesModel.param,
      response: {
        200: BorealisGamesModel.detailResponse,
        404: BorealisGamesModel.notFoundError,
        422: BorealisGamesModel.validationError,
      },
      detail: {
        summary: 'Get game overview',
        description: 'Retrieves complete metadata overview for a game by ID.',
        tags: ['Borealis - Games'],
      },
    },
    async ({ params: { gameId } }) => {
      return await BorealisGamesServ.getById(gameId)
    }
  )

  .post(
    '/:gameId/refresh',
    {
      params: BorealisGamesModel.param,
      response: {
        200: BorealisGamesModel.refreshResponse,
        401: BorealisGamesModel.unauthorizedError,
        404: BorealisGamesModel.notFoundError,
        422: BorealisGamesModel.validationError,
      },
      detail: {
        summary: 'Refresh game metadata',
        description: 'Enqueues background metadata refresh from external sources.',
        tags: ['Borealis - Games'],
      },
    },
    async ({ params: { gameId }, session: userSession }) => {
      userSession.requireUser()
      return await BorealisGamesServ.refresh(gameId)
    }
  )

  .get(
    '/:gameId/similar',
    {
      params: BorealisGamesModel.param,
      query: BorealisGamesModel.similarQuery,
      response: {
        200: BorealisGamesModel.similarResponse,
        404: BorealisGamesModel.notFoundError,
        422: BorealisGamesModel.validationError,
      },
      detail: {
        summary: 'Get similar games',
        description: 'Retrieves algorithmic similarity recommendations (default 24 items).',
        tags: ['Borealis - Games'],
      },
    },
    async ({ params: { gameId }, query }) => {
      return await BorealisGamesServ.getSimilar(gameId, query?.limit)
    }
  )

const metaRoutes = new Elysia()
  .use(session())

  .get(
    '/:gameId/characters',
    {
      params: BorealisGamesModel.param,
      response: {
        200: BorealisGamesModel.charactersResponse,
        404: BorealisGamesModel.notFoundError,
        422: BorealisGamesModel.validationError,
      },
      detail: {
        summary: 'Get game characters',
        description: 'Retrieves character cast members.',
        tags: ['Borealis - Games'],
      },
    },
    async ({ params: { gameId } }) => {
      return await BorealisGamesServ.getCharacters(gameId)
    }
  )

  .get(
    '/:gameId/staff',
    {
      params: BorealisGamesModel.param,
      response: {
        200: BorealisGamesModel.staffResponse,
        404: BorealisGamesModel.notFoundError,
        422: BorealisGamesModel.validationError,
      },
      detail: {
        summary: 'Get game staff',
        description: 'Retrieves developer, publisher, and design staff credits.',
        tags: ['Borealis - Games'],
      },
    },
    async ({ params: { gameId } }) => {
      return await BorealisGamesServ.getStaff(gameId)
    }
  )

  .get(
    '/:gameId/images',
    {
      params: BorealisGamesModel.param,
      response: {
        200: BorealisGamesModel.imagesResponse,
        404: BorealisGamesModel.notFoundError,
        422: BorealisGamesModel.validationError,
      },
      detail: {
        summary: 'Get game images',
        description: 'Retrieves box art, cover, banner, and image gallery.',
        tags: ['Borealis - Games'],
      },
    },
    async ({ params: { gameId } }) => {
      return await BorealisGamesServ.getImages(gameId)
    }
  )

  .get(
    '/:gameId/stats',
    {
      params: BorealisGamesModel.param,
      response: {
        200: BorealisGamesModel.statsResponse,
        404: BorealisGamesModel.notFoundError,
        422: BorealisGamesModel.validationError,
      },
      detail: {
        summary: 'Get game statistics',
        description: 'Retrieves score distribution, status counts, and aggregate metrics.',
        tags: ['Borealis - Games'],
      },
    },
    async ({ params: { gameId } }) => {
      return await BorealisGamesServ.getStats(gameId)
    }
  )

const communityRoutes = new Elysia()
  .use(session())

  .get(
    '/:gameId/friends',
    {
      params: BorealisGamesModel.param,
      response: {
        200: BorealisGamesModel.friendsResponse,
        404: BorealisGamesModel.notFoundError,
        422: BorealisGamesModel.validationError,
      },
      detail: {
        summary: 'Get friends tracking game',
        description: 'Retrieves friends tracking status and standardized primary progress (hours/completion).',
        tags: ['Borealis - Games'],
      },
    },
    async ({ params: { gameId }, session: userSession }) => {
      const user = userSession.getUser()
      return await BorealisGamesServ.getFriends(gameId, user?.id)
    }
  )

  .get(
    '/:gameId/people',
    {
      params: BorealisGamesModel.param,
      query: BorealisGamesModel.peopleQuery,
      response: {
        200: BorealisGamesModel.peopleResponse,
        404: BorealisGamesModel.notFoundError,
        422: BorealisGamesModel.validationError,
      },
      detail: {
        summary: 'Get public people tracking game',
        description: 'Retrieves paginated public user list entries for this game item.',
        tags: ['Borealis - Games'],
      },
    },
    async ({ params: { gameId }, query }) => {
      return await BorealisGamesServ.getPeople(gameId, query)
    }
  )

  .get(
    '/:gameId/recommendations',
    {
      params: BorealisGamesModel.param,
      response: {
        200: BorealisGamesModel.recommendationsResponse,
        404: BorealisGamesModel.notFoundError,
        422: BorealisGamesModel.validationError,
      },
      detail: {
        summary: 'Get game recommendations',
        description: 'Retrieves user community recommendations.',
        tags: ['Borealis - Games'],
      },
    },
    async ({ params: { gameId } }) => {
      return await BorealisGamesServ.getRecommendations(gameId)
    }
  )

export const borealisGames = new Elysia({ prefix: '/borealis/games' })
  .use(coreRoutes)
  .use(metaRoutes)
  .use(communityRoutes)

export default borealisGames
