import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { CarinaAuthModel } from '../../models/carina/auth.model'
import { CarinaAuthServ } from '../../../services/carina/auth.serv'
import { getDomainConfig } from '../../../utils/domain'

export const carinaAuth = new Elysia({ prefix: '/carina/auth' })
  .use(session())

  // POST /carina/auth/login
  .post(
    '/login',
    {
      body: CarinaAuthModel.loginBody,
      detail: {
        summary: 'User login (JWT / session)',
        tags: ['Carina Auth'],
      },
      response: {
        200: CarinaAuthModel.loginResponse,
        401: CarinaAuthModel.unauthorizedError,
        422: CarinaAuthModel.validationError,
      },
    },
    async ({ body, cookie: { session: sessionCookie } }) => {
      const response = await CarinaAuthServ.login(body)

      // Set session cookie if authenticated
      if (response.token && sessionCookie) {
        const { isSecure, cookieDomain } = getDomainConfig()
        sessionCookie.set({
          value: response.token,
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: isSecure,
          maxAge: 365 * 24 * 60 * 60,
          ...(cookieDomain ? { domain: cookieDomain } : {}),
        })
      }

      return response
    }
  )

  // POST /carina/auth/logout
  .post(
    '/logout',
    {
      detail: {
        summary: 'User logout (clears session cookie)',
        tags: ['Carina Auth'],
      },
      response: {
        200: CarinaAuthModel.logoutResponse,
      },
    },
    async ({ cookie: { session: sessionCookie } }) => {
      sessionCookie?.remove()
      return {
        success: true,
        message: 'Logged out successfully',
      }
    }
  )

  // POST /carina/auth/register
  .post(
    '/register',
    {
      body: CarinaAuthModel.registerBody,
      detail: {
        summary: 'User registration',
        tags: ['Carina Auth'],
      },
      response: {
        200: CarinaAuthModel.registerResponse,
        400: CarinaAuthModel.badRequestError,
        409: CarinaAuthModel.conflictError,
        422: CarinaAuthModel.validationError,
      },
    },
    async ({ body }) => {
      return await CarinaAuthServ.register(body)
    }
  )

  // POST /carina/auth/password/change
  .post(
    '/password/change',
    {
      body: CarinaAuthModel.changePasswordBody,
      detail: {
        summary: 'Change user password',
        tags: ['Carina Auth'],
      },
      response: {
        200: CarinaAuthModel.changePasswordResponse,
        400: CarinaAuthModel.badRequestError,
        401: CarinaAuthModel.unauthorizedError,
        404: CarinaAuthModel.notFoundError,
        422: CarinaAuthModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaAuthServ.changePassword(user.id, body)
    }
  )

  // POST /carina/auth/password/forgot
  .post(
    '/password/forgot',
    {
      body: CarinaAuthModel.forgotPasswordBody,
      detail: {
        summary: 'Request password reset email',
        tags: ['Carina Auth'],
      },
      response: {
        200: CarinaAuthModel.forgotPasswordResponse,
        422: CarinaAuthModel.validationError,
      },
    },
    async ({ body }) => {
      return await CarinaAuthServ.forgotPassword(body)
    }
  )

  // POST /carina/auth/password/reset
  .post(
    '/password/reset',
    {
      body: CarinaAuthModel.resetPasswordBody,
      detail: {
        summary: 'Reset password with token',
        tags: ['Carina Auth'],
      },
      response: {
        200: CarinaAuthModel.resetPasswordResponse,
        400: CarinaAuthModel.badRequestError,
        422: CarinaAuthModel.validationError,
      },
    },
    async ({ body }) => {
      return await CarinaAuthServ.resetPassword(body)
    }
  )

export default carinaAuth
