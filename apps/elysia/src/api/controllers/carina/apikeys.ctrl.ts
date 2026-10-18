import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { CarinaApiKeysModel } from '../../models/carina/apikeys.model'
import { CarinaApiKeysServ } from '../../../services/carina/apikeys.serv'

export const carinaApiKeys = new Elysia({ prefix: '/carina/auth/apikeys' })
  .use(session())

  // GET /carina/auth/apikeys
  .get(
    '',
    {
      query: CarinaApiKeysModel.listQuery,
      detail: {
        summary: 'Get all API keys (10 per page)',
        tags: ['Carina API Keys'],
      },
      response: {
        200: CarinaApiKeysModel.listResponse,
        401: CarinaApiKeysModel.unauthorizedError,
        422: CarinaApiKeysModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaApiKeysServ.listKeys(user.id, query)
    }
  )

  // POST /carina/auth/apikeys
  .post(
    '',
    {
      body: CarinaApiKeysModel.createBody,
      detail: {
        summary: 'Create API key',
        tags: ['Carina API Keys'],
      },
      response: {
        200: CarinaApiKeysModel.createResponse,
        400: CarinaApiKeysModel.badRequestError,
        401: CarinaApiKeysModel.unauthorizedError,
        422: CarinaApiKeysModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaApiKeysServ.createKey(user.id, body)
    }
  )

  // PATCH /carina/auth/apikeys/:keyId
  .patch(
    '/:keyId',
    {
      params: CarinaApiKeysModel.keyParams,
      body: CarinaApiKeysModel.updateBody,
      detail: {
        summary: 'Update API key',
        tags: ['Carina API Keys'],
      },
      response: {
        200: CarinaApiKeysModel.updateResponse,
        400: CarinaApiKeysModel.badRequestError,
        401: CarinaApiKeysModel.unauthorizedError,
        404: CarinaApiKeysModel.notFoundError,
        422: CarinaApiKeysModel.validationError,
      },
    },
    async ({ params: { keyId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaApiKeysServ.updateKey(user.id, keyId, body)
    }
  )

  // DELETE /carina/auth/apikeys/:keyId
  .delete(
    '/:keyId',
    {
      params: CarinaApiKeysModel.keyParams,
      detail: {
        summary: 'Delete API key',
        tags: ['Carina API Keys'],
      },
      response: {
        200: CarinaApiKeysModel.deleteResponse,
        401: CarinaApiKeysModel.unauthorizedError,
        404: CarinaApiKeysModel.notFoundError,
        422: CarinaApiKeysModel.validationError,
      },
    },
    async ({ params: { keyId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaApiKeysServ.deleteKey(user.id, keyId)
    }
  )

  // POST /carina/auth/apikeys/:keyId/regenerate
  .post(
    '/:keyId/regenerate',
    {
      params: CarinaApiKeysModel.keyParams,
      detail: {
        summary: 'Regenerate API key',
        tags: ['Carina API Keys'],
      },
      response: {
        200: CarinaApiKeysModel.regenerateResponse,
        401: CarinaApiKeysModel.unauthorizedError,
        404: CarinaApiKeysModel.notFoundError,
        422: CarinaApiKeysModel.validationError,
      },
    },
    async ({ params: { keyId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaApiKeysServ.regenerateKey(user.id, keyId)
    }
  )

export default carinaApiKeys
