import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { AkaromiVaultModel } from '../../models/akaromi/vault.model'
import { AkaromiVaultServ } from '../../../services/akaromi/vault.serv'

export const akaromiVault = new Elysia({ prefix: '/akaromi' })
  .use(session())

  // --- 1. GET /akaromi/sync (Full vault sync state) ---
  .get(
    '/sync',
    {
      query: AkaromiVaultModel.syncQuery,
      detail: {
        summary: 'Full or incremental vault synchronization state',
        tags: ['Akaromi Vault'],
      },
      response: {
        200: AkaromiVaultModel.syncResponse,
        400: AkaromiVaultModel.badRequestError,
        401: AkaromiVaultModel.unauthorizedError,
        422: AkaromiVaultModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await AkaromiVaultServ.syncVault(user.id, query?.since)
    }
  )

  // --- 2. GET /akaromi/export (Export vault data) ---
  .get(
    '/export',
    {
      detail: {
        summary: 'Export complete non-deleted vault data for backup',
        tags: ['Akaromi Vault'],
      },
      response: {
        200: AkaromiVaultModel.exportResponse,
        401: AkaromiVaultModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await AkaromiVaultServ.exportVault(user.id)
    }
  )

  // --- 3. POST /akaromi/import (Import vault data) ---
  .post(
    '/import',
    {
      body: AkaromiVaultModel.importBody,
      detail: {
        summary: 'Import vault folders and ciphers with tempId remapping',
        tags: ['Akaromi Vault'],
      },
      response: {
        200: AkaromiVaultModel.importResponse,
        400: AkaromiVaultModel.badRequestError,
        401: AkaromiVaultModel.unauthorizedError,
        422: AkaromiVaultModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await AkaromiVaultServ.importVault(user.id, body)
    }
  )

export default akaromiVault
