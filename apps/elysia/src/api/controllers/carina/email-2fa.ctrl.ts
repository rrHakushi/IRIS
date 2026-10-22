import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { CarinaEmail2faModel } from '../../models/carina/email-2fa.model'
import { CarinaEmail2faServ } from '../../../services/carina/email-2fa.serv'
import { getDomainConfig } from '../../../utils/domain'

export const carinaEmail2fa = new Elysia({ prefix: '/carina/auth/twofactor/email' })
  .use(session())

  // POST /carina/auth/twofactor/email/setup
  .post(
    '/setup',
    {
      detail: {
        summary: 'Setup 2FA email',
        description:
          'Initiates two-factor email verification by sending a 6-digit confirmation code to the user registered email address.',
        tags: ['Carina Two-Factor Email'],
      },
      response: {
        200: CarinaEmail2faModel.setupResponse,
        400: CarinaEmail2faModel.badRequestError,
        401: CarinaEmail2faModel.unauthorizedError,
        404: CarinaEmail2faModel.notFoundError,
        429: CarinaEmail2faModel.tooManyRequestsError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaEmail2faServ.setupEmail2fa(user.id)
    }
  )

  // POST /carina/auth/twofactor/email/send
  .post(
    '/send',
    {
      body: CarinaEmail2faModel.sendBody,
      detail: {
        summary: 'Send 2FA verification email',
        description:
          'Dispatches a 2FA verification email for either an active login challenge (via mfaTicket) or an authenticated setup resend.',
        tags: ['Carina Two-Factor Email'],
      },
      response: {
        200: CarinaEmail2faModel.sendResponse,
        400: CarinaEmail2faModel.badRequestError,
        401: CarinaEmail2faModel.unauthorizedError,
        404: CarinaEmail2faModel.notFoundError,
        422: CarinaEmail2faModel.validationError,
        429: CarinaEmail2faModel.tooManyRequestsError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.getUser()
      return await CarinaEmail2faServ.sendEmail2fa(user?.id, body)
    }
  )

  // POST /carina/auth/twofactor/email/verify
  .post(
    '/verify',
    {
      body: CarinaEmail2faModel.verifyBody,
      detail: {
        summary: 'Verify 2FA email code',
        description:
          'Verifies a 6-digit email verification code to either complete Email 2FA setup or authenticate a login session.',
        tags: ['Carina Two-Factor Email'],
      },
      response: {
        200: CarinaEmail2faModel.verifyResponse,
        400: CarinaEmail2faModel.badRequestError,
        401: CarinaEmail2faModel.unauthorizedError,
        404: CarinaEmail2faModel.notFoundError,
        422: CarinaEmail2faModel.validationError,
      },
    },
    async ({ body, session: userSession, cookie: { session: sessionCookie } }) => {
      const user = userSession.getUser()
      const res = await CarinaEmail2faServ.verifyEmail2fa(user?.id, body)
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

  // DELETE /carina/auth/twofactor/email
  .delete(
    '',
    {
      body: CarinaEmail2faModel.deleteBody,
      detail: {
        summary: 'Remove 2FA email',
        description:
          'Disables Email two-factor authentication on the authenticated account.',
        tags: ['Carina Two-Factor Email'],
      },
      response: {
        200: CarinaEmail2faModel.deleteResponse,
        400: CarinaEmail2faModel.badRequestError,
        401: CarinaEmail2faModel.unauthorizedError,
        404: CarinaEmail2faModel.notFoundError,
        422: CarinaEmail2faModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaEmail2faServ.deleteEmail2fa(user.id, body)
    }
  )

export default carinaEmail2fa
