import { defineRoute, t } from "@/router"

export default defineRoute({
  GET: {
    schema: {
      params: t.Object({
        mediaType: t.String(),
        id: t.Numeric({ minimum: 1 }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          friends: t.Array(
            t.Object({
              id: t.String(),
              friendId: t.String(),
              nickname: t.Nullable(t.String()),
              user: t.Object({
                id: t.String(),
                username: t.String(),
                customization: t.Any(),
              }),
              status: t.String(),
              progress: t.Optional(t.Nullable(t.Number())),
              progressVolumes: t.Optional(t.Nullable(t.Number())),
              score: t.Optional(t.Nullable(t.Number())),
              updatedAt: t.String(),
            })
          ),
        }),
      },
    },
    async handler({ session, params, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        return { success: true, friends: [] }
      }

      const currentUserId = session.user.id
      const mediaType = params.mediaType.toLowerCase()
      const mediaId = Number(params.id)

      if (!mediaId || isNaN(mediaId) || mediaId <= 0) {
        return { success: true, friends: [] }
      }

      // 1. Get current user's friends
      const friends = await prisma.friend.findMany({
        where: { userId: currentUserId },
        include: {
          friend: {
            select: {
              id: true,
              username: true,
              customization: true,
            },
          },
        },
      })

      if (friends.length === 0) {
        return { success: true, friends: [] }
      }

      const friendIds = friends.map((f) => f.friendId)
      type FriendWithUser = (typeof friends)[number]
      const friendMap = new Map<string, FriendWithUser>(
        friends.map((f) => [f.friendId, f])
      )

      const result: Array<{
        id: string
        friendId: string
        nickname: string | null
        user: {
          id: string
          username: string
          customization: any
        }
        status: string
        progress?: number | null
        progressVolumes?: number | null
        score?: number | null
        updatedAt: string
      }> = []

      // 2. Fetch corresponding list entries for the media type
      if (mediaType === "anime") {
        const entries = await prisma.animeList.findMany({
          where: {
            userId: { in: friendIds },
            animeId: mediaId,
            private: false,
          },
        })
        for (const e of entries) {
          const f = friendMap.get(e.userId)
          if (f) {
            result.push({
              id: f.id,
              friendId: f.friendId,
              nickname: f.nickname,
              user: f.friend,
              status: e.status,
              progress: e.progress,
              score: e.score,
              updatedAt: e.updatedAt.toISOString(),
            })
          }
        }
      } else if (mediaType === "manga") {
        const entries = await prisma.mangaList.findMany({
          where: {
            userId: { in: friendIds },
            mangaId: mediaId,
            private: false,
          },
        })
        for (const e of entries) {
          const f = friendMap.get(e.userId)
          if (f) {
            result.push({
              id: f.id,
              friendId: f.friendId,
              nickname: f.nickname,
              user: f.friend,
              status: e.status,
              progress: e.chaptersProgress,
              progressVolumes: e.volumesProgress,
              score: e.score,
              updatedAt: e.updatedAt.toISOString(),
            })
          }
        }
      } else if (mediaType === "movie" || mediaType === "movies") {
        const entries = await prisma.movieList.findMany({
          where: {
            userId: { in: friendIds },
            movieId: mediaId,
            private: false,
          },
        })
        for (const e of entries) {
          const f = friendMap.get(e.userId)
          if (f) {
            result.push({
              id: f.id,
              friendId: f.friendId,
              nickname: f.nickname,
              user: f.friend,
              status: e.status,
              score: e.score,
              updatedAt: e.updatedAt.toISOString(),
            })
          }
        }
      } else if (mediaType === "tv") {
        const entries = await prisma.tvList.findMany({
          where: {
            userId: { in: friendIds },
            tvId: mediaId,
            private: false,
          },
        })
        for (const e of entries) {
          const f = friendMap.get(e.userId)
          if (f) {
            result.push({
              id: f.id,
              friendId: f.friendId,
              nickname: f.nickname,
              user: f.friend,
              status: e.status,
              progress: e.progress,
              score: e.score,
              updatedAt: e.updatedAt.toISOString(),
            })
          }
        }
      } else if (mediaType === "game" || mediaType === "games") {
        const entries = await prisma.gameList.findMany({
          where: {
            userId: { in: friendIds },
            gameId: mediaId,
            private: false,
          },
        })
        for (const e of entries) {
          const f = friendMap.get(e.userId)
          if (f) {
            result.push({
              id: f.id,
              friendId: f.friendId,
              nickname: f.nickname,
              user: f.friend,
              status: e.status,
              score: e.score,
              updatedAt: e.updatedAt.toISOString(),
            })
          }
        }
      } else if (mediaType === "book" || mediaType === "books") {
        const entries = await prisma.bookList.findMany({
          where: {
            userId: { in: friendIds },
            bookId: mediaId,
            private: false,
          },
        })
        for (const e of entries) {
          const f = friendMap.get(e.userId)
          if (f) {
            result.push({
              id: f.id,
              friendId: f.friendId,
              nickname: f.nickname,
              user: f.friend,
              status: e.status,
              progress: e.progress,
              score: e.score,
              updatedAt: e.updatedAt.toISOString(),
            })
          }
        }
      } else if (mediaType === "music") {
        const entries = await prisma.musicList.findMany({
          where: {
            userId: { in: friendIds },
            musicId: mediaId,
            private: false,
          },
        })
        for (const e of entries) {
          const f = friendMap.get(e.userId)
          if (f) {
            result.push({
              id: f.id,
              friendId: f.friendId,
              nickname: f.nickname,
              user: f.friend,
              status: e.status,
              score: e.score,
              updatedAt: e.updatedAt.toISOString(),
            })
          }
        }
      }

      return {
        success: true,
        friends: result,
      }
    },
  },
})
