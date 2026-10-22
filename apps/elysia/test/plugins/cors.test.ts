import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { cors } from '@elysia/cors'

describe('CORS Plugin Test Suite (@elysia/cors)', () => {
  it('resolves allowed origin rules accurately with string, RegExp, and array matchers', async () => {
    const app = new Elysia()
      .use(
        cors({
          origin: [
            'https://trusted1.com',
            /^https:\/\/.*\.trusted2\.com$/,
            (request: Request) => {
              const orig = request.headers.get('origin')
              return orig === 'https://callback.com'
            },
          ],
        })
      )
      .get('/test', () => ({ ok: true }))

    // Exact string match
    const res1 = await app.handle(
      new Request('http://localhost:4000/test', {
        headers: { Origin: 'https://trusted1.com' },
      })
    )
    expect(res1.headers.get('access-control-allow-origin')).toBe('https://trusted1.com')

    // RegExp match
    const res2 = await app.handle(
      new Request('http://localhost:4000/test', {
        headers: { Origin: 'https://sub.trusted2.com' },
      })
    )
    expect(res2.headers.get('access-control-allow-origin')).toBe('https://sub.trusted2.com')

    // Callback match
    const res3 = await app.handle(
      new Request('http://localhost:4000/test', {
        headers: { Origin: 'https://callback.com' },
      })
    )
    expect(res3.headers.get('access-control-allow-origin')).toBe('https://callback.com')

    // Untrusted origin
    const res4 = await app.handle(
      new Request('http://localhost:4000/test', {
        headers: { Origin: 'https://untrusted.com' },
      })
    )
    expect(res4.headers.get('access-control-allow-origin')).toBeNull()
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
    expect(res.headers.get('access-control-allow-methods')).toBe('POST')
    expect(res.headers.get('access-control-allow-headers')).toBe(
      'Content-Type, Authorization'
    )
  })

  it('sets CORS response headers on standard GET requests', async () => {
    const app = new Elysia()
      .use(
        cors({
          origin: ['https://iris.app', 'https://admin.iris.app'],
          exposeHeaders: ['X-Custom-Header', 'X-Total-Count'],
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
    expect(res.headers.get('access-control-expose-headers')).toContain('X-Custom-Header')
    expect(res.headers.get('access-control-expose-headers')).toContain('X-Total-Count')
  })
})
