import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { cors, resolveAllowedOrigin } from '../../src/plugins/cors'

describe('CORS Plugin Test Suite', () => {
  it('resolves allowed origin rules accurately', () => {
    const req = new Request('http://localhost:4000/test', {
      headers: { origin: 'https://iris.example.com' },
    })

    // Boolean true
    expect(resolveAllowedOrigin(true, 'https://iris.example.com', req, true)).toBe(
      'https://iris.example.com'
    )
    expect(resolveAllowedOrigin(true, null, req, false)).toBe('*')
    expect(resolveAllowedOrigin(true, null, req, true)).toBeNull()

    // Boolean false
    expect(resolveAllowedOrigin(false, 'https://iris.example.com', req, true)).toBeNull()

    // Wildcard with credentials
    expect(resolveAllowedOrigin('*', 'https://iris.example.com', req, true)).toBe(
      'https://iris.example.com'
    )
    expect(resolveAllowedOrigin('*', 'https://iris.example.com', req, false)).toBe('*')

    // RegExp
    const regexMatcher = /^https:\/\/(.*\.)?example\.com$/
    expect(
      resolveAllowedOrigin(regexMatcher, 'https://app.example.com', req, true)
    ).toBe('https://app.example.com')
    expect(
      resolveAllowedOrigin(regexMatcher, 'https://evil.com', req, true)
    ).toBeNull()

    // Array of matchers
    const arrayMatcher = [
      'https://trusted1.com',
      /^https:\/\/.*\.trusted2\.com$/,
      (orig: string) => (orig === 'https://callback.com' ? orig : false),
    ]
    expect(
      resolveAllowedOrigin(arrayMatcher, 'https://trusted1.com', req, true)
    ).toBe('https://trusted1.com')
    expect(
      resolveAllowedOrigin(arrayMatcher, 'https://sub.trusted2.com', req, true)
    ).toBe('https://sub.trusted2.com')
    expect(
      resolveAllowedOrigin(arrayMatcher, 'https://callback.com', req, true)
    ).toBe('https://callback.com')
    expect(
      resolveAllowedOrigin(arrayMatcher, 'https://untrusted.com', req, true)
    ).toBeNull()
  })

  it('handles OPTIONS preflight requests returning 204 with default CORS headers', async () => {
    const app = new Elysia()
      .use(cors())
      .get('/api/resource', () => ({ ok: true }))

    const preflightReq = new Request('http://localhost:4000/api/resource', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://iris.example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
    })

    const res = await app.handle(preflightReq)
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://iris.example.com'
    )
    expect(res.headers.get('access-control-allow-credentials')).toBe('true')
    expect(res.headers.get('access-control-allow-methods')).toContain('GET')
    expect(res.headers.get('access-control-allow-methods')).toContain('POST')
    expect(res.headers.get('access-control-allow-headers')).toBe(
      'Content-Type, Authorization'
    )
    expect(res.headers.get('access-control-max-age')).toBe('86400')
    expect(res.headers.get('vary')).toBe('Origin')
  })

  it('sets CORS response headers on standard GET requests', async () => {
    const app = new Elysia()
      .use(
        cors({
          origin: ['https://iris.app', 'https://admin.iris.app'],
          exposedHeaders: ['X-Custom-Header', 'X-Total-Count'],
        })
      )
      .get('/api/test', () => ({ message: 'success' }))

    const req = new Request('http://localhost:4000/api/test', {
      headers: {
        Origin: 'https://iris.app',
      },
    })

    const res = await app.handle(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe('https://iris.app')
    expect(res.headers.get('access-control-allow-credentials')).toBe('true')
    expect(res.headers.get('access-control-expose-headers')).toBe(
      'X-Custom-Header, X-Total-Count'
    )
    expect(res.headers.get('vary')).toBe('Origin')
  })
})
