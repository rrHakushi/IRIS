import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import {
  createRateLimiter,
  getClientIp,
  rateLimiter,
  resolveRateLimitKey,
} from '../../src/plugins/rate-limiter'

describe('Rate Limiter Plugin Test Suite', () => {
  it('extracts real client IP from Cloudflare, forwarded-for, and real-ip headers', () => {
    // Cloudflare
    const cfReq = new Request('http://localhost:4000/test', {
      headers: { 'cf-connecting-ip': '203.0.113.195' },
    })
    expect(getClientIp(cfReq)).toBe('203.0.113.195')

    // X-Forwarded-For (multi-hop)
    const fwdReq = new Request('http://localhost:4000/test', {
      headers: { 'x-forwarded-for': '198.51.100.4, 10.0.0.1, 172.16.0.1' },
    })
    expect(getClientIp(fwdReq)).toBe('198.51.100.4')

    // X-Real-IP
    const realReq = new Request('http://localhost:4000/test', {
      headers: { 'x-real-ip': '192.0.2.1' },
    })
    expect(getClientIp(realReq)).toBe('192.0.2.1')

    // Default fallback
    const emptyReq = new Request('http://localhost:4000/test')
    expect(getClientIp(emptyReq)).toBe('127.0.0.1')
  })

  it('resolves client identity keys in strict multi-tier hierarchy', () => {
    // 1. Authenticated User
    const userCtx = {
      session: {
        getUser: () => ({ id: 'usr-42' }),
        user: { id: 'usr-42' },
      },
    }
    expect(resolveRateLimitKey(userCtx as any)).toBe('usr:usr-42')

    // 2. API Key header
    const apiKeyReq = new Request('http://localhost:4000/test', {
      headers: { 'x-api-key': 'secret-iris-key' },
    })
    const apiKeyCtx = { request: apiKeyReq }
    expect(resolveRateLimitKey(apiKeyCtx).startsWith('key:')).toBe(true)

    // 3. Device ID
    const devReq = new Request('http://localhost:4000/test', {
      headers: {
        'cf-connecting-ip': '1.2.3.4',
        'x-device-id': 'iphone-15',
      },
    })
    expect(resolveRateLimitKey({ request: devReq })).toBe('dev:1.2.3.4:iphone-15')

    // 4. IP + User-Agent fingerprint
    const uaReq = new Request('http://localhost:4000/test', {
      headers: {
        'cf-connecting-ip': '5.6.7.8',
        'user-agent': 'Mozilla/5.0 IRIS',
      },
    })
    expect(resolveRateLimitKey({ request: uaReq }).startsWith('ip:5.6.7.8:')).toBe(
      true
    )
  })

  it('enforces token bucket limit, sets headers, and returns 429 when exhausted', async () => {
    const app = new Elysia()
      .use(rateLimiter({ capacity: 3, duration: 60000, cost: 1 }))
      .get('/limited', () => ({ ok: true }))

    // Request 1: Allowed (2 remaining)
    const res1 = await app.handle(
      new Request('http://localhost:4000/limited', {
        headers: { 'cf-connecting-ip': '9.9.9.1' },
      })
    )
    expect(res1.status).toBe(200)
    expect(res1.headers.get('ratelimit-limit')).toBe('3')
    expect(res1.headers.get('ratelimit-remaining')).toBe('2')

    // Request 2: Allowed (1 remaining)
    const res2 = await app.handle(
      new Request('http://localhost:4000/limited', {
        headers: { 'cf-connecting-ip': '9.9.9.1' },
      })
    )
    expect(res2.status).toBe(200)
    expect(res2.headers.get('ratelimit-remaining')).toBe('1')

    // Request 3: Allowed (0 remaining)
    const res3 = await app.handle(
      new Request('http://localhost:4000/limited', {
        headers: { 'cf-connecting-ip': '9.9.9.1' },
      })
    )
    expect(res3.status).toBe(200)
    expect(res3.headers.get('ratelimit-remaining')).toBe('0')

    // Request 4: Exceeded -> 429
    const res4 = await app.handle(
      new Request('http://localhost:4000/limited', {
        headers: { 'cf-connecting-ip': '9.9.9.1' },
      })
    )
    expect(res4.status).toBe(429)
    expect(res4.headers.get('ratelimit-remaining')).toBe('0')
    expect(res4.headers.get('retry-after')).toBeDefined()
    const json = (await res4.json()) as any
    expect(json.error).toBe('Too Many Requests')
  })

  it('supports skip condition', async () => {
    const app = new Elysia()
      .use(
        rateLimiter({
          capacity: 1,
          duration: 60000,
          skip: (ctx) =>
            ctx.request?.headers.get('x-internal-admin') === 'true',
        })
      )
      .get('/admin', () => ({ ok: true }))

    for (let i = 0; i < 5; i++) {
      const res = await app.handle(
        new Request('http://localhost:4000/admin', {
          headers: {
            'cf-connecting-ip': '8.8.8.8',
            'x-internal-admin': 'true',
          },
        })
      )
      expect(res.status).toBe(200)
    }
  })
})
