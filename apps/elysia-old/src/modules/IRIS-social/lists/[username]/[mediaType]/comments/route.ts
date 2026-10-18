import { defineRoute, t, type Context } from "@/router"
import { NotFound, BadRequest, TooManyRequests } from "@/utils/errors"
import { getProfileCustomization } from "@IRIS/shared"

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

export const CommentAuthorSchema = t.Object({
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

export const CommentReplySchema = t.Object({
  id: t.String(),
  commentId: t.String(),
  authorId: t.String(),
  content: t.String(),
  createdAt: t.Union([t.Date(), t.String()]),
  updatedAt: t.Union([t.Date(), t.String()]),
  author: CommentAuthorSchema,
})

export const ListCommentItemSchema = t.Object({
  id: t.String(),
  listOwnerId: t.String(),
  mediaType: t.String(),
  authorId: t.String(),
  content: t.String(),
  isSpoiler: t.Boolean(),
  createdAt: t.Union([t.Date(), t.String()]),
  updatedAt: t.Union([t.Date(), t.String()]),
  author: CommentAuthorSchema,
  reply: t.Nullable(CommentReplySchema),
})

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      mediaType: t.String(),
    }),
    query: t.Optional(
      t.Object({
        page: t.Optional(t.Numeric({ default: 1, minimum: 1 })),
        limit: t.Optional(t.Numeric({ default: 6, minimum: 1, maximum: 50 })),
      })
    ),
    response: {
      200: t.Object({
        success: t.Boolean(),
        comments: t.Array(ListCommentItemSchema),
        pagination: t.Object({
          page: t.Number(),
          limit: t.Number(),
          total: t.Number(),
          totalPages: t.Number(),
          hasMore: t.Boolean(),
        }),
      }),
    },
  },

  async GET({ params, query, prisma }) {
    const username = params.username || ""
    const mediaType = (params.mediaType || "").toLowerCase()
    const page = Math.max(1, Number(query?.page) || 1)
    const limit = Math.max(1, Math.min(50, Number(query?.limit) || 6))
    const skip = (page - 1) * limit

    const listOwner = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true },
    })

    if (!listOwner) {
      throw new NotFound(`User '${username}' not found.`)
    }

    const total = await prisma.listComment.count({
      where: {
        listOwnerId: listOwner.id,
        mediaType,
      },
    })

    const rawComments = await prisma.listComment.findMany({
      where: {
        listOwnerId: listOwner.id,
        mediaType,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        author: {
          select: {
            id: true,
            username: true,
            customization: true,
          },
        },
        reply: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                customization: true,
              },
            },
          },
        },
      },
    })

    const comments = rawComments.map((item) => ({
      id: item.id,
      listOwnerId: item.listOwnerId,
      mediaType: item.mediaType,
      authorId: item.authorId,
      content: item.content,
      isSpoiler: item.isSpoiler,
      createdAt:
        item.createdAt instanceof Date
          ? item.createdAt.toISOString()
          : item.createdAt,
      updatedAt:
        item.updatedAt instanceof Date
          ? item.updatedAt.toISOString()
          : item.updatedAt,
      author: formatAuthorProfile(item.author),
      reply: item.reply
        ? {
            id: item.reply.id,
            commentId: item.reply.commentId,
            authorId: item.reply.authorId,
            content: item.reply.content,
            createdAt:
              item.reply.createdAt instanceof Date
                ? item.reply.createdAt.toISOString()
                : item.reply.createdAt,
            updatedAt:
              item.reply.updatedAt instanceof Date
                ? item.reply.updatedAt.toISOString()
                : item.reply.updatedAt,
            author: formatAuthorProfile(item.reply.author),
          }
        : null,
    }))

    const totalPages = Math.max(1, Math.ceil(total / limit))
    const hasMore = page < totalPages

    return {
      success: true,
      comments,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore,
      },
    }
  },

  POST: {
    requireAuth: true,
    schema: {
      body: t.Object({
        content: t.String({ minLength: 1, maxLength: 5000 }),
        isSpoiler: t.Optional(t.Boolean({ default: false })),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          comment: ListCommentItemSchema,
        }),
      },
    },
    async handler(ctx: Context) {
      const { params, body, session, prisma, cache, notifications } = ctx
      const set = ctx.set as {
        headers?: Record<string, string>
        status?: number
      }
      const typedBody = body as { content: string; isSpoiler?: boolean }
      const trimmedContent = typedBody.content.trim()
      if (!trimmedContent) {
        throw new BadRequest("Comment content cannot be empty.")
      }

      if (!session.user) {
        throw new BadRequest("Authentication required.")
      }

      const username = (params.username as string) || ""
      const mediaType = ((params.mediaType as string) || "").toLowerCase()

      // Rate limit: 1 comment per list type per minute
      const rateLimitKey = `ratelimit:comment:${session.user.id}:${mediaType}`
      const rawData = await cache.get(rateLimitKey)
      const rateLimitData =
        typeof rawData === "object" &&
        rawData !== null &&
        "expiresAt" in rawData
          ? (rawData as { expiresAt?: number })
          : null
      const expiresAt = rateLimitData?.expiresAt

      if (expiresAt && expiresAt > Date.now()) {
        const remainingSeconds = Math.max(
          1,
          Math.ceil((expiresAt - Date.now()) / 1000)
        )

        set.status = 429
        if (!set.headers) set.headers = {}
        set.headers["retry-after"] = String(remainingSeconds)
        set.headers["ratelimit-reset"] = String(Math.ceil(expiresAt / 1000))

        return {
          success: false,
          error: "Too Many Requests",
          message: `Rate limit reached. Please wait ${remainingSeconds}s before commenting again.`,
          retryAfter: remainingSeconds,
          status: 429,
        }
      }

      const listOwner = await prisma.user.findUnique({
        where: { username },
        select: { id: true, username: true },
      })

      if (!listOwner) {
        throw new NotFound(`User '${username}' not found.`)
      }

      const rawComment = await prisma.listComment.create({
        data: {
          listOwnerId: listOwner.id,
          mediaType,
          authorId: session.user.id,
          content: trimmedContent,
          isSpoiler: Boolean(typedBody.isSpoiler),
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              customization: true,
            },
          },
          reply: true,
        },
      })

      const authorProfile = formatAuthorProfile(rawComment.author)

      // Set rate limit for 60 seconds (1 minute) with precise expiry timestamp
      await cache.set(rateLimitKey, { expiresAt: Date.now() + 60_000 }, 60)

      // Notify list owner if someone else commented on their list
      if (listOwner.id !== session.user.id) {
        try {
          const authorName =
            authorProfile.displayName || session.user.username || "A user"
          const formattedMediaType =
            mediaType.charAt(0).toUpperCase() + mediaType.slice(1).toLowerCase()
          const snippet =
            trimmedContent.length > 80
              ? `${trimmedContent.slice(0, 80)}...`
              : trimmedContent

          await notifications.send({
            userId: listOwner.id,
            app: "IRIS List",
            category: "Social",
            type: "ACTION_INPUT",
            priority: "NORMAL",
            actionHandler: "lists.comment.reply",
            actionPayload: {
              commentId: rawComment.id,
              mediaType: mediaType.toLowerCase(),
              commentatorId: session.user.id,
              commentatorUsername: session.user.username,
            },
            content: {
              title: `New Comment on your ${formattedMediaType} List`,
              body: `${authorName}: "${snippet}"`,
              icon: authorProfile.avatarUrl ?? undefined,
              link: `/IRIS-list/lists/${params.username}/${mediaType}?tab=comments`,
              actionInputs: [
                {
                  id: "replyContent",
                  label: `Reply to ${authorName}`,
                  type: "textarea",
                  placeholder: "Write your reply...",
                  required: true,
                },
              ],
              metadata: {
                commentId: rawComment.id,
                mediaType: params.mediaType,
                authorUsername: session.user.username,
              },
            },
          })
        } catch (notifErr) {
          console.warn(
            `[comments:POST] Failed to send notification to list owner:`,
            notifErr
          )
        }
      }

      return {
        success: true,
        comment: {
          id: rawComment.id,
          listOwnerId: rawComment.listOwnerId,
          mediaType: rawComment.mediaType,
          authorId: rawComment.authorId,
          content: rawComment.content,
          isSpoiler: rawComment.isSpoiler,
          createdAt:
            rawComment.createdAt instanceof Date
              ? rawComment.createdAt.toISOString()
              : rawComment.createdAt,
          updatedAt:
            rawComment.updatedAt instanceof Date
              ? rawComment.updatedAt.toISOString()
              : rawComment.updatedAt,
          author: authorProfile,
          reply: null,
        },
      }
    },
  },
})
