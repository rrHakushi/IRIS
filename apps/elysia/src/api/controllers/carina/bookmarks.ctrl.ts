import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { CarinaBookmarksModel } from '../../models/carina/bookmarks.model'
import { CarinaBookmarksServ } from '../../../services/carina/bookmarks.serv'

export const carinaBookmarks = new Elysia({ prefix: '/carina/bookmarks' })
  .use(session())

  // --- 1. GET /carina/bookmarks (Get user bookmarks - 10 per page default) ---
  .get(
    '/',
    {
      query: CarinaBookmarksModel.listBookmarksQuery,
      detail: {
        summary: 'Get user bookmarks with pagination (10 per page default)',
        tags: ['Carina Bookmarks'],
      },
      response: {
        200: CarinaBookmarksModel.listBookmarksResponse,
        401: CarinaBookmarksModel.unauthorizedError,
        422: CarinaBookmarksModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaBookmarksServ.getBookmarks(user.id, query)
    }
  )

  // --- 2. PUT /carina/bookmarks (Reorder and batch-update bookmarks) ---
  .put(
    '/',
    {
      body: CarinaBookmarksModel.putBookmarksBody,
      detail: {
        summary: 'Reorder and batch-update bookmarks for current user',
        tags: ['Carina Bookmarks'],
      },
      response: {
        200: CarinaBookmarksModel.putBookmarksResponse,
        401: CarinaBookmarksModel.unauthorizedError,
        422: CarinaBookmarksModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaBookmarksServ.putBookmarks(user.id, body)
    }
  )

  // --- 3. POST /carina/bookmarks (Create bookmark) ---
  .post(
    '/',
    {
      body: CarinaBookmarksModel.createBookmarkBody,
      detail: {
        summary: 'Create bookmark for current user',
        tags: ['Carina Bookmarks'],
      },
      response: {
        200: CarinaBookmarksModel.createBookmarkResponse,
        400: CarinaBookmarksModel.badRequestError,
        401: CarinaBookmarksModel.unauthorizedError,
        422: CarinaBookmarksModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaBookmarksServ.createBookmark(user.id, body)
    }
  )

  // --- 3. PATCH /carina/bookmarks/:bookmarkId (Update bookmark) ---
  .patch(
    '/:bookmarkId',
    {
      params: CarinaBookmarksModel.bookmarkParam,
      body: CarinaBookmarksModel.updateBookmarkBody,
      detail: {
        summary: 'Update bookmark strictly by bookmark ID (UUID)',
        tags: ['Carina Bookmarks'],
      },
      response: {
        200: CarinaBookmarksModel.updateBookmarkResponse,
        400: CarinaBookmarksModel.badRequestError,
        401: CarinaBookmarksModel.unauthorizedError,
        403: CarinaBookmarksModel.forbiddenError,
        404: CarinaBookmarksModel.notFoundError,
        422: CarinaBookmarksModel.validationError,
      },
    },
    async ({ params, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaBookmarksServ.updateBookmark(
        user,
        params.bookmarkId,
        body
      )
    }
  )

  // --- 4. DELETE /carina/bookmarks/:bookmarkId (Delete bookmark) ---
  .delete(
    '/:bookmarkId',
    {
      params: CarinaBookmarksModel.bookmarkParam,
      detail: {
        summary: 'Delete bookmark strictly by bookmark ID (UUID)',
        tags: ['Carina Bookmarks'],
      },
      response: {
        200: CarinaBookmarksModel.deleteBookmarkResponse,
        401: CarinaBookmarksModel.unauthorizedError,
        403: CarinaBookmarksModel.forbiddenError,
        404: CarinaBookmarksModel.notFoundError,
        422: CarinaBookmarksModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaBookmarksServ.deleteBookmark(user, params.bookmarkId)
    }
  )

export default carinaBookmarks
