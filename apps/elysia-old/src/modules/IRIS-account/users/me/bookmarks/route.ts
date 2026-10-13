import { defineRoute, t } from "../../../../../router"
import { NotFound, Unauthorized } from "../../../../../utils/errors"
import { getBookmarksCustomization } from "@IRIS/shared"

export const BookmarkItemSchema = t.Object({
  id: t.String(),
  title: t.String({ minLength: 1, maxLength: 120 }),
  url: t.String({ minLength: 1 }),
  icon: t.Optional(t.String()),
  color: t.Optional(t.String()),
  pinned: t.Optional(t.Boolean()),
  appId: t.Optional(t.String()),
  group: t.Optional(t.String()),
  order: t.Optional(t.Number()),
  createdAt: t.Optional(t.String()),
})

export const CreateBookmarkBodySchema = t.Object({
  title: t.String({ minLength: 1, maxLength: 120 }),
  url: t.String({ minLength: 1 }),
  icon: t.Optional(t.String()),
  color: t.Optional(t.String()),
  pinned: t.Optional(t.Boolean()),
  appId: t.Optional(t.String()),
  group: t.Optional(t.String()),
})

export const PutBookmarksBodySchema = t.Object({
  bookmarks: t.Array(BookmarkItemSchema),
})

export default defineRoute({
  GET: {
    schema: {
      response: {
        200: t.Object({
          success: t.Boolean(),
          bookmarks: t.Array(BookmarkItemSchema),
          groups: t.Array(t.String()),
        }),
      },
    },
    async handler({ session, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        throw new Unauthorized("Session expired")
      }

      const userId = session.user.id

      let dbBookmarks = await prisma.bookmark.findMany({
        where: { userId },
        orderBy: [{ pinned: "desc" }, { order: "asc" }, { createdAt: "asc" }],
      })

      // Auto-migrate legacy bookmarks from customization if DB table is empty
      if (dbBookmarks.length === 0) {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { customization: true },
        })
        const legacyBookmarks = getBookmarksCustomization(dbUser?.customization)
        if (legacyBookmarks.length > 0) {
          await prisma.bookmark.createMany({
            data: legacyBookmarks.map((b, idx) => ({
              id: b.id || crypto.randomUUID(),
              userId,
              title: b.title,
              url: b.url,
              icon: b.icon || null,
              color: b.color || null,
              pinned: Boolean(b.pinned),
              appId: b.appId || null,
              group: b.group || null,
              order: idx,
            })),
          })
          dbBookmarks = await prisma.bookmark.findMany({
            where: { userId },
            orderBy: [
              { pinned: "desc" },
              { order: "asc" },
              { createdAt: "asc" },
            ],
          })
        }
      }

      const bookmarks = dbBookmarks.map((b) => ({
        id: b.id,
        title: b.title,
        url: b.url,
        icon: b.icon || undefined,
        color: b.color || undefined,
        pinned: b.pinned,
        appId: b.appId || undefined,
        group: b.group || undefined,
        order: b.order,
        createdAt: b.createdAt.toISOString(),
      }))

      const groups = Array.from(
        new Set(
          dbBookmarks
            .map((b) => b.group?.trim())
            .filter((g): g is string => Boolean(g && g.length > 0))
        )
      )

      return {
        success: true,
        bookmarks,
        groups,
      }
    },
  },

  POST: {
    schema: {
      body: CreateBookmarkBodySchema,
      response: {
        200: t.Object({
          success: t.Boolean(),
          bookmark: BookmarkItemSchema,
        }),
      },
    },
    async handler({ body, session, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        throw new Unauthorized("Session expired")
      }

      const userId = session.user.id

      const maxOrder = await prisma.bookmark.aggregate({
        where: { userId },
        _max: { order: true },
      })
      const nextOrder = (maxOrder._max.order ?? -1) + 1

      const created = await prisma.bookmark.create({
        data: {
          userId,
          title: body.title.trim(),
          url: body.url.trim(),
          icon: body.icon || null,
          color: body.color || null,
          pinned: Boolean(body.pinned),
          appId: body.appId || null,
          group: body.group?.trim() || null,
          order: nextOrder,
        },
      })

      return {
        success: true,
        bookmark: {
          id: created.id,
          title: created.title,
          url: created.url,
          icon: created.icon || undefined,
          color: created.color || undefined,
          pinned: created.pinned,
          appId: created.appId || undefined,
          group: created.group || undefined,
          order: created.order,
          createdAt: created.createdAt.toISOString(),
        },
      }
    },
  },

  PUT: {
    schema: {
      body: PutBookmarksBodySchema,
      response: {
        200: t.Object({
          success: t.Boolean(),
          bookmarks: t.Array(BookmarkItemSchema),
        }),
      },
    },
    async handler({ body, session, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        throw new Unauthorized("Session expired")
      }

      const userId = session.user.id

      await prisma.$transaction(
        body.bookmarks.map((bm, index) =>
          prisma.bookmark.updateMany({
            where: { id: bm.id, userId },
            data: {
              order: index,
              pinned: Boolean(bm.pinned),
              title: bm.title,
              url: bm.url,
              icon: bm.icon || null,
              color: bm.color || null,
              appId: bm.appId || null,
              group: bm.group?.trim() || null,
            },
          })
        )
      )

      const dbBookmarks = await prisma.bookmark.findMany({
        where: { userId },
        orderBy: [{ pinned: "desc" }, { order: "asc" }, { createdAt: "asc" }],
      })

      const bookmarks = dbBookmarks.map((b) => ({
        id: b.id,
        title: b.title,
        url: b.url,
        icon: b.icon || undefined,
        color: b.color || undefined,
        pinned: b.pinned,
        appId: b.appId || undefined,
        group: b.group || undefined,
        order: b.order,
        createdAt: b.createdAt.toISOString(),
      }))

      return {
        success: true,
        bookmarks,
      }
    },
  },
})
