import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { BorealisTvModel } from '../../models/borealis/tv.model'
import { BorealisTvServ } from '../../../services/borealis/tv.serv'

// Split into small Elysia instances to avoid TS2589 (excessively deep type instantiation).
const routes1 = new Elysia()
  .use(session())

  .get(
    '',
    {
      query: BorealisTvModel.catalogQuery,
      response: {
        200: BorealisTvModel.catalogResponse,
        422: BorealisTvModel.validationError,
      },
      detail: {
        summary: 'Get TV show catalog',
        description: 'Retrieves paginated TV catalog with cursor or page, supporting comprehensive multi-field filtering.',
        tags: ['Borealis - TV'],
      },
    },
    async ({ query }) => {
      return await BorealisTvServ.getCatalog(query)
    }
  )

  .get(
    '/filters',
    {
      response: {
        200: BorealisTvModel.filtersResponse,
      },
      detail: {
        summary: 'Get TV catalog filters',
        description: 'Returns available filter facets and value counts for TV catalog.',
        tags: ['Borealis - TV'],
      },
    },
    async () => {
      return await BorealisTvServ.getFilters()
    }
  )

  .get(
    '/:tvId',
    {
      params: BorealisTvModel.param,
      response: {
        200: BorealisTvModel.detailResponse,
        404: BorealisTvModel.notFoundError,
        422: BorealisTvModel.validationError,
      },
      detail: {
        summary: 'Get TV show overview',
        description: 'Retrieves complete metadata overview for a TV show by ID.',
        tags: ['Borealis - TV'],
      },
    },
    async ({ params: { tvId } }) => {
      return await BorealisTvServ.getById(tvId)
    }
  )

  .post(
    '/:tvId/refresh',
    {
      params: BorealisTvModel.param,
      response: {
        200: BorealisTvModel.refreshResponse,
        401: BorealisTvModel.unauthorizedError,
        404: BorealisTvModel.notFoundError,
        422: BorealisTvModel.validationError,
      },
      detail: {
        summary: 'Refresh TV show metadata',
        description: 'Enqueues background metadata refresh from external sources.',
        tags: ['Borealis - TV'],
      },
    },
    async ({ params: { tvId }, session: userSession }) => {
      userSession.requireUser()
      return await BorealisTvServ.refresh(tvId)
    }
  )

const routes2 = new Elysia()
  .use(session())

  .get(
    '/:tvId/similar',
    {
      params: BorealisTvModel.param,
      query: BorealisTvModel.similarQuery,
      response: {
        200: BorealisTvModel.similarResponse,
        404: BorealisTvModel.notFoundError,
        422: BorealisTvModel.validationError,
      },
      detail: {
        summary: 'Get similar TV shows',
        description: 'Retrieves algorithmic similarity recommendations (default 24 items).',
        tags: ['Borealis - TV'],
      },
    },
    async ({ params: { tvId }, query }) => {
      return await BorealisTvServ.getSimilar(tvId, query?.limit)
    }
  )

  .get(
    '/:tvId/characters',
    {
      params: BorealisTvModel.param,
      response: {
        200: BorealisTvModel.charactersResponse,
        404: BorealisTvModel.notFoundError,
        422: BorealisTvModel.validationError,
      },
      detail: {
        summary: 'Get TV show characters',
        description: 'Retrieves character cast members and actors.',
        tags: ['Borealis - TV'],
      },
    },
    async ({ params: { tvId } }) => {
      return await BorealisTvServ.getCharacters(tvId)
    }
  )

  .get(
    '/:tvId/staff',
    {
      params: BorealisTvModel.param,
      response: {
        200: BorealisTvModel.staffResponse,
        404: BorealisTvModel.notFoundError,
        422: BorealisTvModel.validationError,
      },
      detail: {
        summary: 'Get TV show staff',
        description: 'Retrieves creators, directors, and production credits.',
        tags: ['Borealis - TV'],
      },
    },
    async ({ params: { tvId } }) => {
      return await BorealisTvServ.getStaff(tvId)
    }
  )

const routes3 = new Elysia()
  .use(session())

  .get(
    '/:tvId/seasons',
    {
      params: BorealisTvModel.param,
      response: {
        200: BorealisTvModel.seasonsResponse,
        404: BorealisTvModel.notFoundError,
        422: BorealisTvModel.validationError,
      },
      detail: {
        summary: 'Get TV show seasons',
        description: 'Retrieves list of seasons.',
        tags: ['Borealis - TV'],
      },
    },
    async ({ params: { tvId } }) => {
      return await BorealisTvServ.getSeasons(tvId)
    }
  )

  .get(
    '/:tvId/episodes',
    {
      params: BorealisTvModel.param,
      response: {
        200: BorealisTvModel.episodesResponse,
        404: BorealisTvModel.notFoundError,
        422: BorealisTvModel.validationError,
      },
      detail: {
        summary: 'Get TV show episodes',
        description: 'Retrieves list of episodes.',
        tags: ['Borealis - TV'],
      },
    },
    async ({ params: { tvId } }) => {
      return await BorealisTvServ.getEpisodes(tvId)
    }
  )

  .get(
    '/:tvId/images',
    {
      params: BorealisTvModel.param,
      response: {
        200: BorealisTvModel.imagesResponse,
        404: BorealisTvModel.notFoundError,
        422: BorealisTvModel.validationError,
      },
      detail: {
        summary: 'Get TV show images',
        description: 'Retrieves poster, backdrop, and image gallery.',
        tags: ['Borealis - TV'],
      },
    },
    async ({ params: { tvId } }) => {
      return await BorealisTvServ.getImages(tvId)
    }
  )

  .get(
    '/:tvId/stats',
    {
      params: BorealisTvModel.param,
      response: {
        200: BorealisTvModel.statsResponse,
        404: BorealisTvModel.notFoundError,
        422: BorealisTvModel.validationError,
      },
      detail: {
        summary: 'Get TV show statistics',
        description: 'Retrieves score distribution, status counts, and aggregate metrics.',
        tags: ['Borealis - TV'],
      },
    },
    async ({ params: { tvId } }) => {
      return await BorealisTvServ.getStats(tvId)
    }
  )

const routes4 = new Elysia()
  .use(session())

  .get(
    '/:tvId/friends',
    {
      params: BorealisTvModel.param,
      response: {
        200: BorealisTvModel.friendsResponse,
        404: BorealisTvModel.notFoundError,
        422: BorealisTvModel.validationError,
      },
      detail: {
        summary: 'Get friends tracking TV show',
        description: 'Retrieves friends tracking status and standardized primary progress.',
        tags: ['Borealis - TV'],
      },
    },
    async ({ params: { tvId }, session: userSession }) => {
      const user = userSession.getUser()
      return await BorealisTvServ.getFriends(tvId, user?.id)
    }
  )

  .get(
    '/:tvId/people',
    {
      params: BorealisTvModel.param,
      query: BorealisTvModel.peopleQuery,
      response: {
        200: BorealisTvModel.peopleResponse,
        404: BorealisTvModel.notFoundError,
        422: BorealisTvModel.validationError,
      },
      detail: {
        summary: 'Get public people tracking TV show',
        description: 'Retrieves paginated public user list entries for this TV show.',
        tags: ['Borealis - TV'],
      },
    },
    async ({ params: { tvId }, query }) => {
      return await BorealisTvServ.getPeople(tvId, query)
    }
  )

  .get(
    '/:tvId/recommendations',
    {
      params: BorealisTvModel.param,
      response: {
        200: BorealisTvModel.recommendationsResponse,
        404: BorealisTvModel.notFoundError,
        422: BorealisTvModel.validationError,
      },
      detail: {
        summary: 'Get TV show recommendations',
        description: 'Retrieves user community recommendations.',
        tags: ['Borealis - TV'],
      },
    },
    async ({ params: { tvId } }) => {
      return await BorealisTvServ.getRecommendations(tvId)
    }
  )

export const borealisTv = new Elysia({ prefix: '/borealis/tv' })
  .use(routes1)
  .use(routes2)
  .use(routes3)
  .use(routes4)

export default borealisTv
