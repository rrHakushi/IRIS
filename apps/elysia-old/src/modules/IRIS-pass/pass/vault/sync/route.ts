import { defineRoute, t } from "../../../../../router"

export default defineRoute({
  GET: {
    requireAuth: true,
    schema: {
      query: t.Optional(
        t.Object({
          since: t.Optional(t.String()),
        })
      ),
      response: {
        200: t.Object({
          serverTime: t.String(),
          ciphers: t.Array(
            t.Object({
              id: t.String(),
              type: t.Union([t.Literal("LOGIN"), t.Literal("SSH_KEY")]),
              favorite: t.Boolean(),
              reprompt: t.Union([
                t.Literal("NONE"),
                t.Literal("REQUIRE_MASTER_PASSWORD"),
              ]),
              folderId: t.Nullable(t.String()),
              encryptedTitle: t.String(),
              encryptedData: t.String(),
              deletedAt: t.Nullable(t.String()),
              createdAt: t.String(),
              updatedAt: t.String(),
            })
          ),
          deletedCipherIds: t.Array(t.String()),
          folders: t.Array(
            t.Object({
              id: t.String(),
              encryptedName: t.String(),
              parentId: t.Nullable(t.String()),
              createdAt: t.String(),
              updatedAt: t.String(),
            })
          ),
        }),
      },
    },
    async handler({ session, prisma, query }: any) {
      const user = session.getUser()!
      const sinceDate = query?.since ? new Date(query.since) : null
      const now = new Date()

      // Active or updated ciphers
      const cipherWhere: any = { userId: user.id }
      if (sinceDate && !isNaN(sinceDate.getTime())) {
        cipherWhere.updatedAt = { gte: sinceDate }
      }

      const rawCiphers = await prisma.passCipher.findMany({
        where: cipherWhere,
        orderBy: { updatedAt: "desc" },
      })

      // Active or updated folders
      const folderWhere: any = { userId: user.id }
      if (sinceDate && !isNaN(sinceDate.getTime())) {
        folderWhere.updatedAt = { gte: sinceDate }
      }

      const rawFolders = await prisma.passFolder.findMany({
        where: folderWhere,
        orderBy: { updatedAt: "desc" },
      })

      // Ciphers in trash or deleted
      const deletedCiphers = rawCiphers
        .filter((c: any) => c.deletedAt !== null)
        .map((c: any) => c.id)

      return {
        serverTime: now.toISOString(),
        ciphers: rawCiphers.map((c: any) => ({
          id: c.id,
          type: c.type as "LOGIN" | "SSH_KEY",
          favorite: c.favorite,
          reprompt: c.reprompt as "NONE" | "REQUIRE_MASTER_PASSWORD",
          folderId: c.folderId,
          encryptedTitle: c.encryptedTitle,
          encryptedData: c.encryptedData,
          deletedAt: c.deletedAt ? c.deletedAt.toISOString() : null,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })),
        deletedCipherIds: deletedCiphers,
        folders: rawFolders.map((f: any) => ({
          id: f.id,
          encryptedName: f.encryptedName,
          parentId: f.parentId,
          createdAt: f.createdAt.toISOString(),
          updatedAt: f.updatedAt.toISOString(),
        })),
      }
    },
  },
})
