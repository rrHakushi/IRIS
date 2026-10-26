import { prisma, countOf, type FavoriteType, type MediaType } from '@Iris/db'
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
    const status = item.status || 'PLANNED'
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
          const entries = await prisma.orm.public.AnimeList
            .where({ animeId: mediaId })
            .select('status', 'score')
            .all()
          const stats = computeMediaStats(entries)
          await prisma.orm.public.Anime.where({ id: mediaId }).update(stats)
          break
        }
        case 'MANGA': {
          const entries = await prisma.orm.public.MangaList
            .where({ mangaId: mediaId })
            .select('status', 'score')
            .all()
          const stats = computeMediaStats(entries)
          await prisma.orm.public.Manga.where({ id: mediaId }).update(stats)
          break
        }
        case 'MOVIE': {
          const entries = await prisma.orm.public.MovieList
            .where({ movieId: mediaId })
            .select('status', 'score')
            .all()
          const stats = computeMediaStats(entries)
          await prisma.orm.public.Movie.where({ id: mediaId }).update(stats)
          break
        }
        case 'TV': {
          const entries = await prisma.orm.public.TvList
            .where({ tvId: mediaId })
            .select('status', 'score')
            .all()
          const stats = computeMediaStats(entries)
          await prisma.orm.public.Tv.where({ id: mediaId }).update(stats)
          break
        }
        case 'GAME': {
          const entries = await prisma.orm.public.GameList
            .where({ gameId: mediaId })
            .select('status', 'score')
            .all()
          const stats = computeMediaStats(entries)
          await prisma.orm.public.Game.where({ id: mediaId }).update(stats)
          break
        }
        case 'BOOK': {
          const entries = await prisma.orm.public.BookList
            .where({ bookId: mediaId })
            .select('status', 'score')
            .all()
          const stats = computeMediaStats(entries)
          await prisma.orm.public.Book.where({ id: mediaId }).update(stats)
          break
        }
        case 'MUSIC': {
          const count = await countOf(
            prisma.orm.public.MusicList.where({ musicId: mediaId })
          )
          await prisma.orm.public.Music
            .where({ id: mediaId })
            .update({ popularity: count })
          break
        }
        case 'OTHER': {
          const entries = await prisma.orm.public.OtherList
            .where({ otherId: mediaId })
            .select('status', 'score')
            .all()
          const stats = computeMediaStats(entries)
          await prisma.orm.public.Other.where({ id: mediaId }).update(stats)
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
      const count = await countOf(
        prisma.orm.public.Favorite.where({ type: normType, targetId })
      )

      switch (normType) {
        case 'ANIME':
          await prisma.orm.public.Anime
            .where({ id: targetId })
            .update({ favorites: count })
          break
        case 'MANGA':
          await prisma.orm.public.Manga
            .where({ id: targetId })
            .update({ favorites: count })
          break
        case 'MOVIE':
          await prisma.orm.public.Movie
            .where({ id: targetId })
            .update({ favorites: count })
          break
        case 'TV':
          await prisma.orm.public.Tv
            .where({ id: targetId })
            .update({ favorites: count })
          break
        case 'GAME':
          await prisma.orm.public.Game
            .where({ id: targetId })
            .update({ favorites: count })
          break
        case 'BOOK':
          await prisma.orm.public.Book
            .where({ id: targetId })
            .update({ favorites: count })
          break
        case 'MUSIC_ALBUM':
        case 'MUSIC_TRACK':
          await prisma.orm.public.Music
            .where({ id: targetId })
            .update({ favorites: count })
          break
        case 'CHARACTER':
          await prisma.orm.public.Character
            .where({ id: targetId })
            .update({ favorites: count })
          break
        case 'PERSON':
          await prisma.orm.public.Person
            .where({ id: targetId })
            .update({ favorites: count })
          break
        case 'STUDIO':
          await prisma.orm.public.Studio
            .where({ id: targetId })
            .update({ favorites: count })
          break
        case 'OTHER':
          await prisma.orm.public.Other
            .where({ id: targetId })
            .update({ favorites: count })
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
