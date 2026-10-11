// Model define the data structure and validation for the request and response
import { t, type UnwrapSchema } from 'elysia'

export const AuthModel = {
    signInBody: t.Object({
        username: t.String(),
        password: t.String(),
    }),
    signInResponse: t.Object({
        username: t.String(),
        token: t.String(),
    }),
    signInInvalid: t.Literal('Invalid username or password')
} as const

// Optional, cast all model to TypeScript type
export type AuthModel = {
    [k in keyof typeof AuthModel]: UnwrapSchema<typeof AuthModel[k]>
}