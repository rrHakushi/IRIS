import { prisma, toDate, type FavoriteType } from '@IRIS/database'
import { NotFound, BadRequest } from '../../lib/errors'
import { MediaStatsServ } from '../borealis/media-stats.serv'
import { ActivityServ } from './activity.serv'

export const VALID_FAVORITE_TYPES = [
  'ANIME',
  'MANGA',
  'MOVIE',
  'TV',
  'GAME',
  'BOOK',
  'MUSIC_ALBUM',
  'MUSIC_TRACK',
  'OTHER',
  'CHARACTER',
  'PERSON',
  'STUDIO',
  'USER',
] as const

export type ValidFavoriteType = (typeof VALID_FAVORITE_TYPES)[number]

export class CarinaFavoritesServ {
  /**
   * Helper to normalize and validate favorite category / type string into FavoriteType enum.
   */
  public static parseFavoriteType(raw: string): FavoriteType {
    const normalized = raw.trim().replace(/-/g, '_').toUpperCase()
    if (!VALID_FAVORITE_TYPES.includes(normalized as ValidFavoriteType)) {
      throw new BadRequest(
        `Invalid favorite category: '${raw}'. Must be one of: ${VALID_FAVORITE_TYPES.map((t) => t.toLowerCase()).join(', ')}`
      )
    }
    return normalized as FavoriteType
  }

  /**
   * Add media or entity to user favorites (strictly by IDs).
   */
  public static async addFavorite(
    userId: string,
    body: { category?: string; type?: string; targetId: number }
  ) {
    const rawCategory = body.category || body.type
    if (!rawCategory || typeof rawCategory !== 'string' || !rawCategory.trim()) {
      throw new BadRequest('Category or type is required.')
    }

    const normType = this.parseFavoriteType(rawCategory)

    let favorite = await prisma.orm.public.Favorite.where({
      userId,
      type: normType,
      targetId: body.targetId,
    }).first()

    if (!favorite) {
      favorite = await prisma.orm.public.Favorite.create({
        userId,
        type: normType,
        targetId: body.targetId,
      })
    }

    await MediaStatsServ.recalculateFavoritesCount(normType, body.targetId)

    ActivityServ.recordFavoriteActivity({
      userId,
      action: 'FAVORITE_ADDED',
      favoriteType: normType,
      targetId: body.targetId,
    })

    return {
      success: true,
      favorite: {
        id: favorite.id,
        userId: favorite.userId,
        type: favorite.type,
        targetId: favorite.targetId,
        createdAt: toDate(favorite.createdAt).toISOString(),
      },
      message: 'Added to favorites successfully',
    }
  }

  /**
   * Check if target entity is in user favorites strictly by category and target ID.
   */
  public static async checkFavorite(
    userId: string,
    category: string,
    targetId: number
  ) {
    const normType = this.parseFavoriteType(category)

    const favorite = await prisma.orm.public.Favorite.where({
      userId,
      type: normType,
      targetId,
    }).first()

    return {
      success: true,
      isFavorite: Boolean(favorite),
      favorite: favorite
        ? {
            id: favorite.id,
            userId: favorite.userId,
            type: favorite.type,
            targetId: favorite.targetId,
            createdAt: toDate(favorite.createdAt).toISOString(),
          }
        : null,
    }
  }

  /**
   * Remove target from favorites strictly by category and target ID.
   */
  public static async removeFavorite(
    userId: string,
    category: string,
    targetId: number
  ) {
    const normType = this.parseFavoriteType(category)

    const favorite = await prisma.orm.public.Favorite.where({
      userId,
      type: normType,
      targetId,
    }).first()

    if (!favorite) {
      throw new NotFound('Favorite not found')
    }

    await prisma.orm.public.Favorite.where({ id: favorite.id }).delete()

    await MediaStatsServ.recalculateFavoritesCount(normType, targetId)

    ActivityServ.recordFavoriteActivity({
      userId,
      action: 'FAVORITE_REMOVED',
      favoriteType: normType,
      targetId,
    })

    return {
      success: true,
      targetId,
      category: normType,
      message: 'Removed from favorites successfully',
    }
  }
}
