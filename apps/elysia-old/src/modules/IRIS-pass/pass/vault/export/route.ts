import { defineRoute, t } from "../../../../../router"

export default defineRoute({
  GET: {
    requireAuth: true,
    schema: {
      response: {
        200: t.Object({
          exportedAt: t.String(),
          folders: t.Array(
            t.Object({
              id: t.String(),
              encryptedName: t.String(),
            })
          ),
          ciphers: t.Array(
            t.Object({
              id: t.String(),
              type: t.Union([t.Literal("LOGIN"), t.Literal("SSH_KEY")]),
              favorite: t.Boolean(),
              folderId: t.Nullable(t.String()),
              encryptedTitle: t.String(),
              encryptedData: t.String(),
              createdAt: t.String(),
              updatedAt: t.String(),
            })
          ),
        }),
      },
    },
    async handler({ session, prisma }: any) {
      const user = session.getUser()!

      const folders = await prisma.passFolder.findMany({
        where: { userId: user.id },
        select: { id: true, encryptedName: true },
      })

      const ciphers = await prisma.passCipher.findMany({
        where: { userId: user.id, deletedAt: null },
        select: {
          id: true,
          type: true,
          favorite: true,
          folderId: true,
          encryptedTitle: true,
          encryptedData: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        exportedAt: new Date().toISOString(),
        folders,
        ciphers: ciphers.map((c: any) => ({
          ...c,
          type: c.type as "LOGIN" | "SSH_KEY",
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })),
      }
    },
  },
})
