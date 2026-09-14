import { defineRoute, t } from "../../../../../router"

export default defineRoute({
  GET: {
    requireAuth: true,
    schema: {
      response: {
        200: t.Object({
          folders: t.Array(
            t.Object({
              id: t.String(),
              encryptedName: t.String(),
              parentId: t.Nullable(t.String()),
              cipherCount: t.Number(),
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
        include: {
          _count: {
            select: {
              ciphers: {
                where: { deletedAt: null },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      })

      return {
        folders: folders.map((f: any) => ({
          id: f.id,
          encryptedName: f.encryptedName,
          parentId: f.parentId,
          cipherCount: f._count.ciphers,
          createdAt: f.createdAt.toISOString(),
          updatedAt: f.updatedAt.toISOString(),
        })),
      }
    },
  },

  POST: {
    requireAuth: true,
    schema: {
      body: t.Object({
        encryptedName: t.String({ minLength: 1 }),
        parentId: t.Optional(t.Nullable(t.String())),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          folder: t.Object({
            id: t.String(),
            encryptedName: t.String(),
            parentId: t.Nullable(t.String()),
            cipherCount: t.Number(),
            createdAt: t.String(),
            updatedAt: t.String(),
          }),
        }),
      },
    },
    async handler({ session, prisma, body }: any) {
      const user = session.getUser()!

      const created = await prisma.passFolder.create({
        data: {
          userId: user.id,
          encryptedName: body.encryptedName,
          parentId: body.parentId ?? null,
        },
      })

      return {
        success: true,
        folder: {
          id: created.id,
          encryptedName: created.encryptedName,
          parentId: created.parentId,
          cipherCount: 0,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      }
    },
  },
})
