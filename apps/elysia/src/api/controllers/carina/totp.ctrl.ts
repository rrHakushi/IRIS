import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { CarinaTotpModel } from '../../models/carina/totp.model'
import { CarinaTotpServ } from '../../../services/carina/totp.serv'
import { getDomainConfig } from '../../../utils/domain'

export const carinaTotp = new Elysia({ prefix: '/carina/auth/twofactor/totp' })
  .use(session())

  // POST /carina/auth/twofactor/totp/setup
  .post(
    '/setup',
    {
      detail: {
        summary: 'Setup TOTP authenticator app',
        tags: ['Carina Two-Factor TOTP'],
      },
      response: {
        200: CarinaTotpModel.setupResponse,
        401: CarinaTotpModel.unauthorizedError,
        404: CarinaTotpModel.notFoundError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaTotpServ.setupTotp(user.id)
    }
  )

  // POST /carina/auth/twofactor/totp/verify
  .post(
    '/verify',
    {
      body: CarinaTotpModel.verifyBody,
      detail: {
        summary: 'Verify TOTP token',
        tags: ['Carina Two-Factor TOTP'],
      },
      response: {
        200: CarinaTotpModel.verifyResponse,
        400: CarinaTotpModel.badRequestError,
        401: CarinaTotpModel.unauthorizedError,
        404: CarinaTotpModel.notFoundError,
        422: CarinaTotpModel.validationError,
      },
    },
    async ({ body, session: userSession, cookie: { session: sessionCookie } }) => {
      const res = await CarinaTotpServ.verifyTotp(userSession.user?.id, body)
      if (res.token) {
        const { isSecure, cookieDomain } = getDomainConfig()
        sessionCookie.set({
          value: res.token,
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: isSecure,
          maxAge: 365 * 24 * 60 * 60,
          ...(cookieDomain ? { domain: cookieDomain } : {}),
        })
      }
      return res
    }
  )

  // DELETE /carina/auth/twofactor/totp
  .delete(
    '',
    {
      body: CarinaTotpModel.deleteBody,
      detail: {
        summary: 'Remove TOTP authenticator',
        tags: ['Carina Two-Factor TOTP'],
      },
      response: {
        200: CarinaTotpModel.deleteResponse,
        400: CarinaTotpModel.badRequestError,
        401: CarinaTotpModel.unauthorizedError,
        404: CarinaTotpModel.notFoundError,
        422: CarinaTotpModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaTotpServ.deleteTotp(user.id, body)
    }
  )

export default carinaTotp
