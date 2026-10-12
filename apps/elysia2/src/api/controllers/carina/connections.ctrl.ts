import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { CarinaConnectionsModel } from '../../models/carina/connections.model'
import { CarinaConnectionsServ } from '../../../services/carina/connections.serv'

export const carinaConnections = new Elysia({ prefix: '/carina/connections' })
  .use(session())

  // --- 1. GET /carina/connections (Get connected accounts - 10 per page default) ---
  .get(
    '/',
    {
      query: CarinaConnectionsModel.listConnectionsQuery,
      detail: {
        summary: 'Get paginated connected accounts for authenticated user (10 per page default)',
        tags: ['Carina Connections'],
      },
      response: {
        200: CarinaConnectionsModel.listConnectionsResponse,
        401: CarinaConnectionsModel.unauthorizedError,
        422: CarinaConnectionsModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaConnectionsServ.listConnections(user.id, query)
    }
  )

  // --- 2. GET /carina/connections/providers (Get available third-party providers) ---
  .get(
    '/providers',
    {
      detail: {
        summary: 'Get available third-party integration providers and capability matrix',
        tags: ['Carina Connections'],
      },
      response: {
        200: CarinaConnectionsModel.listProvidersResponse,
      },
    },
    async () => {
      return CarinaConnectionsServ.listProviders()
    }
  )

  // --- 3. GET /carina/connections/:connectionId/auth (Get OAuth initiation URL for provider) ---
  .get(
    '/:connectionId/auth',
    {
      params: CarinaConnectionsModel.connectionParam,
      query: CarinaConnectionsModel.getAuthUrlQuery,
      detail: {
        summary: 'Get OAuth initiation URL and CSRF state token for target connection or provider',
        tags: ['Carina Connections'],
      },
      response: {
        200: CarinaConnectionsModel.getAuthUrlResponse,
        400: CarinaConnectionsModel.badRequestError,
        401: CarinaConnectionsModel.unauthorizedError,
        404: CarinaConnectionsModel.notFoundError,
        422: CarinaConnectionsModel.validationError,
      },
    },
    async ({ params, query, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaConnectionsServ.getAuthUrl(
        user.id,
        params.connectionId,
        query
      )
    }
  )

  // --- 4. GET /carina/connections/:connectionId/callback (OAuth callback handler) ---
  .get(
    '/:connectionId/callback',
    {
      params: CarinaConnectionsModel.connectionParam,
      query: CarinaConnectionsModel.callbackQuery,
      detail: {
        summary: 'OAuth callback handler to exchange code and persist encrypted tokens',
        tags: ['Carina Connections'],
      },
      response: {
        200: CarinaConnectionsModel.callbackResponse,
        400: CarinaConnectionsModel.badRequestError,
        401: CarinaConnectionsModel.unauthorizedError,
        404: CarinaConnectionsModel.notFoundError,
        422: CarinaConnectionsModel.validationError,
      },
    },
    async ({ params, query, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaConnectionsServ.handleOAuthCallback(
        user.id,
        params.connectionId,
        query
      )
    }
  )

  // --- 5. POST /carina/connections/:connectionId/sync (Trigger manual sync with provider) ---
  .post(
    '/:connectionId/sync',
    {
      params: CarinaConnectionsModel.connectionParam,
      detail: {
        summary: 'Trigger immediate synchronization of library or watchlist from provider',
        tags: ['Carina Connections'],
      },
      response: {
        200: CarinaConnectionsModel.syncResponse,
        401: CarinaConnectionsModel.unauthorizedError,
        404: CarinaConnectionsModel.notFoundError,
        422: CarinaConnectionsModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaConnectionsServ.syncConnection(
        user.id,
        params.connectionId
      )
    }
  )

  // --- 6. POST /carina/connections/:connectionId/test (Test connection to provider) ---
  .post(
    '/:connectionId/test',
    {
      params: CarinaConnectionsModel.connectionParam,
      detail: {
        summary: 'Test connection health and validity against external provider API',
        tags: ['Carina Connections'],
      },
      response: {
        200: CarinaConnectionsModel.testConnectionResponse,
        401: CarinaConnectionsModel.unauthorizedError,
        404: CarinaConnectionsModel.notFoundError,
        422: CarinaConnectionsModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaConnectionsServ.testConnection(
        user.id,
        params.connectionId
      )
    }
  )

  // --- 7. GET /carina/connections/:connectionId (Get connected account info) ---
  .get(
    '/:connectionId',
    {
      params: CarinaConnectionsModel.connectionParam,
      detail: {
        summary: 'Get single connected account info strictly by connection ID (UUID)',
        tags: ['Carina Connections'],
      },
      response: {
        200: CarinaConnectionsModel.singleConnectionResponse,
        401: CarinaConnectionsModel.unauthorizedError,
        404: CarinaConnectionsModel.notFoundError,
        422: CarinaConnectionsModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaConnectionsServ.getConnection(
        user.id,
        params.connectionId
      )
    }
  )

  // --- 8. PATCH /carina/connections/:connectionId (Update connected account settings) ---
  .patch(
    '/:connectionId',
    {
      params: CarinaConnectionsModel.connectionParam,
      body: CarinaConnectionsModel.updateConnectionBody,
      detail: {
        summary: 'Update integration settings or profile info strictly by connection ID (UUID)',
        tags: ['Carina Connections'],
      },
      response: {
        200: CarinaConnectionsModel.updateConnectionResponse,
        401: CarinaConnectionsModel.unauthorizedError,
        404: CarinaConnectionsModel.notFoundError,
        422: CarinaConnectionsModel.validationError,
      },
    },
    async ({ params, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaConnectionsServ.updateConnection(
        user.id,
        params.connectionId,
        body
      )
    }
  )

  // --- 9. DELETE /carina/connections/:connectionId (Disconnect account) ---
  .delete(
    '/:connectionId',
    {
      params: CarinaConnectionsModel.connectionParam,
      detail: {
        summary: 'Disconnect and delete integration record strictly by connection ID (UUID)',
        tags: ['Carina Connections'],
      },
      response: {
        200: CarinaConnectionsModel.deleteConnectionResponse,
        401: CarinaConnectionsModel.unauthorizedError,
        404: CarinaConnectionsModel.notFoundError,
        422: CarinaConnectionsModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaConnectionsServ.deleteConnection(
        user.id,
        params.connectionId
      )
    }
  )

export default carinaConnections
