import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { AkaromiEncryptionModel } from '../../models/akaromi/encryption.model'
import { AkaromiEncryptionServ } from '../../../services/akaromi/encryption.serv'

export const akaromiEncryption = new Elysia({ prefix: '/akaromi/encryption' })
  .use(session())

  // --- 1. GET /akaromi/encryption/keys (Get user encryption keys & salt) ---
  .get(
    '/keys',
    {
      detail: {
        summary: 'Get user post-quantum encryption keys and cryptographic salt',
        tags: ['Akaromi Encryption'],
      },
      response: {
        200: AkaromiEncryptionModel.encryptionKeysResponse,
        400: AkaromiEncryptionModel.badRequestError,
        401: AkaromiEncryptionModel.unauthorizedError,
        404: AkaromiEncryptionModel.notFoundError,
        422: AkaromiEncryptionModel.validationError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await AkaromiEncryptionServ.getEncryptionKeys(user.id)
    }
  )

  // --- 2. POST /akaromi/encryption/password (Update encryption vault password) ---
  .post(
    '/password',
    {
      body: AkaromiEncryptionModel.changePasswordBody,
      detail: {
        summary: 'Change or initialize user post-quantum encryption vault password',
        tags: ['Akaromi Encryption'],
      },
      response: {
        200: AkaromiEncryptionModel.changePasswordResponse,
        400: AkaromiEncryptionModel.badRequestError,
        401: AkaromiEncryptionModel.unauthorizedError,
        404: AkaromiEncryptionModel.notFoundError,
        422: AkaromiEncryptionModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await AkaromiEncryptionServ.changeEncryptionPassword(user.id, body)
    }
  )

export default akaromiEncryption
