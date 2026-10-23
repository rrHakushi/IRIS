import { prisma, countOf, toDate } from '@IRIS/database'
import { IRISBitField, IRISFlags } from '@IRIS/permissions'
import { NotFound, BadRequest, Forbidden } from '../../lib/errors'

export class CarinaBookmarksServ {
  /**
   * Helper to format a bookmark record for API responses.
   */
  public static formatBookmark(b: {
    id: string
    userId: string
    title: string
    url: string
    icon: string | null
    color: string | null
    pinned: boolean
    appId: string | null
    group: string | null
    order: number
    createdAt: any
    updatedAt: any
  }) {
    return {
      id: b.id,
      userId: b.userId,
      title: b.title,
      url: b.url,
      icon: b.icon ?? null,
      color: b.color ?? null,
      pinned: b.pinned,
      appId: b.appId ?? null,
      group: b.group ?? null,
      order: b.order,
      createdAt: toDate(b.createdAt).toISOString(),
      updatedAt: toDate(b.updatedAt).toISOString(),
    }
  }

  /**
   * Get user bookmarks with pagination and optional filtering (10 per page default).
   */
  public static async getBookmarks(
    userId: string,
    query?: {
      page?: number
      limit?: number
      group?: string
      pinned?: boolean
    }
  ) {
    const page = Math.max(1, query?.page ?? 1)
    const limit = Math.max(1, Math.min(50, query?.limit ?? 10))
    const skip = (page - 1) * limit

    let bmQuery = prisma.orm.public.Bookmark.where({ userId })
    if (query?.group !== undefined) {
      bmQuery = bmQuery.where({ group: query.group.trim() })
    }
    if (query?.pinned !== undefined) {
      bmQuery = bmQuery.where({ pinned: Boolean(query.pinned) })
    }

    const [total, rawBookmarks] = await Promise.all([
      countOf(bmQuery),
      bmQuery
        .orderBy([(b) => b.order.asc(), (b) => b.createdAt.desc()])
        .offset(skip)
        .limit(limit)
        .all(),
    ])

    rawBookmarks.sort((a, b) => (b.pinned === a.pinned ? 0 : b.pinned ? 1 : -1))

    const totalPages = Math.max(1, Math.ceil(total / limit))
    const hasMore = page < totalPages

    const groups = Array.from(
      new Set(
        rawBookmarks
          .map((b) => b.group?.trim())
          .filter((g): g is string => Boolean(g && g.length > 0))
      )
    )

    return {
      success: true,
      bookmarks: rawBookmarks.map((b) => this.formatBookmark(b)),
      groups,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore,
      },
    }
  }

  /**
   * Reorder and batch update bookmarks for the current user.
   */
  public static async putBookmarks(
    userId: string,
    body: {
      bookmarks: Array<{
        id: string
        title: string
        url: string
        icon?: string | null
        color?: string | null
        pinned?: boolean
        appId?: string | null
        group?: string | null
        order?: number
      }>
    }
  ) {
    await prisma.transaction(async (tx) => {
      for (let index = 0; index < body.bookmarks.length; index++) {
        const bm = body.bookmarks[index]!
        await tx.orm.public.Bookmark.where({ id: bm.id, userId }).update({
          order: bm.order ?? index,
          pinned: Boolean(bm.pinned),
          title: bm.title.trim(),
          url: bm.url.trim(),
          icon: bm.icon?.trim() || null,
          color: bm.color?.trim() || null,
          appId: bm.appId?.trim() || null,
          group: bm.group?.trim() || null,
        })
      }
    })

    const dbBookmarks = await prisma.orm.public.Bookmark.where({ userId })
      .orderBy([(b) => b.order.asc(), (b) => b.createdAt.desc()])
      .all()

    dbBookmarks.sort((a, b) => (b.pinned === a.pinned ? 0 : b.pinned ? 1 : -1))

    return {
      success: true,
      bookmarks: dbBookmarks.map((b) => this.formatBookmark(b)),
    }
  }

  /**
   * Create a new bookmark for the current user.
   */
  public static async createBookmark(
    userId: string,
    body: {
      title: string
      url: string
      icon?: string | null
      color?: string | null
      pinned?: boolean
      appId?: string | null
      group?: string | null
      order?: number
    }
  ) {
    const title = body.title.trim()
    if (!title) {
      throw new BadRequest('Bookmark title cannot be empty')
    }
    const url = body.url.trim()
    if (!url) {
      throw new BadRequest('Bookmark URL cannot be empty')
    }

    const created = await prisma.orm.public.Bookmark.create({
      userId,
      title,
      url,
      icon: body.icon?.trim() || null,
      color: body.color?.trim() || null,
      pinned: Boolean(body.pinned),
      appId: body.appId?.trim() || null,
      group: body.group?.trim() || null,
      order: body.order ?? 0,
    })

    return {
      success: true,
      bookmark: this.formatBookmark(created),
      message: 'Bookmark created successfully',
    }
  }

  /**
   * Update an existing bookmark strictly by bookmark ID.
   */
  public static async updateBookmark(
    user: { id: string; permissions: number[] },
    bookmarkId: string,
    body: {
      title?: string
      url?: string
      icon?: string | null
      color?: string | null
      pinned?: boolean
      appId?: string | null
      group?: string | null
      order?: number
    }
  ) {
    const bookmark = await prisma.orm.public.Bookmark.where({ id: bookmarkId.trim() }).first()

    if (!bookmark) {
      throw new NotFound('Bookmark not found')
    }

    const isOwner = bookmark.userId === user.id
    const isAdmin = new IRISBitField(user.permissions).has(IRISFlags.ADMINISTRATOR)

    if (!isOwner && !isAdmin) {
      throw new Forbidden('You do not have permission to update this bookmark')
    }

    const data: any = {}
    if (body.title !== undefined) {
      const trimmedTitle = body.title.trim()
      if (!trimmedTitle) throw new BadRequest('Bookmark title cannot be empty')
      data.title = trimmedTitle
    }
    if (body.url !== undefined) {
      const trimmedUrl = body.url.trim()
      if (!trimmedUrl) throw new BadRequest('Bookmark URL cannot be empty')
      data.url = trimmedUrl
    }
    if (body.icon !== undefined) {
      data.icon = body.icon?.trim() || null
    }
    if (body.color !== undefined) {
      data.color = body.color?.trim() || null
    }
    if (body.pinned !== undefined) {
      data.pinned = Boolean(body.pinned)
    }
    if (body.appId !== undefined) {
      data.appId = body.appId?.trim() || null
    }
    if (body.group !== undefined) {
      data.group = body.group?.trim() || null
    }
    if (body.order !== undefined) {
      data.order = body.order
    }

    const updated = await prisma.orm.public.Bookmark.where({ id: bookmark.id }).update(data)

    if (!updated) {
      throw new NotFound('Bookmark not found')
    }

    return {
      success: true,
      bookmark: this.formatBookmark(updated),
      message: 'Bookmark updated successfully',
    }
  }

  /**
   * Delete a bookmark strictly by bookmark ID.
   */
  public static async deleteBookmark(
    user: { id: string; permissions: number[] },
    bookmarkId: string
  ) {
    const bookmark = await prisma.orm.public.Bookmark.where({ id: bookmarkId.trim() }).first()

    if (!bookmark) {
      throw new NotFound('Bookmark not found')
    }

    const isOwner = bookmark.userId === user.id
    const isAdmin = new IRISBitField(user.permissions).has(IRISFlags.ADMINISTRATOR)

    if (!isOwner && !isAdmin) {
      throw new Forbidden('You do not have permission to delete this bookmark')
    }

    await prisma.orm.public.Bookmark.where({ id: bookmark.id }).delete()

    return {
      success: true,
      id: bookmark.id,
      message: 'Bookmark deleted successfully',
    }
  }
}
