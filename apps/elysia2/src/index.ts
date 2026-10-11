import { Elysia, NotFound, ValidationError, t } from 'elysia'
import { openapi } from '@elysia/openapi'
import { controllers } from './plugins/controllers'
import { isHttpError, ServiceUnavailable, TooManyRequests } from './lib/errors'
import { LogFactory } from '@Iris/logger'

const logger = new LogFactory("Elysia")

export const app = new Elysia({
    strictPath: true
})
    .use(controllers({ logger }))
    .use(openapi())
    .error(({ error, request, set }) => {
        const { method, url } = request

        // 1. Custom RFC 9457 HttpErrors (4xx, 5xx)
        if (isHttpError(error)) {
            if (error.status >= 500) {
                logger.error(`${method} ${url} -> ${error.status} [${error.code}]: ${error.message}`, error.cause ?? error.stack)
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
            detail: error.message,
        }
    })


    .get('/', () => {
        throw new NotFound()
    })

    .listen(process.env.ELYSIA_PORT || 4000, ({ hostname, port }) => {
        const host = hostname === '0.0.0.0' ? 'localhost' : hostname
        logger.info(`Server started on http://${host}:${port}`)
        logger.info(`OpenAPI docs available at http://${host}:${port}/openapi`)
    })

export type App = typeof app