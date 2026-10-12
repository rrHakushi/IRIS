import { prisma, type MediaType } from '@IRIS/database'
import { getProfileCustomization } from '@IRIS/shared'
import { BadRequest, NotFound } from '../../lib/errors'

const VALID_MEDIA_TYPES = [
  'anime',
  'manga',
  'movie',
  'tv',
  'game',
  'book',
  'music',
] as const

type ValidMediaType = (typeof VALID_MEDIA_TYPES)[number]

export class CarinaFriendsServ {
  /**
   * Get friends list for authenticated user with pagination.
   */
  public static async listFriends(
    currentUserId: string,
    query?: { page?: number; limit?: number }
  ) {
    const page = Math.max(1, query?.page ?? 1)
    const limit = Math.max(1, Math.min(50, query?.limit ?? 10))
    const skip = (page - 1) * limit

    const where = { userId: currentUserId }

    const [total, rawFriends] = await Promise.all([
      prisma.friend.count({ where }),
      prisma.friend.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          friend: {
            select: {
              id: true,
              username: true,
              customization: true,
              badges: true,
            },
          },
        },
      }),
    ])

    const totalPages = Math.max(1, Math.ceil(total / limit))
    const hasMore = page < totalPages

    const friends = rawFriends.map((f) => {
      const profile = getProfileCustomization(f.friend.customization)
      return {
        id: f.id,
        friendId: f.friendId,
        nickname: f.nickname,
        isPrivate: f.isPrivate,
        createdAt: f.createdAt.toISOString(),
        user: {
          id: f.friend.id,
          username: f.friend.username,
          displayName: profile.displayName || null,
          avatarUrl: profile.avatarUrl || null,
          avatarFrame: profile.avatarFrame || null,
          badges: f.friend.badges,
        },
      }
    })

    return {
      success: true,
      friends,
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
   * Remove friend strictly by target friend user ID (UUID).
   */
  public static async removeFriend(currentUserId: string, friendId: string) {
    const trimmedFriendId = friendId.trim()

    // Verify friendship exists
    const existing = await prisma.friend.findFirst({
      where: {
        userId: currentUserId,
        friendId: trimmedFriendId,
      },
    })

    if (!existing) {
      throw new NotFound('Friendship not found')
    }

    // Bilateral deletion
    await prisma.friend.deleteMany({
      where: {
        OR: [
          { userId: currentUserId, friendId: trimmedFriendId },
          { userId: trimmedFriendId, friendId: currentUserId },
        ],
      },
    })

    return {
      success: true,
      message: 'Friend removed successfully',
    }
  }

  /**
   * Get pending friend requests (incoming, outgoing, or all).
   */
  public static async listFriendRequests(
    currentUserId: string,
    query?: {
      type?: 'incoming' | 'outgoing' | 'all'
      page?: number
      limit?: number
    }
  ) {
    const page = Math.max(1, query?.page ?? 1)
    const limit = Math.max(1, Math.min(50, query?.limit ?? 10))
    const skip = (page - 1) * limit
    const type = query?.type ?? 'incoming'

    let where: any = { status: 'PENDING' }
    if (type === 'outgoing') {
      where.senderId = currentUserId
    } else if (type === 'all') {
      where.OR = [{ receiverId: currentUserId }, { senderId: currentUserId }]
    } else {
      // Default: incoming
      where.receiverId = currentUserId
    }

    const [total, rawRequests] = await Promise.all([
      prisma.friendRequest.count({ where }),
      prisma.friendRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              customization: true,
            },
          },
          receiver: {
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

    const requests = rawRequests.map((r) => {
      const senderProfile = getProfileCustomization(r.sender.customization)
      const receiverProfile = getProfileCustomization(r.receiver.customization)

      return {
        id: r.id,
        senderId: r.senderId,
        receiverId: r.receiverId,
        message: r.message,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        sender: {
          id: r.sender.id,
          username: r.sender.username,
          displayName: senderProfile.displayName || null,
          avatarUrl: senderProfile.avatarUrl || null,
          avatarFrame: senderProfile.avatarFrame || null,
        },
        receiver: {
          id: r.receiver.id,
          username: r.receiver.username,
          displayName: receiverProfile.displayName || null,
          avatarUrl: receiverProfile.avatarUrl || null,
          avatarFrame: receiverProfile.avatarFrame || null,
        },
      }
    })

    return {
      success: true,
      requests,
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
   * Send a friend request strictly by target user ID (UUID).
   */
  public static async sendFriendRequest(
    currentUserId: string,
    body: { targetUserId: string; message?: string }
  ) {
    const targetUserId = body.targetUserId.trim()

    if (targetUserId === currentUserId) {
      throw new BadRequest('You cannot send a friend request to yourself')
    }

    // Verify target user exists strictly by ID
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    })

    if (!targetUser) {
      throw new NotFound(`User with ID "${targetUserId}" not found`)
    }

    // Check if either user has blocked the other
    const isBlocked = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: currentUserId, blockedId: targetUserId },
          { blockerId: targetUserId, blockedId: currentUserId },
        ],
      },
    })

    if (isBlocked) {
      throw new BadRequest('Cannot send friend request to blocked user')
    }

    // Check if already friends
    const alreadyFriends = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId: currentUserId, friendId: targetUserId },
          { userId: targetUserId, friendId: currentUserId },
        ],
      },
    })

    if (alreadyFriends) {
      throw new BadRequest('You are already friends with this user')
    }

    // Check if caller already sent pending request
    const existingOutgoing = await prisma.friendRequest.findFirst({
      where: {
        senderId: currentUserId,
        receiverId: targetUserId,
        status: 'PENDING',
      },
    })

    if (existingOutgoing) {
      throw new BadRequest('Friend request already sent and pending')
    }

    // Check if target user already sent a pending request to caller (Mutual request)
    const existingIncoming = await prisma.friendRequest.findFirst({
      where: {
        senderId: targetUserId,
        receiverId: currentUserId,
        status: 'PENDING',
      },
    })

    if (existingIncoming) {
      // Automatically establish bilateral friendship
      await prisma.$transaction([
        prisma.friend.upsert({
          where: {
            userId_friendId: {
              userId: currentUserId,
              friendId: targetUserId,
            },
          },
          create: {
            userId: currentUserId,
            friendId: targetUserId,
          },
          update: {},
        }),
        prisma.friend.upsert({
          where: {
            userId_friendId: {
              userId: targetUserId,
              friendId: currentUserId,
            },
          },
          create: {
            userId: targetUserId,
            friendId: currentUserId,
          },
          update: {},
        }),
        prisma.friendRequest.delete({
          where: { id: existingIncoming.id },
        }),
      ])

      return {
        success: true,
        message: 'Mutual friend request accepted, you are now friends!',
        requestId: existingIncoming.id,
      }
    }

    // Create new friend request
    const newRequest = await prisma.friendRequest.create({
      data: {
        senderId: currentUserId,
        receiverId: targetUserId,
        message: body.message?.trim() || null,
        status: 'PENDING',
      },
    })

    return {
      success: true,
      message: 'Friend request sent successfully',
      requestId: newRequest.id,
    }
  }

  /**
   * Accept a pending friend request by request ID.
   */
  public static async acceptFriendRequest(
    currentUserId: string,
    requestId: string
  ) {
    const friendRequest = await prisma.friendRequest.findUnique({
      where: { id: requestId.trim() },
    })

    if (!friendRequest || friendRequest.receiverId !== currentUserId) {
      throw new NotFound('Friend request not found')
    }

    if (friendRequest.status !== 'PENDING') {
      throw new BadRequest('Friend request is not pending')
    }

    // Bilateral friendship creation + remove request
    await prisma.$transaction([
      prisma.friend.upsert({
        where: {
          userId_friendId: {
            userId: currentUserId,
            friendId: friendRequest.senderId,
          },
        },
        create: {
          userId: currentUserId,
          friendId: friendRequest.senderId,
        },
        update: {},
      }),
      prisma.friend.upsert({
        where: {
          userId_friendId: {
            userId: friendRequest.senderId,
            friendId: currentUserId,
          },
        },
        create: {
          userId: friendRequest.senderId,
          friendId: currentUserId,
        },
        update: {},
      }),
      prisma.friendRequest.delete({
        where: { id: friendRequest.id },
      }),
    ])

    return {
      success: true,
      message: 'Friend request accepted successfully',
      friendId: friendRequest.senderId,
    }
  }

  /**
   * Decline a pending friend request by request ID.
   */
  public static async declineFriendRequest(
    currentUserId: string,
    requestId: string
  ) {
    const friendRequest = await prisma.friendRequest.findUnique({
      where: { id: requestId.trim() },
    })

    if (!friendRequest || friendRequest.receiverId !== currentUserId) {
      throw new NotFound('Friend request not found')
    }

    await prisma.friendRequest.delete({
      where: { id: friendRequest.id },
    })

    return {
      success: true,
      message: 'Friend request declined successfully',
    }
  }

  /**
   * Get friends tracking status for a media item.
   */
  public static async getFriendsMediaTracking(
    currentUserId: string,
    mediaType: string,
    mediaId: number
  ) {
    const normType = mediaType.toLowerCase().trim() as ValidMediaType

    if (!VALID_MEDIA_TYPES.includes(normType)) {
      throw new BadRequest(
        `Invalid media type "${mediaType}". Valid types: ${VALID_MEDIA_TYPES.join(', ')}`
      )
    }

    // 1. Fetch caller's friends
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
      return {
        success: true,
        mediaType: normType,
        mediaId,
        friends: [],
      }
    }

    const friendIds = friends.map((f) => f.friendId)
    const friendMap = new Map(friends.map((f) => [f.friendId, f]))

    const trackingList: Array<{
      id: string
      friendId: string
      nickname: string | null
      status: string
      progress: number | null
      progressVolumes: number | null
      score: number | null
      updatedAt: string
      user: {
        id: string
        username: string
        displayName: string | null
        avatarUrl: string | null
        avatarFrame: string | null
      }
    }> = []

    const formatEntry = (
      userId: string,
      status: string,
      progress: number | null,
      progressVolumes: number | null,
      score: number | null,
      updatedAt: Date
    ) => {
      const f = friendMap.get(userId)
      if (!f) return
      const profile = getProfileCustomization(f.friend.customization)
      trackingList.push({
        id: f.id,
        friendId: f.friendId,
        nickname: f.nickname,
        status,
        progress,
        progressVolumes,
        score,
        updatedAt: updatedAt.toISOString(),
        user: {
          id: f.friend.id,
          username: f.friend.username,
          displayName: profile.displayName || null,
          avatarUrl: profile.avatarUrl || null,
          avatarFrame: profile.avatarFrame || null,
        },
      })
    }

    if (normType === 'anime') {
      const entries = await prisma.animeList.findMany({
        where: { userId: { in: friendIds }, animeId: mediaId, private: false },
      })
      for (const e of entries) {
        formatEntry(e.userId, e.status, e.progress, null, e.score, e.updatedAt)
      }
    } else if (normType === 'manga') {
      const entries = await prisma.mangaList.findMany({
        where: { userId: { in: friendIds }, mangaId: mediaId, private: false },
      })
      for (const e of entries) {
        formatEntry(
          e.userId,
          e.status,
          e.chaptersProgress,
          e.volumesProgress,
          e.score,
          e.updatedAt
        )
      }
    } else if (normType === 'movie') {
      const entries = await prisma.movieList.findMany({
        where: { userId: { in: friendIds }, movieId: mediaId, private: false },
      })
      for (const e of entries) {
        formatEntry(e.userId, e.status, null, null, e.score, e.updatedAt)
      }
    } else if (normType === 'tv') {
      const entries = await prisma.tvList.findMany({
        where: { userId: { in: friendIds }, tvId: mediaId, private: false },
      })
      for (const e of entries) {
        formatEntry(e.userId, e.status, e.progress, null, e.score, e.updatedAt)
      }
    } else if (normType === 'game') {
      const entries = await prisma.gameList.findMany({
        where: { userId: { in: friendIds }, gameId: mediaId, private: false },
      })
      for (const e of entries) {
        formatEntry(e.userId, e.status, null, null, e.score, e.updatedAt)
      }
    } else if (normType === 'book') {
      const entries = await prisma.bookList.findMany({
        where: { userId: { in: friendIds }, bookId: mediaId, private: false },
      })
      for (const e of entries) {
        formatEntry(
          e.userId,
          e.status,
          e.progressPages,
          e.progressVolumes,
          e.score,
          e.updatedAt
        )
      }
    } else if (normType === 'music') {
      const entries = await prisma.musicList.findMany({
        where: { userId: { in: friendIds }, musicId: mediaId, private: false },
      })
      for (const e of entries) {
        formatEntry(e.userId, e.status, null, null, e.score, e.updatedAt)
      }
    }

    return {
      success: true,
      mediaType: normType,
      mediaId,
      friends: trackingList,
    }
  }

  /**
   * Recommend media directly to friends strictly by user IDs (UUIDs).
   */
  public static async recommendToFriends(
    currentUserId: string,
    body: {
      friendIds: string[]
      mediaType: string
      mediaId: number
      mediaTitle: string
      mediaCover?: string
      message?: string
    }
  ) {
    const validFriends = await prisma.friend.findMany({
      where: {
        userId: currentUserId,
        friendId: { in: body.friendIds },
      },
      select: { friendId: true },
    })

    if (validFriends.length === 0) {
      throw new BadRequest('No valid friends selected')
    }

    // Optional activity logging
    try {
      const upperMediaType = body.mediaType.toUpperCase() as MediaType
      await prisma.activityLog.create({
        data: {
          userId: currentUserId,
          type: 'RECOMMENDATION_POSTED',
          mediaType: upperMediaType,
          mediaId: body.mediaId,
          title: `Recommended "${body.mediaTitle}" to ${validFriends.length} friend(s)`,
          content: body.message?.trim() || null,
          metadata: {
            mediaTitle: body.mediaTitle,
            mediaCover: body.mediaCover,
            recommendedToCount: validFriends.length,
          },
        },
      })
    } catch {
      // Non-critical if activity log fails
    }

    return {
      success: true,
      message: 'Media recommendation sent to friend(s)',
      sentCount: validFriends.length,
    }
  }
}
