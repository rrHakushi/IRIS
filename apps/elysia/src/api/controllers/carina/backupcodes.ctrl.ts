import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { CarinaBackupCodesModel } from '../../models/carina/backupcodes.model'
import { CarinaBackupCodesServ } from '../../../services/carina/backupcodes.serv'

export const carinaBackupCodes = new Elysia({ prefix: '/carina/auth/twofactor/backupcodes' })
  .use(session())

  // POST /carina/auth/twofactor/backupcodes/generate
  .post(
    '/generate',
    {
      detail: {
        summary: 'Generate initial backup codes',
        tags: ['Carina Two-Factor Backup Codes'],
      },
      response: {
        200: CarinaBackupCodesModel.generateResponse,
        400: CarinaBackupCodesModel.badRequestError,
        401: CarinaBackupCodesModel.unauthorizedError,
        404: CarinaBackupCodesModel.notFoundError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaBackupCodesServ.generateCodes(user.id)
    }
  )

  // POST /carina/auth/twofactor/backupcodes/regenerate
  .post(
    '/regenerate',
    {
      detail: {
        summary: 'Regenerate backup codes',
        tags: ['Carina Two-Factor Backup Codes'],
      },
      response: {
        200: CarinaBackupCodesModel.regenerateResponse,
        400: CarinaBackupCodesModel.badRequestError,
        401: CarinaBackupCodesModel.unauthorizedError,
        404: CarinaBackupCodesModel.notFoundError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaBackupCodesServ.regenerateCodes(user.id)
    }
  )

  // POST /carina/auth/twofactor/backupcodes/verify
  .post(
    '/verify',
    {
      body: CarinaBackupCodesModel.verifyBody,
      detail: {
        summary: 'Verify backup code',
        tags: ['Carina Two-Factor Backup Codes'],
      },
      response: {
        200: CarinaBackupCodesModel.verifyResponse,
        400: CarinaBackupCodesModel.badRequestError,
        401: CarinaBackupCodesModel.unauthorizedError,
        404: CarinaBackupCodesModel.notFoundError,
        422: CarinaBackupCodesModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaBackupCodesServ.verifyCode(user.id, body)
    }
  )

export default carinaBackupCodes
