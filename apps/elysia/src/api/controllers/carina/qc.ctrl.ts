import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { CarinaQcModel } from '../../models/carina/qc.model'
import { CarinaQcServ } from '../../../services/carina/qc.serv'
import { getDomainConfig } from '../../../utils/domain'

export const carinaQc = new Elysia({ prefix: '/carina/auth/qc' })
  .use(session())

  // POST /carina/auth/qc/generate
  .post(
    '/generate',
    {
      body: CarinaQcModel.generateBody,
      detail: {
        summary: 'Generate quick connect session/code',
        tags: ['Carina Quick Connect'],
      },
      response: {
        200: CarinaQcModel.generateResponse,
        422: CarinaQcModel.validationError,
      },
    },
    async ({ body }) => {
      return await CarinaQcServ.generateSession(body)
    }
  )

  // POST /carina/auth/qc/approve
  .post(
    '/approve',
    {
      body: CarinaQcModel.approveBody,
      detail: {
        summary: 'Approve quick connect login',
        tags: ['Carina Quick Connect'],
      },
      response: {
        200: CarinaQcModel.approveResponse,
        400: CarinaQcModel.badRequestError,
        401: CarinaQcModel.unauthorizedError,
        422: CarinaQcModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaQcServ.approveSession(user.id, body)
    }
  )

  // GET /carina/auth/qc/status
  .get(
    '/status',
    {
      query: CarinaQcModel.statusQuery,
      detail: {
        summary: 'Get quick connect session status',
        tags: ['Carina Quick Connect'],
      },
      response: {
        200: CarinaQcModel.statusResponse,
        422: CarinaQcModel.validationError,
      },
    },
    async ({ query, cookie: { session: sessionCookie } }) => {
      const res = await CarinaQcServ.checkStatus(query.sessionToken)
      if (res.status === 'approved' && res.token && sessionCookie) {
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

export default carinaQc
