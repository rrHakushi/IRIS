import { defineRoute, t } from "@/router"
import { NotFound, BadRequest } from "@/utils/errors"
import { getProfileCustomization } from "@IRIS/shared"
import { type MediaType, type ActivityType, type Prisma } from "@IRIS/database"
import { IRISFlags } from "@IRIS/permissions"

function formatAuthorProfile(user: {
  id: string
  username: string
  customization?: unknown
}) {
  const profile = getProfileCustomization(user.customization)
  const trimmedDisplayName =
    typeof profile.displayName === "string" ? profile.displayName.trim() : ""

  return {
    id: user.id,
    username: user.username,
    displayName: trimmedDisplayName !== "" ? trimmedDisplayName : null,
    avatarUrl: profile.avatarUrl ?? null,
    avatarFrame: profile.avatarFrame ?? null,
    bannerUrl: profile.bannerUrl ?? null,
    nameplateUrl: profile.nameplateUrl ?? null,
    bio: profile.bio ?? null,
    statusText: profile.statusText ?? null,
    pronouns: profile.pronouns ?? null,
    displayNameStyle: profile.displayNameStyle ?? null,
  }
}

export const ActivityAuthorSchema = t.Object({
  id: t.String(),
  username: t.String(),
  displayName: t.Nullable(t.String()),
  avatarUrl: t.Nullable(t.String()),
  avatarFrame: t.Nullable(t.String()),
  bannerUrl: t.Nullable(t.String()),
  nameplateUrl: t.Nullable(t.String()),
  bio: t.Nullable(t.String()),
  statusText: t.Nullable(t.String()),
  pronouns: t.Nullable(t.String()),
  displayNameStyle: t.Optional(t.Nullable(t.Any())),
})

export const ListActivityItemSchema = t.Object({
  id: t.String(),
  userId: t.String(),
  type: t.String(),
  mediaType: t.String(),
  mediaId: t.Nullable(t.Number()),
  status: t.Nullable(t.String()),
  progress: t.Nullable(t.Number()),
  progressVolumes: t.Nullable(t.Number()),
  score: t.Nullable(t.Number()),
  title: t.Nullable(t.String()),
  content: t.Nullable(t.String()),
  metadata: t.Optional(t.Nullable(t.Any())),
  isPrivate: t.Boolean(),
  createdAt: t.String(),
  user: ActivityAuthorSchema,
  canDelete: t.Boolean(),
})

const VALID_MEDIA_TYPES = new Set([
  "ANIME",
  "MANGA",
  "MOVIE",
  "TV",
  "GAME",
  "BOOK",
  "MUSIC",
])

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      mediaType: t.String(),
    }),
    query: t.Optional(
      t.Object({
        page: t.Optional(t.Numeric({ default: 1, minimum: 1 })),
        limit: t.Optional(t.Numeric({ default: 15, minimum: 1, maximum: 50 })),
        action: t.Optional(t.String()),
      })
    ),
    response: {
      200: t.Object({
        success: t.Boolean(),
        activities: t.Array(ListActivityItemSchema),
        pagination: t.Object({
          page: t.Number(),
          limit: t.Number(),
          total: t.Number(),
          totalPages: t.Number(),
          hasMore: t.Boolean(),
        }),
      }),
    },
    detail: {
      summary: "Get user list activity stream for specific media type",
      tags: ["Lists - Activity"],
    },
  },

  async GET({ params, query, prisma, session }) {
    const username = params.username || ""
    const rawMediaType = (params.mediaType || "").toUpperCase()
    if (!VALID_MEDIA_TYPES.has(rawMediaType)) {
      throw new BadRequest(`Invalid media type: '${params.mediaType}'`)
    }
    const mediaType = rawMediaType as MediaType

    const page = Math.max(1, Number(query?.page) || 1)
    const limit = Math.max(1, Math.min(50, Number(query?.limit) || 15))
    const skip = (page - 1) * limit

    const listOwner = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: {
        id: true,
        username: true,
        customization: true,
      },
    })

    if (!listOwner) {
      throw new NotFound(`User '${username}' not found.`)
    }

    const currentUser = session?.isAuthenticated ? session.getUser() : null
    const isOwner = Boolean(
      currentUser &&
      currentUser.username?.toLowerCase() === listOwner.username.toLowerCase()
    )
    const isAdmin = Boolean(
      session?.isAuthenticated && session.hasPermission(IRISFlags.ADMINISTRATOR)
    )

    // 30 days retention filter
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    let typeFilter: ActivityType | undefined
    const actionQuery =
      typeof query?.action === "string" ? query.action : undefined
    if (actionQuery && actionQuery !== "ALL") {
      switch (actionQuery.toUpperCase()) {
        case "ADDED":
          typeFilter = "LIST_ITEM_ADDED"
          break
        case "COMPLETED":
          typeFilter = "LIST_COMPLETED"
          break
        case "PROGRESS":
        case "PROGRESS_CHANGED":
          typeFilter = "LIST_PROGRESS_UPDATED"
          break
        case "STATUS":
        case "STATUS_CHANGED":
          typeFilter = "LIST_STATUS_UPDATED"
          break
        case "SCORE":
        case "SCORE_CHANGED":
          typeFilter = "LIST_SCORE_UPDATED"
          break
        case "REMOVED":
          typeFilter = "LIST_ITEM_REMOVED"
          break
      }
    }

    const where: Prisma.ActivityLogWhereInput = {
      userId: listOwner.id,
      mediaType,
      createdAt: { gte: cutoff },
      ...(isOwner || isAdmin ? {} : { isPrivate: false }),
      ...(typeFilter ? { type: typeFilter } : {}),
    }

    const [total, rawActivities] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              customization: true,
            },
          },
        },
      }),
    ])

    const totalPages = Math.ceil(total / limit)
    const hasMore = page < totalPages

    const activities = rawActivities.map((activity) => ({
      id: activity.id,
      userId: activity.userId,
      type: activity.type,
      mediaType: activity.mediaType ?? mediaType,
      mediaId: activity.mediaId,
      status: activity.status,
      progress: activity.progress,
      progressVolumes: activity.progressVolumes,
      score: activity.score,
      title: activity.title,
      content: activity.content,
      metadata: activity.metadata,
      isPrivate: activity.isPrivate,
      createdAt:
        activity.createdAt instanceof Date
          ? activity.createdAt.toISOString()
          : String(activity.createdAt),
      user: formatAuthorProfile(activity.user),
      canDelete: isOwner || isAdmin,
    }))

    return {
      success: true,
      activities,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore,
      },
    }
  },
})
