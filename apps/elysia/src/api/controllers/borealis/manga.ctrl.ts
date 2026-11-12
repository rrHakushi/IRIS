import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { BorealisMangaModel } from '../../models/borealis/manga.model'
import { BorealisMangaServ } from '../../../services/borealis/manga.serv'

// Split into small Elysia instances to avoid TS2589 (excessively deep type instantiation).
const routes1 = new Elysia()
  .use(session())

  .get(
    '',
    {
      query: BorealisMangaModel.catalogQuery,
      response: {
        200: BorealisMangaModel.catalogResponse,
        422: BorealisMangaModel.validationError,
      },
      detail: {
        summary: 'Get manga catalog',
        description: 'Retrieves paginated manga catalog with cursor or page, supporting comprehensive multi-field filtering.',
        tags: ['Borealis - Manga'],
      },
    },
    async ({ query }) => {
      return await BorealisMangaServ.getCatalog(query)
    }
  )

  .get(
    '/filters',
    {
      response: {
        200: BorealisMangaModel.filtersResponse,
      },
      detail: {
        summary: 'Get manga catalog filters',
        description: 'Returns available filter facets and value counts for manga catalog.',
        tags: ['Borealis - Manga'],
      },
    },
    async () => {
      return await BorealisMangaServ.getFilters()
    }
  )

  .get(
    '/:mangaId',
    {
      params: BorealisMangaModel.param,
      response: {
        200: BorealisMangaModel.detailResponse,
        404: BorealisMangaModel.notFoundError,
        422: BorealisMangaModel.validationError,
      },
      detail: {
        summary: 'Get manga overview',
        description: 'Retrieves complete metadata overview for a manga item by ID.',
        tags: ['Borealis - Manga'],
      },
    },
    async ({ params: { mangaId } }) => {
      return await BorealisMangaServ.getById(mangaId)
    }
  )

  .post(
    '/:mangaId/refresh',
    {
      params: BorealisMangaModel.param,
      response: {
        200: BorealisMangaModel.refreshResponse,
        401: BorealisMangaModel.unauthorizedError,
        404: BorealisMangaModel.notFoundError,
        422: BorealisMangaModel.validationError,
      },
      detail: {
        summary: 'Refresh manga metadata',
        description: 'Enqueues background metadata refresh from external sources.',
        tags: ['Borealis - Manga'],
      },
    },
    async ({ params: { mangaId }, session: userSession }) => {
      userSession.requireUser()
      return await BorealisMangaServ.refresh(mangaId)
    }
  )

const routes2 = new Elysia()
  .use(session())

  .get(
    '/:mangaId/similar',
    {
      params: BorealisMangaModel.param,
      query: BorealisMangaModel.similarQuery,
      response: {
        200: BorealisMangaModel.similarResponse,
        404: BorealisMangaModel.notFoundError,
        422: BorealisMangaModel.validationError,
      },
      detail: {
        summary: 'Get similar manga',
        description: 'Retrieves algorithmic similarity recommendations (default 24 items).',
        tags: ['Borealis - Manga'],
      },
    },
    async ({ params: { mangaId }, query }) => {
      return await BorealisMangaServ.getSimilar(mangaId, query?.limit)
    }
  )

  .get(
    '/:mangaId/relations',
    {
      params: BorealisMangaModel.param,
      response: {
        200: BorealisMangaModel.relationsResponse,
        404: BorealisMangaModel.notFoundError,
        422: BorealisMangaModel.validationError,
      },
      detail: {
        summary: 'Get manga relations',
        description: 'Retrieves cross-media relations and franchise connections.',
        tags: ['Borealis - Manga'],
      },
    },
    async ({ params: { mangaId } }) => {
      return await BorealisMangaServ.getRelations(mangaId)
    }
  )

  .get(
    '/:mangaId/characters',
    {
      params: BorealisMangaModel.param,
      response: {
        200: BorealisMangaModel.charactersResponse,
        404: BorealisMangaModel.notFoundError,
        422: BorealisMangaModel.validationError,
      },
      detail: {
        summary: 'Get manga characters',
        description: 'Retrieves character cast members.',
        tags: ['Borealis - Manga'],
      },
    },
    async ({ params: { mangaId } }) => {
      return await BorealisMangaServ.getCharacters(mangaId)
    }
  )

  .get(
    '/:mangaId/staff',
    {
      params: BorealisMangaModel.param,
      response: {
        200: BorealisMangaModel.staffResponse,
        404: BorealisMangaModel.notFoundError,
        422: BorealisMangaModel.validationError,
      },
      detail: {
        summary: 'Get manga staff',
        description: 'Retrieves author, illustrator, and publishing staff credits.',
        tags: ['Borealis - Manga'],
      },
    },
    async ({ params: { mangaId } }) => {
      return await BorealisMangaServ.getStaff(mangaId)
    }
  )

const routes3 = new Elysia()
  .use(session())

  .get(
    '/:mangaId/images',
    {
      params: BorealisMangaModel.param,
      response: {
        200: BorealisMangaModel.imagesResponse,
        404: BorealisMangaModel.notFoundError,
        422: BorealisMangaModel.validationError,
      },
      detail: {
        summary: 'Get manga images',
        description: 'Retrieves cover, banner, and image gallery.',
        tags: ['Borealis - Manga'],
      },
    },
    async ({ params: { mangaId } }) => {
      return await BorealisMangaServ.getImages(mangaId)
    }
  )

  .get(
    '/:mangaId/stats',
    {
      params: BorealisMangaModel.param,
      response: {
        200: BorealisMangaModel.statsResponse,
        404: BorealisMangaModel.notFoundError,
        422: BorealisMangaModel.validationError,
      },
      detail: {
        summary: 'Get manga statistics',
        description: 'Retrieves score distribution, status counts, and aggregate metrics.',
        tags: ['Borealis - Manga'],
      },
    },
    async ({ params: { mangaId } }) => {
      return await BorealisMangaServ.getStats(mangaId)
    }
  )

  .get(
    '/:mangaId/friends',
    {
      params: BorealisMangaModel.param,
      response: {
        200: BorealisMangaModel.friendsResponse,
        404: BorealisMangaModel.notFoundError,
        422: BorealisMangaModel.validationError,
      },
      detail: {
        summary: 'Get friends tracking manga',
        description: 'Retrieves friends tracking status and standardized primary (chapters) and secondary (volumes) progress.',
        tags: ['Borealis - Manga'],
      },
    },
    async ({ params: { mangaId }, session: userSession }) => {
      const user = userSession.getUser()
      return await BorealisMangaServ.getFriends(mangaId, user?.id)
    }
  )

  .get(
    '/:mangaId/people',
    {
      params: BorealisMangaModel.param,
      query: BorealisMangaModel.peopleQuery,
      response: {
        200: BorealisMangaModel.peopleResponse,
        404: BorealisMangaModel.notFoundError,
        422: BorealisMangaModel.validationError,
      },
      detail: {
        summary: 'Get public people tracking manga',
        description: 'Retrieves paginated public user list entries for this manga item.',
        tags: ['Borealis - Manga'],
      },
    },
    async ({ params: { mangaId }, query }) => {
      return await BorealisMangaServ.getPeople(mangaId, query)
    }
  )

const routes4 = new Elysia()
  .use(session())

  .get(
    '/:mangaId/recommendations',
    {
      params: BorealisMangaModel.param,
      response: {
        200: BorealisMangaModel.recommendationsResponse,
        404: BorealisMangaModel.notFoundError,
        422: BorealisMangaModel.validationError,
      },
      detail: {
        summary: 'Get manga recommendations',
        description: 'Retrieves user community recommendations.',
        tags: ['Borealis - Manga'],
      },
    },
    async ({ params: { mangaId } }) => {
      return await BorealisMangaServ.getRecommendations(mangaId)
    }
  )

export const borealisManga = new Elysia({ prefix: '/borealis/manga' })
  .use(routes1)
  .use(routes2)
  .use(routes3)
  .use(routes4)

export default borealisManga
