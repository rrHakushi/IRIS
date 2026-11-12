import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { BorealisAnimeModel } from '../../models/borealis/anime.model'
import { BorealisAnimeServ } from '../../../services/borealis/anime.serv'

// Split into small Elysia instances to avoid TS2589 (excessively deep type instantiation).
const routes1 = new Elysia()
  .use(session())

  .get(
    '',
    {
      query: BorealisAnimeModel.catalogQuery,
      response: {
        200: BorealisAnimeModel.catalogResponse,
        422: BorealisAnimeModel.validationError,
      },
      detail: {
        summary: 'Get anime catalog',
        description: 'Retrieves paginated anime catalog with cursor or page, supporting comprehensive multi-field filtering.',
        tags: ['Borealis - Anime'],
      },
    },
    async ({ query }) => {
      return await BorealisAnimeServ.getCatalog(query)
    }
  )

  .get(
    '/filters',
    {
      response: {
        200: BorealisAnimeModel.filtersResponse,
      },
      detail: {
        summary: 'Get anime catalog filters',
        description: 'Returns available filter facets and value counts for anime catalog.',
        tags: ['Borealis - Anime'],
      },
    },
    async () => {
      return await BorealisAnimeServ.getFilters()
    }
  )

  .get(
    '/:animeId',
    {
      params: BorealisAnimeModel.param,
      response: {
        200: BorealisAnimeModel.detailResponse,
        404: BorealisAnimeModel.notFoundError,
        422: BorealisAnimeModel.validationError,
      },
      detail: {
        summary: 'Get anime overview',
        description: 'Retrieves complete metadata overview for an anime item by ID.',
        tags: ['Borealis - Anime'],
      },
    },
    async ({ params: { animeId } }) => {
      return await BorealisAnimeServ.getById(animeId)
    }
  )

  .post(
    '/:animeId/refresh',
    {
      params: BorealisAnimeModel.param,
      response: {
        200: BorealisAnimeModel.refreshResponse,
        401: BorealisAnimeModel.unauthorizedError,
        404: BorealisAnimeModel.notFoundError,
        422: BorealisAnimeModel.validationError,
      },
      detail: {
        summary: 'Refresh anime metadata',
        description: 'Enqueues background metadata refresh from external sources.',
        tags: ['Borealis - Anime'],
      },
    },
    async ({ params: { animeId }, session: userSession }) => {
      userSession.requireUser()
      return await BorealisAnimeServ.refresh(animeId)
    }
  )

const routes2 = new Elysia()
  .use(session())

  .get(
    '/:animeId/similar',
    {
      params: BorealisAnimeModel.param,
      query: BorealisAnimeModel.similarQuery,
      response: {
        200: BorealisAnimeModel.similarResponse,
        404: BorealisAnimeModel.notFoundError,
        422: BorealisAnimeModel.validationError,
      },
      detail: {
        summary: 'Get similar anime',
        description: 'Retrieves algorithmic similarity recommendations (default 24 items).',
        tags: ['Borealis - Anime'],
      },
    },
    async ({ params: { animeId }, query }) => {
      return await BorealisAnimeServ.getSimilar(animeId, query?.limit)
    }
  )

  .get(
    '/:animeId/relations',
    {
      params: BorealisAnimeModel.param,
      response: {
        200: BorealisAnimeModel.relationsResponse,
        404: BorealisAnimeModel.notFoundError,
        422: BorealisAnimeModel.validationError,
      },
      detail: {
        summary: 'Get anime relations',
        description: 'Retrieves cross-media relations and franchise connections.',
        tags: ['Borealis - Anime'],
      },
    },
    async ({ params: { animeId } }) => {
      return await BorealisAnimeServ.getRelations(animeId)
    }
  )

  .get(
    '/:animeId/characters',
    {
      params: BorealisAnimeModel.param,
      response: {
        200: BorealisAnimeModel.charactersResponse,
        404: BorealisAnimeModel.notFoundError,
        422: BorealisAnimeModel.validationError,
      },
      detail: {
        summary: 'Get anime characters',
        description: 'Retrieves character cast and voice actor mappings.',
        tags: ['Borealis - Anime'],
      },
    },
    async ({ params: { animeId } }) => {
      return await BorealisAnimeServ.getCharacters(animeId)
    }
  )

  .get(
    '/:animeId/staff',
    {
      params: BorealisAnimeModel.param,
      response: {
        200: BorealisAnimeModel.staffResponse,
        404: BorealisAnimeModel.notFoundError,
        422: BorealisAnimeModel.validationError,
      },
      detail: {
        summary: 'Get anime staff',
        description: 'Retrieves production staff and credits.',
        tags: ['Borealis - Anime'],
      },
    },
    async ({ params: { animeId } }) => {
      return await BorealisAnimeServ.getStaff(animeId)
    }
  )

const routes3 = new Elysia()
  .use(session())

  .get(
    '/:animeId/episodes',
    {
      params: BorealisAnimeModel.param,
      response: {
        200: BorealisAnimeModel.episodesResponse,
        404: BorealisAnimeModel.notFoundError,
        422: BorealisAnimeModel.validationError,
      },
      detail: {
        summary: 'Get anime episodes',
        description: 'Retrieves list of anime episodes.',
        tags: ['Borealis - Anime'],
      },
    },
    async ({ params: { animeId } }) => {
      return await BorealisAnimeServ.getEpisodes(animeId)
    }
  )

  .get(
    '/:animeId/images',
    {
      params: BorealisAnimeModel.param,
      response: {
        200: BorealisAnimeModel.imagesResponse,
        404: BorealisAnimeModel.notFoundError,
        422: BorealisAnimeModel.validationError,
      },
      detail: {
        summary: 'Get anime images',
        description: 'Retrieves poster, banner, and image gallery.',
        tags: ['Borealis - Anime'],
      },
    },
    async ({ params: { animeId } }) => {
      return await BorealisAnimeServ.getImages(animeId)
    }
  )

  .get(
    '/:animeId/stats',
    {
      params: BorealisAnimeModel.param,
      response: {
        200: BorealisAnimeModel.statsResponse,
        404: BorealisAnimeModel.notFoundError,
        422: BorealisAnimeModel.validationError,
      },
      detail: {
        summary: 'Get anime statistics',
        description: 'Retrieves score distribution, status counts, and aggregate metrics.',
        tags: ['Borealis - Anime'],
      },
    },
    async ({ params: { animeId } }) => {
      return await BorealisAnimeServ.getStats(animeId)
    }
  )

  .get(
    '/:animeId/friends',
    {
      params: BorealisAnimeModel.param,
      response: {
        200: BorealisAnimeModel.friendsResponse,
        404: BorealisAnimeModel.notFoundError,
        422: BorealisAnimeModel.validationError,
      },
      detail: {
        summary: 'Get friends tracking anime',
        description: 'Retrieves friends tracking status and standardized primary/secondary progress.',
        tags: ['Borealis - Anime'],
      },
    },
    async ({ params: { animeId }, session: userSession }) => {
      const user = userSession.getUser()
      return await BorealisAnimeServ.getFriends(animeId, user?.id)
    }
  )

const routes4 = new Elysia()
  .use(session())

  .get(
    '/:animeId/people',
    {
      params: BorealisAnimeModel.param,
      query: BorealisAnimeModel.peopleQuery,
      response: {
        200: BorealisAnimeModel.peopleResponse,
        404: BorealisAnimeModel.notFoundError,
        422: BorealisAnimeModel.validationError,
      },
      detail: {
        summary: 'Get public people tracking anime',
        description: 'Retrieves paginated public user list entries for this anime item.',
        tags: ['Borealis - Anime'],
      },
    },
    async ({ params: { animeId }, query }) => {
      return await BorealisAnimeServ.getPeople(animeId, query)
    }
  )

  .get(
    '/:animeId/recommendations',
    {
      params: BorealisAnimeModel.param,
      response: {
        200: BorealisAnimeModel.recommendationsResponse,
        404: BorealisAnimeModel.notFoundError,
        422: BorealisAnimeModel.validationError,
      },
      detail: {
        summary: 'Get anime recommendations',
        description: 'Retrieves user community recommendations.',
        tags: ['Borealis - Anime'],
      },
    },
    async ({ params: { animeId } }) => {
      return await BorealisAnimeServ.getRecommendations(animeId)
    }
  )

export const borealisAnime = new Elysia({ prefix: '/borealis/anime' })
  .use(routes1)
  .use(routes2)
  .use(routes3)
  .use(routes4)

export default borealisAnime
