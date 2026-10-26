import { prisma, countOf, or, and, toDate, type MediaType } from '@IRIS/database'
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

    const friendsQuery = prisma.orm.public.Friend.where((f) => f.userId.eq(currentUserId))

    const [total, rawFriends, rawIncoming, rawOutgoing, rawBlocked] = await Promise.all([
      countOf(friendsQuery),
      friendsQuery
        .include('friend')
        .orderBy((f) => f.createdAt.desc())
        .offset(skip)
        .limit(limit)
        .all(),
      prisma.orm.public.FriendRequest.where((r) =>
        and(r.receiverId.eq(currentUserId), r.status.eq('PENDING'))
      )
        .include('sender')
        .orderBy((r) => r.createdAt.desc())
        .all(),
      prisma.orm.public.FriendRequest.where((r) =>
        and(r.senderId.eq(currentUserId), r.status.eq('PENDING'))
      )
        .include('receiver')
        .orderBy((r) => r.createdAt.desc())
        .all(),
      prisma.orm.public.UserBlock.where((b) => b.blockerId.eq(currentUserId))
        .include('blocked')
        .orderBy((b) => b.createdAt.desc())
        .all(),
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
        createdAt: toDate(f.createdAt).toISOString(),
        user: {
          id: f.friend.id,
          username: f.friend.username,
          displayName: profile.displayName || null,
          avatarUrl: profile.avatarUrl || null,
          avatarFrame: profile.avatarFrame || null,
          badges: [...f.friend.badges],
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
        createdAt: toDate(r.createdAt).toISOString(),
        sender: {
          id: r.sender.id,
          username: r.sender.username,
          displayName: senderProfile.displayName || null,
          avatarUrl: senderProfile.avatarUrl || null,
          avatarFrame: senderProfile.avatarFrame || null,
          badges: [...r.sender.badges],
          customization: r.sender.customization,
        },
        user: {
          id: r.sender.id,
          username: r.sender.username,
          displayName: senderProfile.displayName || null,
          avatarUrl: senderProfile.avatarUrl || null,
          avatarFrame: senderProfile.avatarFrame || null,
          badges: [...r.sender.badges],
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
        createdAt: toDate(r.createdAt).toISOString(),
        receiver: {
          id: r.receiver.id,
          username: r.receiver.username,
          displayName: receiverProfile.displayName || null,
          avatarUrl: receiverProfile.avatarUrl || null,
          avatarFrame: receiverProfile.avatarFrame || null,
          badges: [...r.receiver.badges],
          customization: r.receiver.customization,
        },
        user: {
          id: r.receiver.id,
          username: r.receiver.username,
          displayName: receiverProfile.displayName || null,
          avatarUrl: receiverProfile.avatarUrl || null,
          avatarFrame: receiverProfile.avatarFrame || null,
          badges: [...r.receiver.badges],
          customization: r.receiver.customization,
        },
      }
    })

    const blockedUsers = rawBlocked.map((b) => {
      const blockedProfile = getProfileCustomization(b.blocked.customization)
      return {
        id: b.id,
        blockedId: b.blockedId,
        createdAt: toDate(b.createdAt).toISOString(),
        blocked: {
          id: b.blocked.id,
          username: b.blocked.username,
          displayName: blockedProfile.displayName || null,
          avatarUrl: blockedProfile.avatarUrl || null,
          avatarFrame: blockedProfile.avatarFrame || null,
          badges: [...b.blocked.badges],
          customization: b.blocked.customization,
        },
        user: {
          id: b.blocked.id,
          username: b.blocked.username,
          displayName: blockedProfile.displayName || null,
          avatarUrl: blockedProfile.avatarUrl || null,
          avatarFrame: blockedProfile.avatarFrame || null,
          badges: [...b.blocked.badges],
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
    const existing = await prisma.orm.public.Friend.where((f) =>
      and(
        f.userId.eq(currentUserId),
        or(f.id.eq(trimmedId), f.friendId.eq(trimmedId))
      )
    ).first()

    if (!existing) {
      throw new NotFound('Friend not found')
    }

    const data: { isPrivate?: boolean; nickname?: string | null } = {}
    if (body.isPrivate !== undefined) data.isPrivate = Boolean(body.isPrivate)
    if (body.nickname !== undefined) data.nickname = body.nickname?.trim() || null

    const updated = await prisma.orm.public.Friend.where((f) => f.id.eq(existing.id)).update(data)

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
    const existing = await prisma.orm.public.Friend.where((f) =>
      and(
        f.userId.eq(currentUserId),
        or(f.friendId.eq(trimmedFriendId), f.id.eq(trimmedFriendId))
      )
    ).first()

    if (!existing) {
      throw new NotFound('Friendship not found')
    }

    const targetFriendId = existing.friendId

    // Bilateral deletion
    await prisma.orm.public.Friend.where((f) =>
      or(
        and(f.userId.eq(currentUserId), f.friendId.eq(targetFriendId)),
        and(f.userId.eq(targetFriendId), f.friendId.eq(currentUserId))
      )
    ).deleteAll()

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

    let requestsQuery = prisma.orm.public.FriendRequest.where((r) => r.status.eq('PENDING'))
    if (type === 'outgoing') {
      requestsQuery = requestsQuery.where((r) => r.senderId.eq(currentUserId))
    } else if (type === 'all') {
      requestsQuery = requestsQuery.where((r) =>
        or(r.receiverId.eq(currentUserId), r.senderId.eq(currentUserId))
      )
    } else {
      requestsQuery = requestsQuery.where((r) => r.receiverId.eq(currentUserId))
    }

    const [total, rawRequests] = await Promise.all([
      countOf(requestsQuery),
      requestsQuery
        .include('sender')
        .include('receiver')
        .orderBy((r) => r.createdAt.desc())
        .offset(skip)
        .limit(limit)
        .all(),
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
        createdAt: toDate(r.createdAt).toISOString(),
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
      const user = await prisma.orm.public.User.where((u) =>
        u.username.ilike(body.targetUsername!.trim())
      ).first()
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
    const targetUser = await prisma.orm.public.User.where((u) => u.id.eq(targetUserId)).first()

    if (!targetUser) {
      throw new NotFound(`User with ID "${targetUserId}" not found`)
    }

    // Check if either user has blocked the other
    const isBlocked = await prisma.orm.public.UserBlock.where((b) =>
      or(
        and(b.blockerId.eq(currentUserId), b.blockedId.eq(targetUserId)),
        and(b.blockerId.eq(targetUserId), b.blockedId.eq(currentUserId))
      )
    ).first()

    if (isBlocked) {
      throw new BadRequest('Cannot send friend request to blocked user')
    }

    // Check if already friends
    const alreadyFriends = await prisma.orm.public.Friend.where((f) =>
      or(
        and(f.userId.eq(currentUserId), f.friendId.eq(targetUserId)),
        and(f.userId.eq(targetUserId), f.friendId.eq(currentUserId))
      )
    ).first()

    if (alreadyFriends) {
      throw new BadRequest('You are already friends with this user')
    }

    // Check if caller already sent pending request
    const existingOutgoing = await prisma.orm.public.FriendRequest.where((r) =>
      and(
        r.senderId.eq(currentUserId),
        r.receiverId.eq(targetUserId),
        r.status.eq('PENDING')
      )
    ).first()

    if (existingOutgoing) {
      throw new BadRequest('Friend request already sent and pending')
    }

    // Check if target user already sent a pending request to caller (Mutual request)
    const existingIncoming = await prisma.orm.public.FriendRequest.where((r) =>
      and(
        r.senderId.eq(targetUserId),
        r.receiverId.eq(currentUserId),
        r.status.eq('PENDING')
      )
    ).first()

    if (existingIncoming) {
      // Automatically establish bilateral friendship
      await prisma.transaction(async (tx) => {
        const f1 = await tx.orm.public.Friend.where((f) =>
          and(f.userId.eq(currentUserId), f.friendId.eq(targetUserId))
        ).first()
        if (!f1) {
          await tx.orm.public.Friend.create({
            userId: currentUserId,
            friendId: targetUserId,
          })
        }
        const f2 = await tx.orm.public.Friend.where((f) =>
          and(f.userId.eq(targetUserId), f.friendId.eq(currentUserId))
        ).first()
        if (!f2) {
          await tx.orm.public.Friend.create({
            userId: targetUserId,
            friendId: currentUserId,
          })
        }
        await tx.orm.public.FriendRequest.where((r) => r.id.eq(existingIncoming.id)).deleteAll()
      })

      return {
        success: true,
        message: 'Mutual friend request accepted, you are now friends!',
        requestId: existingIncoming.id,
      }
    }

    // Create new friend request
    const newRequest = await prisma.orm.public.FriendRequest.create({
      senderId: currentUserId,
      receiverId: targetUserId,
      message: body.message?.trim() || null,
      status: 'PENDING',
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
    const friendRequest = await prisma.orm.public.FriendRequest.where((r) =>
      r.id.eq(requestId.trim())
    )
      .include('sender')
      .include('receiver')
      .first()

    if (!friendRequest || friendRequest.receiverId !== currentUserId) {
      throw new NotFound('Friend request not found')
    }

    if (friendRequest.status !== 'PENDING') {
      throw new BadRequest('Friend request is not pending')
    }

    // Bilateral friendship creation + remove request
    await prisma.transaction(async (tx) => {
      const f1 = await tx.orm.public.Friend.where((f) =>
        and(f.userId.eq(currentUserId), f.friendId.eq(friendRequest.senderId))
      ).first()
      if (!f1) {
        await tx.orm.public.Friend.create({
          userId: currentUserId,
          friendId: friendRequest.senderId,
        })
      }
      const f2 = await tx.orm.public.Friend.where((f) =>
        and(f.userId.eq(friendRequest.senderId), f.friendId.eq(currentUserId))
      ).first()
      if (!f2) {
        await tx.orm.public.Friend.create({
          userId: friendRequest.senderId,
          friendId: currentUserId,
        })
      }
      await tx.orm.public.FriendRequest.where((r) => r.id.eq(friendRequest.id)).deleteAll()
    })

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
    const friendRequest = await prisma.orm.public.FriendRequest.where((r) =>
      r.id.eq(requestId.trim())
    ).first()

    if (!friendRequest || friendRequest.receiverId !== currentUserId) {
      throw new NotFound('Friend request not found')
    }

    await prisma.orm.public.FriendRequest.where((r) => r.id.eq(friendRequest.id)).deleteAll()

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
      const request = await prisma.orm.public.FriendRequest.where((r) =>
        r.id.eq(requestId.trim())
      ).first()
      if (!request || request.receiverId !== currentUserId) {
        throw new NotFound('Friend request not found')
      }
      const senderId = request.senderId
      await prisma.orm.public.FriendRequest.where((r) => r.id.eq(request.id)).deleteAll()
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
    const friendRequest = await prisma.orm.public.FriendRequest.where((r) =>
      and(r.id.eq(requestId.trim()), r.senderId.eq(currentUserId))
    ).first()

    if (!friendRequest) {
      throw new NotFound('Friend request not found')
    }

    await prisma.orm.public.FriendRequest.where((r) => r.id.eq(friendRequest.id)).deleteAll()

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
      const user = await prisma.orm.public.User.where((u) =>
        u.username.ilike(body.targetUsername!.trim())
      ).first()
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

    const targetUser = await prisma.orm.public.User.where((u) => u.id.eq(targetUserId)).first()
    if (!targetUser) {
      throw new NotFound('User not found')
    }

    await prisma.transaction(async (tx) => {
      await tx.orm.public.Friend.where((f) =>
        or(
          and(f.userId.eq(currentUserId), f.friendId.eq(targetUserId)),
          and(f.userId.eq(targetUserId), f.friendId.eq(currentUserId))
        )
      ).deleteAll()

      await tx.orm.public.FriendRequest.where((r) =>
        or(
          and(r.senderId.eq(currentUserId), r.receiverId.eq(targetUserId)),
          and(r.senderId.eq(targetUserId), r.receiverId.eq(currentUserId))
        )
      ).deleteAll()

      const existingBlock = await tx.orm.public.UserBlock.where((b) =>
        and(b.blockerId.eq(currentUserId), b.blockedId.eq(targetUserId))
      ).first()

      if (!existingBlock) {
        await tx.orm.public.UserBlock.create({
          blockerId: currentUserId,
          blockedId: targetUserId,
        })
      }
    })

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
    const block = await prisma.orm.public.UserBlock.where((b) =>
      and(
        b.blockerId.eq(currentUserId),
        or(b.id.eq(trimmed), b.blockedId.eq(trimmed))
      )
    ).first()

    if (!block) {
      throw new NotFound('Blocked user record not found')
    }

    await prisma.orm.public.UserBlock.where((b) => b.id.eq(block.id)).deleteAll()

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
    const friends = await prisma.orm.public.Friend.where((f) =>
      f.userId.eq(currentUserId)
    ).include('friend').all()

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
      updatedAt: any
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
        updatedAt: toDate(updatedAt).toISOString(),
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
      const entries = await prisma.orm.public.AnimeList.where((a) =>
        and(a.userId.in(friendIds), a.animeId.eq(mediaId), a.private.eq(false))
      ).all()
      for (const e of entries) {
        formatEntry(e.userId, e.status, e.progress, null, e.score, e.updatedAt)
      }
    } else if (normType === 'manga') {
      const entries = await prisma.orm.public.MangaList.where((m) =>
        and(m.userId.in(friendIds), m.mangaId.eq(mediaId), m.private.eq(false))
      ).all()
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
      const entries = await prisma.orm.public.MovieList.where((m) =>
        and(m.userId.in(friendIds), m.movieId.eq(mediaId), m.private.eq(false))
      ).all()
      for (const e of entries) {
        formatEntry(e.userId, e.status, null, null, e.score, e.updatedAt)
      }
    } else if (normType === 'tv') {
      const entries = await prisma.orm.public.TvList.where((t) =>
        and(t.userId.in(friendIds), t.tvId.eq(mediaId), t.private.eq(false))
      ).all()
      for (const e of entries) {
        formatEntry(e.userId, e.status, e.progress, null, e.score, e.updatedAt)
      }
    } else if (normType === 'game') {
      const entries = await prisma.orm.public.GameList.where((g) =>
        and(g.userId.in(friendIds), g.gameId.eq(mediaId), g.private.eq(false))
      ).all()
      for (const e of entries) {
        formatEntry(e.userId, e.status, null, null, e.score, e.updatedAt)
      }
    } else if (normType === 'book') {
      const entries = await prisma.orm.public.BookList.where((b) =>
        and(b.userId.in(friendIds), b.bookId.eq(mediaId), b.private.eq(false))
      ).all()
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
      const entries = await prisma.orm.public.MusicList.where((m) =>
        and(m.userId.in(friendIds), m.musicId.eq(mediaId), m.private.eq(false))
      ).all()
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
    const validFriends = await prisma.orm.public.Friend.where((f) =>
      and(f.userId.eq(currentUserId), f.friendId.in(body.friendIds))
    ).all()

    if (validFriends.length === 0) {
      throw new BadRequest('No valid friends selected')
    }

    // Optional activity logging
    try {
      const upperMediaType = body.mediaType.toUpperCase() as MediaType
      await prisma.orm.public.ActivityLog.create({
        userId: currentUserId,
        type: 'RECOMMENDATION_POSTED',
        mediaType: upperMediaType,
        mediaId: body.mediaId,
        title: `Recommended "${body.mediaTitle}" to ${validFriends.length} friend(s)`,
        content: body.message?.trim() || null,
        metadata: {
          mediaTitle: body.mediaTitle,
          mediaCover: body.mediaCover ?? null,
          recommendedToCount: validFriends.length,
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


