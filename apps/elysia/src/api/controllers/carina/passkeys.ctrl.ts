import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { CarinaPasskeysModel } from '../../models/carina/passkeys.model'
import { CarinaPasskeysServ } from '../../../services/carina/passkeys.serv'

export const carinaPasskeys = new Elysia({ prefix: '/carina/auth/twofactor/passkeys' })
  .use(session())

  // GET /carina/auth/twofactor/passkeys
  .get(
    '',
    {
      query: CarinaPasskeysModel.listQuery,
      detail: {
        summary: 'Get all passkeys (10 per page)',
        tags: ['Carina Passkeys'],
      },
      response: {
        200: CarinaPasskeysModel.listResponse,
        401: CarinaPasskeysModel.unauthorizedError,
        422: CarinaPasskeysModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaPasskeysServ.listPasskeys(user.id, query)
    }
  )

  // POST /carina/auth/twofactor/passkeys (challenge)
  .post(
    '',
    {
      detail: {
        summary: 'Create new passkey registration challenge',
        tags: ['Carina Passkeys'],
      },
      response: {
        200: CarinaPasskeysModel.createChallengeResponse,
        401: CarinaPasskeysModel.unauthorizedError,
        404: CarinaPasskeysModel.notFoundError,
      },
    },
    async ({ request, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaPasskeysServ.createRegistrationChallenge(user.id, request)
    }
  )

  // POST /carina/auth/twofactor/passkeys/verify
  .post(
    '/verify',
    {
      body: CarinaPasskeysModel.verifyBody,
      detail: {
        summary: 'Verify passkey registration',
        tags: ['Carina Passkeys'],
      },
      response: {
        200: CarinaPasskeysModel.verifyResponse,
        400: CarinaPasskeysModel.badRequestError,
        401: CarinaPasskeysModel.unauthorizedError,
        404: CarinaPasskeysModel.notFoundError,
        422: CarinaPasskeysModel.validationError,
      },
    },
    async ({ body, request, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaPasskeysServ.verifyRegistration(user.id, body, request)
    }
  )

  // DELETE /carina/auth/twofactor/passkeys/:passkeyId
  .delete(
    '/:passkeyId',
    {
      params: CarinaPasskeysModel.passkeyParams,
      detail: {
        summary: 'Delete passkey',
        tags: ['Carina Passkeys'],
      },
      response: {
        200: CarinaPasskeysModel.deleteResponse,
        401: CarinaPasskeysModel.unauthorizedError,
        404: CarinaPasskeysModel.notFoundError,
        422: CarinaPasskeysModel.validationError,
      },
    },
    async ({ params: { passkeyId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaPasskeysServ.deletePasskey(user.id, passkeyId)
    }
  )

export default carinaPasskeys
