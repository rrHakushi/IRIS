import { defineRoute, t } from "@/router"
import { NotFound } from "@/utils/errors"
import { getProfileCustomization } from "@IRIS/shared"
import { type Prisma } from "@IRIS/database"
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

export const UserActivityItemSchema = t.Object({
  id: t.String(),
  userId: t.String(),
  type: t.String(),
  mediaType: t.Nullable(t.String()),
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

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
    }),
    query: t.Optional(
      t.Object({
        page: t.Optional(t.Numeric({ default: 1, minimum: 1 })),
        limit: t.Optional(t.Numeric({ default: 20, minimum: 1, maximum: 50 })),
      })
    ),
    response: {
      200: t.Object({
        success: t.Boolean(),
        activities: t.Array(UserActivityItemSchema),
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
      summary: "Get comprehensive user activity stream (all activities)",
      tags: ["Users - Activity"],
    },
  },

  async GET({ params, query, prisma, session }) {
    const username = params.username || ""
    const page = Math.max(1, Number(query?.page) || 1)
    const limit = Math.max(1, Math.min(50, Number(query?.limit) || 20))
    const skip = (page - 1) * limit

    const targetUser = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: {
        id: true,
        username: true,
        customization: true,
      },
    })

    if (!targetUser) {
      throw new NotFound(`User '${username}' not found.`)
    }

    const currentUser = session?.isAuthenticated ? session.getUser() : null
    const isOwner = Boolean(
      currentUser &&
      currentUser.username?.toLowerCase() === targetUser.username.toLowerCase()
    )
    const isAdmin = Boolean(
      session?.isAuthenticated && session.hasPermission(IRISFlags.ADMINISTRATOR)
    )

    const where: Prisma.ActivityLogWhereInput = {
      userId: targetUser.id,
      ...(!isOwner && !isAdmin ? { isPrivate: false } : {}),
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

    const totalPages = Math.max(1, Math.ceil(total / limit))
    const hasMore = page < totalPages

    const activities = rawActivities.map((activity) => ({
      id: activity.id,
      userId: activity.userId,
      type: activity.type,
      mediaType: activity.mediaType ?? null,
      mediaId: activity.mediaId ?? null,
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
