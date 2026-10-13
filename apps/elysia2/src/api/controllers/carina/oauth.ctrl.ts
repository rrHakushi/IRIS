import { Elysia, t } from 'elysia'
import { session } from '../../../plugins/session'
import { CarinaOAuthModel } from '../../models/carina/oauth.model'
import { CarinaOAuthServ } from '../../../services/carina/oauth.serv'

export const carinaOAuth = new Elysia({ prefix: '/carina/oauth' })
  .use(session())

  // ===========================================================================
  // OAuth 2.0 / OIDC Authorization & Tokens
  // ===========================================================================

  // GET /carina/oauth/authorize
  .get(
    '/authorize',
    {
      query: CarinaOAuthModel.authorizeQuery,
      detail: {
        summary: 'OAuth authorization endpoint (consent / prompt)',
        description: 'Validates client application credentials and returns details for the user consent screen.',
        tags: ['Carina OAuth Provider'],
      },
      response: {
        200: CarinaOAuthModel.authorizeGetResponse,
        400: CarinaOAuthModel.badRequestError,
        404: CarinaOAuthModel.notFoundError,
        422: CarinaOAuthModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.getUser()
      return await CarinaOAuthServ.getAuthorize(query, user)
    }
  )

  // POST /carina/oauth/authorize
  .post(
    '/authorize',
    {
      body: CarinaOAuthModel.authorizeBody,
      detail: {
        summary: 'Process OAuth authorization grant',
        description: 'Records user approval and issues an authorization code redirecting to the application callback.',
        tags: ['Carina OAuth Provider'],
      },
      response: {
        200: CarinaOAuthModel.authorizePostResponse,
        400: CarinaOAuthModel.badRequestError,
        401: CarinaOAuthModel.unauthorizedError,
        404: CarinaOAuthModel.notFoundError,
        422: CarinaOAuthModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaOAuthServ.postAuthorize(body, user)
    }
  )

  // POST /carina/oauth/token
  .post(
    '/token',
    {
      body: CarinaOAuthModel.tokenBody,
      detail: {
        summary: 'Exchange authorization code for token',
        description: 'RFC 6749 Token endpoint supporting authorization_code, refresh_token, and client_credentials grants.',
        tags: ['Carina OAuth Provider'],
      },
      response: {
        200: CarinaOAuthModel.tokenResponse,
        400: CarinaOAuthModel.badRequestError,
        401: CarinaOAuthModel.unauthorizedError,
        422: CarinaOAuthModel.validationError,
      },
    },
    async ({ body, request }) => {
      const authHeader = request.headers.get('authorization')
      return await CarinaOAuthServ.postToken(body, authHeader)
    }
  )

  // GET /carina/oauth/userinfo
  .get(
    '/userinfo',
    {
      detail: {
        summary: 'Get userinfo profile for access token',
        description: 'OpenID Connect UserInfo endpoint returning identity profile claims.',
        tags: ['Carina OAuth Provider'],
      },
      response: {
        200: CarinaOAuthModel.userinfoResponse,
        401: CarinaOAuthModel.unauthorizedError,
        404: CarinaOAuthModel.notFoundError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaOAuthServ.getUserinfo(user)
    }
  )

  // POST /carina/oauth/revoke
  .post(
    '/revoke',
    {
      body: CarinaOAuthModel.revokeBody,
      detail: {
        summary: 'Revoke OAuth token',
        description: 'RFC 7009 Token Revocation endpoint to invalidate access or refresh tokens.',
        tags: ['Carina OAuth Provider'],
      },
      response: {
        200: CarinaOAuthModel.revokeResponse,
        400: CarinaOAuthModel.badRequestError,
        422: CarinaOAuthModel.validationError,
      },
    },
    async ({ body }) => {
      return await CarinaOAuthServ.postRevoke(body)
    }
  )

  // POST /carina/oauth/introspect
  .post(
    '/introspect',
    {
      body: CarinaOAuthModel.introspectBody,
      detail: {
        summary: 'Introspect OAuth token',
        description: 'RFC 7662 Token Introspection endpoint returning token active state, scopes, and identity metadata.',
        tags: ['Carina OAuth Provider'],
      },
      response: {
        200: CarinaOAuthModel.introspectResponse,
        422: CarinaOAuthModel.validationError,
      },
    },
    async ({ body }) => {
      return await CarinaOAuthServ.postIntrospect(body)
    }
  )

  // POST /carina/oauth/register
  .post(
    '/register',
    {
      body: CarinaOAuthModel.registerClientBody,
      detail: {
        summary: 'Dynamic client registration',
        description: 'RFC 7591 Dynamic Client Registration endpoint for automated application registration.',
        tags: ['Carina OAuth Provider'],
      },
      response: {
        200: CarinaOAuthModel.registerClientResponse,
        400: CarinaOAuthModel.badRequestError,
        422: CarinaOAuthModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.getUser()
      return await CarinaOAuthServ.postRegisterClient(body, user)
    }
  )

  // ===========================================================================
  // Developer Apps Management
  // ===========================================================================

  // GET /carina/oauth/apps
  .get(
    '/apps',
    {
      detail: {
        summary: 'List registered OAuth applications',
        description: 'Lists all OAuth client applications registered by the authenticated user.',
        tags: ['Carina OAuth Apps'],
      },
      response: {
        200: CarinaOAuthModel.listAppsResponse,
        401: CarinaOAuthModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaOAuthServ.listApps(user.id)
    }
  )

  // POST /carina/oauth/apps
  .post(
    '/apps',
    {
      body: CarinaOAuthModel.createAppBody,
      detail: {
        summary: 'Create new OAuth application',
        description: 'Registers a new OAuth client application and returns its credentials.',
        tags: ['Carina OAuth Apps'],
      },
      response: {
        200: CarinaOAuthModel.createAppResponse,
        400: CarinaOAuthModel.badRequestError,
        401: CarinaOAuthModel.unauthorizedError,
        422: CarinaOAuthModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaOAuthServ.createApp(user.id, body)
    }
  )

  // GET /carina/oauth/apps/:id
  .get(
    '/apps/:id',
    {
      params: t.Object({
        id: t.String({ description: 'Application database ID or Client ID' }),
      }),
      detail: {
        summary: 'Get OAuth application details',
        description: 'Retrieves metadata for an application owned by the authenticated user.',
        tags: ['Carina OAuth Apps'],
      },
      response: {
        200: CarinaOAuthModel.appDetailsResponse,
        401: CarinaOAuthModel.unauthorizedError,
        404: CarinaOAuthModel.notFoundError,
      },
    },
    async ({ params: { id }, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaOAuthServ.getApp(user.id, id)
    }
  )

  // PATCH /carina/oauth/apps/:id
  .patch(
    '/apps/:id',
    {
      params: t.Object({
        id: t.String({ description: 'Application database ID or Client ID' }),
      }),
      body: CarinaOAuthModel.updateAppBody,
      detail: {
        summary: 'Update OAuth application',
        description: 'Modifies application configuration, redirect URIs, or display information.',
        tags: ['Carina OAuth Apps'],
      },
      response: {
        200: CarinaOAuthModel.appDetailsResponse,
        400: CarinaOAuthModel.badRequestError,
        401: CarinaOAuthModel.unauthorizedError,
        404: CarinaOAuthModel.notFoundError,
        422: CarinaOAuthModel.validationError,
      },
    },
    async ({ params: { id }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaOAuthServ.updateApp(user.id, id, body)
    }
  )

  // DELETE /carina/oauth/apps/:id
  .delete(
    '/apps/:id',
    {
      params: t.Object({
        id: t.String({ description: 'Application database ID or Client ID' }),
      }),
      detail: {
        summary: 'Delete OAuth application',
        description: 'Permanently deletes an OAuth application and revokes all issued tokens.',
        tags: ['Carina OAuth Apps'],
      },
      response: {
        200: CarinaOAuthModel.deleteAppResponse,
        401: CarinaOAuthModel.unauthorizedError,
        404: CarinaOAuthModel.notFoundError,
      },
    },
    async ({ params: { id }, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaOAuthServ.deleteApp(user.id, id)
    }
  )

  // POST /carina/oauth/apps/:id/regenerate-secret
  .post(
    '/apps/:id/regenerate-secret',
    {
      params: t.Object({
        id: t.String({ description: 'Application database ID or Client ID' }),
      }),
      detail: {
        summary: 'Regenerate OAuth application client secret',
        description: 'Invalidates existing client secret and generates a new secret.',
        tags: ['Carina OAuth Apps'],
      },
      response: {
        200: CarinaOAuthModel.regenerateSecretResponse,
        401: CarinaOAuthModel.unauthorizedError,
        404: CarinaOAuthModel.notFoundError,
      },
    },
    async ({ params: { id }, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaOAuthServ.regenerateSecret(user.id, id)
    }
  )

  // ===========================================================================
  // User Authorizations Management
  // ===========================================================================

  // GET /carina/oauth/authorizations
  .get(
    '/authorizations',
    {
      detail: {
        summary: 'List user authorized OAuth applications',
        description: 'Lists all third-party applications the authenticated user has granted access to.',
        tags: ['Carina OAuth Grants'],
      },
      response: {
        200: CarinaOAuthModel.listAuthorizationsResponse,
        401: CarinaOAuthModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaOAuthServ.listAuthorizations(user.id)
    }
  )

  // DELETE /carina/oauth/authorizations/:id
  .delete(
    '/authorizations/:id',
    {
      params: t.Object({
        id: t.String({ description: 'Authorization ID or Client ID to revoke' }),
      }),
      detail: {
        summary: 'Revoke authorized OAuth application',
        description: 'Revokes access for a third-party application and invalidates all associated tokens.',
        tags: ['Carina OAuth Grants'],
      },
      response: {
        200: CarinaOAuthModel.revokeAuthorizationResponse,
        401: CarinaOAuthModel.unauthorizedError,
        404: CarinaOAuthModel.notFoundError,
      },
    },
    async ({ params: { id }, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaOAuthServ.revokeAuthorization(user.id, id)
    }
  )

export default carinaOAuth
