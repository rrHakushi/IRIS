import { prisma, type MediaType } from '@IRIS/database'
import { getProfileCustomization } from '@IRIS/shared'
import { BadRequest, NotFound } from '../../lib/errors'
import { ActivityServ } from './activity.serv'

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

    const [total, rawFriends, rawIncoming, rawOutgoing, rawBlocked] = await Promise.all([
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
      prisma.friendRequest.findMany({
        where: { receiverId: currentUserId, status: 'PENDING' },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              customization: true,
              badges: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.friendRequest.findMany({
        where: { senderId: currentUserId, status: 'PENDING' },
        include: {
          receiver: {
            select: {
              id: true,
              username: true,
              customization: true,
              badges: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.userBlock.findMany({
        where: { blockerId: currentUserId },
        include: {
          blocked: {
            select: {
              id: true,
              username: true,
              customization: true,
              badges: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
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
          customization: f.friend.customization,
        },
      }
    })

    const incomingRequests = rawIncoming.map((r) => {
      const senderProfile = getProfileCustomization(r.sender.customization)
      return {
        id: r.id,
        senderId: r.senderId,
        message: r.message,
        createdAt: r.createdAt.toISOString(),
        sender: {
          id: r.sender.id,
          username: r.sender.username,
          displayName: senderProfile.displayName || null,
          avatarUrl: senderProfile.avatarUrl || null,
          avatarFrame: senderProfile.avatarFrame || null,
          badges: r.sender.badges,
          customization: r.sender.customization,
        },
        user: {
          id: r.sender.id,
          username: r.sender.username,
          displayName: senderProfile.displayName || null,
          avatarUrl: senderProfile.avatarUrl || null,
          avatarFrame: senderProfile.avatarFrame || null,
          badges: r.sender.badges,
          customization: r.sender.customization,
        },
      }
    })

    const outgoingRequests = rawOutgoing.map((r) => {
      const receiverProfile = getProfileCustomization(r.receiver.customization)
      return {
        id: r.id,
        receiverId: r.receiverId,
        message: r.message,
        createdAt: r.createdAt.toISOString(),
        receiver: {
          id: r.receiver.id,
          username: r.receiver.username,
          displayName: receiverProfile.displayName || null,
          avatarUrl: receiverProfile.avatarUrl || null,
          avatarFrame: receiverProfile.avatarFrame || null,
          badges: r.receiver.badges,
          customization: r.receiver.customization,
        },
        user: {
          id: r.receiver.id,
          username: r.receiver.username,
          displayName: receiverProfile.displayName || null,
          avatarUrl: receiverProfile.avatarUrl || null,
          avatarFrame: receiverProfile.avatarFrame || null,
          badges: r.receiver.badges,
          customization: r.receiver.customization,
        },
      }
    })

    const blockedUsers = rawBlocked.map((b) => {
      const blockedProfile = getProfileCustomization(b.blocked.customization)
      return {
        id: b.id,
        blockedId: b.blockedId,
        createdAt: b.createdAt.toISOString(),
        blocked: {
          id: b.blocked.id,
          username: b.blocked.username,
          displayName: blockedProfile.displayName || null,
          avatarUrl: blockedProfile.avatarUrl || null,
          avatarFrame: blockedProfile.avatarFrame || null,
          badges: b.blocked.badges,
          customization: b.blocked.customization,
        },
        user: {
          id: b.blocked.id,
          username: b.blocked.username,
          displayName: blockedProfile.displayName || null,
          avatarUrl: blockedProfile.avatarUrl || null,
          avatarFrame: blockedProfile.avatarFrame || null,
          badges: b.blocked.badges,
          customization: b.blocked.customization,
        },
      }
    })

    return {
      success: true,
      friends,
      incomingRequests,
      outgoingRequests,
      blockedUsers,
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
   * Update friend relationship (privacy, nickname).
   */
  public static async updateFriend(
    currentUserId: string,
    friendId: string,
    body: { isPrivate?: boolean; nickname?: string | null }
  ) {
    const trimmedId = friendId.trim()
    const existing = await prisma.friend.findFirst({
      where: {
        userId: currentUserId,
        OR: [{ id: trimmedId }, { friendId: trimmedId }],
      },
    })

    if (!existing) {
      throw new NotFound('Friend not found')
    }

    const data: any = {}
    if (body.isPrivate !== undefined) data.isPrivate = Boolean(body.isPrivate)
    if (body.nickname !== undefined) data.nickname = body.nickname?.trim() || null

    const updated = await prisma.friend.update({
      where: { id: existing.id },
      data,
    })

    return {
      success: true,
      friend: updated,
    }
  }

  /**
   * Remove friend strictly by target friend user ID or friendship record ID.
   */
  public static async removeFriend(currentUserId: string, friendId: string) {
    const trimmedFriendId = friendId.trim()

    // Verify friendship exists by friendship ID or friend user ID
    const existing = await prisma.friend.findFirst({
      where: {
        userId: currentUserId,
        OR: [{ friendId: trimmedFriendId }, { id: trimmedFriendId }],
      },
    })

    if (!existing) {
      throw new NotFound('Friendship not found')
    }

    const targetFriendId = existing.friendId

    // Bilateral deletion
    await prisma.friend.deleteMany({
      where: {
        OR: [
          { userId: currentUserId, friendId: targetFriendId },
          { userId: targetFriendId, friendId: currentUserId },
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
   * Send a friend request by target user ID (UUID) or username.
   */
  public static async sendFriendRequest(
    currentUserId: string,
    body: { targetUserId?: string; targetUsername?: string; message?: string | null }
  ) {
    let targetUserId = body.targetUserId?.trim()

    if (!targetUserId && body.targetUsername) {
      const user = await prisma.user.findFirst({
        where: { username: { equals: body.targetUsername.trim(), mode: 'insensitive' } },
        select: { id: true },
      })
      if (!user) {
        throw new NotFound(`User @${body.targetUsername.trim()} not found`)
      }
      targetUserId = user.id
    }

    if (!targetUserId) {
      throw new BadRequest('Either targetUserId or targetUsername is required')
    }

    if (targetUserId === currentUserId) {
      throw new BadRequest('You cannot send a friend request to yourself')
    }

    // Verify target user exists
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

    const senderProfile = friendRequest.sender ? getProfileCustomization(friendRequest.sender.customization) : null
    const receiverProfile = friendRequest.receiver ? getProfileCustomization(friendRequest.receiver.customization) : null

    ActivityServ.recordFriendActivity({
      userId: currentUserId,
      friendId: friendRequest.senderId,
      friendUsername: friendRequest.sender?.username,
      friendDisplayName: senderProfile?.displayName,
      friendAvatarUrl: senderProfile?.avatarUrl,
    })

    ActivityServ.recordFriendActivity({
      userId: friendRequest.senderId,
      friendId: currentUserId,
      friendUsername: friendRequest.receiver?.username,
      friendDisplayName: receiverProfile?.displayName,
      friendAvatarUrl: receiverProfile?.avatarUrl,
    })

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
   * Respond to a friend request (ACCEPT, DECLINE, or BLOCK).
   */
  public static async respondFriendRequest(
    currentUserId: string,
    requestId: string,
    action: 'ACCEPT' | 'DECLINE' | 'BLOCK'
  ) {
    if (action === 'ACCEPT') {
      return await this.acceptFriendRequest(currentUserId, requestId)
    }

    if (action === 'DECLINE') {
      return await this.declineFriendRequest(currentUserId, requestId)
    }

    if (action === 'BLOCK') {
      const request = await prisma.friendRequest.findUnique({
        where: { id: requestId.trim() },
      })
      if (!request || request.receiverId !== currentUserId) {
        throw new NotFound('Friend request not found')
      }
      const senderId = request.senderId
      await prisma.friendRequest.delete({
        where: { id: request.id },
      })
      await this.blockUser(currentUserId, { targetUserId: senderId })
      return {
        success: true,
        message: 'Friend request rejected and user blocked',
      }
    }

    throw new BadRequest(`Invalid action "${action}"`)
  }

  /**
   * Cancel an outgoing friend request by request ID.
   */
  public static async cancelFriendRequest(
    currentUserId: string,
    requestId: string
  ) {
    const friendRequest = await prisma.friendRequest.findFirst({
      where: {
        id: requestId.trim(),
        senderId: currentUserId,
      },
    })

    if (!friendRequest) {
      throw new NotFound('Friend request not found')
    }

    await prisma.friendRequest.delete({
      where: { id: friendRequest.id },
    })

    return {
      success: true,
      message: 'Friend request cancelled successfully',
    }
  }

  /**
   * Block a user by target user ID or username.
   */
  public static async blockUser(
    currentUserId: string,
    body: { targetUserId?: string; targetUsername?: string }
  ) {
    let targetUserId = body.targetUserId?.trim()

    if (!targetUserId && body.targetUsername) {
      const user = await prisma.user.findFirst({
        where: { username: { equals: body.targetUsername.trim(), mode: 'insensitive' } },
        select: { id: true },
      })
      if (!user) {
        throw new NotFound(`User @${body.targetUsername.trim()} not found`)
      }
      targetUserId = user.id
    }

    if (!targetUserId) {
      throw new BadRequest('Either targetUserId or targetUsername is required')
    }

    if (targetUserId === currentUserId) {
      throw new BadRequest('You cannot block yourself')
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    })
    if (!targetUser) {
      throw new NotFound('User not found')
    }

    await prisma.$transaction([
      prisma.friend.deleteMany({
        where: {
          OR: [
            { userId: currentUserId, friendId: targetUserId },
            { userId: targetUserId, friendId: currentUserId },
          ],
        },
      }),
      prisma.friendRequest.deleteMany({
        where: {
          OR: [
            { senderId: currentUserId, receiverId: targetUserId },
            { senderId: targetUserId, receiverId: currentUserId },
          ],
        },
      }),
      prisma.userBlock.upsert({
        where: {
          blockerId_blockedId: {
            blockerId: currentUserId,
            blockedId: targetUserId,
          },
        },
        create: {
          blockerId: currentUserId,
          blockedId: targetUserId,
        },
        update: {},
      }),
    ])

    return {
      success: true,
      message: 'User blocked successfully',
    }
  }

  /**
   * Unblock a user by block record ID or blocked user ID.
   */
  public static async unblockUser(
    currentUserId: string,
    blockId: string
  ) {
    const trimmed = blockId.trim()
    const block = await prisma.userBlock.findFirst({
      where: {
        blockerId: currentUserId,
        OR: [{ id: trimmed }, { blockedId: trimmed }],
      },
    })

    if (!block) {
      throw new NotFound('Blocked user record not found')
    }

    await prisma.userBlock.delete({
      where: { id: block.id },
    })

    return {
      success: true,
      message: 'User unblocked successfully',
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
