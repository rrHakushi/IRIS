import { defineRoute, t } from "../../../../../router"

export default defineRoute({
  POST: {
    requireAuth: true,
    schema: {
      body: t.Object({
        folders: t.Array(
          t.Object({
            tempId: t.String(),
            encryptedName: t.String({ minLength: 1 }),
          })
        ),
        ciphers: t.Array(
          t.Object({
            type: t.Union([t.Literal("LOGIN"), t.Literal("SSH_KEY")]),
            encryptedTitle: t.String({ minLength: 1 }),
            encryptedData: t.String({ minLength: 1 }),
            folderTempId: t.Optional(t.Nullable(t.String())),
            favorite: t.Optional(t.Boolean()),
          })
        ),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          importedFoldersCount: t.Number(),
          importedCiphersCount: t.Number(),
        }),
      },
    },
    async handler({ session, prisma, body }: any) {
      const user = session.getUser()!

      // Map tempId to created folder ID
      const folderMap = new Map<string, string>()

      // 1. Create folders in batch
      for (const folderItem of body.folders) {
        const created = await prisma.passFolder.create({
          data: {
            userId: user.id,
            encryptedName: folderItem.encryptedName,
          },
        })
        folderMap.set(folderItem.tempId, created.id)
      }

      // 2. Create ciphers in batch
      let createdCiphersCount = 0
      for (const cipherItem of body.ciphers) {
        const folderId = cipherItem.folderTempId
          ? (folderMap.get(cipherItem.folderTempId) ?? null)
          : null

        await prisma.passCipher.create({
          data: {
            userId: user.id,
            type: cipherItem.type,
            encryptedTitle: cipherItem.encryptedTitle,
            encryptedData: cipherItem.encryptedData,
            folderId,
            favorite: cipherItem.favorite ?? false,
          },
        })
        createdCiphersCount++
      }

      return {
        success: true,
        importedFoldersCount: folderMap.size,
        importedCiphersCount: createdCiphersCount,
      }
    },
  },
})
