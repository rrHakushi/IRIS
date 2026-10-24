import { Elysia } from 'elysia'
import { verifyOAuthStateToken } from '@IRIS/connections'
import { session } from '../../../plugins/session'
import { CarinaConnectionsModel } from '../../models/carina/connections.model'
import { CarinaConnectionsServ } from '../../../services/carina/connections.serv'
import { Unauthorized, BadRequest } from '../../../lib/errors'

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

  // --- 1b. POST /carina/connections (Create connection with API Key / credentials) ---
  .post(
    '/',
    {
      body: CarinaConnectionsModel.createConnectionBody,
      detail: {
        summary: 'Create or update connected account with manual credentials or API Key',
        tags: ['Carina Connections'],
      },
      response: {
        200: CarinaConnectionsModel.createConnectionResponse,
        400: CarinaConnectionsModel.badRequestError,
        401: CarinaConnectionsModel.unauthorizedError,
        422: CarinaConnectionsModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaConnectionsServ.createManualConnection(user.id, body)
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

  // --- 2b. GET /carina/connections/search (Search media via provider proxy) ---
  .get(
    '/search',
    {
      query: CarinaConnectionsModel.searchQuery,
      detail: {
        summary: 'Search media or lookup external item ID via third-party provider proxy',
        tags: ['Carina Connections'],
      },
      response: {
        200: CarinaConnectionsModel.searchResponse,
        400: CarinaConnectionsModel.badRequestError,
        401: CarinaConnectionsModel.unauthorizedError,
        422: CarinaConnectionsModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaConnectionsServ.searchProxy(user.id, query)
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
    async ({ params, query, cookie, session: userSession }) => {
      const user = userSession.requireUser()
      const authResult = await CarinaConnectionsServ.getAuthUrl(
        user.id,
        params.connectionId,
        query
      )

      if (authResult.state && (cookie as any)?.oauth_state) {
        ;(cookie as any).oauth_state.set({
          value: authResult.state,
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 600,
        })
      }

      return authResult
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
    },
    async ({ params, query, cookie, request, session: userSession }) => {
      const cookieState = (cookie as any)?.oauth_state?.value
      const rawState = query.state || cookieState
      const statePayload = rawState ? verifyOAuthStateToken(rawState) : null

      // Check for OAuth error from provider
      if (query.error) {
        if (request.headers.get('accept')?.includes('text/html')) {
          const returnTo = statePayload?.returnTo || 'http://localhost:3000/settings?tab=connections'
          const redirectUrl = new URL(returnTo)
          redirectUrl.searchParams.set('tab', 'connections')
          redirectUrl.searchParams.set('error', query.error_description || query.error)
          return Response.redirect(redirectUrl.toString(), 302)
        }
        throw new BadRequest(query.error_description || query.error)
      }

      const userId = userSession.user?.id || statePayload?.userId
      if (!userId) {
        throw new Unauthorized('Authentication required')
      }

      const effectiveQuery = {
        ...query,
        state: rawState || query.state,
      }

      const result = await CarinaConnectionsServ.handleOAuthCallback(
        userId,
        params.connectionId,
        effectiveQuery
      )

      if ((cookie as any)?.oauth_state) {
        try {
          ;(cookie as any).oauth_state.remove()
        } catch {}
      }

      if (request.headers.get('accept')?.includes('text/html')) {
        const returnTo = statePayload?.returnTo || 'http://localhost:3000/settings?tab=connections'
        const redirectUrl = new URL(returnTo)
        redirectUrl.searchParams.set('tab', 'connections')
        redirectUrl.searchParams.set('connected', params.connectionId.toLowerCase())
        return Response.redirect(redirectUrl.toString(), 302)
      }

      return result
    }
  )

  // --- 4b. GET /carina/connections/callback (Fallback OAuth callback handler) ---
  .get(
    '/callback',
    {
      query: CarinaConnectionsModel.callbackQuery,
      detail: {
        summary: 'Fallback OAuth callback handler to exchange code and persist encrypted tokens',
        tags: ['Carina Connections'],
      },
    },
    async ({ query, cookie, request, session: userSession }) => {
      const cookieState = (cookie as any)?.oauth_state?.value
      const rawState = query.state || cookieState
      const statePayload = rawState ? verifyOAuthStateToken(rawState) : null

      if (query.error) {
        if (request.headers.get('accept')?.includes('text/html')) {
          const returnTo = statePayload?.returnTo || 'http://localhost:3000/settings?tab=connections'
          const redirectUrl = new URL(returnTo)
          redirectUrl.searchParams.set('tab', 'connections')
          redirectUrl.searchParams.set('error', query.error_description || query.error)
          return Response.redirect(redirectUrl.toString(), 302)
        }
        throw new BadRequest(query.error_description || query.error)
      }

      const userId = userSession.user?.id || statePayload?.userId
      if (!userId) {
        throw new Unauthorized('Authentication required')
      }

      const providerKey = statePayload?.provider?.toLowerCase() || 'connection'
      const effectiveQuery = {
        ...query,
        state: rawState || query.state,
      }

      const result = await CarinaConnectionsServ.handleOAuthCallback(
        userId,
        providerKey,
        effectiveQuery
      )

      if ((cookie as any)?.oauth_state) {
        try {
          ;(cookie as any).oauth_state.remove()
        } catch {}
      }

      if (request.headers.get('accept')?.includes('text/html')) {
        const returnTo = statePayload?.returnTo || 'http://localhost:3000/settings?tab=connections'
        const redirectUrl = new URL(returnTo)
        redirectUrl.searchParams.set('tab', 'connections')
        redirectUrl.searchParams.set('connected', providerKey)
        return Response.redirect(redirectUrl.toString(), 302)
      }

      return result
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
