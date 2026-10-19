import { prisma } from '@IRIS/database'
import { IRISFlags } from '@IRIS/permissions'
import { BadRequest, Forbidden, NotFound, Conflict } from '../../lib/errors'
import { uploadPublicAsset } from '../../utils/s3'
import { CarinaNotificationsServ } from '../carina/notifications.serv'
import type { CreateOtherBody, UpdateOtherBody } from '../../api/models/borealis/other.model'

const DEFAULT_STATUSES = [
  { key: 'PLANNING', label: 'Planning', isCompleted: false },
  { key: 'TRACKING', label: 'Tracking', isCompleted: false },
  { key: 'COMPLETED', label: 'Completed', isCompleted: true },
  { key: 'ON_HOLD', label: 'On Hold', isCompleted: false },
  { key: 'DROPPED', label: 'Dropped', isCompleted: false },
]

export class BorealisOtherServ {
  /**
   * Create a custom trackable catalog item.
   * Standard users are capped at 500 created items; ADMINISTRATOR users are unlimited.
   */
  public static async createItem(userId: string, body: CreateOtherBody, isAdmin: boolean) {
    if (!isAdmin) {
      const existingCount = await prisma.other.count({
        where: { creatorId: userId },
      })
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
    const statuses =
      body.statuses && body.statuses.length > 0 ? body.statuses : DEFAULT_STATUSES

    const item = await prisma.other.create({
      data: {
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
        statuses: statuses as any,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    })

    return {
      success: true,
      item,
    }
  }

  /**
   * Get single custom item by ID.
   */
  public static async getItem(otherId: number, currentUserId?: string, isAdmin = false) {
    const item = await prisma.other.findUnique({
      where: { id: otherId },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    })

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
    const existing = await prisma.other.findUnique({
      where: { id: otherId },
    })

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
    const trackers = await prisma.otherList.findMany({
      where: {
        otherId,
        userId: { not: userId },
      },
      select: { userId: true },
    })

    let preUpdateSnapshot = existing.preUpdateSnapshot
    if (existing.isPublished && trackers.length > 0) {
      preUpdateSnapshot = {
        titlePrimary: existing.titlePrimary,
        titleSecondary: existing.titleSecondary,
        description: existing.description,
        coverImage: existing.coverImage,
        bannerImage: existing.bannerImage,
        format: existing.format,
        startDate: existing.startDate ? existing.startDate.toISOString() : null,
        endDate: existing.endDate ? existing.endDate.toISOString() : null,
        progressFields: existing.progressFields,
        incrementFieldKey: existing.incrementFieldKey,
        statuses: existing.statuses,
        updatedAt: existing.updatedAt.toISOString(),
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

    const updated = await prisma.other.update({
      where: { id: otherId },
      data: {
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
        statuses: body.statuses !== undefined ? (body.statuses as any) : undefined,
        preUpdateSnapshot: preUpdateSnapshot as any,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    })

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
    const existing = await prisma.other.findUnique({
      where: { id: otherId },
    })

    if (!existing) {
      throw new NotFound(`Custom item with ID ${otherId} not found`)
    }

    if (existing.creatorId !== userId && !isAdmin) {
      throw new Forbidden('Only the creator or an administrator can delete this item')
    }

    // Check if other users have it tracked or favorited
    const otherUserTrackingCount = await prisma.otherList.count({
      where: {
        otherId,
        userId: { not: existing.creatorId },
      },
    })

    const otherUserFavoriteCount = await prisma.favorite.count({
      where: {
        type: 'OTHER',
        targetId: otherId,
        userId: { not: existing.creatorId },
      },
    })

    const otherUserCustomListCount = await prisma.customListEntry.count({
      where: {
        otherId,
        customList: {
          userId: { not: existing.creatorId },
        },
      },
    })

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
    await prisma.$transaction([
      prisma.otherList.deleteMany({ where: { otherId } }),
      prisma.favorite.deleteMany({ where: { type: 'OTHER', targetId: otherId } }),
      prisma.customListEntry.deleteMany({ where: { otherId } }),
      prisma.other.delete({ where: { id: otherId } }),
    ])

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
      const existingCount = await prisma.other.count({
        where: { creatorId: userId },
      })
      if (existingCount >= 500) {
        throw new Forbidden(
          'You have reached the maximum limit of 500 custom items. Administrator permission is required to create more.'
        )
      }
    }

    const item = await prisma.other.findUnique({
      where: { id: otherId },
    })

    if (!item) {
      throw new NotFound(`Custom item with ID ${otherId} not found`)
    }

    const snapshot = (item.preUpdateSnapshot as any) || item

    const cloned = await prisma.other.create({
      data: {
        creatorId: userId,
        titlePrimary: `${snapshot.titlePrimary || item.titlePrimary} (Copy)`,
        titleSecondary: snapshot.titleSecondary || item.titleSecondary || null,
        description: snapshot.description || item.description || null,
        coverImage: snapshot.coverImage || item.coverImage || null,
        bannerImage: snapshot.bannerImage || item.bannerImage || null,
        startDate: snapshot.startDate ? new Date(snapshot.startDate) : item.startDate,
        endDate: snapshot.endDate ? new Date(snapshot.endDate) : item.endDate,
        isPublished: false,
        progressFields: (snapshot.progressFields || item.progressFields) as any,
        incrementFieldKey: snapshot.incrementFieldKey || item.incrementFieldKey,
        statuses: (snapshot.statuses || item.statuses) as any,
      },
    })

    // Repoint user's list entry if present
    let updatedEntry: any = null
    const existingListEntry = await prisma.otherList.findUnique({
      where: {
        userId_otherId: {
          userId,
          otherId,
        },
      },
    })

    if (existingListEntry) {
      // Delete old entry and create/update to new cloned item
      await prisma.otherList.delete({
        where: { id: existingListEntry.id },
      })

      updatedEntry = await prisma.otherList.create({
        data: {
          userId,
          otherId: cloned.id,
          status: existingListEntry.status,
          progressValues: existingListEntry.progressValues as any,
          score: existingListEntry.score,
          notes: existingListEntry.notes,
          private: existingListEntry.private,
          startedAt: existingListEntry.startedAt,
          completedAt: existingListEntry.completedAt,
        },
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
    const sharp = (await import('sharp')).default
    const webpBuffer = await sharp(rawBuffer).webp({ quality: 85 }).toBuffer()

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
}
