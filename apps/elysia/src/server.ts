import './lib/typebox'
import { Elysia, NotFound, ValidationError } from 'elysia'
import { openapi } from '@elysia/openapi'
import { cors } from '@elysia/cors'
import { rateLimiter, generateControllersManifest } from './plugins'
import { isHttpError } from './lib/errors'
import { LogFactory } from '@Iris/logger'
import { wsHub } from './services/ws.serv'
import { controllers, type ControllersApp } from './api/controllers.generated'
import { websocket } from 'elysia/websocket'

declare global {
  interface BigInt {
    toJSON(): number | string
  }
}

if (!('toJSON' in BigInt.prototype)) {
  ; (BigInt.prototype as any).toJSON = function () {
    const num = Number(this)
    return Number.isSafeInteger(num) ? num : this.toString()
  }
}

const logger = new LogFactory('Elysia:Server')
const authTimeouts = new WeakMap<object, ReturnType<typeof setTimeout>>()

// In development, auto-sync static controllers manifest when running against source
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  try {
    generateControllersManifest()
  } catch (err: any) {
    logger.warn(`Failed to auto-sync controllers manifest: ${err?.message || err}`)
  }
}

export const app = new Elysia()
  .use(cors())
  .use(rateLimiter())
  .use(controllers as any)
  .use(
    openapi({
      provider: 'scalar',
      scalar: {
        darkMode: true,
      },
      documentation: {
        servers: [

          {
            url: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
            description: 'Direct API url',
          },
          {
            url: `${process.env.NEXT_PUBLIC_URL}/elysia`,
            description: 'Proxied api url thru page url',
          }
        ],
      },
    })
  )
  .use(websocket())
  .ws('/ws', {
    async open(ws: any) {
      const request = ws.request
      let userId: string | null = (ws.query as Record<string, string> | undefined)?.userId ?? null

      if (!userId && request) {
        try {
          const rawUrl = typeof request.url === 'string' ? request.url : ''
          if (rawUrl) {
            const parsedUrl = new URL(rawUrl, 'http://localhost:4000')
            const queryUserId = parsedUrl.searchParams.get('userId')
            if (queryUserId && queryUserId.trim()) {
              userId = queryUserId.trim()
            }
          }
        } catch { }
      }

      if (userId) {
        wsHub.register(ws as any, userId)
        logger.info(`WebSocket connected: user ${userId}`)
        wsHub.send(ws as any, 'auth:success', { userId })
      } else {
        // Allow a 5-second grace period for client to authenticate via auth message frame
        const authTimeout = setTimeout(() => {
          if (!wsHub.hasConnection(ws as any)) {
            try {
              ws.close?.(4401, 'Unauthorized')
            } catch { }
          }
        }, 5000)
        authTimeouts.set(ws, authTimeout)
      }
    },
    message(ws: any, message: any) {
      wsHub.handleMessage(ws as any, message)
    },
    close(ws: any) {
      const authTimeout = authTimeouts.get(ws)
      if (authTimeout) {
        clearTimeout(authTimeout)
        authTimeouts.delete(ws)
      }
      const hadUser = wsHub.hasConnection(ws as any)
      wsHub.unregister(ws as any)
      if (hadUser) {
        logger.info('WebSocket disconnected')
      }
    },
  })
  .onError(({ error, request, set }) => {
    const { method, url } = request

    // 1. Custom RFC 9457 HttpErrors (4xx, 5xx)
    if (isHttpError(error)) {
      if (error.status >= 500) {
        logger.error(
          `${method} ${url} -> ${error.status} [${error.code}]: ${error.message}`,
          error.cause ?? error.stack
        )
      } else {
        logger.warn(`${method} ${url} -> ${error.status} [${error.code}]: ${error.message}`)
      }
      return error.toResponse()
    }

    // 2. TypeBox / Schema Validation errors
    if (error instanceof ValidationError) {
      logger.warn(`${method} ${url} -> 422 [validation]: ${error.message}`)
      set.status = 422
      return {
        type: 'validation',
        title: 'Unprocessable Content',
        status: 422,
        code: 'validation',
        detail: error.message,
      }
    }

    // 3. Built-in 404 Route Not Found
    if (error instanceof NotFound) {
      logger.warn(`${method} ${url} -> 404 [not-found]: Route not found`)
      return error.toResponse()
    }

    // 4. Uncaught server exceptions
    logger.error(`${method} ${url} -> 500 [internal-error]:`, error)
    set.status = 500
    return {
      type: 'internal-server-error',
      title: 'Internal Server Error',
      status: 500,
      code: 'internal-server-error',
      detail: error instanceof Error ? error.message : String(error),
    }
  })

export type App = ControllersApp

/**
 * Starts listening for incoming HTTP connections.
 * Uses reusePort: true for kernel-level multi-threaded connection distribution across cluster workers.
 */
export function startServer(port = Number(process.env.ELYSIA_PORT || 4000)) {
  const server = app.listen(
    {
      port,
      reusePort: true,
    },
    ({ hostname, port }) => {
      const host = hostname === '0.0.0.0' ? 'localhost' : hostname
      logger.info(`Worker ${process.pid} listening on http://${host}:${port}`)
      logger.info(`Worker ${process.pid} loaded ${app.routes.length} routes`)
      logger.info(`OpenAPI docs available at http://${host}:${port}/openapi`)
    }
  )

  const handleShutdown = async (signal: string) => {
    logger.info(`Worker ${process.pid} received ${signal}, shutting down...`)
    try {
      await app.stop()
    } catch { }
    process.exit(0)
  }

  process.on('SIGTERM', () => handleShutdown('SIGTERM'))
  process.on('SIGINT', () => handleShutdown('SIGINT'))

  return server
}
