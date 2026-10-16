import { prisma, type FavoriteType, type MediaType } from '@IRIS/database'
import { LogFactory, c } from '@Iris/logger'

const logger = new LogFactory('MediaStatsServ')

export function initScoreDistribution(): Record<string, number> {
  const dist: Record<string, number> = {}
  for (let i = 1; i <= 10; i++) {
    dist[String(i)] = 0
  }
  return dist
}

export interface EntryItem {
  status: string
  score: number | null
}

export function computeMediaStats(entries: EntryItem[]) {
  const popularity = entries.length
  const statusDistribution: Record<string, number> = {}
  const scoreDistribution = initScoreDistribution()

  let scoredCount = 0
  let rawScoreSum = 0

  for (const item of entries) {
    const status = item.status || 'PLANNING'
    statusDistribution[status] = (statusDistribution[status] || 0) + 1

    if (item.score !== null && item.score !== undefined && item.score > 0) {
      let normalized = Number(item.score)
      // Normalize score to 10-point scale: if > 10 (e.g. 85), divide by 10
      if (normalized > 10) normalized = normalized / 10
      normalized = Math.min(10, Math.max(0, normalized))

      scoredCount++
      rawScoreSum += normalized

      const bucket = Math.min(10, Math.max(1, Math.round(normalized)))
      scoreDistribution[String(bucket)] = (scoreDistribution[String(bucket)] || 0) + 1
    }
  }

  const totalScoreSum = scoredCount > 0 ? Math.round(rawScoreSum) : null
  const averageScore = scoredCount > 0 ? Math.round((rawScoreSum / scoredCount) * 10) / 10 : null

  return {
    popularity,
    statusDistribution,
    scoreDistribution,
    scoredCount: scoredCount > 0 ? scoredCount : null,
    totalScoreSum,
    averageScore,
  }
}

export class MediaStatsServ {
  /**
   * Recalculates community statistics (averageScore, popularity, totalScoreSum,
   * scoredCount, statusDistribution, scoreDistribution) for a single media item.
   */
  public static async recalculateMediaStats(
    mediaType: MediaType | string,
    mediaId: number
  ): Promise<void> {
    const normType = String(mediaType).toUpperCase()

    try {
      switch (normType) {
        case 'ANIME': {
          const entries = await prisma.animeList.findMany({
            where: { animeId: mediaId },
            select: { status: true, score: true },
          })
          const stats = computeMediaStats(entries)
          await prisma.anime.update({ where: { id: mediaId }, data: stats })
          break
        }
        case 'MANGA': {
          const entries = await prisma.mangaList.findMany({
            where: { mangaId: mediaId },
            select: { status: true, score: true },
          })
          const stats = computeMediaStats(entries)
          await prisma.manga.update({ where: { id: mediaId }, data: stats })
          break
        }
        case 'MOVIE': {
          const entries = await prisma.movieList.findMany({
            where: { movieId: mediaId },
            select: { status: true, score: true },
          })
          const stats = computeMediaStats(entries)
          await prisma.movie.update({ where: { id: mediaId }, data: stats })
          break
        }
        case 'TV': {
          const entries = await prisma.tvList.findMany({
            where: { tvId: mediaId },
            select: { status: true, score: true },
          })
          const stats = computeMediaStats(entries)
          await prisma.tv.update({ where: { id: mediaId }, data: stats })
          break
        }
        case 'GAME': {
          const entries = await prisma.gameList.findMany({
            where: { gameId: mediaId },
            select: { status: true, score: true },
          })
          const stats = computeMediaStats(entries)
          await prisma.game.update({ where: { id: mediaId }, data: stats })
          break
        }
        case 'BOOK': {
          const entries = await prisma.bookList.findMany({
            where: { bookId: mediaId },
            select: { status: true, score: true },
          })
          const stats = computeMediaStats(entries)
          await prisma.book.update({ where: { id: mediaId }, data: stats })
          break
        }
        case 'MUSIC': {
          const count = await prisma.musicList.count({
            where: { musicId: mediaId },
          })
          await prisma.music.update({ where: { id: mediaId }, data: { popularity: count } })
          break
        }
        default:
          logger.warn(`Unknown media type for stats recalculation: ${mediaType}`)
      }
    } catch (err: any) {
      logger.error(
        `Failed to recalculate stats for ${normType} #${mediaId}: ${err?.message || err}`
      )
    }
  }

  /**
   * Recalculates the exact favorite count for a target entity from the Favorite table.
   */
  public static async recalculateFavoritesCount(
    favoriteType: FavoriteType | string,
    targetId: number
  ): Promise<void> {
    const normType = String(favoriteType).toUpperCase() as FavoriteType

    try {
      const count = await prisma.favorite.count({
        where: { type: normType, targetId },
      })

      switch (normType) {
        case 'ANIME':
          await prisma.anime.update({ where: { id: targetId }, data: { favorites: count } })
          break
        case 'MANGA':
          await prisma.manga.update({ where: { id: targetId }, data: { favorites: count } })
          break
        case 'MOVIE':
          await prisma.movie.update({ where: { id: targetId }, data: { favorites: count } })
          break
        case 'TV':
          await prisma.tv.update({ where: { id: targetId }, data: { favorites: count } })
          break
        case 'GAME':
          await prisma.game.update({ where: { id: targetId }, data: { favorites: count } })
          break
        case 'BOOK':
          await prisma.book.update({ where: { id: targetId }, data: { favorites: count } })
          break
        case 'MUSIC_ALBUM':
        case 'MUSIC_TRACK':
          await prisma.music.update({ where: { id: targetId }, data: { favorites: count } })
          break
        case 'CHARACTER':
          await prisma.character.update({ where: { id: targetId }, data: { favorites: count } })
          break
        case 'PERSON':
          await prisma.person.update({ where: { id: targetId }, data: { favorites: count } })
          break
        case 'STUDIO':
          await prisma.studio.update({ where: { id: targetId }, data: { favorites: count } })
          break
        default:
          break
      }
    } catch (err: any) {
      logger.error(
        `Failed to recalculate favorites for ${normType} #${targetId}: ${err?.message || err}`
      )
    }
  }
}
