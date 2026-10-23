import { createHash } from 'node:crypto'
import { Elysia } from 'elysia'
import { prisma, toDate } from '@IRIS/database'
import { session } from '../../../plugins/session'
import { KiroshiSearchModel } from '../../models/kiroshi/search.model'
import { KiroshiSearchServ } from '../../../services/kiroshi/search.serv'
import { Unauthorized } from '../../../lib/errors'

export const kiroshiSearch = new Elysia({ prefix: '/kiroshi' })
  .use(session())

  // --- 1. GET /kiroshi/search (Web search via SearXNG backend) ---
  .get(
    '/search',
    {
      query: KiroshiSearchModel.searchQuery,
      detail: {
        summary: 'Web search proxying upstream SearXNG with encrypted history and caching',
        tags: ['Kiroshi Search'],
      },
      response: {
        200: KiroshiSearchModel.searchResponse,
        400: KiroshiSearchModel.badRequestError,
        401: KiroshiSearchModel.unauthorizedError,
        422: KiroshiSearchModel.validationError,
        429: KiroshiSearchModel.tooManyRequestsError,
        502: KiroshiSearchModel.badGatewayError,
      },
    },
    async ({ query, session: userSession, request }) => {
      // 1. Resolve user ID via session or ApiKey header
      let authenticatedUserId: string | null = null

      if (userSession.isAuthenticated && userSession.user) {
        authenticatedUserId = userSession.user.id
      } else {
        const authHeader = request.headers.get('authorization') || ''
        const xApiKey = request.headers.get('x-api-key') || request.headers.get('api-key')
        const apiKey =
          xApiKey || (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null)

        if (apiKey) {
          const hash = createHash('sha256').update(apiKey).digest('hex')
          const keyRecord = await prisma.orm.public.ApiKey
            .where({ hash })
            .first()
          if (
            keyRecord &&
            (!keyRecord.expiresAt || toDate(keyRecord.expiresAt).getTime() > Date.now())
          ) {
            authenticatedUserId = keyRecord.userId
          }
        }
      }

      if (!authenticatedUserId) {
        throw new Unauthorized(
          'Authentication required via IRIS session or header (x-api-key / Authorization).'
        )
      }

      return await KiroshiSearchServ.search(authenticatedUserId, query)
    }
  )

  // --- 2. GET /kiroshi/suggestions (Web search autocomplete suggestions) ---
  .get(
    '/suggestions',
    {
      query: KiroshiSearchModel.suggestionsQuery,
      detail: {
        summary: 'Get web search autocomplete suggestions from SearXNG',
        tags: ['Kiroshi Search'],
      },
      response: {
        200: KiroshiSearchModel.suggestionsResponse,
        400: KiroshiSearchModel.badRequestError,
        422: KiroshiSearchModel.validationError,
      },
    },
    async ({ query }) => {
      return await KiroshiSearchServ.getSuggestions(query)
    }
  )

export default kiroshiSearch
