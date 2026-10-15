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

export default akaromiEncryption
