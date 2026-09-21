import { defineRoute, t } from "../../../../../../router"
import { NotFound, Unauthorized } from "../../../../../../utils/errors"
import { BookmarkItemSchema } from "../route"

export const PatchBookmarkBodySchema = t.Object({
  title: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
  url: t.Optional(t.String({ minLength: 1 })),
  icon: t.Optional(t.String()),
  color: t.Optional(t.String()),
  pinned: t.Optional(t.Boolean()),
  appId: t.Optional(t.String()),
  group: t.Optional(t.String()),
  order: t.Optional(t.Number()),
})

export default defineRoute({
  schema: {
    params: t.Object({
      id: t.String(),
    }),
  },

  PATCH: {
    schema: {
      body: PatchBookmarkBodySchema,
      response: {
        200: t.Object({
          success: t.Boolean(),
          bookmark: BookmarkItemSchema,
        }),
      },
    },
    async handler({ params, body, session, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        throw new Unauthorized("Session expired")
      }

      const userId = session.user.id

      const existing = await prisma.bookmark.findFirst({
        where: { id: params.id, userId },
      })

      if (!existing) {
        throw new NotFound("Bookmark not found")
      }

      const updated = await prisma.bookmark.update({
        where: { id: params.id },
        data: {
          ...(body.title !== undefined ? { title: body.title.trim() } : {}),
          ...(body.url !== undefined ? { url: body.url.trim() } : {}),
          ...(body.icon !== undefined ? { icon: body.icon || null } : {}),
          ...(body.color !== undefined ? { color: body.color || null } : {}),
          ...(body.pinned !== undefined
            ? { pinned: Boolean(body.pinned) }
            : {}),
          ...(body.appId !== undefined ? { appId: body.appId || null } : {}),
          ...(body.group !== undefined
            ? { group: body.group.trim() || null }
            : {}),
          ...(body.order !== undefined ? { order: body.order } : {}),
        },
      })

      return {
        success: true,
        bookmark: {
          id: updated.id,
          title: updated.title,
          url: updated.url,
          icon: updated.icon || undefined,
          color: updated.color || undefined,
          pinned: updated.pinned,
          appId: updated.appId || undefined,
          group: updated.group || undefined,
          order: updated.order,
          createdAt: updated.createdAt.toISOString(),
        },
      }
    },
  },

  DELETE: {
    schema: {
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    },
    async handler({ params, session, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        throw new Unauthorized("Session expired")
      }

      const userId = session.user.id

      const existing = await prisma.bookmark.findFirst({
        where: { id: params.id, userId },
      })

      if (!existing) {
        throw new NotFound("Bookmark not found")
      }

      await prisma.bookmark.delete({
        where: { id: params.id },
      })

      return {
        success: true,
        message: "Bookmark deleted",
      }
    },
  },
})
