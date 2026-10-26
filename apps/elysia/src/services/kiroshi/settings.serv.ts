import { prisma } from '@IRIS/database'
import { NotFound } from '../../lib/errors'

export class KiroshiSettingsServ {
  /**
   * Retrieves search engine settings and preferences for the user.
   */
  public static async getSettings(userId: string) {
    const dbUser = await prisma.orm.public.User
      .select('settings')
      .first({ id: userId })

    if (!dbUser) {
      throw new NotFound('User not found.')
    }

    const rawSettings = (dbUser.settings as Record<string, any>) || {}
    const searchSettings = rawSettings.search || {}

    return {
      success: true,
      settings: {
        historyEnabled: searchSettings.historyEnabled !== false,
      },
    }
  }

  /**
   * Updates search engine settings and preferences for the user.
   */
  public static async updateSettings(
    userId: string,
    body: { historyEnabled: boolean }
  ) {
    const dbUser = await prisma.orm.public.User
      .select('settings')
      .first({ id: userId })

    if (!dbUser) {
      throw new NotFound('User not found.')
    }

    const currentSettings = (dbUser.settings as Record<string, any>) || {}
    const updatedSearch = {
      ...((currentSettings.search as Record<string, any>) || {}),
      historyEnabled: body.historyEnabled,
    }

    const newSettings = {
      ...currentSettings,
      search: updatedSearch,
    }

    await prisma.orm.public.User
      .where({ id: userId })
      .update({ settings: newSettings })

    return {
      success: true,
      settings: {
        historyEnabled: body.historyEnabled,
      },
    }
  }
}
