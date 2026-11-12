import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { BorealisMusicModel } from '../../models/borealis/music.model'
import { BorealisMusicServ } from '../../../services/borealis/music.serv'

// Split into small Elysia instances to avoid TS2589 (excessively deep type instantiation).
const routes1 = new Elysia()
  .use(session())

  .get(
    '',
    {
      query: BorealisMusicModel.catalogQuery,
      response: {
        200: BorealisMusicModel.catalogResponse,
        422: BorealisMusicModel.validationError,
      },
      detail: {
        summary: 'Get music catalog',
        description: 'Retrieves paginated music tracks and albums with cursor or page, supporting comprehensive multi-field filtering.',
        tags: ['Borealis - Music'],
      },
    },
    async ({ query }) => {
      return await BorealisMusicServ.getCatalog(query)
    }
  )

  .get(
    '/filters',
    {
      response: {
        200: BorealisMusicModel.filtersResponse,
      },
      detail: {
        summary: 'Get music catalog filters',
        description: 'Returns available filter facets and value counts for music catalog.',
        tags: ['Borealis - Music'],
      },
    },
    async () => {
      return await BorealisMusicServ.getFilters()
    }
  )

  .get(
    '/:musicId',
    {
      params: BorealisMusicModel.param,
      response: {
        200: BorealisMusicModel.detailResponse,
        404: BorealisMusicModel.notFoundError,
        422: BorealisMusicModel.validationError,
      },
      detail: {
        summary: 'Get music overview',
        description: 'Retrieves complete metadata overview for a track or album by ID.',
        tags: ['Borealis - Music'],
      },
    },
    async ({ params: { musicId } }) => {
      return await BorealisMusicServ.getById(musicId)
    }
  )

  .post(
    '/:musicId/refresh',
    {
      params: BorealisMusicModel.param,
      response: {
        200: BorealisMusicModel.refreshResponse,
        401: BorealisMusicModel.unauthorizedError,
        404: BorealisMusicModel.notFoundError,
        422: BorealisMusicModel.validationError,
      },
      detail: {
        summary: 'Refresh music metadata',
        description: 'Enqueues background metadata refresh from external sources.',
        tags: ['Borealis - Music'],
      },
    },
    async ({ params: { musicId }, session: userSession }) => {
      userSession.requireUser()
      return await BorealisMusicServ.refresh(musicId)
    }
  )

const routes2 = new Elysia()
  .use(session())

  .get(
    '/:musicId/similar',
    {
      params: BorealisMusicModel.param,
      query: BorealisMusicModel.similarQuery,
      response: {
        200: BorealisMusicModel.similarResponse,
        404: BorealisMusicModel.notFoundError,
        422: BorealisMusicModel.validationError,
      },
      detail: {
        summary: 'Get similar music',
        description: 'Retrieves algorithmic similarity recommendations (default 24 items).',
        tags: ['Borealis - Music'],
      },
    },
    async ({ params: { musicId }, query }) => {
      return await BorealisMusicServ.getSimilar(musicId, query?.limit)
    }
  )

  .get(
    '/:musicId/tracks',
    {
      params: BorealisMusicModel.param,
      response: {
        200: BorealisMusicModel.tracksResponse,
        404: BorealisMusicModel.notFoundError,
        422: BorealisMusicModel.validationError,
      },
      detail: {
        summary: 'Get album tracks',
        description: 'Retrieves tracklist of a music album.',
        tags: ['Borealis - Music'],
      },
    },
    async ({ params: { musicId } }) => {
      return await BorealisMusicServ.getTracks(musicId)
    }
  )

  .get(
    '/:musicId/lyrics',
    {
      params: BorealisMusicModel.param,
      response: {
        200: BorealisMusicModel.lyricsResponse,
        404: BorealisMusicModel.notFoundError,
        422: BorealisMusicModel.validationError,
      },
      detail: {
        summary: 'Get track lyrics',
        description: 'Retrieves plain and synchronized lyrics for a track.',
        tags: ['Borealis - Music'],
      },
    },
    async ({ params: { musicId } }) => {
      return await BorealisMusicServ.getLyrics(musicId)
    }
  )

const routes3 = new Elysia()
  .use(session())

  .get(
    '/:musicId/staff',
    {
      params: BorealisMusicModel.param,
      response: {
        200: BorealisMusicModel.staffResponse,
        404: BorealisMusicModel.notFoundError,
        422: BorealisMusicModel.validationError,
      },
      detail: {
        summary: 'Get music staff',
        description: 'Retrieves artists, composers, lyricists, and producers.',
        tags: ['Borealis - Music'],
      },
    },
    async ({ params: { musicId } }) => {
      return await BorealisMusicServ.getStaff(musicId)
    }
  )

  .get(
    '/:musicId/images',
    {
      params: BorealisMusicModel.param,
      response: {
        200: BorealisMusicModel.imagesResponse,
        404: BorealisMusicModel.notFoundError,
        422: BorealisMusicModel.validationError,
      },
      detail: {
        summary: 'Get music images',
        description: 'Retrieves cover artwork and image variations.',
        tags: ['Borealis - Music'],
      },
    },
    async ({ params: { musicId } }) => {
      return await BorealisMusicServ.getImages(musicId)
    }
  )

  .get(
    '/:musicId/stats',
    {
      params: BorealisMusicModel.param,
      response: {
        200: BorealisMusicModel.statsResponse,
        404: BorealisMusicModel.notFoundError,
        422: BorealisMusicModel.validationError,
      },
      detail: {
        summary: 'Get music statistics',
        description: 'Retrieves listeners, play counts, and popularity metrics.',
        tags: ['Borealis - Music'],
      },
    },
    async ({ params: { musicId } }) => {
      return await BorealisMusicServ.getStats(musicId)
    }
  )

  .get(
    '/:musicId/friends',
    {
      params: BorealisMusicModel.param,
      response: {
        200: BorealisMusicModel.friendsResponse,
        404: BorealisMusicModel.notFoundError,
        422: BorealisMusicModel.validationError,
      },
      detail: {
        summary: 'Get friends tracking music',
        description: 'Retrieves friends tracking status and standardized primary progress (playCount).',
        tags: ['Borealis - Music'],
      },
    },
    async ({ params: { musicId }, session: userSession }) => {
      const user = userSession.getUser()
      return await BorealisMusicServ.getFriends(musicId, user?.id)
    }
  )

const routes4 = new Elysia()
  .use(session())

  .get(
    '/:musicId/people',
    {
      params: BorealisMusicModel.param,
      query: BorealisMusicModel.peopleQuery,
      response: {
        200: BorealisMusicModel.peopleResponse,
        404: BorealisMusicModel.notFoundError,
        422: BorealisMusicModel.validationError,
      },
      detail: {
        summary: 'Get public people tracking music',
        description: 'Retrieves paginated public user list entries for this music item.',
        tags: ['Borealis - Music'],
      },
    },
    async ({ params: { musicId }, query }) => {
      return await BorealisMusicServ.getPeople(musicId, query)
    }
  )

  .get(
    '/:musicId/recommendations',
    {
      params: BorealisMusicModel.param,
      response: {
        200: BorealisMusicModel.recommendationsResponse,
        404: BorealisMusicModel.notFoundError,
        422: BorealisMusicModel.validationError,
      },
      detail: {
        summary: 'Get music recommendations',
        description: 'Retrieves user community recommendations.',
        tags: ['Borealis - Music'],
      },
    },
    async ({ params: { musicId } }) => {
      return await BorealisMusicServ.getRecommendations(musicId)
    }
  )

export const borealisMusic = new Elysia({ prefix: '/borealis/music' })
  .use(routes1)
  .use(routes2)
  .use(routes3)
  .use(routes4)

export default borealisMusic
