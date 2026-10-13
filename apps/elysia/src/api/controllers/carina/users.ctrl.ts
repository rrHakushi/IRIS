import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { CarinaUsersModel } from '../../models/carina/users.model'
import { CarinaUsersServ } from '../../../services/carina/users.serv'

export const carinaUsers = new Elysia({ prefix: '/carina/users' })
  .use(session())

  // --- 1. GET /carina/users (Search / list users) ---
  .get(
    '/',
    {
      query: CarinaUsersModel.listUsersQuery,
      detail: {
        summary: 'Search and list public users (10 per page default)',
        tags: ['Carina Users'],
      },
      response: {
        200: CarinaUsersModel.listUsersResponse,
        422: CarinaUsersModel.validationError,
      },
    },
    async ({ query }) => {
      return await CarinaUsersServ.listUsers(query)
    }
  )

  // --- 2. GET /carina/users/me (Return full account info) ---
  .get(
    '/me',
    {
      detail: {
        summary: 'Return full account information for authenticated user',
        tags: ['Carina Users'],
      },
      response: {
        200: CarinaUsersModel.currentUserResponse,
        401: CarinaUsersModel.unauthorizedError,
        404: CarinaUsersModel.notFoundError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaUsersServ.getMe(user.id)
    }
  )

  // --- 3. PATCH /carina/users/me (Update account info, assets, settings) ---
  .patch(
    '/me',
    {
      body: CarinaUsersModel.updateMeBody,
      detail: {
        summary: 'Update account info, profile customization, settings, and assets for authenticated user',
        tags: ['Carina Users'],
      },
      response: {
        200: CarinaUsersModel.updateMeResponse,
        400: CarinaUsersModel.badRequestError,
        401: CarinaUsersModel.unauthorizedError,
        404: CarinaUsersModel.notFoundError,
        422: CarinaUsersModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaUsersServ.updateMe(user.id, body)
    }
  )

  // --- 4. DELETE /carina/users/activity/:id (Delete activity item) ---
  .delete(
    '/activity/:id',
    {
      params: CarinaUsersModel.activityItemParam,
      detail: {
        summary: 'Delete user activity log item by activity ID',
        tags: ['Carina Users'],
      },
      response: {
        200: CarinaUsersModel.deleteActivityResponse,
        401: CarinaUsersModel.unauthorizedError,
        403: CarinaUsersModel.forbiddenError,
        404: CarinaUsersModel.notFoundError,
        422: CarinaUsersModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaUsersServ.deleteActivity(user.id, user.permissions, params.id)
    }
  )

  // --- 5. POST /carina/users/:userId/block (Block user) ---
  .post(
    '/:userId/block',
    {
      params: CarinaUsersModel.userParam,
      detail: {
        summary: 'Block a target user strictly by user ID',
        tags: ['Carina Users'],
      },
      response: {
        200: CarinaUsersModel.blockUserResponse,
        400: CarinaUsersModel.badRequestError,
        401: CarinaUsersModel.unauthorizedError,
        404: CarinaUsersModel.notFoundError,
        422: CarinaUsersModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaUsersServ.blockUser(user.id, params.userId)
    }
  )

  // --- 6. POST /carina/users/:userId/unblock (Unblock user) ---
  .post(
    '/:userId/unblock',
    {
      params: CarinaUsersModel.userParam,
      detail: {
        summary: 'Unblock a target user strictly by user ID',
        tags: ['Carina Users'],
      },
      response: {
        200: CarinaUsersModel.unblockUserResponse,
        401: CarinaUsersModel.unauthorizedError,
        404: CarinaUsersModel.notFoundError,
        422: CarinaUsersModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaUsersServ.unblockUser(user.id, params.userId)
    }
  )

  // --- 7. GET /carina/users/:userId/friendship (Get friendship status with target user) ---
  .get(
    '/:userId/friendship',
    {
      params: CarinaUsersModel.userParam,
      detail: {
        summary: 'Get friendship & social relationship status with target user by user ID',
        tags: ['Carina Users'],
      },
      response: {
        200: CarinaUsersModel.friendshipResponse,
        401: CarinaUsersModel.unauthorizedError,
        404: CarinaUsersModel.notFoundError,
        422: CarinaUsersModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaUsersServ.getFriendshipStatus(user.id, params.userId)
    }
  )

  // --- 8. GET /carina/users/:userId/assets (Get user assets: avatar, banner, decor) ---
  .get(
    '/:userId/assets',
    {
      params: CarinaUsersModel.userParam,
      detail: {
        summary: 'Get public user assets (avatar, banner, decor) strictly by user ID',
        tags: ['Carina Users'],
      },
      response: {
        200: CarinaUsersModel.userAssetsResponse,
        404: CarinaUsersModel.notFoundError,
        422: CarinaUsersModel.validationError,
      },
    },
    async ({ params }) => {
      return await CarinaUsersServ.getUserAssets(params.userId)
    }
  )

  // --- 9. GET /carina/users/:userId/badges (Get user badges) ---
  .get(
    '/:userId/badges',
    {
      params: CarinaUsersModel.userParam,
      detail: {
        summary: 'Get user unlocked badges mapped with full metadata strictly by user ID',
        tags: ['Carina Users'],
      },
      response: {
        200: CarinaUsersModel.userBadgesResponse,
        404: CarinaUsersModel.notFoundError,
        422: CarinaUsersModel.validationError,
      },
    },
    async ({ params }) => {
      return await CarinaUsersServ.getUserBadges(params.userId)
    }
  )

  // --- 10. POST /carina/users/:userId/badges/evaluate (Evaluate badge eligibility) ---
  .post(
    '/:userId/badges/evaluate',
    {
      params: CarinaUsersModel.userParam,
      detail: {
        summary: 'Evaluate and award eligible badge achievements for user by user ID',
        tags: ['Carina Users'],
      },
      response: {
        200: CarinaUsersModel.evaluateBadgesResponse,
        401: CarinaUsersModel.unauthorizedError,
        403: CarinaUsersModel.forbiddenError,
        404: CarinaUsersModel.notFoundError,
        422: CarinaUsersModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaUsersServ.evaluateBadges(
        { id: user.id, permissions: user.permissions },
        params.userId
      )
    }
  )

  // --- 11. GET /carina/users/:userId/activity/:category (Get user activity feed filtered by category) ---
  .get(
    '/:userId/activity/:category',
    {
      params: CarinaUsersModel.activityCategoryParam,
      query: CarinaUsersModel.activityPaginationQuery,
      detail: {
        summary: 'Get user activity feed filtered by category strictly by user ID',
        tags: ['Carina Users'],
      },
      response: {
        200: CarinaUsersModel.activityResponse,
        400: CarinaUsersModel.badRequestError,
        404: CarinaUsersModel.notFoundError,
        422: CarinaUsersModel.validationError,
      },
    },
    async ({ params, query, session: userSession }) => {
      return await CarinaUsersServ.getUserActivityByCategory(
        params.userId,
        params.category,
        query,
        userSession.getUser()
      )
    }
  )

  // --- 12. GET /carina/users/:userId/activity (Get user full activity feed) ---
  .get(
    '/:userId/activity',
    {
      params: CarinaUsersModel.userParam,
      query: CarinaUsersModel.activityPaginationQuery,
      detail: {
        summary: 'Get user full activity stream (10 per page default) strictly by user ID',
        tags: ['Carina Users'],
      },
      response: {
        200: CarinaUsersModel.activityResponse,
        404: CarinaUsersModel.notFoundError,
        422: CarinaUsersModel.validationError,
      },
    },
    async ({ params, query, session: userSession }) => {
      return await CarinaUsersServ.getUserActivity(
        params.userId,
        query,
        userSession.getUser()
      )
    }
  )

  // --- 13. GET /carina/users/:userId/favorites/:category (Get user favorites filtered by category) ---
  .get(
    '/:userId/favorites/:category',
    {
      params: CarinaUsersModel.favoritesCategoryParam,
      query: CarinaUsersModel.activityPaginationQuery,
      detail: {
        summary: 'Get user favorites filtered by category strictly by user ID',
        tags: ['Carina Users'],
      },
      response: {
        200: CarinaUsersModel.favoritesResponse,
        400: CarinaUsersModel.badRequestError,
        404: CarinaUsersModel.notFoundError,
        422: CarinaUsersModel.validationError,
      },
    },
    async ({ params, query }) => {
      return await CarinaUsersServ.getUserFavoritesByCategory(
        params.userId,
        params.category,
        query
      )
    }
  )

  // --- 14. GET /carina/users/:userId/favorites (Get user favorites) ---
  .get(
    '/:userId/favorites',
    {
      params: CarinaUsersModel.userParam,
      query: CarinaUsersModel.activityPaginationQuery,
      detail: {
        summary: 'Get user favorites (10 per page default) strictly by user ID',
        tags: ['Carina Users'],
      },
      response: {
        200: CarinaUsersModel.favoritesResponse,
        404: CarinaUsersModel.notFoundError,
        422: CarinaUsersModel.validationError,
      },
    },
    async ({ params, query }) => {
      return await CarinaUsersServ.getUserFavorites(params.userId, query)
    }
  )

  // --- 15. GET /carina/users/:userId (Get user public profile info) ---
  .get(
    '/:userId',
    {
      params: CarinaUsersModel.userParam,
      detail: {
        summary: 'Get public user profile information strictly by user ID',
        tags: ['Carina Users'],
      },
      response: {
        200: CarinaUsersModel.userProfileResponse,
        404: CarinaUsersModel.notFoundError,
        422: CarinaUsersModel.validationError,
      },
    },
    async ({ params }) => {
      return await CarinaUsersServ.getUserProfile(params.userId)
    }
  )

export default carinaUsers
