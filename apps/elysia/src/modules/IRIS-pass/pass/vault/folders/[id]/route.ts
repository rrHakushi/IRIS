import { defineRoute, t } from "../../../../../../router"

export default defineRoute({
  PUT: {
    requireAuth: true,
    schema: {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        encryptedName: t.Optional(t.String({ minLength: 1 })),
        parentId: t.Optional(t.Nullable(t.String())),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          folder: t.Object({
            id: t.String(),
            encryptedName: t.String(),
            parentId: t.Nullable(t.String()),
            createdAt: t.String(),
            updatedAt: t.String(),
          }),
        }),
      },
    },
    async handler({ session, prisma, params, body, set }: any) {
      const user = session.getUser()!

      const existing = await prisma.passFolder.findFirst({
        where: { id: params.id, userId: user.id },
      })

      if (!existing) {
        set.status = 404
        throw new Error("Folder not found")
      }

      const updated = await prisma.passFolder.update({
        where: { id: params.id },
        data: {
          encryptedName: body.encryptedName ?? existing.encryptedName,
          parentId:
            body.parentId !== undefined ? body.parentId : existing.parentId,
        },
      })

      return {
        success: true,
        folder: {
          id: updated.id,
          encryptedName: updated.encryptedName,
          parentId: updated.parentId,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
      }
    },
  },

  DELETE: {
    requireAuth: true,
    schema: {
      params: t.Object({
        id: t.String(),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
        }),
      },
    },
    async handler({ session, prisma, params, set }: any) {
      const user = session.getUser()!

      const existing = await prisma.passFolder.findFirst({
        where: { id: params.id, userId: user.id },
      })

      if (!existing) {
        set.status = 404
        throw new Error("Folder not found")
      }

      // Unassign folderId from ciphers, then delete folder
      await prisma.passCipher.updateMany({
        where: { folderId: params.id },
        data: { folderId: null },
      })

      await prisma.passFolder.delete({
        where: { id: params.id },
      })

      return { success: true }
    },
  },
})
