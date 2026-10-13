import { Elysia, NotFound, ValidationError } from 'elysia'
import { openapi } from '@elysia/openapi'
import { controllers, cors, rateLimiter } from './plugins'
import { isHttpError } from './lib/errors'
import { LogFactory } from '@Iris/logger'

const logger = new LogFactory('Elysia:Server')

export const app = new Elysia({
  strictPath: true,
})
  .use(cors())
  .use(rateLimiter())
  .use(controllers({ logger }))
  .use(openapi())
  .error(({ error, request, set }) => {
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
  .get('/', () => {
    throw new NotFound()
  })

export type App = typeof app

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
      logger.info(`OpenAPI docs available at http://${host}:${port}/openapi`)
    }
  )

  const handleShutdown = async (signal: string) => {
    logger.info(`Worker ${process.pid} received ${signal}, shutting down...`)
    try {
      await app.stop()
    } catch {}
    process.exit(0)
  }

  process.on('SIGTERM', () => handleShutdown('SIGTERM'))
  process.on('SIGINT', () => handleShutdown('SIGINT'))

  return server
}
