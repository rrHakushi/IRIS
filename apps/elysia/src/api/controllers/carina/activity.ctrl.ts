import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { CarinaActivityModel } from '../../models/carina/activity.model'
import { ActivityServ } from '../../../services/carina/activity.serv'

export const carinaActivity = new Elysia({ prefix: '/carina/activity' })
  .use(session())

  // --- 1. POST /carina/activity (Create a user status post) ---
  .post(
    '',
    {
      body: CarinaActivityModel.createStatusPostBody,
      detail: {
        summary: 'Create a status post on your Carina activity feed',
        tags: ['Carina Activity'],
      },
      response: {
        200: CarinaActivityModel.createStatusPostResponse,
        400: CarinaActivityModel.badRequestError,
        401: CarinaActivityModel.unauthorizedError,
        404: CarinaActivityModel.notFoundError,
        422: CarinaActivityModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await ActivityServ.createStatusPost(user.id, body)
    }
  )

  // --- 2. POST /carina/activity/:id/like (Toggle like on an activity entry) ---
  .post(
    '/:id/like',
    {
      params: CarinaActivityModel.activityParam,
      detail: {
        summary: 'Toggle like on an activity entry',
        tags: ['Carina Activity'],
      },
      response: {
        200: CarinaActivityModel.toggleLikeResponse,
        401: CarinaActivityModel.unauthorizedError,
        403: CarinaActivityModel.forbiddenError,
        404: CarinaActivityModel.notFoundError,
        422: CarinaActivityModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await ActivityServ.toggleLike(user.id, user.permissions, params.id)
    }
  )

  // --- 3. GET /carina/activity/:id/replies (List replies for an activity entry) ---
  .get(
    '/:id/replies',
    {
      params: CarinaActivityModel.activityParam,
      query: CarinaActivityModel.repliesQuery,
      detail: {
        summary: 'List replies for an activity entry',
        tags: ['Carina Activity'],
      },
      response: {
        200: CarinaActivityModel.repliesResponse,
        403: CarinaActivityModel.forbiddenError,
        404: CarinaActivityModel.notFoundError,
        422: CarinaActivityModel.validationError,
      },
    },
    async ({ params, query, session: userSession }) => {
      return await ActivityServ.getReplies(
        params.id,
        query,
        userSession.getUser()
      )
    }
  )

  // --- 4. POST /carina/activity/:id/replies (Post reply on an activity entry) ---
  .post(
    '/:id/replies',
    {
      params: CarinaActivityModel.activityParam,
      body: CarinaActivityModel.createReplyBody,
      detail: {
        summary: 'Add a reply to an activity entry',
        tags: ['Carina Activity'],
      },
      response: {
        200: CarinaActivityModel.createReplyResponse,
        400: CarinaActivityModel.badRequestError,
        401: CarinaActivityModel.unauthorizedError,
        403: CarinaActivityModel.forbiddenError,
        404: CarinaActivityModel.notFoundError,
        422: CarinaActivityModel.validationError,
      },
    },
    async ({ params, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await ActivityServ.createReply(
        user.id,
        user.permissions,
        params.id,
        body
      )
    }
  )

  // --- 5. DELETE /carina/activity/:id/replies/:replyId (Delete reply) ---
  .delete(
    '/:id/replies/:replyId',
    {
      params: CarinaActivityModel.replyParam,
      detail: {
        summary: 'Delete an activity reply',
        tags: ['Carina Activity'],
      },
      response: {
        200: CarinaActivityModel.deleteReplyResponse,
        401: CarinaActivityModel.unauthorizedError,
        403: CarinaActivityModel.forbiddenError,
        404: CarinaActivityModel.notFoundError,
        422: CarinaActivityModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await ActivityServ.deleteReply(
        user.id,
        user.permissions,
        params.id,
        params.replyId
      )
    }
  )

export default carinaActivity

