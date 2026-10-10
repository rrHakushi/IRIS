import { Elysia } from 'elysia'

import { Auth } from './auth.serv'
import { AuthModel } from './auth.model'

export const auth = new Elysia({ prefix: '/auth' })
    .post(
        '/sign-in',
        {
            body: AuthModel.signInBody,
            detail: {
                description: "test"
            },
            // response is optional, use to enforce return type
            response: {
                200: AuthModel.signInResponse,
                400: AuthModel.signInInvalid
            }
        },
        async ({ body, cookie: { session } }) => {
            const response = await Auth.signIn(body)

            // Set session cookie
            // (Elysia cookie is proxy, it can never be null/undefined)
            session!.value = response.token

            return response
        },
    )