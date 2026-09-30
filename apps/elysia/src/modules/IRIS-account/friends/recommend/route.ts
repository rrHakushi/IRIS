import { defineRoute, t } from "@/router"
import { Unauthorized, BadRequest } from "@/utils/errors"
import { sendNotification } from "@/services/notification.service"
import { getProfileCustomization } from "@IRIS/shared"

export default defineRoute({
  POST: {
    schema: {
      body: t.Object({
        friendIds: t.Array(t.String(), { minItems: 1 }),
        mediaType: t.String(),
        mediaId: t.Number({ minimum: 1 }),
        mediaTitle: t.String(),
        mediaCover: t.Optional(t.String()),
        message: t.Optional(t.String({ maxLength: 250 })),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          sentCount: t.Number(),
        }),
      },
    },
    async handler({ session, body, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        throw new Unauthorized("You must be logged in to recommend to friends.")
      }

      const senderId = session.user.id
      const {
        friendIds,
        mediaType,
        mediaId,
        mediaTitle,
        mediaCover,
        message: customMessage,
      } = body

      // Fetch sender user details
      const senderRecord = await prisma.user.findUnique({
        where: { id: senderId },
        select: { username: true, customization: true },
      })

      const customization = getProfileCustomization(
        senderRecord?.customization
      )
      const senderDisplayName =
        customization.displayName || session.user.username

      // Verify friends of sender
      const validFriends = await prisma.friend.findMany({
        where: {
          userId: senderId,
          friendId: { in: friendIds },
        },
        select: { friendId: true },
      })

      if (validFriends.length === 0) {
        throw new BadRequest("No valid friends selected.")
      }

      // Check sender tracking status for this media
      let senderStatus: string | null = null
      let senderScore: number | null = null
      let senderProgress: number | null = null

      const normType = mediaType.toLowerCase()
      if (normType === "anime") {
        const item = await prisma.animeList.findUnique({
          where: { userId_animeId: { userId: senderId, animeId: mediaId } },
        })
        if (item) {
          senderStatus = item.status
          senderScore = item.score
          senderProgress = item.progress
        }
      } else if (normType === "manga") {
        const item = await prisma.mangaList.findUnique({
          where: { userId_mangaId: { userId: senderId, mangaId: mediaId } },
        })
        if (item) {
          senderStatus = item.status
          senderScore = item.score
          senderProgress = item.chaptersProgress
        }
      } else if (normType === "tv") {
        const item = await prisma.tvList.findUnique({
          where: { userId_tvId: { userId: senderId, tvId: mediaId } },
        })
        if (item) {
          senderStatus = item.status
          senderScore = item.score
          senderProgress = item.progress
        }
      } else if (normType === "movie" || normType === "movies") {
        const item = await prisma.movieList.findUnique({
          where: { userId_movieId: { userId: senderId, movieId: mediaId } },
        })
        if (item) {
          senderStatus = item.status
          senderScore = item.score
        }
      } else if (normType === "game" || normType === "games") {
        const item = await prisma.gameList.findUnique({
          where: { userId_gameId: { userId: senderId, gameId: mediaId } },
        })
        if (item) {
          senderStatus = item.status
          senderScore = item.score
        }
      } else if (normType === "book" || normType === "books") {
        const item = await prisma.bookList.findUnique({
          where: { userId_bookId: { userId: senderId, bookId: mediaId } },
        })
        if (item) {
          senderStatus = item.status
          senderScore = item.score
          senderProgress = item.progress
        }
      }

      const trimmedMsg = customMessage?.trim().slice(0, 250) || null

      let notifBody = trimmedMsg
        ? `"${trimmedMsg}"`
        : `@${session.user.username} thinks you would like "${mediaTitle}"!`

      const extraDetails: string[] = []
      if (senderScore !== null && senderScore !== undefined) {
        extraDetails.push(`Score: ${senderScore}/10`)
      }
      if (senderStatus) {
        extraDetails.push(`Status: ${senderStatus.toLowerCase()}`)
      }
      if (senderProgress !== null && senderProgress !== undefined) {
        extraDetails.push(`Progress: Unit ${senderProgress}`)
      }

      if (extraDetails.length > 0) {
        notifBody += ` (${extraDetails.join(" • ")})`
      }

      let sentCount = 0

      for (const f of validFriends) {
        try {
          await sendNotification({
            userId: f.friendId,
            app: "IRIS-list",
            category: "recommendations",
            type: "INFO",
            priority: "NORMAL",
            content: {
              title: `@${session.user.username} recommended ${mediaTitle}`,
              body: notifBody,
              icon: mediaCover || customization.avatarUrl || undefined,
              link: `/IRIS-list/${mediaType}/${mediaId}`,
              metadata: {
                mediaType,
                mediaId,
                mediaTitle,
                mediaCover,
                senderId,
                senderUsername: session.user.username,
                senderDisplayName,
                senderStatus,
                senderScore,
                senderProgress,
                message: trimmedMsg,
              },
            },
          })
          sentCount++
        } catch (err) {
          console.warn(
            `[RecommendFriend] Failed to send recommendation to user ${f.friendId}:`,
            err
          )
        }
      }

      return {
        success: true,
        message: `Recommendation sent to ${sentCount} friend(s)!`,
        sentCount,
      }
    },
  },
})
