import { defineRoute, t } from "../../../../router"

export default defineRoute({
  GET: {
    requireAuth: true,
    schema: {
      response: {
        200: t.Object({
          success: t.Boolean(),
          settings: t.Object({
            historyEnabled: t.Boolean(),
          }),
        }),
      },
    },
    async handler({ session, prisma }: any) {
      const user = session.getUser()!
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { settings: true },
      })

      const rawSettings = (dbUser?.settings as any) || {}
      const searchSettings = rawSettings.search || {}

      return {
        success: true,
        settings: {
          historyEnabled: searchSettings.historyEnabled !== false,
        },
      }
    },
  },

  PATCH: {
    requireAuth: true,
    schema: {
      body: t.Object({
        historyEnabled: t.Boolean(),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          settings: t.Object({
            historyEnabled: t.Boolean(),
          }),
        }),
      },
    },
    async handler({ body, session, prisma }: any) {
      const user = session.getUser()!
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { settings: true },
      })

      const currentSettings = (dbUser?.settings as Record<string, unknown>) || {}
      const updatedSearch = {
        ...((currentSettings.search as Record<string, unknown>) || {}),
        historyEnabled: body.historyEnabled,
      }

      const newSettings = {
        ...currentSettings,
        search: updatedSearch,
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { settings: newSettings },
      })

      return {
        success: true,
        settings: {
          historyEnabled: body.historyEnabled,
        },
      }
    },
  },
})
