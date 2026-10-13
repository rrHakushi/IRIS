import { Elysia } from 'elysia'
import { CarinaOAuthModel } from '../../models/carina/oauth.model'
import { CarinaOAuthServ } from '../../../services/carina/oauth.serv'

export const carinaOAuthDiscovery = new Elysia({ prefix: '/.well-known' })
  // GET /.well-known/openid-configuration
  .get(
    '/openid-configuration',
    {
      detail: {
        summary: 'OpenID Connect discovery document',
        description: 'RFC 8414 & OpenID Connect 1.0 machine-readable discovery metadata.',
        tags: ['OAuth 2.0 Discovery'],
      },
      response: {
        200: CarinaOAuthModel.openidConfigResponse,
      },
    },
    () => {
      return CarinaOAuthServ.getOpenIdConfiguration()
    }
  )

  // GET /.well-known/oauth-authorization-server
  .get(
    '/oauth-authorization-server',
    {
      detail: {
        summary: 'OAuth 2.0 authorization server metadata',
        description: 'RFC 8414 OAuth 2.0 authorization server configuration metadata.',
        tags: ['OAuth 2.0 Discovery'],
      },
      response: {
        200: CarinaOAuthModel.oauthServerConfigResponse,
      },
    },
    () => {
      return CarinaOAuthServ.getOAuthAuthorizationServerMetadata()
    }
  )

export default carinaOAuthDiscovery
