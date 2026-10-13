import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test'
import { createHash } from 'node:crypto'
import { Elysia, ValidationError } from 'elysia'
import { kiroshiSearch } from '../../src/api/controllers/kiroshi/search.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { cache } from '../../src/utils/cache'
import { decryptConnectionData } from '@IRIS/connections'
import { prisma } from '@IRIS/database'

// -----------------------------------------------------------------------------
// In-Memory Database Mock
// -----------------------------------------------------------------------------

interface MockUser {
  id: string
  username: string
  email: string
  settings: any
  permissions: number[]
  passwordChangedAt: Date | null
}

interface MockApiKey {
  id: string
  userId: string
  hash: string
  expiresAt: Date | null
}

interface MockSearchHistory {
  id: string
  userId: string
  encryptedQuery: string
  category: string
  createdAt: Date
}

let mockUsers: MockUser[] = []
let mockApiKeys: MockApiKey[] = []
let mockHistories: MockSearchHistory[] = []
let originalFetch: typeof globalThis.fetch

function setupPrismaMock() {
  mockHistories = []
  mockApiKeys = []
  mockUsers = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'alice',
      email: 'alice@example.com',
      settings: { search: { historyEnabled: true } },
      permissions: [],
      passwordChangedAt: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      username: 'bob',
      email: 'bob@example.com',
      settings: { search: { historyEnabled: false } }, // History disabled
      permissions: [],
      passwordChangedAt: null,
    },
  ]

    ; (prisma.user.findUnique as any) = async ({ where }: any) => {
      return mockUsers.find((u) => u.id === where.id) ?? null
    }

    ; (prisma.apiKey.findFirst as any) = async ({ where }: any) => {
      return mockApiKeys.find((k) => k.hash === where.hash) ?? null
    }

    ; (prisma.searchHistory.create as any) = async ({ data }: any) => {
      const created: MockSearchHistory = {
        id: `sh-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        userId: data.userId,
        encryptedQuery: data.encryptedQuery,
        category: data.category || 'general',
        createdAt: new Date(),
      }
      mockHistories.push(created)
      return created
    }

    ; (prisma.searchHistory.deleteMany as any) = async () => {
      return { count: 0 }
    }
}

const app = new Elysia()
  .error(({ error, set }) => {
    if (isHttpError(error)) {
      set.status = error.status
      return error.toResponse()
    }
    if (error instanceof ValidationError) {
      set.status = 422
      return {
        type: 'validation',
        title: 'Unprocessable Content',
        status: 422,
        code: 'validation',
        detail: error.message,
      }
    }
  })
  .use(kiroshiSearch)

describe('Comprehensive Kiroshi Search Test Suite', () => {
  let aliceToken: string
  const ALICE_ID = '00000000-0000-0000-0000-000000000001'
  const BOB_ID = '00000000-0000-0000-0000-000000000002'

  beforeEach(async () => {
    process.env.NEXTAUTH_SECRET = 'test-iris-secret-key-at-least-32-chars!'
    process.env.SEARXNG_URL = 'http://searxng.internal.test:8888'
    await cache.clear()
    setupPrismaMock()
    originalFetch = globalThis.fetch

    aliceToken = await signUserJwt({
      id: ALICE_ID,
      username: 'alice',
      email: 'alice@example.com',
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // ===========================================================================
  // 1. GET /kiroshi/search
  // ===========================================================================

  describe('GET /kiroshi/search', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/kiroshi/search?q=test', { method: 'GET' })
      )
      expect(res.status).toBe(401)
    })

    it('fails (422) when query parameter q is missing', async () => {
      const res = await app.handle(
        new Request('http://localhost/kiroshi/search', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(422)
    })

    it('successfully queries SearXNG, normalizes results, caches response, and saves history', async () => {
      let fetchCallCount = 0

      globalThis.fetch = (async (url: string | URL) => {
        fetchCallCount++
        expect(String(url)).toContain('searxng.internal.test:8888/search')
        expect(String(url)).toContain('q=typescript+compiler')

        return new Response(
          JSON.stringify({
            query: 'typescript compiler',
            number_of_results: 1,
            results: [
              {
                title: 'TypeScript: JavaScript With Syntax For Types',
                url: 'https://www.typescriptlang.org/',
                content: 'TypeScript extends JavaScript by adding types.',
                engine: 'google',
                engines: ['google', 'bing'],
                score: 1.25,
              },
            ],
            infoboxes: [
              {
                infobox: 'Software',
                content: 'Programming language developed by Microsoft',
              },
            ],
            suggestions: ['typescript tutorial', 'typescript handbook'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }) as any

      // First search request
      const res = await app.handle(
        new Request('http://localhost/kiroshi/search?q=typescript%20compiler', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.query).toBe('typescript compiler')
      expect(data.results.length).toBe(1)
      expect(data.results[0].title).toBe('TypeScript: JavaScript With Syntax For Types')
      expect(data.results[0].engine).toBe('google')
      expect(data.infoboxes.length).toBe(1)
      expect(data.suggestions).toContain('typescript tutorial')
      expect(fetchCallCount).toBe(1)

      // Verify search history record was encrypted and saved
      expect(mockHistories.length).toBe(1)
      const decryptedQuery = decryptConnectionData<string>(
        mockHistories[0]!.encryptedQuery,
        ALICE_ID
      )
      expect(decryptedQuery).toBe('typescript compiler')

      // Second identical search request hits query cache (60s TTL)
      const resCached = await app.handle(
        new Request('http://localhost/kiroshi/search?q=typescript%20compiler', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(resCached.status).toBe(200)
      const dataCached = await resCached.json()
      expect(dataCached.query).toBe('typescript compiler')
      // SearXNG fetch was NOT called a second time
      expect(fetchCallCount).toBe(1)
    })

    it('authenticates via API key in x-api-key header', async () => {
      const rawApiKey = 'iris_test_apikey_secret_999'
      const hash = createHash('sha256').update(rawApiKey).digest('hex')

      mockApiKeys.push({
        id: 'key-1',
        userId: ALICE_ID,
        hash,
        expiresAt: null,
      })

      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({
            query: 'via api key',
            results: [{ title: 'API Key Result', url: 'https://example.com', content: 'c' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }) as any

      const res = await app.handle(
        new Request('http://localhost/kiroshi/search?q=via%20api%20key', {
          method: 'GET',
          headers: { 'x-api-key': rawApiKey },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.results[0].title).toBe('API Key Result')
    })

    it('does NOT save search history when isPrivate=true', async () => {
      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({ query: 'private query', results: [] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }) as any

      const res = await app.handle(
        new Request('http://localhost/kiroshi/search?q=private%20query&isPrivate=true', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      expect(mockHistories.length).toBe(0) // No history saved
    })

    it('does NOT save search history when user has historyEnabled=false', async () => {
      const bobToken = await signUserJwt({
        id: BOB_ID,
        username: 'bob',
        email: 'bob@example.com',
      })

      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({ query: 'bob query', results: [] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }) as any

      const res = await app.handle(
        new Request('http://localhost/kiroshi/search?q=bob%20query', {
          method: 'GET',
          headers: { Authorization: `Bearer ${bobToken}` },
        })
      )
      expect(res.status).toBe(200)
      expect(mockHistories.length).toBe(0) // Bob has history disabled
    })

    it('handles SearXNG upstream connection failure with 502 Bad Gateway', async () => {
      globalThis.fetch = (async () => {
        throw new Error('ECONNREFUSED 127.0.0.1:8888')
      }) as any

      const res = await app.handle(
        new Request('http://localhost/kiroshi/search?q=failure%20test', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(502)
      const err = await res.json()
      expect(err.code).toBe('bad-gateway')
    })

    it('handles SearXNG 429 rate limit with 429 Too Many Requests', async () => {
      globalThis.fetch = (async () => {
        return new Response('Rate limit reached', { status: 429 })
      }) as any

      const res = await app.handle(
        new Request('http://localhost/kiroshi/search?q=ratelimit%20test', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(429)
      const err = await res.json()
      expect(err.code).toBe('too-many-requests')
    })
  })

  // ===========================================================================
  // 2. GET /kiroshi/suggestions
  // ===========================================================================

  describe('GET /kiroshi/suggestions', () => {
    it('returns empty suggestions when query is empty string', async () => {
      const res = await app.handle(
        new Request('http://localhost/kiroshi/suggestions?q=', { method: 'GET' })
      )
      expect(res.status).toBe(422) // TypeBox minLength: 1
    })

    it('returns autocomplete suggestions in standard JSON format', async () => {
      globalThis.fetch = (async (url: string | URL) => {
        expect(String(url)).toContain('/autocompleter?q=bun')
        return new Response(
          JSON.stringify(['bun', ['bun js', 'bun test', 'bun install']]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }) as any

      const res = await app.handle(
        new Request('http://localhost/kiroshi/suggestions?q=bun', { method: 'GET' })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.suggestions).toEqual(['bun js', 'bun test', 'bun install'])
    })

    it('returns suggestions in OpenSearch format [query, [suggestions]] when requested', async () => {
      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify(['elysia', ['elysiajs', 'elysia framework']]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }) as any

      const res = await app.handle(
        new Request('http://localhost/kiroshi/suggestions?q=elysia&format=opensearch', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(Array.isArray(data)).toBe(true)
      expect(data[0]).toBe('elysia')
      expect(data[1]).toEqual(['elysiajs', 'elysia framework'])
    })
  })
})
