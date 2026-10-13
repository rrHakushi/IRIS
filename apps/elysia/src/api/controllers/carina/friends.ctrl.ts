import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { CarinaFriendsModel } from '../../models/carina/friends.model'
import { CarinaFriendsServ } from '../../../services/carina/friends.serv'

export const carinaFriends = new Elysia({ prefix: '/carina/friends' })
  .use(session())

  // --- 1. GET /carina/friends (Get friends list) ---
  .get(
    '/',
    {
      query: CarinaFriendsModel.listFriendsQuery,
      detail: {
        summary: 'Get paginated friends list for authenticated user (10 per page default)',
        tags: ['Carina Friends'],
      },
      response: {
        200: CarinaFriendsModel.listFriendsResponse,
        401: CarinaFriendsModel.unauthorizedError,
        422: CarinaFriendsModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaFriendsServ.listFriends(user.id, query)
    }
  )

  // --- 2. GET /carina/friends/requests (Get pending friend requests) ---
  .get(
    '/requests',
    {
      query: CarinaFriendsModel.listRequestsQuery,
      detail: {
        summary: 'Get pending incoming or outgoing friend requests (10 per page default)',
        tags: ['Carina Friends'],
      },
      response: {
        200: CarinaFriendsModel.listRequestsResponse,
        401: CarinaFriendsModel.unauthorizedError,
        422: CarinaFriendsModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaFriendsServ.listFriendRequests(user.id, query)
    }
  )

  // --- 3. POST /carina/friends/requests (Send friend request) ---
  .post(
    '/requests',
    {
      body: CarinaFriendsModel.sendRequestBody,
      detail: {
        summary: 'Send friend request strictly by target user ID (UUID)',
        tags: ['Carina Friends'],
      },
      response: {
        200: CarinaFriendsModel.sendRequestResponse,
        400: CarinaFriendsModel.badRequestError,
        401: CarinaFriendsModel.unauthorizedError,
        404: CarinaFriendsModel.notFoundError,
        422: CarinaFriendsModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaFriendsServ.sendFriendRequest(user.id, body)
    }
  )

  // --- 4. POST /carina/friends/requests/:requestId/accept (Accept friend request) ---
  .post(
    '/requests/:requestId/accept',
    {
      params: CarinaFriendsModel.requestParam,
      detail: {
        summary: 'Accept incoming friend request by request ID',
        tags: ['Carina Friends'],
      },
      response: {
        200: CarinaFriendsModel.acceptRequestResponse,
        400: CarinaFriendsModel.badRequestError,
        401: CarinaFriendsModel.unauthorizedError,
        404: CarinaFriendsModel.notFoundError,
        422: CarinaFriendsModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaFriendsServ.acceptFriendRequest(user.id, params.requestId)
    }
  )

  // --- 5. POST /carina/friends/requests/:requestId/decline (Decline friend request) ---
  .post(
    '/requests/:requestId/decline',
    {
      params: CarinaFriendsModel.requestParam,
      detail: {
        summary: 'Decline incoming friend request by request ID',
        tags: ['Carina Friends'],
      },
      response: {
        200: CarinaFriendsModel.declineRequestResponse,
        401: CarinaFriendsModel.unauthorizedError,
        404: CarinaFriendsModel.notFoundError,
        422: CarinaFriendsModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaFriendsServ.declineFriendRequest(user.id, params.requestId)
    }
  )

  // --- 6. GET /carina/friends/media/:mediaType/:id (Get friends tracking status for media) ---
  .get(
    '/media/:mediaType/:id',
    {
      params: CarinaFriendsModel.mediaTrackingParam,
      detail: {
        summary: 'Get friends tracking status and score for a specific media item',
        tags: ['Carina Friends'],
      },
      response: {
        200: CarinaFriendsModel.mediaTrackingResponse,
        400: CarinaFriendsModel.badRequestError,
        401: CarinaFriendsModel.unauthorizedError,
        422: CarinaFriendsModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaFriendsServ.getFriendsMediaTracking(
        user.id,
        params.mediaType,
        Number(params.id)
      )
    }
  )

  // --- 7. POST /carina/friends/recommend (Recommend media directly to friend) ---
  .post(
    '/recommend',
    {
      body: CarinaFriendsModel.recommendBody,
      detail: {
        summary: 'Recommend a media title directly to selected friends strictly by user IDs',
        tags: ['Carina Friends'],
      },
      response: {
        200: CarinaFriendsModel.recommendResponse,
        400: CarinaFriendsModel.badRequestError,
        401: CarinaFriendsModel.unauthorizedError,
        422: CarinaFriendsModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaFriendsServ.recommendToFriends(user.id, body)
    }
  )

  // --- 8. DELETE /carina/friends/:friendId (Remove friend) ---
  .delete(
    '/:friendId',
    {
      params: CarinaFriendsModel.friendParam,
      detail: {
        summary: 'Remove bilateral friendship strictly by friend user ID (UUID)',
        tags: ['Carina Friends'],
      },
      response: {
        200: CarinaFriendsModel.deleteFriendResponse,
        401: CarinaFriendsModel.unauthorizedError,
        404: CarinaFriendsModel.notFoundError,
        422: CarinaFriendsModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaFriendsServ.removeFriend(user.id, params.friendId)
    }
  )

  // --- 9. PATCH /carina/friends/:friendId (Update friendship settings) ---
  .patch(
    '/:friendId',
    {
      params: CarinaFriendsModel.friendParam,
      body: CarinaFriendsModel.updateFriendBody,
      detail: {
        summary: 'Update friendship settings (privacy, nickname)',
        tags: ['Carina Friends'],
      },
      response: {
        200: CarinaFriendsModel.updateFriendResponse,
        401: CarinaFriendsModel.unauthorizedError,
        404: CarinaFriendsModel.notFoundError,
        422: CarinaFriendsModel.validationError,
      },
    },
    async ({ params, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaFriendsServ.updateFriend(user.id, params.friendId, body)
    }
  )

  // --- 10. POST /carina/friends/requests/:requestId/respond (Respond to friend request) ---
  .post(
    '/requests/:requestId/respond',
    {
      params: CarinaFriendsModel.requestParam,
      body: CarinaFriendsModel.respondRequestBody,
      detail: {
        summary: 'Respond to friend request (ACCEPT, DECLINE, or BLOCK)',
        tags: ['Carina Friends'],
      },
      response: {
        200: CarinaFriendsModel.respondRequestResponse,
        400: CarinaFriendsModel.badRequestError,
        401: CarinaFriendsModel.unauthorizedError,
        404: CarinaFriendsModel.notFoundError,
        422: CarinaFriendsModel.validationError,
      },
    },
    async ({ params, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaFriendsServ.respondFriendRequest(user.id, params.requestId, body.action)
    }
  )

  // --- 11. DELETE /carina/friends/requests/:requestId (Cancel outgoing friend request) ---
  .delete(
    '/requests/:requestId',
    {
      params: CarinaFriendsModel.requestParam,
      detail: {
        summary: 'Cancel outgoing pending friend request',
        tags: ['Carina Friends'],
      },
      response: {
        200: CarinaFriendsModel.cancelRequestResponse,
        401: CarinaFriendsModel.unauthorizedError,
        404: CarinaFriendsModel.notFoundError,
        422: CarinaFriendsModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaFriendsServ.cancelFriendRequest(user.id, params.requestId)
    }
  )

  // --- 12. POST /carina/friends/block (Block user) ---
  .post(
    '/block',
    {
      body: CarinaFriendsModel.blockUserBody,
      detail: {
        summary: 'Block a user by target user ID or username',
        tags: ['Carina Friends'],
      },
      response: {
        200: CarinaFriendsModel.blockUserResponse,
        400: CarinaFriendsModel.badRequestError,
        401: CarinaFriendsModel.unauthorizedError,
        404: CarinaFriendsModel.notFoundError,
        422: CarinaFriendsModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaFriendsServ.blockUser(user.id, body)
    }
  )

  // --- 13. DELETE /carina/friends/block/:blockId (Unblock user) ---
  .delete(
    '/block/:blockId',
    {
      params: CarinaFriendsModel.blockParam,
      detail: {
        summary: 'Unblock user by block ID or blocked user ID',
        tags: ['Carina Friends'],
      },
      response: {
        200: CarinaFriendsModel.unblockUserResponse,
        401: CarinaFriendsModel.unauthorizedError,
        404: CarinaFriendsModel.notFoundError,
        422: CarinaFriendsModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaFriendsServ.unblockUser(user.id, params.blockId)
    }
  )

export default carinaFriends
