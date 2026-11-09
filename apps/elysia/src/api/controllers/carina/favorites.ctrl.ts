import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { CarinaFavoritesModel } from '../../models/carina/favorites.model'
import { CarinaUsersModel } from '../../models/carina/users.model'
import { CarinaFavoritesServ } from '../../../services/carina/favorites.serv'
import { CarinaUsersServ } from '../../../services/carina/users.serv'

export const carinaFavorites = new Elysia({ prefix: '/carina/favorites' })
  .use(session())

  // --- 0. GET /carina/favorites/all (Get all favorites across all categories at once) ---
  .get(
    '/all',
    {
      query: CarinaUsersModel.allFavoritesQuery,
      detail: {
        summary: 'Get all user favorites in all categories at once',
        tags: ['Carina Favorites'],
      },
      response: {
        200: CarinaUsersModel.allFavoritesResponse,
        401: CarinaFavoritesModel.unauthorizedError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaUsersServ.getAllUserFavorites(user.id, query)
    }
  )

  // --- 1. POST /carina/favorites (Add media to user favorites) ---
  .post(
    '/',
    {
      body: CarinaFavoritesModel.addFavoriteBody,
      detail: {
        summary: 'Add media or entity to user favorites strictly by IDs',
        tags: ['Carina Favorites'],
      },
      response: {
        200: CarinaFavoritesModel.addFavoriteResponse,
        400: CarinaFavoritesModel.badRequestError,
        401: CarinaFavoritesModel.unauthorizedError,
        422: CarinaFavoritesModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaFavoritesServ.addFavorite(user.id, body)
    }
  )

  // --- 2. GET /carina/favorites/:category/:targetId (Check if target is in favorites) ---
  .get(
    '/:category/:targetId',
    {
      params: CarinaFavoritesModel.favoriteParam,
      detail: {
        summary: 'Check if target is in user favorites strictly by category and target ID',
        tags: ['Carina Favorites'],
      },
      response: {
        200: CarinaFavoritesModel.checkFavoriteResponse,
        400: CarinaFavoritesModel.badRequestError,
        401: CarinaFavoritesModel.unauthorizedError,
        422: CarinaFavoritesModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaFavoritesServ.checkFavorite(
        user.id,
        params.category,
        params.targetId
      )
    }
  )

  // --- 3. DELETE /carina/favorites/:category/:targetId (Remove target from favorites) ---
  .delete(
    '/:category/:targetId',
    {
      params: CarinaFavoritesModel.favoriteParam,
      detail: {
        summary: 'Remove target from user favorites strictly by category and target ID',
        tags: ['Carina Favorites'],
      },
      response: {
        200: CarinaFavoritesModel.removeFavoriteResponse,
        400: CarinaFavoritesModel.badRequestError,
        401: CarinaFavoritesModel.unauthorizedError,
        404: CarinaFavoritesModel.notFoundError,
        422: CarinaFavoritesModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaFavoritesServ.removeFavorite(
        user.id,
        params.category,
        params.targetId
      )
    }
  )

export default carinaFavorites
