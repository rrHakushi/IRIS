import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { BorealisBooksModel } from '../../models/borealis/books.model'
import { BorealisBooksServ } from '../../../services/borealis/books.serv'

// Split into small Elysia instances to avoid TS2589 (excessively deep type instantiation).
const routes1 = new Elysia()
  .use(session())

  .get(
    '',
    {
      query: BorealisBooksModel.catalogQuery,
      detail: {
        summary: 'Get books catalog',
        description: 'Returns 50 books per page with cursor or page pagination and filtering.',
        tags: ['Borealis - Books'],
      },
      response: {
        200: BorealisBooksModel.catalogResponse,
        422: BorealisBooksModel.validationError,
      },
    },
    async ({ query }) => {
      return await BorealisBooksServ.getCatalog(query)
    }
  )

  // GET /borealis/books/filters (Aggregated filters)
  .get(
    '/filters',
    {
      detail: {
        summary: 'Get available book catalog filters',
        description: 'Returns all available filters with counts for books.',
        tags: ['Borealis - Books'],
      },
      response: {
        200: BorealisBooksModel.filtersResponse,
      },
    },
    async () => {
      return await BorealisBooksServ.getFilters()
    }
  )

  // GET /borealis/books/:bookId (Overview details)
  .get(
    '/:bookId',
    {
      params: BorealisBooksModel.param,
      detail: {
        summary: 'Get book overview by ID',
        description: 'Retrieves overview metadata and characters for a book.',
        tags: ['Borealis - Books'],
      },
      response: {
        200: BorealisBooksModel.detailResponse,
        404: BorealisBooksModel.notFoundError,
        422: BorealisBooksModel.validationError,
      },
    },
    async ({ params: { bookId } }) => {
      return await BorealisBooksServ.getById(bookId)
    }
  )

  // POST /borealis/books/:bookId/refresh (Trigger external sync)
  .post(
    '/:bookId/refresh',
    {
      params: BorealisBooksModel.param,
      detail: {
        summary: 'Refresh book from external providers',
        description: 'Syncs or enqueues a background refresh for this book.',
        tags: ['Borealis - Books'],
      },
      response: {
        200: BorealisBooksModel.refreshResponse,
        404: BorealisBooksModel.notFoundError,
        422: BorealisBooksModel.validationError,
      },
    },
    async ({ params: { bookId } }) => {
      return await BorealisBooksServ.refresh(bookId)
    }
  )

  // GET /borealis/books/:bookId/similar (24 most similar books)

const routes2 = new Elysia()
  .use(session())

  .get(
    '/:bookId/similar',
    {
      params: BorealisBooksModel.param,
      detail: {
        summary: 'Get similar books',
        description: 'Returns up to 24 similar books based on shared genres.',
        tags: ['Borealis - Books'],
      },
      response: {
        200: BorealisBooksModel.similarResponse,
        404: BorealisBooksModel.notFoundError,
        422: BorealisBooksModel.validationError,
      },
    },
    async ({ params: { bookId } }) => {
      return await BorealisBooksServ.getSimilar(bookId)
    }
  )

  // GET /borealis/books/:bookId/relations (Media relations)
  .get(
    '/:bookId/relations',
    {
      params: BorealisBooksModel.param,
      detail: {
        summary: 'Get book relations',
        description: 'Returns related media entries across IRIS catalog.',
        tags: ['Borealis - Books'],
      },
      response: {
        200: BorealisBooksModel.relationsResponse,
        404: BorealisBooksModel.notFoundError,
        422: BorealisBooksModel.validationError,
      },
    },
    async ({ params: { bookId } }) => {
      return await BorealisBooksServ.getRelations(bookId)
    }
  )

  // GET /borealis/books/:bookId/characters (Characters)
  .get(
    '/:bookId/characters',
    {
      params: BorealisBooksModel.param,
      detail: {
        summary: 'Get characters for book',
        description: 'Returns all characters associated with this book.',
        tags: ['Borealis - Books'],
      },
      response: {
        200: BorealisBooksModel.charactersResponse,
        404: BorealisBooksModel.notFoundError,
        422: BorealisBooksModel.validationError,
      },
    },
    async ({ params: { bookId } }) => {
      return await BorealisBooksServ.getCharacters(bookId)
    }
  )

  // GET /borealis/books/:bookId/staff (Staff)
  .get(
    '/:bookId/staff',
    {
      params: BorealisBooksModel.param,
      detail: {
        summary: 'Get staff for book',
        description: 'Returns all staff members associated with this book.',
        tags: ['Borealis - Books'],
      },
      response: {
        200: BorealisBooksModel.staffResponse,
        404: BorealisBooksModel.notFoundError,
        422: BorealisBooksModel.validationError,
      },
    },
    async ({ params: { bookId } }) => {
      return await BorealisBooksServ.getStaff(bookId)
    }
  )

  // GET /borealis/books/:bookId/images (Images)

const routes3 = new Elysia()
  .use(session())

  .get(
    '/:bookId/images',
    {
      params: BorealisBooksModel.param,
      detail: {
        summary: 'Get images for book',
        description: 'Returns cover, banner, and extra images for this book.',
        tags: ['Borealis - Books'],
      },
      response: {
        200: BorealisBooksModel.imagesResponse,
        404: BorealisBooksModel.notFoundError,
        422: BorealisBooksModel.validationError,
      },
    },
    async ({ params: { bookId } }) => {
      return await BorealisBooksServ.getImages(bookId)
    }
  )

  // GET /borealis/books/:bookId/stats (Stats)
  .get(
    '/:bookId/stats',
    {
      params: BorealisBooksModel.param,
      detail: {
        summary: 'Get book statistics',
        description: 'Returns score and status distributions, favorites, and popularity.',
        tags: ['Borealis - Books'],
      },
      response: {
        200: BorealisBooksModel.statsResponse,
        404: BorealisBooksModel.notFoundError,
        422: BorealisBooksModel.validationError,
      },
    },
    async ({ params: { bookId } }) => {
      return await BorealisBooksServ.getStats(bookId)
    }
  )

  // GET /borealis/books/:bookId/friends (Friends list entries)
  .get(
    '/:bookId/friends',
    {
      params: BorealisBooksModel.param,
      detail: {
        summary: 'Get friends tracking this book',
        description: 'Returns public list entries for accepted friends tracking this book.',
        tags: ['Borealis - Books'],
      },
      response: {
        200: BorealisBooksModel.friendsResponse,
        404: BorealisBooksModel.notFoundError,
        422: BorealisBooksModel.validationError,
      },
    },
    async ({ params: { bookId }, session: userSession }) => {
      const user = userSession.getUser()
      return await BorealisBooksServ.getFriends(bookId, user?.id)
    }
  )

  // GET /borealis/books/:bookId/people (All public list entries)
  .get(
    '/:bookId/people',
    {
      params: BorealisBooksModel.param,
      query: BorealisBooksModel.peopleQuery,
      detail: {
        summary: 'Get all public users tracking this book',
        description: 'Paginated list of users tracking this book with primary and secondary progress.',
        tags: ['Borealis - Books'],
      },
      response: {
        200: BorealisBooksModel.peopleResponse,
        404: BorealisBooksModel.notFoundError,
        422: BorealisBooksModel.validationError,
      },
    },
    async ({ params: { bookId }, query }) => {
      return await BorealisBooksServ.getPeople(bookId, query)
    }
  )

  // GET /borealis/books/:bookId/recommendations (Recommendations)

const routes4 = new Elysia()
  .use(session())

  .get(
    '/:bookId/recommendations',
    {
      params: BorealisBooksModel.param,
      detail: {
        summary: 'Get recommendations for this book',
        description: 'Returns community recommendations for this book.',
        tags: ['Borealis - Books'],
      },
      response: {
        200: BorealisBooksModel.recommendationsResponse,
        404: BorealisBooksModel.notFoundError,
        422: BorealisBooksModel.validationError,
      },
    },
    async ({ params: { bookId } }) => {
      return await BorealisBooksServ.getRecommendations(bookId)
    }
  )

export const borealisBooks = new Elysia({ prefix: '/borealis/books' })
  .use(routes1)
  .use(routes2)
  .use(routes3)
  .use(routes4)

export default borealisBooks

