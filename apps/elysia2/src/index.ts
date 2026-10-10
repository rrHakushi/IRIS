import { Elysia, t } from 'elysia'
import { openapi } from '@elysia/openapi'
import { auth } from './modules/auth/auth.ctrl'


export const app = new Elysia({
    strictPath: true

})
    .use(auth)
    .use(openapi())

    .get('/', 'Hello Elysia')

    .listen(process.env.ELYSIA_PORT || 4000)

export type App = typeof app