import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { KiroshiSettingsModel } from '../../models/kiroshi/settings.model'
import { KiroshiSettingsServ } from '../../../services/kiroshi/settings.serv'

export const kiroshiSettings = new Elysia({ prefix: '/kiroshi/settings' })
  .use(session())

  // --- 1. GET /kiroshi/settings (Get search engine settings & preferences) ---
  .get(
    '/',
    {
      detail: {
        summary: 'Get search engine settings and preferences for authenticated user',
        tags: ['Kiroshi Settings'],
      },
      response: {
        200: KiroshiSettingsModel.settingsResponse,
        401: KiroshiSettingsModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await KiroshiSettingsServ.getSettings(user.id)
    }
  )

  // --- 2. PATCH /kiroshi/settings (Update search engine settings & preferences) ---
  .patch(
    '/',
    {
      body: KiroshiSettingsModel.updateSettingsBody,
      detail: {
        summary: 'Update search engine settings and preferences (e.g. historyEnabled)',
        tags: ['Kiroshi Settings'],
      },
      response: {
        200: KiroshiSettingsModel.updateSettingsResponse,
        400: KiroshiSettingsModel.badRequestError,
        401: KiroshiSettingsModel.unauthorizedError,
        422: KiroshiSettingsModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await KiroshiSettingsServ.updateSettings(user.id, body)
    }
  )

export default kiroshiSettings
