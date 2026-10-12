import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { CarinaQcModel } from '../../models/carina/qc.model'
import { CarinaQcServ } from '../../../services/carina/qc.serv'

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
    async ({ query }) => {
      return await CarinaQcServ.checkStatus(query.sessionToken)
    }
  )

export default carinaQc
