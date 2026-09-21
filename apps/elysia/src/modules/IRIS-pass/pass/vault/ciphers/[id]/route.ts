import { defineRoute, t } from "../../../../../../router"

export default defineRoute({
  GET: {
    requireAuth: true,
    schema: {
      params: t.Object({
        id: t.String(),
      }),
      response: {
        200: t.Object({
          cipher: t.Object({
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
          }),
        }),
      },
    },
    async handler({ session, prisma, params, set }: any) {
      const user = session.getUser()!

      const cipher = await prisma.passCipher.findFirst({
        where: { id: params.id, userId: user.id },
      })

      if (!cipher) {
        set.status = 404
        throw new Error("Cipher not found")
      }

      return {
        cipher: {
          id: cipher.id,
          type: cipher.type as "LOGIN" | "SSH_KEY",
          favorite: cipher.favorite,
          reprompt: cipher.reprompt as "NONE" | "REQUIRE_MASTER_PASSWORD",
          folderId: cipher.folderId,
          encryptedTitle: cipher.encryptedTitle,
          encryptedData: cipher.encryptedData,
          deletedAt: cipher.deletedAt ? cipher.deletedAt.toISOString() : null,
          createdAt: cipher.createdAt.toISOString(),
          updatedAt: cipher.updatedAt.toISOString(),
        },
      }
    },
  },

  PUT: {
    requireAuth: true,
    schema: {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        type: t.Optional(t.Union([t.Literal("LOGIN"), t.Literal("SSH_KEY")])),
        encryptedTitle: t.Optional(t.String()),
        encryptedData: t.Optional(t.String()),
        folderId: t.Optional(t.Nullable(t.String())),
        favorite: t.Optional(t.Boolean()),
        reprompt: t.Optional(
          t.Union([t.Literal("NONE"), t.Literal("REQUIRE_MASTER_PASSWORD")])
        ),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          cipher: t.Object({
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
          }),
        }),
      },
    },
    async handler({ session, prisma, params, body, set }: any) {
      const user = session.getUser()!

      const existing = await prisma.passCipher.findFirst({
        where: { id: params.id, userId: user.id },
      })

      if (!existing) {
        set.status = 404
        throw new Error("Cipher not found")
      }

      // Strictly overwrite ciphertext - NEVER keep password history
      const updated = await prisma.passCipher.update({
        where: { id: params.id },
        data: {
          encryptedTitle: body.encryptedTitle ?? existing.encryptedTitle,
          encryptedData: body.encryptedData ?? existing.encryptedData,
          folderId:
            body.folderId !== undefined ? body.folderId : existing.folderId,
          favorite:
            body.favorite !== undefined ? body.favorite : existing.favorite,
          reprompt:
            body.reprompt !== undefined ? body.reprompt : existing.reprompt,
        },
      })

      return {
        success: true,
        cipher: {
          id: updated.id,
          type: updated.type as "LOGIN" | "SSH_KEY",
          favorite: updated.favorite,
          reprompt: updated.reprompt as "NONE" | "REQUIRE_MASTER_PASSWORD",
          folderId: updated.folderId,
          encryptedTitle: updated.encryptedTitle,
          encryptedData: updated.encryptedData,
          deletedAt: updated.deletedAt ? updated.deletedAt.toISOString() : null,
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
      query: t.Optional(
        t.Object({
          permanent: t.Optional(t.Boolean()),
        })
      ),
      response: {
        200: t.Object({
          success: t.Boolean(),
          permanent: t.Boolean(),
        }),
      },
    },
    async handler({ session, prisma, params, query, set }: any) {
      const user = session.getUser()!

      const existing = await prisma.passCipher.findFirst({
        where: { id: params.id, userId: user.id },
      })

      if (!existing) {
        set.status = 404
        throw new Error("Cipher not found")
      }

      if (query?.permanent) {
        await prisma.passCipher.delete({
          where: { id: params.id },
        })
        return { success: true, permanent: true }
      } else {
        await prisma.passCipher.update({
          where: { id: params.id },
          data: { deletedAt: new Date() },
        })
        return { success: true, permanent: false }
      }
    },
  },
})
