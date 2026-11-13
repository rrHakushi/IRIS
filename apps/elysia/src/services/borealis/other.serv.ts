import { prisma, and, or, not, countOf, toDate } from '@NamelessLiberty/db'
import { IRISFlags } from '@NamelessLiberty/permissions'
import { BadRequest, Forbidden, NotFound, Conflict } from '../../lib/errors'
import { uploadPublicAsset } from '../../utils/s3'
import { CarinaNotificationsServ } from '../carina/notifications.serv'
import { getProfileCustomization } from '@NamelessLiberty/shared'
import type {
  CreateOtherBody,
  UpdateOtherBody,
  OtherCatalogQuery,
} from '../../api/models/borealis/other.model'

function parseList(val?: unknown): string[] {
  if (!val || typeof val !== 'string') return []
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export class BorealisOtherServ {
  /**
   * Get public catalog of custom items with pagination and filters.
   */
  public static async getCatalog(query?: OtherCatalogQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 50)))
    const skip = query?.cursor ? 0 : (page - 1) * limit

    const search = query?.search?.trim()
    const formats = parseList(query?.formats)
    const sortBy = query?.sortBy ?? 'popularity'
    const sortOrder = query?.sortOrder ?? (sortBy === 'title' ? 'asc' : 'desc')

    let q = prisma.orm.public.Other.where({ isPublished: true })
    if (search) {
      q = q.where((m) =>
        or(
          m.titlePrimary.ilike(`%${search}%`),
          m.titleSecondary.ilike(`%${search}%`)
        )
      )
    }
    if (formats.length > 0) {
      q = q.where((m) => m.format.in(formats))
    }
    if (query?.cursor) {
      q = q.where((m) =>
        sortOrder === 'asc' ? m.id.gt(query.cursor!) : m.id.lt(query.cursor!)
      )
    }

    let itemsQ = q
    if (sortBy === 'score') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.averageScore.asc() : x.averageScore.desc()
      )
    } else if (sortBy === 'title') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.titlePrimary.asc() : x.titlePrimary.desc()
      )
    } else if (sortBy === 'releaseDate') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.startDate.asc() : x.startDate.desc()
      )
    } else if (sortBy === 'favorites') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.favorites.asc() : x.favorites.desc()
      )
    } else if (sortBy === 'updatedAt') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.updatedAt.asc() : x.updatedAt.desc()
      )
    } else {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.popularity.asc() : x.popularity.desc()
      )
    }

    const [total, rawItems] = await Promise.all([
      countOf(q),
      itemsQ.offset(skip).limit(limit).all(),
    ])

    const items = rawItems.map((m: any) => ({
      id: m.id,
      titlePrimary: m.titlePrimary,
      titleSecondary: m.titleSecondary ?? null,
      titleNative: m.titleSecondary ?? null,
      coverImage: m.coverImage ?? null,
      bannerImage: m.bannerImage ?? null,
      averageScore: m.averageScore ?? null,
      format: m.format ?? null,
      status: m.isPublished ? 'PUBLISHED' : 'DRAFT',
      startDateYear: m.startDate ? toDate(m.startDate).getFullYear() : null,
      description: m.description ?? null,
      genres: [],
      tags: [],
    }))

    const nextCursor = items.length === limit ? items[items.length - 1]!.id : null
    const hasMore = query?.cursor ? nextCursor !== null : skip + limit < total

    return {
      success: true,
      items,
      nextCursor,
      hasMore,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore,
      },
    }
  }

  /**
   * Get available catalog filters for other items.
   */
  public static async getFilters() {
    const allPublished = await prisma.orm.public.Other
      .where({ isPublished: true })
      .select('format', 'startDate')
      .all()

    const formatCounts: Record<string, number> = {}
    const yearCounts: Record<number, number> = {}

    for (const item of allPublished) {
      if (item.format) formatCounts[item.format] = (formatCounts[item.format] || 0) + 1
      if (item.startDate) {
        const y = toDate(item.startDate).getFullYear()
        yearCounts[y] = (yearCounts[y] || 0) + 1
      }
    }

    return {
      success: true,
      statuses: [{ value: 'PUBLISHED', count: allPublished.length }],
      formats: Object.entries(formatCounts).map(([value, count]) => ({ value, count })),
      genres: [],
      years: Object.entries(yearCounts)
        .map(([value, count]) => ({ value: Number(value), count }))
        .sort((a, b) => b.value - a.value),
    }
  }

  /**
   * Create a custom trackable catalog item.
   * Standard users are capped at 500 created items; ADMINISTRATOR users are unlimited.
   */
  public static async createItem(userId: string, body: CreateOtherBody, isAdmin: boolean) {
    if (!isAdmin) {
      const existingCount = await countOf(
        prisma.orm.public.Other.where({ creatorId: userId })
      )
      if (existingCount >= 500) {
        throw new Forbidden(
          'You have reached the maximum limit of 500 custom items. Administrator permission is required to create more.'
        )
      }
    }

    if (!body.progressFields || body.progressFields.length === 0) {
      throw new BadRequest('At least one progress field must be defined.')
    }

    const fieldKeys = new Set(body.progressFields.map((f) => f.key))
    if (!fieldKeys.has(body.incrementFieldKey)) {
      throw new BadRequest(
        `Designated incrementFieldKey "${body.incrementFieldKey}" must match one of the defined progress field keys.`
      )
    }

    const startDate = body.startDate ? new Date(body.startDate) : null
    const endDate = body.endDate ? new Date(body.endDate) : null
    const format = body.format ? body.format.trim().toLowerCase() : null

    const created = await prisma.orm.public.Other.create({
      creatorId: userId,
      titlePrimary: body.titlePrimary.trim(),
      titleSecondary: body.titleSecondary?.trim() || null,
      description: body.description?.trim() || null,
      coverImage: body.coverImage || null,
      bannerImage: body.bannerImage || null,
      format,
      startDate,
      endDate,
      isPublished: Boolean(body.isPublished),
      progressFields: body.progressFields as any,
      incrementFieldKey: body.incrementFieldKey,
    })

    const item = await prisma.orm.public.Other
      .where({ id: created.id })
      .include('creator', (c) => c.select('id', 'username'))
      .first()

    return {
      success: true,
      item,
    }
  }

  /**
   * Get single custom item by ID.
   */
  public static async getItem(otherId: number, currentUserId?: string, isAdmin = false) {
    const item = await prisma.orm.public.Other
      .where({ id: otherId })
      .include('creator', (c) => c.select('id', 'username'))
      .first()

    if (!item) {
      throw new NotFound(`Custom item with ID ${otherId} not found`)
    }

    // Draft items are private to creator or administrators
    if (!item.isPublished && item.creatorId !== currentUserId && !isAdmin) {
      throw new NotFound(`Custom item with ID ${otherId} not found`)
    }

    return {
      success: true,
      item,
    }
  }

  /**
   * Update an existing custom item.
   * If the item is published and tracked by other users, creates a pre-update snapshot
   * and dispatches interactive notifications to tracking users with a one-click fork option.
   */
  public static async updateItem(
    userId: string,
    otherId: number,
    body: UpdateOtherBody,
    isAdmin = false
  ) {
    const existing = await prisma.orm.public.Other
      .where({ id: otherId })
      .first()

    if (!existing) {
      throw new NotFound(`Custom item with ID ${otherId} not found`)
    }

    if (existing.creatorId !== userId && !isAdmin) {
      throw new Forbidden('Only the creator or an administrator can edit this item')
    }

    const progressFields = body.progressFields ?? (existing.progressFields as any)
    const incrementFieldKey = body.incrementFieldKey ?? existing.incrementFieldKey

    if (body.progressFields || body.incrementFieldKey) {
      if (!progressFields || progressFields.length === 0) {
        throw new BadRequest('At least one progress field must be defined.')
      }
      const fieldKeys = new Set(progressFields.map((f: any) => f.key))
      if (incrementFieldKey && !fieldKeys.has(incrementFieldKey)) {
        throw new BadRequest(
          `Designated incrementFieldKey "${incrementFieldKey}" must match one of the defined progress field keys.`
        )
      }
    }

    // Check if other users track this item
    const trackers = await prisma.orm.public.OtherList
      .where((ol) => and(ol.otherId.eq(otherId), ol.userId.neq(userId)))
      .select('userId')
      .all()

    let preUpdateSnapshot = existing.preUpdateSnapshot
    if (existing.isPublished && trackers.length > 0) {
      preUpdateSnapshot = {
        titlePrimary: existing.titlePrimary,
        titleSecondary: existing.titleSecondary,
        description: existing.description,
        coverImage: existing.coverImage,
        bannerImage: existing.bannerImage,
        format: existing.format,
        startDate: existing.startDate ? toDate(existing.startDate).toISOString() : null,
        endDate: existing.endDate ? toDate(existing.endDate).toISOString() : null,
        progressFields: existing.progressFields,
        incrementFieldKey: existing.incrementFieldKey,
        updatedAt: toDate(existing.updatedAt).toISOString(),
      } as any

      // Dispatch notifications to tracking users
      for (const tracker of trackers) {
        try {
          await CarinaNotificationsServ.createNotification({
            userId: tracker.userId,
            app: 'borealis',
            category: 'list',
            type: 'ACTION_CONFIRM',
            priority: 'NORMAL',
            content: {
              title: 'Item Updated by Creator',
              body: `"${existing.titlePrimary}" was updated by its creator. Would you like to keep a private copy of the pre-update version?`,
              link: `/borealis/other/${otherId}`,
              actionConfirm: {
                confirmLabel: 'Keep Pre-Update Copy',
                confirmVariant: 'default',
                rejectLabel: 'Dismiss',
                rejectVariant: 'outline',
              },
              actionData: { otherId },
            },
            actionHandler: 'borealis.other.fork',
            actionPayload: { otherId },
          })
        } catch (err) {
          console.warn(`[OtherServ] Failed to send update notification to user ${tracker.userId}:`, err)
        }
      }
    }

    await prisma.orm.public.Other
      .where({ id: otherId })
      .update({
        titlePrimary: body.titlePrimary !== undefined ? body.titlePrimary.trim() : undefined,
        titleSecondary:
          body.titleSecondary !== undefined
            ? body.titleSecondary
              ? body.titleSecondary.trim()
              : null
            : undefined,
        description:
          body.description !== undefined
            ? body.description
              ? body.description.trim()
              : null
            : undefined,
        coverImage: body.coverImage !== undefined ? body.coverImage : undefined,
        bannerImage: body.bannerImage !== undefined ? body.bannerImage : undefined,
        format:
          body.format !== undefined
            ? body.format
              ? body.format.trim().toLowerCase()
              : null
            : undefined,
        startDate:
          body.startDate !== undefined
            ? body.startDate
              ? new Date(body.startDate)
              : null
            : undefined,
        endDate:
          body.endDate !== undefined
            ? body.endDate
              ? new Date(body.endDate)
              : null
            : undefined,
        isPublished: body.isPublished !== undefined ? Boolean(body.isPublished) : undefined,
        progressFields: body.progressFields !== undefined ? (body.progressFields as any) : undefined,
        incrementFieldKey: incrementFieldKey !== undefined ? incrementFieldKey : undefined,
        preUpdateSnapshot: preUpdateSnapshot as any,
      })

    const updated = await prisma.orm.public.Other
      .where({ id: otherId })
      .include('creator', (c) => c.select('id', 'username'))
      .first()

    return {
      success: true,
      item: updated,
    }
  }

  /**
   * Delete custom item.
   * STRICT INTEGRITY: If any user other than creator has it in their list or favorited,
   * deletion is strictly blocked (even for admins).
   */
  public static async deleteItem(userId: string, otherId: number, isAdmin = false) {
    const existing = await prisma.orm.public.Other
      .where({ id: otherId })
      .first()

    if (!existing) {
      throw new NotFound(`Custom item with ID ${otherId} not found`)
    }

    if (existing.creatorId !== userId && !isAdmin) {
      throw new Forbidden('Only the creator or an administrator can delete this item')
    }

    // Check if other users have it tracked or favorited
    const otherUserTrackingCount = await countOf(
      prisma.orm.public.OtherList.where((ol) =>
        and(ol.otherId.eq(otherId), ol.userId.neq(existing.creatorId))
      )
    )

    const otherUserFavoriteCount = await countOf(
      prisma.orm.public.Favorite.where((f) =>
        and(
          f.type.eq('OTHER'),
          f.targetId.eq(otherId),
          f.userId.neq(existing.creatorId)
        )
      )
    )

    const userCustomLists = await prisma.orm.public.CustomList
      .where({ userId: existing.creatorId })
      .select('id')
      .all()
    const userCustomListIds = userCustomLists.map((cl) => cl.id)

    const customListEntryQuery =
      userCustomListIds.length > 0
        ? prisma.orm.public.CustomListEntry.where((cle) =>
            and(cle.otherId.eq(otherId), not(cle.listId.in(userCustomListIds)))
          )
        : prisma.orm.public.CustomListEntry.where((cle) =>
            cle.otherId.eq(otherId)
          )

    const otherUserCustomListCount = await countOf(customListEntryQuery)

    if (
      otherUserTrackingCount > 0 ||
      otherUserFavoriteCount > 0 ||
      otherUserCustomListCount > 0
    ) {
      throw new Conflict(
        'This item cannot be deleted because other users have it tracked in their list, favorited, or in a custom list.'
      )
    }

    // Safe to delete: cascade creator's own list entry, favorites, and the item
    await prisma.transaction(async (tx) => {
      await tx.orm.public.OtherList.where({ otherId }).delete()
      await tx.orm.public.Favorite.where({ type: 'OTHER', targetId: otherId }).delete()
      await tx.orm.public.CustomListEntry.where({ otherId }).delete()
      await tx.orm.public.Other.where({ id: otherId }).delete()
    })

    return {
      success: true,
      message: 'Item removed successfully',
    }
  }

  /**
   * Fork pre-update snapshot (or current item) into a new private item for the requesting user,
   * and repoint their list entry to the new private item.
   */
  public static async forkItem(userId: string, otherId: number, isAdmin = false) {
    if (!isAdmin) {
      const existingCount = await countOf(
        prisma.orm.public.Other.where({ creatorId: userId })
      )
      if (existingCount >= 500) {
        throw new Forbidden(
          'You have reached the maximum limit of 500 custom items. Administrator permission is required to create more.'
        )
      }
    }

    const item = await prisma.orm.public.Other
      .where({ id: otherId })
      .first()

    if (!item) {
      throw new NotFound(`Custom item with ID ${otherId} not found`)
    }

    const snapshot = (item.preUpdateSnapshot as any) || item

    const cloned = await prisma.orm.public.Other.create({
      creatorId: userId,
      titlePrimary: `${snapshot.titlePrimary || item.titlePrimary} (Copy)`,
      titleSecondary: snapshot.titleSecondary || item.titleSecondary || null,
      description: snapshot.description || item.description || null,
      coverImage: snapshot.coverImage || item.coverImage || null,
      bannerImage: snapshot.bannerImage || item.bannerImage || null,
      startDate: snapshot.startDate ? new Date(snapshot.startDate) : (item.startDate ? toDate(item.startDate) : null),
      endDate: snapshot.endDate ? new Date(snapshot.endDate) : (item.endDate ? toDate(item.endDate) : null),
      isPublished: false,
      progressFields: (snapshot.progressFields || item.progressFields) as any,
      incrementFieldKey: snapshot.incrementFieldKey || item.incrementFieldKey,
    })

    // Repoint user's list entry if present
    let updatedEntry: any = null
    const existingListEntry = await prisma.orm.public.OtherList
      .where({ userId, otherId })
      .first()

    if (existingListEntry) {
      await prisma.orm.public.OtherList.where({ id: existingListEntry.id }).delete()

      updatedEntry = await prisma.orm.public.OtherList.create({
        userId,
        otherId: cloned.id,
        status: existingListEntry.status,
        progressValues: existingListEntry.progressValues as any,
        score: existingListEntry.score,
        notes: existingListEntry.notes,
        private: existingListEntry.private,
        startedAt: existingListEntry.startedAt ? toDate(existingListEntry.startedAt) : null,
        completedAt: existingListEntry.completedAt ? toDate(existingListEntry.completedAt) : null,
      })
    }

    return {
      success: true,
      message: 'Item copied successfully to your private items',
      item: cloned,
      entry: updatedEntry,
    }
  }

  /**
   * Upload and optimize an asset file (cover or banner) <= 1MB.
   * Converts to WebP format with sharp.
   */
  public static async uploadAsset(
    userId: string,
    file: File,
    type: 'cover' | 'banner'
  ) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      throw new BadRequest('Unsupported file format. Please upload JPEG, PNG, WebP, or GIF.')
    }

    const maxSizeBytes = 1 * 1024 * 1024 // 1MB
    if (file.size > maxSizeBytes) {
      throw new BadRequest('File size exceeds the 1MB limit.')
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer())
    const webpBuffer = await new Bun.Image(rawBuffer).webp({ quality: 85 }).toBuffer()

    const key = `borealis/other/${userId}/${type}-${Date.now()}.webp`
    const { publicUrl } = await uploadPublicAsset({
      key,
      body: webpBuffer,
      contentType: 'image/webp',
    })

    return {
      success: true,
      url: publicUrl,
    }
  }

  /**
   * Get stats for custom item.
   */
  public static async getStats(otherId: number) {
    const item = await prisma.orm.public.Other.where({ id: otherId })
      .select('averageScore', 'favorites', 'popularity', 'scoreDistribution', 'statusDistribution')
      .first()
    if (!item) throw new NotFound(`Custom item with ID ${otherId} not found`)

    return {
      success: true,
      stats: {
        averageScore: item.averageScore ?? null,
        favorites: item.favorites ?? 0,
        popularity: item.popularity ?? 0,
        scoreDistribution: item.scoreDistribution ?? {},
        statusDistribution: item.statusDistribution ?? {},
      },
    }
  }

  /**
   * Get friends tracking this custom item.
   */
  public static async getFriends(otherId: number, currentUserId?: string) {
    if (!currentUserId) return { success: true, friends: [] }

    const item = await prisma.orm.public.Other.where({ id: otherId })
      .select('id', 'incrementFieldKey')
      .first()
    if (!item) throw new NotFound(`Custom item with ID ${otherId} not found`)

    const userFriends = await prisma.orm.public.Friend
      .where({ userId: currentUserId })
      .select('friendId')
      .all()

    const friendIds = userFriends.map((f) => f.friendId)
    if (friendIds.length === 0) return { success: true, friends: [] }

    const rawEntries = await prisma.orm.public.OtherList
      .where((l) => and(l.otherId.eq(otherId), l.private.eq(false), l.userId.in(friendIds)))
      .include('user', (u: any) => u.select('id', 'username', 'customization'))
      .all()

    const friends = rawEntries.map((raw: any) => {
      const profile = getProfileCustomization(raw.user?.customization)
      const primary = item.incrementFieldKey
        ? (raw.progressValues as any)?.[item.incrementFieldKey] ?? null
        : null
      return {
        id: raw.id,
        userId: raw.userId,
        status: raw.status,
        score: raw.score,
        primaryProgress: primary,
        secondaryProgress: null,
        progress: primary,
        volumesProgress: null,
        updatedAt: toDate(raw.updatedAt).toISOString(),
        user: {
          id: raw.user?.id || raw.userId,
          username: raw.user?.username || 'Unknown',
          customization: raw.user?.customization || null,
          displayName: profile.displayName || raw.user?.username || 'Unknown',
          avatarUrl: profile.avatarUrl || null,
          avatarFrame: profile.avatarFrame || null,
          displayNameStyle: profile.displayNameStyle || null,
        },
      }
    })

    return { success: true, friends }
  }

  /**
   * Get all public users tracking this custom item.
   */
  public static async getPeople(
    otherId: number,
    query?: { page?: number; limit?: number; status?: string }
  ) {
    const item = await prisma.orm.public.Other.where({ id: otherId })
      .select('id', 'incrementFieldKey')
      .first()
    if (!item) throw new NotFound(`Custom item with ID ${otherId} not found`)

    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 40)))
    const skip = (page - 1) * limit
    const filterStatus = query?.status?.toUpperCase()?.trim()

    let q = prisma.orm.public.OtherList.where({ otherId, private: false })
    if (filterStatus) q = q.where({ status: filterStatus as any })

    const [total, rawEntries] = await Promise.all([
      countOf(q),
      q
        .orderBy((entry: any) => entry.updatedAt.desc())
        .offset(skip)
        .limit(limit)
        .include('user', (u: any) => u.select('id', 'username', 'customization'))
        .all(),
    ])

    const people = rawEntries.map((raw: any) => {
      const profile = getProfileCustomization(raw.user?.customization)
      const primary = item.incrementFieldKey
        ? (raw.progressValues as any)?.[item.incrementFieldKey] ?? null
        : null
      return {
        id: raw.id,
        userId: raw.userId,
        status: raw.status,
        score: raw.score,
        primaryProgress: primary,
        secondaryProgress: null,
        progress: primary,
        volumesProgress: null,
        updatedAt: toDate(raw.updatedAt).toISOString(),
        user: {
          id: raw.user?.id || raw.userId,
          username: raw.user?.username || 'Unknown',
          customization: raw.user?.customization || null,
          displayName: profile.displayName || raw.user?.username || 'Unknown',
          avatarUrl: profile.avatarUrl || null,
          avatarFrame: profile.avatarFrame || null,
          displayNameStyle: profile.displayNameStyle || null,
        },
      }
    })

    return {
      success: true,
      mediaType: 'other',
      mediaId: otherId,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      people,
    }
  }

  /**
   * Get recommendations for this custom item.
   */
  public static async getRecommendations(_otherId: number) {
    return { success: true, recommendations: [] }
  }
}
