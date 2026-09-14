import { defineRoute, t } from "../../../../../router"

export default defineRoute({
  GET: {
    requireAuth: true,
    schema: {
      query: t.Optional(
        t.Object({
          folderId: t.Optional(t.String()),
          type: t.Optional(
            t.Union([t.Literal("LOGIN"), t.Literal("SSH_KEY")])
          ),
          favorite: t.Optional(t.Boolean()),
          trash: t.Optional(t.Boolean()),
        })
      ),
      response: {
        200: t.Object({
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
        }),
      },
    },
    async handler({ session, prisma, query }: any) {
      const user = session.getUser()!
      const where: any = { userId: user.id }

      if (typeof query?.trash === "boolean") {
        if (query.trash) {
          where.deletedAt = { not: null }
        } else {
          where.deletedAt = null
        }
      }

      if (query?.folderId) {
        where.folderId = query.folderId
      }
      if (query?.type) {
        where.type = query.type
      }
      if (typeof query?.favorite === "boolean") {
        where.favorite = query.favorite
      }

      const ciphers = await prisma.passCipher.findMany({
        where,
        orderBy: [{ favorite: "desc" }, { updatedAt: "desc" }],
      })

      return {
        ciphers: ciphers.map((c: any) => ({
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
      }
    },
  },

  POST: {
    requireAuth: true,
    schema: {
      body: t.Object({
        type: t.Union([t.Literal("LOGIN"), t.Literal("SSH_KEY")]),
        encryptedTitle: t.String({ minLength: 1 }),
        encryptedData: t.String({ minLength: 1 }),
        folderId: t.Optional(t.Nullable(t.String())),
        favorite: t.Optional(t.Boolean({ default: false })),
        reprompt: t.Optional(
          t.Union([
            t.Literal("NONE"),
            t.Literal("REQUIRE_MASTER_PASSWORD"),
          ])
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
    async handler({ session, prisma, body }: any) {
      const user = session.getUser()!

      const created = await prisma.passCipher.create({
        data: {
          userId: user.id,
          type: body.type,
          encryptedTitle: body.encryptedTitle,
          encryptedData: body.encryptedData,
          folderId: body.folderId ?? null,
          favorite: body.favorite ?? false,
          reprompt: body.reprompt ?? "NONE",
        },
      })

      return {
        success: true,
        cipher: {
          id: created.id,
          type: created.type as "LOGIN" | "SSH_KEY",
          favorite: created.favorite,
          reprompt: created.reprompt as "NONE" | "REQUIRE_MASTER_PASSWORD",
          folderId: created.folderId,
          encryptedTitle: created.encryptedTitle,
          encryptedData: created.encryptedData,
          deletedAt: created.deletedAt ? created.deletedAt.toISOString() : null,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      }
    },
  },
})
