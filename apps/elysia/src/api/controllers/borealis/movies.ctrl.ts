import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { BorealisMoviesModel } from '../../models/borealis/movies.model'
import { BorealisMoviesServ } from '../../../services/borealis/movies.serv'

// Split into small Elysia instances to avoid TS2589 (excessively deep type instantiation).
const routes1 = new Elysia()
  .use(session())

  .get(
    '',
    {
      query: BorealisMoviesModel.catalogQuery,
      response: {
        200: BorealisMoviesModel.catalogResponse,
        422: BorealisMoviesModel.validationError,
      },
      detail: {
        summary: 'Get movie catalog',
        description: 'Retrieves paginated movie catalog with cursor or page, supporting comprehensive multi-field filtering.',
        tags: ['Borealis - Movies'],
      },
    },
    async ({ query }) => {
      return await BorealisMoviesServ.getCatalog(query)
    }
  )

  .get(
    '/filters',
    {
      response: {
        200: BorealisMoviesModel.filtersResponse,
      },
      detail: {
        summary: 'Get movie catalog filters',
        description: 'Returns available filter facets and value counts for movie catalog.',
        tags: ['Borealis - Movies'],
      },
    },
    async () => {
      return await BorealisMoviesServ.getFilters()
    }
  )

  .get(
    '/:movieId',
    {
      params: BorealisMoviesModel.param,
      response: {
        200: BorealisMoviesModel.detailResponse,
        404: BorealisMoviesModel.notFoundError,
        422: BorealisMoviesModel.validationError,
      },
      detail: {
        summary: 'Get movie overview',
        description: 'Retrieves complete metadata overview for a movie by ID.',
        tags: ['Borealis - Movies'],
      },
    },
    async ({ params: { movieId } }) => {
      return await BorealisMoviesServ.getById(movieId)
    }
  )

  .post(
    '/:movieId/refresh',
    {
      params: BorealisMoviesModel.param,
      response: {
        200: BorealisMoviesModel.refreshResponse,
        401: BorealisMoviesModel.unauthorizedError,
        404: BorealisMoviesModel.notFoundError,
        422: BorealisMoviesModel.validationError,
      },
      detail: {
        summary: 'Refresh movie metadata',
        description: 'Enqueues background metadata refresh from external sources.',
        tags: ['Borealis - Movies'],
      },
    },
    async ({ params: { movieId }, session: userSession }) => {
      userSession.requireUser()
      return await BorealisMoviesServ.refresh(movieId)
    }
  )

const routes2 = new Elysia()
  .use(session())

  .get(
    '/:movieId/similar',
    {
      params: BorealisMoviesModel.param,
      query: BorealisMoviesModel.similarQuery,
      response: {
        200: BorealisMoviesModel.similarResponse,
        404: BorealisMoviesModel.notFoundError,
        422: BorealisMoviesModel.validationError,
      },
      detail: {
        summary: 'Get similar movies',
        description: 'Retrieves algorithmic similarity recommendations (default 24 items).',
        tags: ['Borealis - Movies'],
      },
    },
    async ({ params: { movieId }, query }) => {
      return await BorealisMoviesServ.getSimilar(movieId, query?.limit)
    }
  )

  .get(
    '/:movieId/relations',
    {
      params: BorealisMoviesModel.param,
      response: {
        200: BorealisMoviesModel.relationsResponse,
        404: BorealisMoviesModel.notFoundError,
        422: BorealisMoviesModel.validationError,
      },
      detail: {
        summary: 'Get movie relations',
        description: 'Retrieves cross-media relations and franchise connections.',
        tags: ['Borealis - Movies'],
      },
    },
    async ({ params: { movieId } }) => {
      return await BorealisMoviesServ.getRelations(movieId)
    }
  )

  .get(
    '/:movieId/characters',
    {
      params: BorealisMoviesModel.param,
      response: {
        200: BorealisMoviesModel.charactersResponse,
        404: BorealisMoviesModel.notFoundError,
        422: BorealisMoviesModel.validationError,
      },
      detail: {
        summary: 'Get movie characters',
        description: 'Retrieves character cast members and actors.',
        tags: ['Borealis - Movies'],
      },
    },
    async ({ params: { movieId } }) => {
      return await BorealisMoviesServ.getCharacters(movieId)
    }
  )

  .get(
    '/:movieId/staff',
    {
      params: BorealisMoviesModel.param,
      response: {
        200: BorealisMoviesModel.staffResponse,
        404: BorealisMoviesModel.notFoundError,
        422: BorealisMoviesModel.validationError,
      },
      detail: {
        summary: 'Get movie staff',
        description: 'Retrieves directors, writers, and production credits.',
        tags: ['Borealis - Movies'],
      },
    },
    async ({ params: { movieId } }) => {
      return await BorealisMoviesServ.getStaff(movieId)
    }
  )

const routes3 = new Elysia()
  .use(session())

  .get(
    '/:movieId/images',
    {
      params: BorealisMoviesModel.param,
      response: {
        200: BorealisMoviesModel.imagesResponse,
        404: BorealisMoviesModel.notFoundError,
        422: BorealisMoviesModel.validationError,
      },
      detail: {
        summary: 'Get movie images',
        description: 'Retrieves poster, backdrop, and image gallery.',
        tags: ['Borealis - Movies'],
      },
    },
    async ({ params: { movieId } }) => {
      return await BorealisMoviesServ.getImages(movieId)
    }
  )

  .get(
    '/:movieId/stats',
    {
      params: BorealisMoviesModel.param,
      response: {
        200: BorealisMoviesModel.statsResponse,
        404: BorealisMoviesModel.notFoundError,
        422: BorealisMoviesModel.validationError,
      },
      detail: {
        summary: 'Get movie statistics',
        description: 'Retrieves score distribution, status counts, and aggregate metrics.',
        tags: ['Borealis - Movies'],
      },
    },
    async ({ params: { movieId } }) => {
      return await BorealisMoviesServ.getStats(movieId)
    }
  )

  .get(
    '/:movieId/friends',
    {
      params: BorealisMoviesModel.param,
      response: {
        200: BorealisMoviesModel.friendsResponse,
        404: BorealisMoviesModel.notFoundError,
        422: BorealisMoviesModel.validationError,
      },
      detail: {
        summary: 'Get friends tracking movie',
        description: 'Retrieves friends tracking status (primary/secondary progress are null for movies).',
        tags: ['Borealis - Movies'],
      },
    },
    async ({ params: { movieId }, session: userSession }) => {
      const user = userSession.getUser()
      return await BorealisMoviesServ.getFriends(movieId, user?.id)
    }
  )

  .get(
    '/:movieId/people',
    {
      params: BorealisMoviesModel.param,
      query: BorealisMoviesModel.peopleQuery,
      response: {
        200: BorealisMoviesModel.peopleResponse,
        404: BorealisMoviesModel.notFoundError,
        422: BorealisMoviesModel.validationError,
      },
      detail: {
        summary: 'Get public people tracking movie',
        description: 'Retrieves paginated public user list entries for this movie.',
        tags: ['Borealis - Movies'],
      },
    },
    async ({ params: { movieId }, query }) => {
      return await BorealisMoviesServ.getPeople(movieId, query)
    }
  )

const routes4 = new Elysia()
  .use(session())

  .get(
    '/:movieId/recommendations',
    {
      params: BorealisMoviesModel.param,
      response: {
        200: BorealisMoviesModel.recommendationsResponse,
        404: BorealisMoviesModel.notFoundError,
        422: BorealisMoviesModel.validationError,
      },
      detail: {
        summary: 'Get movie recommendations',
        description: 'Retrieves user community recommendations.',
        tags: ['Borealis - Movies'],
      },
    },
    async ({ params: { movieId } }) => {
      return await BorealisMoviesServ.getRecommendations(movieId)
    }
  )

export const borealisMovies = new Elysia({ prefix: '/borealis/movies' })
  .use(routes1)
  .use(routes2)
  .use(routes3)
  .use(routes4)

export default borealisMovies
