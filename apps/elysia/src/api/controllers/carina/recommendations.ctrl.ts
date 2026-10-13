import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { CarinaRecommendationsModel } from '../../models/carina/recommendations.model'
import { CarinaRecommendationsServ } from '../../../services/carina/recommendations.serv'

export const carinaRecommendations = new Elysia({ prefix: '/carina/recommendations' })
  .use(session())

  // --- 1. POST /carina/recommendations (Submit media recommendation) ---
  .post(
    '/',
    {
      body: CarinaRecommendationsModel.submitBody,
      detail: {
        summary: 'Submit media recommendation strictly by media IDs',
        tags: ['Carina Recommendations'],
      },
      response: {
        200: CarinaRecommendationsModel.submitResponse,
        400: CarinaRecommendationsModel.badRequestError,
        401: CarinaRecommendationsModel.unauthorizedError,
        422: CarinaRecommendationsModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaRecommendationsServ.submitRecommendation(user.id, body)
    }
  )

  // --- 2. GET /carina/recommendations/:type/:id (Get recommendations for media - 10 per page default) ---
  .get(
    '/:type/:id',
    {
      params: CarinaRecommendationsModel.mediaParam,
      query: CarinaRecommendationsModel.listRecommendationsQuery,
      detail: {
        summary: 'Get recommendations for media strictly by media domain and ID (10 per page default)',
        tags: ['Carina Recommendations'],
      },
      response: {
        200: CarinaRecommendationsModel.listRecommendationsResponse,
        400: CarinaRecommendationsModel.badRequestError,
        422: CarinaRecommendationsModel.validationError,
      },
    },
    async ({ params, query, session: userSession }) => {
      const currentUser = userSession.getUser()
      return await CarinaRecommendationsServ.getMediaRecommendations(
        params.type,
        params.id,
        query,
        currentUser?.id
      )
    }
  )

  // --- 3. DELETE /carina/recommendations/:id (Delete recommendation) ---
  .delete(
    '/:id',
    {
      params: CarinaRecommendationsModel.recommendationParam,
      detail: {
        summary: 'Delete recommendation strictly by numerical recommendation ID',
        tags: ['Carina Recommendations'],
      },
      response: {
        200: CarinaRecommendationsModel.deleteResponse,
        401: CarinaRecommendationsModel.unauthorizedError,
        403: CarinaRecommendationsModel.forbiddenError,
        404: CarinaRecommendationsModel.notFoundError,
        422: CarinaRecommendationsModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaRecommendationsServ.deleteRecommendation(
        user,
        params.id
      )
    }
  )

  // --- 4. POST /carina/recommendations/:id/vote (Vote on recommendation) ---
  .post(
    '/:id/vote',
    {
      params: CarinaRecommendationsModel.recommendationParam,
      body: CarinaRecommendationsModel.voteBody,
      detail: {
        summary: 'Vote on recommendation strictly by recommendation ID',
        tags: ['Carina Recommendations'],
      },
      response: {
        200: CarinaRecommendationsModel.voteResponse,
        400: CarinaRecommendationsModel.badRequestError,
        401: CarinaRecommendationsModel.unauthorizedError,
        404: CarinaRecommendationsModel.notFoundError,
        422: CarinaRecommendationsModel.validationError,
      },
    },
    async ({ params, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaRecommendationsServ.voteRecommendation(
        user.id,
        params.id,
        body.voteType
      )
    }
  )

export default carinaRecommendations
