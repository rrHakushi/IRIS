import { prisma, and, or, countOf, toDate, type MediaType } from '@IRIS/database'
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
      createdAt: any
      updatedAt: any
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
      createdAt: toDate(item.createdAt).toISOString(),
      updatedAt: toDate(item.updatedAt).toISOString(),
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

    let rec = await prisma.orm.public.MediaRecommendation.where({
      userId,
      sourceType: normSourceType,
      sourceId: body.sourceId,
      targetType: normTargetType,
      targetId: body.targetId,
    }).first()

    if (rec) {
      rec = await prisma.orm.public.MediaRecommendation.where({ id: rec.id })
        .update({ body: trimmedBody })
    } else {
      rec = await prisma.orm.public.MediaRecommendation.create({
        userId,
        sourceType: normSourceType,
        sourceId: body.sourceId,
        targetType: normTargetType,
        targetId: body.targetId,
        body: trimmedBody,
      })
    }

    if (!rec) {
      throw new BadRequest('Failed to save recommendation')
    }

    const recWithUser = await prisma.orm.public.MediaRecommendation.where({ id: rec.id })
      .include('user')
      .first()

    if (!recWithUser) {
      throw new NotFound('Recommendation not found')
    }

    return {
      success: true,
      recommendation: this.formatRecommendation(recWithUser),
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

    const recQuery = prisma.orm.public.MediaRecommendation.where((r) =>
      or(
        and(r.sourceType.eq(normType), r.sourceId.eq(id)),
        and(r.targetType.eq(normType), r.targetId.eq(id))
      )
    )

    const [total, rawRecommendations] = await Promise.all([
      countOf(recQuery),
      recQuery
        .orderBy([(r) => r.score.desc(), (r) => r.createdAt.desc()])
        .offset(skip)
        .limit(limit)
        .include('user')
        .all(),
    ])

    const voteMap = new Map<number, string>()
    if (requestingUserId && rawRecommendations.length > 0) {
      const recIds = rawRecommendations.map((r) => r.id)
      const votes = await prisma.orm.public.MediaRecommendationVote.where({ userId: requestingUserId })
        .where((v) => v.recommendationId.in(recIds))
        .select('recommendationId', 'voteType')
        .all()

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
    const recommendation = await prisma.orm.public.MediaRecommendation.where({ id }).first()

    if (!recommendation) {
      throw new NotFound('Recommendation not found')
    }

    const isAuthor = recommendation.userId === user.id
    const isAdmin = new IRISBitField(user.permissions).has(IRISFlags.ADMINISTRATOR)

    if (!isAuthor && !isAdmin) {
      throw new Forbidden('You do not have permission to delete this recommendation')
    }

    await prisma.orm.public.MediaRecommendation.where({ id }).delete()

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
    const recommendation = await prisma.orm.public.MediaRecommendation.where({ id }).first()

    if (!recommendation) {
      throw new NotFound('Recommendation not found')
    }

    if (voteType === 'NONE') {
      await prisma.orm.public.MediaRecommendationVote.where({
        recommendationId: id,
        userId,
      }).deleteAll()
    } else {
      const existingVote = await prisma.orm.public.MediaRecommendationVote.where({
        recommendationId: id,
        userId,
      }).first()

      if (existingVote) {
        await prisma.orm.public.MediaRecommendationVote.where({ id: existingVote.id }).update({
          voteType,
        })
      } else {
        await prisma.orm.public.MediaRecommendationVote.create({
          recommendationId: id,
          userId,
          voteType,
        })
      }
    }

    const [upvotes, downvotes] = await Promise.all([
      countOf(
        prisma.orm.public.MediaRecommendationVote.where({
          recommendationId: id,
          voteType: 'UPVOTE',
        })
      ),
      countOf(
        prisma.orm.public.MediaRecommendationVote.where({
          recommendationId: id,
          voteType: 'DOWNVOTE',
        })
      ),
    ])

    const score = upvotes - downvotes

    await prisma.orm.public.MediaRecommendation.where({ id }).update({
      upvotes,
      downvotes,
      score,
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

