import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { AkaromiCiphersModel } from '../../models/akaromi/ciphers.model'
import { AkaromiCiphersServ } from '../../../services/akaromi/ciphers.serv'

export const akaromiCiphers = new Elysia({ prefix: '/akaromi/ciphers' })
  .use(session())

  // --- 1. GET /akaromi/ciphers (List vault ciphers with filters) ---
  .get(
    '/',
    {
      query: AkaromiCiphersModel.listCiphersQuery,
      detail: {
        summary: 'Get vault ciphers with optional filters (folder, type, favorite, trash)',
        tags: ['Akaromi Ciphers'],
      },
      response: {
        200: AkaromiCiphersModel.listCiphersResponse,
        400: AkaromiCiphersModel.badRequestError,
        401: AkaromiCiphersModel.unauthorizedError,
        422: AkaromiCiphersModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await AkaromiCiphersServ.listCiphers(user.id, query)
    }
  )

  // --- 2. POST /akaromi/ciphers (Create new cipher entry) ---
  .post(
    '/',
    {
      body: AkaromiCiphersModel.createCipherBody,
      detail: {
        summary: 'Create new vault cipher entry (login credentials or ssh key)',
        tags: ['Akaromi Ciphers'],
      },
      response: {
        200: AkaromiCiphersModel.createCipherResponse,
        400: AkaromiCiphersModel.badRequestError,
        401: AkaromiCiphersModel.unauthorizedError,
        404: AkaromiCiphersModel.notFoundError,
        422: AkaromiCiphersModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await AkaromiCiphersServ.createCipher(user.id, body)
    }
  )

  // --- 3. DELETE /akaromi/ciphers/trash (Permanently empty cipher trash) ---
  // Note: Defined before /:cipherId to prevent parameter route collision.
  .delete(
    '/trash',
    {
      detail: {
        summary: 'Permanently empty all trashed ciphers for the user',
        tags: ['Akaromi Ciphers'],
      },
      response: {
        200: AkaromiCiphersModel.emptyTrashResponse,
        401: AkaromiCiphersModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await AkaromiCiphersServ.emptyTrash(user.id)
    }
  )

  // --- 4. GET /akaromi/ciphers/:cipherId (Get cipher details) ---
  .get(
    '/:cipherId',
    {
      params: AkaromiCiphersModel.cipherParam,
      detail: {
        summary: 'Get cipher details and encrypted payload by ID',
        tags: ['Akaromi Ciphers'],
      },
      response: {
        200: AkaromiCiphersModel.singleCipherResponse,
        400: AkaromiCiphersModel.badRequestError,
        401: AkaromiCiphersModel.unauthorizedError,
        404: AkaromiCiphersModel.notFoundError,
        422: AkaromiCiphersModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await AkaromiCiphersServ.getCipher(user.id, params.cipherId)
    }
  )

  // --- 5. PATCH /akaromi/ciphers/:cipherId (Update cipher entry) ---
  .patch(
    '/:cipherId',
    {
      params: AkaromiCiphersModel.cipherParam,
      body: AkaromiCiphersModel.updateCipherBody,
      detail: {
        summary: 'Update cipher entry (strictly overwrites ciphertext, zero password history)',
        tags: ['Akaromi Ciphers'],
      },
      response: {
        200: AkaromiCiphersModel.updateCipherResponse,
        400: AkaromiCiphersModel.badRequestError,
        401: AkaromiCiphersModel.unauthorizedError,
        404: AkaromiCiphersModel.notFoundError,
        422: AkaromiCiphersModel.validationError,
      },
    },
    async ({ params, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await AkaromiCiphersServ.updateCipher(user.id, params.cipherId, body)
    }
  )

  // --- 6. PUT /akaromi/ciphers/:cipherId (Update cipher entry alias) ---
  .put(
    '/:cipherId',
    {
      params: AkaromiCiphersModel.cipherParam,
      body: AkaromiCiphersModel.updateCipherBody,
      detail: {
        summary: 'Update cipher entry via PUT (strictly overwrites ciphertext)',
        tags: ['Akaromi Ciphers'],
      },
      response: {
        200: AkaromiCiphersModel.updateCipherResponse,
        400: AkaromiCiphersModel.badRequestError,
        401: AkaromiCiphersModel.unauthorizedError,
        404: AkaromiCiphersModel.notFoundError,
        422: AkaromiCiphersModel.validationError,
      },
    },
    async ({ params, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await AkaromiCiphersServ.updateCipher(user.id, params.cipherId, body)
    }
  )

  // --- 7. DELETE /akaromi/ciphers/:cipherId (Move cipher to trash or permanent delete) ---
  .delete(
    '/:cipherId',
    {
      params: AkaromiCiphersModel.cipherParam,
      query: AkaromiCiphersModel.deleteCipherQuery,
      detail: {
        summary: 'Move cipher to trash (or permanently delete if permanent=true)',
        tags: ['Akaromi Ciphers'],
      },
      response: {
        200: AkaromiCiphersModel.deleteCipherResponse,
        400: AkaromiCiphersModel.badRequestError,
        401: AkaromiCiphersModel.unauthorizedError,
        404: AkaromiCiphersModel.notFoundError,
        422: AkaromiCiphersModel.validationError,
      },
    },
    async ({ params, query, session: userSession }) => {
      const user = userSession.requireUser()
      return await AkaromiCiphersServ.deleteCipher(
        user.id,
        params.cipherId,
        query?.permanent ?? false
      )
    }
  )

  // --- 8. POST /akaromi/ciphers/:cipherId/restore (Restore cipher from trash) ---
  .post(
    '/:cipherId/restore',
    {
      params: AkaromiCiphersModel.cipherParam,
      detail: {
        summary: 'Restore cipher from trash bin',
        tags: ['Akaromi Ciphers'],
      },
      response: {
        200: AkaromiCiphersModel.restoreCipherResponse,
        400: AkaromiCiphersModel.badRequestError,
        401: AkaromiCiphersModel.unauthorizedError,
        404: AkaromiCiphersModel.notFoundError,
        422: AkaromiCiphersModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await AkaromiCiphersServ.restoreCipher(user.id, params.cipherId)
    }
  )

export default akaromiCiphers
