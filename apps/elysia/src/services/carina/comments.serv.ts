import { prisma } from '@IRIS/database'
import { getProfileCustomization } from '@IRIS/shared'
import { IRISBitField, IRISFlags } from '@IRIS/permissions'
import { NotFound, BadRequest, Forbidden } from '../../lib/errors'

export const VALID_MEDIA_TYPES = [
  'anime',
  'manga',
  'movie',
  'tv',
  'game',
  'book',
  'music',
] as const

export type ValidMediaType = (typeof VALID_MEDIA_TYPES)[number]

export class CarinaCommentsServ {
  /**
   * Helper to format an author profile summary.
   */
  public static formatAuthor(user: {
    id: string
    username: string
    customization?: any
  }) {
    const profile = getProfileCustomization(user.customization)
    const trimmedDisplayName =
      typeof profile.displayName === 'string' ? profile.displayName.trim() : ''

    return {
      id: user.id,
      username: user.username,
      displayName: trimmedDisplayName !== '' ? trimmedDisplayName : null,
      avatarUrl: profile.avatarUrl ?? null,
      avatarFrame: profile.avatarFrame ?? null,
      bannerUrl: profile.bannerUrl ?? null,
    }
  }

  /**
   * Helper to format a comment and its nested reply for API responses.
   */
  public static formatComment(item: {
    id: string
    listOwnerId: string
    mediaType: string
    authorId: string
    content: string
    isSpoiler: boolean
    createdAt: Date
    updatedAt: Date
    author: {
      id: string
      username: string
      customization?: any
    }
    reply?: {
      id: string
      commentId: string
      authorId: string
      content: string
      createdAt: Date
      updatedAt: Date
      author: {
        id: string
        username: string
        customization?: any
      }
    } | null
  }) {
    return {
      id: item.id,
      listOwnerId: item.listOwnerId,
      mediaType: item.mediaType,
      authorId: item.authorId,
      content: item.content,
      isSpoiler: item.isSpoiler,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      author: this.formatAuthor(item.author),
      reply: item.reply
        ? {
            id: item.reply.id,
            commentId: item.reply.commentId,
            authorId: item.reply.authorId,
            content: item.reply.content,
            createdAt: item.reply.createdAt.toISOString(),
            updatedAt: item.reply.updatedAt.toISOString(),
            author: this.formatAuthor(item.reply.author),
          }
        : null,
    }
  }

  /**
   * Helper to format a single reply.
   */
  public static formatReply(reply: {
    id: string
    commentId: string
    authorId: string
    content: string
    createdAt: Date
    updatedAt: Date
    author: {
      id: string
      username: string
      customization?: any
    }
  }) {
    return {
      id: reply.id,
      commentId: reply.commentId,
      authorId: reply.authorId,
      content: reply.content,
      createdAt: reply.createdAt.toISOString(),
      updatedAt: reply.updatedAt.toISOString(),
      author: this.formatAuthor(reply.author),
    }
  }

  /**
   * Get comments on a user's profile (10 per page default).
   */
  public static async getProfileComments(
    targetUserId: string,
    query?: { page?: number; limit?: number }
  ) {
    const page = Math.max(1, query?.page ?? 1)
    const limit = Math.max(1, Math.min(50, query?.limit ?? 10))
    const skip = (page - 1) * limit

    const profileOwner = await prisma.user.findUnique({
      where: { id: targetUserId.trim() },
      select: { id: true },
    })

    if (!profileOwner) {
      throw new NotFound('User not found')
    }

    const where = {
      listOwnerId: profileOwner.id,
      mediaType: 'profile',
    }

    const [total, rawComments] = await Promise.all([
      prisma.listComment.count({ where }),
      prisma.listComment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
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
      }),
    ])

    const totalPages = Math.max(1, Math.ceil(total / limit))
    const hasMore = page < totalPages

    const comments = rawComments.map((c) => this.formatComment(c))

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
  }

  /**
   * Post a comment on a user's profile.
   */
  public static async createProfileComment(
    authorId: string,
    targetUserId: string,
    body: { content: string; isSpoiler?: boolean }
  ) {
    const trimmed = body.content.trim()
    if (!trimmed) {
      throw new BadRequest('Comment content cannot be empty.')
    }

    const profileOwner = await prisma.user.findUnique({
      where: { id: targetUserId.trim() },
      select: { id: true, customization: true },
    })

    if (!profileOwner) {
      throw new NotFound('User not found')
    }

    // Check block relationship
    const isBlocked = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: authorId, blockedId: profileOwner.id },
          { blockerId: profileOwner.id, blockedId: authorId },
        ],
      },
    })

    if (isBlocked) {
      throw new BadRequest('Cannot comment on profile due to user block.')
    }

    // Check privacy settings
    const ownerCustom = getProfileCustomization(profileOwner.customization)
    const allowComments =
      ownerCustom.privacy?.allowComments ||
      (profileOwner.customization as any)?.privacy?.allowComments ||
      'public'

    if (allowComments === 'disabled') {
      throw new BadRequest('This user has disabled comments on their profile.')
    }

    if (allowComments === 'friends' && authorId !== profileOwner.id) {
      const areFriends = await prisma.friend.findFirst({
        where: {
          OR: [
            { userId: profileOwner.id, friendId: authorId },
            { userId: authorId, friendId: profileOwner.id },
          ],
        },
      })
      if (!areFriends) {
        throw new BadRequest('Only friends can comment on this user profile.')
      }
    }

    const rawComment = await prisma.listComment.create({
      data: {
        listOwnerId: profileOwner.id,
        mediaType: 'profile',
        authorId,
        content: trimmed,
        isSpoiler: Boolean(body.isSpoiler),
      },
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

    return {
      success: true,
      comment: this.formatComment(rawComment),
    }
  }

  /**
   * Get comments on a user's media list (10 per page default).
   */
  public static async getListComments(
    targetUserId: string,
    mediaType: string,
    query?: { page?: number; limit?: number }
  ) {
    const normMediaType = mediaType.trim().toLowerCase()
    if (!VALID_MEDIA_TYPES.includes(normMediaType as ValidMediaType)) {
      throw new BadRequest(
        `Invalid mediaType. Must be one of: ${VALID_MEDIA_TYPES.join(', ')}`
      )
    }

    const page = Math.max(1, query?.page ?? 1)
    const limit = Math.max(1, Math.min(50, query?.limit ?? 10))
    const skip = (page - 1) * limit

    const listOwner = await prisma.user.findUnique({
      where: { id: targetUserId.trim() },
      select: { id: true },
    })

    if (!listOwner) {
      throw new NotFound('User not found')
    }

    const where = {
      listOwnerId: listOwner.id,
      mediaType: normMediaType,
    }

    const [total, rawComments] = await Promise.all([
      prisma.listComment.count({ where }),
      prisma.listComment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
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
      }),
    ])

    const totalPages = Math.max(1, Math.ceil(total / limit))
    const hasMore = page < totalPages

    const comments = rawComments.map((c) => this.formatComment(c))

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
  }

  /**
   * Post a comment on a user's media list.
   */
  public static async createListComment(
    authorId: string,
    targetUserId: string,
    mediaType: string,
    body: { content: string; isSpoiler?: boolean }
  ) {
    const normMediaType = mediaType.trim().toLowerCase()
    if (!VALID_MEDIA_TYPES.includes(normMediaType as ValidMediaType)) {
      throw new BadRequest(
        `Invalid mediaType. Must be one of: ${VALID_MEDIA_TYPES.join(', ')}`
      )
    }

    const trimmed = body.content.trim()
    if (!trimmed) {
      throw new BadRequest('Comment content cannot be empty.')
    }

    const listOwner = await prisma.user.findUnique({
      where: { id: targetUserId.trim() },
      select: { id: true },
    })

    if (!listOwner) {
      throw new NotFound('User not found')
    }

    // Check block relationship
    const isBlocked = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: authorId, blockedId: listOwner.id },
          { blockerId: listOwner.id, blockedId: authorId },
        ],
      },
    })

    if (isBlocked) {
      throw new BadRequest('Cannot comment on list due to user block.')
    }

    const rawComment = await prisma.listComment.create({
      data: {
        listOwnerId: listOwner.id,
        mediaType: normMediaType,
        authorId,
        content: trimmed,
        isSpoiler: Boolean(body.isSpoiler),
      },
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

    return {
      success: true,
      comment: this.formatComment(rawComment),
    }
  }

  /**
   * Delete a comment strictly by comment ID.
   * Allowed for comment author, list/profile owner, or administrator.
   */
  public static async deleteComment(
    user: { id: string; permissions: number[] },
    commentId: string
  ) {
    const comment = await prisma.listComment.findUnique({
      where: { id: commentId.trim() },
    })

    if (!comment) {
      throw new NotFound('Comment not found')
    }

    const isAuthor = comment.authorId === user.id
    const isOwner = comment.listOwnerId === user.id
    const isAdmin = new IRISBitField(user.permissions).has(IRISFlags.ADMINISTRATOR)

    if (!isAuthor && !isOwner && !isAdmin) {
      throw new Forbidden('You do not have permission to delete this comment')
    }

    await prisma.listComment.delete({
      where: { id: comment.id },
    })

    return {
      success: true,
      id: comment.id,
      message: 'Comment deleted successfully',
    }
  }

  /**
   * Post a reply to a comment (only owner can reply, max 1 reply per comment).
   */
  public static async createReply(
    authorId: string,
    commentId: string,
    body: { content: string }
  ) {
    const trimmed = body.content.trim()
    if (!trimmed) {
      throw new BadRequest('Reply content cannot be empty.')
    }

    const comment = await prisma.listComment.findUnique({
      where: { id: commentId.trim() },
      include: { reply: true },
    })

    if (!comment) {
      throw new NotFound('Comment not found')
    }

    // Only list or profile owner can post a direct reply
    if (comment.listOwnerId !== authorId) {
      throw new Forbidden(
        'Only the list or profile owner can reply to comments on their profile or list.'
      )
    }

    if (comment.reply) {
      throw new BadRequest('A reply already exists for this comment.')
    }

    const rawReply = await prisma.listCommentReply.create({
      data: {
        commentId: comment.id,
        authorId,
        content: trimmed,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            customization: true,
          },
        },
      },
    })

    return {
      success: true,
      reply: this.formatReply(rawReply),
    }
  }

  /**
   * Delete a reply to a comment strictly by reply ID.
   * Allowed for reply author, list/profile owner, or administrator.
   */
  public static async deleteReply(
    user: { id: string; permissions: number[] },
    commentId: string,
    replyId: string
  ) {
    const reply = await prisma.listCommentReply.findUnique({
      where: { id: replyId.trim() },
      include: { comment: true },
    })

    if (!reply || reply.commentId !== commentId.trim()) {
      throw new NotFound('Reply not found')
    }

    const isAuthor = reply.authorId === user.id
    const isOwner = reply.comment.listOwnerId === user.id
    const isAdmin = new IRISBitField(user.permissions).has(IRISFlags.ADMINISTRATOR)

    if (!isAuthor && !isOwner && !isAdmin) {
      throw new Forbidden('You do not have permission to delete this reply')
    }

    await prisma.listCommentReply.delete({
      where: { id: reply.id },
    })

    return {
      success: true,
      id: reply.id,
      message: 'Reply deleted successfully',
    }
  }

  /**
   * Update a reply to a comment strictly by reply ID.
   * Allowed for reply author or administrator.
   */
  public static async updateReply(
    user: { id: string; permissions: number[] },
    commentId: string,
    replyId: string,
    body: { content: string }
  ) {
    const trimmed = body.content.trim()
    if (!trimmed) {
      throw new BadRequest('Reply content cannot be empty.')
    }

    const reply = await prisma.listCommentReply.findUnique({
      where: { id: replyId.trim() },
    })

    if (!reply || reply.commentId !== commentId.trim()) {
      throw new NotFound('Reply not found')
    }

    const isAuthor = reply.authorId === user.id
    const isAdmin = new IRISBitField(user.permissions).has(IRISFlags.ADMINISTRATOR)

    if (!isAuthor && !isAdmin) {
      throw new Forbidden('You do not have permission to update this reply')
    }

    const updated = await prisma.listCommentReply.update({
      where: { id: reply.id },
      data: { content: trimmed },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            avatarFrame: true,
            badges: true,
          },
        },
      },
    })

    return {
      success: true,
      reply: this.formatReply(updated),
    }
  }
}
