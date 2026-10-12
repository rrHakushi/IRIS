import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { CarinaCommentsModel } from '../../models/carina/comments.model'
import { CarinaCommentsServ } from '../../../services/carina/comments.serv'

export const carinaComments = new Elysia({ prefix: '/carina/comments' })
  .use(session())

  // --- 1. GET /carina/comments/user/:userId (Get comments on user profile - 10 per page default) ---
  .get(
    '/user/:userId',
    {
      params: CarinaCommentsModel.userParam,
      query: CarinaCommentsModel.listCommentsQuery,
      detail: {
        summary: 'Get comments on user profile strictly by user ID (10 per page default)',
        tags: ['Carina Comments'],
      },
      response: {
        200: CarinaCommentsModel.listCommentsResponse,
        404: CarinaCommentsModel.notFoundError,
        422: CarinaCommentsModel.validationError,
      },
    },
    async ({ params, query }) => {
      return await CarinaCommentsServ.getProfileComments(params.userId, query)
    }
  )

  // --- 2. POST /carina/comments/user/:userId (Post comment on user profile) ---
  .post(
    '/user/:userId',
    {
      params: CarinaCommentsModel.userParam,
      body: CarinaCommentsModel.createCommentBody,
      detail: {
        summary: 'Post comment on user profile strictly by target user ID',
        tags: ['Carina Comments'],
      },
      response: {
        200: CarinaCommentsModel.createCommentResponse,
        400: CarinaCommentsModel.badRequestError,
        401: CarinaCommentsModel.unauthorizedError,
        404: CarinaCommentsModel.notFoundError,
        422: CarinaCommentsModel.validationError,
      },
    },
    async ({ params, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaCommentsServ.createProfileComment(
        user.id,
        params.userId,
        body
      )
    }
  )

  // --- 3. GET /carina/comments/lists/:userId/:mediaType (Get comments on user list - 10 per page default) ---
  .get(
    '/lists/:userId/:mediaType',
    {
      params: CarinaCommentsModel.listUserParam,
      query: CarinaCommentsModel.listCommentsQuery,
      detail: {
        summary: 'Get comments on user media list strictly by user ID and media domain (10 per page default)',
        tags: ['Carina Comments'],
      },
      response: {
        200: CarinaCommentsModel.listCommentsResponse,
        400: CarinaCommentsModel.badRequestError,
        404: CarinaCommentsModel.notFoundError,
        422: CarinaCommentsModel.validationError,
      },
    },
    async ({ params, query }) => {
      return await CarinaCommentsServ.getListComments(
        params.userId,
        params.mediaType,
        query
      )
    }
  )

  // --- 4. POST /carina/comments/lists/:userId/:mediaType (Post comment on user list) ---
  .post(
    '/lists/:userId/:mediaType',
    {
      params: CarinaCommentsModel.listUserParam,
      body: CarinaCommentsModel.createCommentBody,
      detail: {
        summary: 'Post comment on user media list strictly by target user ID and media domain',
        tags: ['Carina Comments'],
      },
      response: {
        200: CarinaCommentsModel.createCommentResponse,
        400: CarinaCommentsModel.badRequestError,
        401: CarinaCommentsModel.unauthorizedError,
        404: CarinaCommentsModel.notFoundError,
        422: CarinaCommentsModel.validationError,
      },
    },
    async ({ params, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaCommentsServ.createListComment(
        user.id,
        params.userId,
        params.mediaType,
        body
      )
    }
  )

  // --- 5. DELETE /carina/comments/:commentId/reply/:replyId (Delete reply to comment) ---
  .delete(
    '/:commentId/reply/:replyId',
    {
      params: CarinaCommentsModel.replyParam,
      detail: {
        summary: 'Delete reply to comment strictly by reply ID',
        tags: ['Carina Comments'],
      },
      response: {
        200: CarinaCommentsModel.deleteReplyResponse,
        401: CarinaCommentsModel.unauthorizedError,
        403: CarinaCommentsModel.forbiddenError,
        404: CarinaCommentsModel.notFoundError,
        422: CarinaCommentsModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaCommentsServ.deleteReply(
        user,
        params.commentId,
        params.replyId
      )
    }
  )

  // --- 6. POST /carina/comments/:commentId/reply (Reply to comment) ---
  .post(
    '/:commentId/reply',
    {
      params: CarinaCommentsModel.commentParam,
      body: CarinaCommentsModel.createReplyBody,
      detail: {
        summary: 'Post owner reply to comment strictly by comment ID',
        tags: ['Carina Comments'],
      },
      response: {
        200: CarinaCommentsModel.createReplyResponse,
        400: CarinaCommentsModel.badRequestError,
        401: CarinaCommentsModel.unauthorizedError,
        403: CarinaCommentsModel.forbiddenError,
        404: CarinaCommentsModel.notFoundError,
        422: CarinaCommentsModel.validationError,
      },
    },
    async ({ params, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaCommentsServ.createReply(
        user.id,
        params.commentId,
        body
      )
    }
  )

  // --- 7. DELETE /carina/comments/:commentId (Delete comment) ---
  .delete(
    '/:commentId',
    {
      params: CarinaCommentsModel.commentParam,
      detail: {
        summary: 'Delete comment strictly by comment ID (UUID)',
        tags: ['Carina Comments'],
      },
      response: {
        200: CarinaCommentsModel.deleteCommentResponse,
        401: CarinaCommentsModel.unauthorizedError,
        403: CarinaCommentsModel.forbiddenError,
        404: CarinaCommentsModel.notFoundError,
        422: CarinaCommentsModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaCommentsServ.deleteComment(user, params.commentId)
    }
  )

export default carinaComments
