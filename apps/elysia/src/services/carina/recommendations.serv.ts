import { prisma, type MediaType } from '@IRIS/database'
import { getProfileCustomization } from '@IRIS/shared'
import { IRISBitField, IRISFlags } from '@IRIS/permissions'
import { NotFound, BadRequest, Forbidden } from '../../lib/errors'

export const VALID_RECOMMENDATION_MEDIA_TYPES = [
  'ANIME',
  'MANGA',
  'MOVIE',
  'TV',
  'GAME',
  'BOOK',
  'MUSIC',
  'MUSIC_ALBUM',
  'MUSIC_TRACK',
  'OTHER',
  'UNKNOWN',
] as const

export type ValidRecommendationMediaType =
  (typeof VALID_RECOMMENDATION_MEDIA_TYPES)[number]

export class CarinaRecommendationsServ {
  /**
   * Helper to normalize and validate media type strings into Prisma MediaType enum.
   */
  public static parseMediaType(rawType: string): MediaType {
    const normalized = rawType.trim().toUpperCase()
    if (
      !VALID_RECOMMENDATION_MEDIA_TYPES.includes(
        normalized as ValidRecommendationMediaType
      )
    ) {
      throw new BadRequest(
        `Invalid media type: '${rawType}'. Must be one of: ${VALID_RECOMMENDATION_MEDIA_TYPES.map((t) => t.toLowerCase()).join(', ')}`
      )
    }
    return normalized as MediaType
  }

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
   * Helper to format a recommendation item for API responses.
   */
  public static formatRecommendation(
    item: {
      id: number
      userId: string
      sourceType: string
      sourceId: number
      targetType: string
      targetId: number
      body: string | null
      upvotes: number
      downvotes: number
      score: number
      createdAt: Date
      updatedAt: Date
      user: {
        id: string
        username: string
        customization?: any
      }
    },
    userVote?: string | null
  ) {
    return {
      id: item.id,
      userId: item.userId,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      targetType: item.targetType,
      targetId: item.targetId,
      body: item.body ?? null,
      upvotes: item.upvotes,
      downvotes: item.downvotes,
      score: item.score,
      ...(userVote !== undefined ? { userVote: userVote ?? null } : {}),
      author: this.formatAuthor(item.user),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }
  }

  /**
   * Submit or update a media recommendation strictly by media IDs.
   */
  public static async submitRecommendation(
    userId: string,
    body: {
      sourceType: string
      sourceId: number
      targetType: string
      targetId: number
      body?: string
    }
  ) {
    const normSourceType = this.parseMediaType(body.sourceType)
    const normTargetType = this.parseMediaType(body.targetType)

    if (
      normSourceType === normTargetType &&
      body.sourceId === body.targetId
    ) {
      throw new BadRequest('Cannot recommend a media item to itself')
    }

    const trimmedBody = body.body?.trim() || null

    const rec = await prisma.mediaRecommendation.upsert({
      where: {
        userId_sourceType_sourceId_targetType_targetId: {
          userId,
          sourceType: normSourceType,
          sourceId: body.sourceId,
          targetType: normTargetType,
          targetId: body.targetId,
        },
      },
      create: {
        userId,
        sourceType: normSourceType,
        sourceId: body.sourceId,
        targetType: normTargetType,
        targetId: body.targetId,
        body: trimmedBody,
      },
      update: {
        body: trimmedBody,
      },
      include: {
        user: {
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
      recommendation: this.formatRecommendation(rec),
      message: 'Recommendation submitted successfully',
    }
  }

  /**
   * Get recommendations for media (10 per page default).
   * Finds recommendations where media is either source or target.
   */
  public static async getMediaRecommendations(
    type: string,
    id: number,
    query?: { page?: number; limit?: number },
    requestingUserId?: string
  ) {
    const normType = this.parseMediaType(type)
    const page = Math.max(1, query?.page ?? 1)
    const limit = Math.max(1, Math.min(50, query?.limit ?? 10))
    const skip = (page - 1) * limit

    const where = {
      OR: [
        { sourceType: normType, sourceId: id },
        { targetType: normType, targetId: id },
      ],
    }

    const [total, rawRecommendations] = await Promise.all([
      prisma.mediaRecommendation.count({ where }),
      prisma.mediaRecommendation.findMany({
        where,
        orderBy: [
          { score: 'desc' },
          { createdAt: 'desc' },
        ],
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

    const voteMap = new Map<number, string>()
    if (requestingUserId && rawRecommendations.length > 0) {
      const recIds = rawRecommendations.map((r) => r.id)
      const votes = await prisma.mediaRecommendationVote.findMany({
        where: {
          recommendationId: { in: recIds },
          userId: requestingUserId,
        },
        select: {
          recommendationId: true,
          voteType: true,
        },
      })
      for (const v of votes) {
        voteMap.set(v.recommendationId, v.voteType)
      }
    }

    const totalPages = Math.max(1, Math.ceil(total / limit))
    const hasMore = page < totalPages

    const recommendations = rawRecommendations.map((r) =>
      this.formatRecommendation(
        r,
        requestingUserId ? (voteMap.get(r.id) ?? null) : null
      )
    )

    return {
      success: true,
      total,
      recommendations,
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
   * Delete recommendation strictly by recommendation ID.
   * Allowed for recommendation author or system administrator.
   */
  public static async deleteRecommendation(
    user: { id: string; permissions: number[] },
    id: number
  ) {
    const recommendation = await prisma.mediaRecommendation.findUnique({
      where: { id },
    })

    if (!recommendation) {
      throw new NotFound('Recommendation not found')
    }

    const isAuthor = recommendation.userId === user.id
    const isAdmin = new IRISBitField(user.permissions).has(IRISFlags.ADMINISTRATOR)

    if (!isAuthor && !isAdmin) {
      throw new Forbidden('You do not have permission to delete this recommendation')
    }

    await prisma.mediaRecommendation.delete({
      where: { id },
    })

    return {
      success: true,
      id,
      message: 'Recommendation deleted successfully',
    }
  }

  /**
   * Vote on recommendation (UPVOTE, DOWNVOTE, or NONE).
   * Recalculates and updates upvotes, downvotes, and net score.
   */
  public static async voteRecommendation(
    userId: string,
    id: number,
    voteType: 'UPVOTE' | 'DOWNVOTE' | 'NONE'
  ) {
    const recommendation = await prisma.mediaRecommendation.findUnique({
      where: { id },
    })

    if (!recommendation) {
      throw new NotFound('Recommendation not found')
    }

    if (voteType === 'NONE') {
      await prisma.mediaRecommendationVote.deleteMany({
        where: {
          recommendationId: id,
          userId,
        },
      })
    } else {
      await prisma.mediaRecommendationVote.upsert({
        where: {
          recommendationId_userId: {
            recommendationId: id,
            userId,
          },
        },
        create: {
          recommendationId: id,
          userId,
          voteType,
        },
        update: {
          voteType,
        },
      })
    }

    const [upvotes, downvotes] = await Promise.all([
      prisma.mediaRecommendationVote.count({
        where: { recommendationId: id, voteType: 'UPVOTE' },
      }),
      prisma.mediaRecommendationVote.count({
        where: { recommendationId: id, voteType: 'DOWNVOTE' },
      }),
    ])

    const score = upvotes - downvotes

    await prisma.mediaRecommendation.update({
      where: { id },
      data: {
        upvotes,
        downvotes,
        score,
      },
    })

    return {
      success: true,
      id,
      upvotes,
      downvotes,
      score,
      userVote: voteType === 'NONE' ? null : voteType,
      message:
        voteType === 'NONE'
          ? 'Vote removed successfully'
          : `Recommendation ${voteType.toLowerCase()}d successfully`,
    }
  }
}
