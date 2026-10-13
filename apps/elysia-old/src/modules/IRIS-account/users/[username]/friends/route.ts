import { defineRoute, t } from "@/router"
import { NotFound } from "@/utils/errors"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
    }),
  },
  GET: {
    schema: {
      response: {
        200: t.Object({
          success: t.Boolean(),
          total: t.Number(),
          friends: t.Array(
            t.Object({
              id: t.String(),
              friendId: t.String(),
              nickname: t.Nullable(t.String()),
              isPrivate: t.Boolean(),
              createdAt: t.String(),
              user: t.Object({
                id: t.String(),
                username: t.String(),
                customization: t.Any(),
                createdAt: t.String(),
              }),
            })
          ),
        }),
      },
    },
    async handler({ session, params, prisma }) {
      const targetUsername = params.username.trim()

      const user = await prisma.user.findUnique({
        where: { username: targetUsername },
        select: { id: true, username: true },
      })

      if (!user) {
        throw new NotFound(`User @${targetUsername} not found.`)
      }

      const isOwner = Boolean(
        session.isAuthenticated && session.user?.id === user.id
      )

      // Query friends: if owner, return all; if visitor, only isPrivate: false
      const whereCondition: {
        userId: string
        isPrivate?: boolean
      } = {
        userId: user.id,
      }

      if (!isOwner) {
        whereCondition.isPrivate = false
      }

      const friends = await prisma.friend.findMany({
        where: whereCondition,
        include: {
          friend: {
            select: {
              id: true,
              username: true,
              customization: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })

      return {
        success: true,
        total: friends.length,
        friends: friends.map((f) => ({
          id: f.id,
          friendId: f.friendId,
          nickname: isOwner ? f.nickname : null,
          isPrivate: f.isPrivate,
          createdAt: f.createdAt.toISOString(),
          user: {
            id: f.friend.id,
            username: f.friend.username,
            customization: f.friend.customization,
            createdAt: f.friend.createdAt.toISOString(),
          },
        })),
      }
    },
  },
})
