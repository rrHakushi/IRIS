import { prisma } from '@IRIS/database'
import { BorealisExternalSearchServ } from './external-search.serv'
import type { PreviewResult } from './syncer/media-preview.syncer'

export interface SearchQuery {
  q: string
  category?:
    | 'media'
    | 'anime'
    | 'manga'
    | 'movies'
    | 'tv'
    | 'games'
    | 'music'
    | 'books'
    | 'characters'
    | 'people'
    | 'staff'
    | 'studios'
    | 'other'
  page?: number
  limit?: number
  external?: boolean | string
}

function mergeWithExternal<T extends { id: number }>(
  items: T[],
  externalStubs: PreviewResult[],
  mediaType: string,
  total: number
) {
  const externalIds = new Set(externalStubs.map((s) => s.id))
  const results = items.map((x) => ({
    ...x,
    mediaType,
    queuedForFetch:
      externalIds.has(x.id) ||
      (x as any).alUpdatedAt === null ||
      (x as any).tvdbUpdatedAt === null,
  }))
  const existingIds = new Set(results.map((r) => r.id))
  let addedCount = 0
  for (const stub of externalStubs) {
    if (!existingIds.has(stub.id)) {
      results.push({ ...stub, mediaType, queuedForFetch: true } as any)
      addedCount++
    }
  }
  return { results, total: total + addedCount }
}

export class BorealisSearchServ {
  public static async search(query: SearchQuery) {
    const cleanQuery = decodeURIComponent(String(query.q || ''))
      .replace(/\+/g, ' ')
      .trim()
    const rawCategory = query.category || 'media'
    const category = rawCategory === 'staff' ? 'people' : rawCategory
    const page = Math.max(1, Number(query.page ?? 1))
    const limit = Math.max(1, Math.min(50, Number(query.limit ?? 20)))
    const skip = (page - 1) * limit
    const isExternal = query.external === true || query.external === 'true'

    if (!cleanQuery) {
      return {
        success: true,
        category,
        query: cleanQuery,
        results: [],
        pagination: {
          page,
          limit,
          total: 0,
          hasMore: false,
        },
      }
    }

    let externalStubs: PreviewResult[] = []
    if (
      isExternal &&
      ['anime', 'manga', 'movies', 'tv', 'games', 'books', 'music', 'characters', 'people', 'staff'].includes(category)
    ) {
      externalStubs = await BorealisExternalSearchServ.enqueueSearchFetch(
        category,
        cleanQuery,
        limit
      )
    }

    switch (category) {
      case 'anime': {
        const where = {
          OR: [
            { titlePrimary: { contains: cleanQuery, mode: 'insensitive' as const } },
            { titleSecondary: { contains: cleanQuery, mode: 'insensitive' as const } },
            { titleNative: { contains: cleanQuery, mode: 'insensitive' as const } },
          ],
        }
        const [total, items] = await Promise.all([
          prisma.anime.count({ where }),
          prisma.anime.findMany({
            where,
            skip,
            take: limit,
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              titleNative: true,
              coverImage: true,
              bannerImage: true,
              format: true,
              status: true,
              seasonYear: true,
              seasonSeason: true,
              episodeCount: true,
              averageScore: true,
              alUpdatedAt: true,
              genres: { select: { id: true, name: true } },
            },
          }),
        ])
        const { results, total: combinedTotal } = mergeWithExternal(items, externalStubs, 'anime', total)
        return {
          success: true,
          category,
          query: cleanQuery,
          results,
          pagination: {
            page,
            limit,
            total: combinedTotal,
            hasMore: skip + results.length < combinedTotal,
          },
        }
      }

      case 'manga': {
        const where = {
          OR: [
            { titlePrimary: { contains: cleanQuery, mode: 'insensitive' as const } },
            { titleSecondary: { contains: cleanQuery, mode: 'insensitive' as const } },
            { titleNative: { contains: cleanQuery, mode: 'insensitive' as const } },
          ],
        }
        const [total, items] = await Promise.all([
          prisma.manga.count({ where }),
          prisma.manga.findMany({
            where,
            skip,
            take: limit,
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              titleNative: true,
              coverImage: true,
              bannerImage: true,
              format: true,
              status: true,
              startDateYear: true,
              chapterCount: true,
              volumeCount: true,
              averageScore: true,
              alUpdatedAt: true,
              genres: { select: { id: true, name: true } },
            },
          }),
        ])
        const { results, total: combinedTotal } = mergeWithExternal(items, externalStubs, 'manga', total)
        return {
          success: true,
          category,
          query: cleanQuery,
          results,
          pagination: {
            page,
            limit,
            total: combinedTotal,
            hasMore: skip + results.length < combinedTotal,
          },
        }
      }

      case 'movies': {
        const where = {
          OR: [
            { titlePrimary: { contains: cleanQuery, mode: 'insensitive' as const } },
            { titleSecondary: { contains: cleanQuery, mode: 'insensitive' as const } },
            { titleNative: { contains: cleanQuery, mode: 'insensitive' as const } },
          ],
        }
        const [total, items] = await Promise.all([
          prisma.movie.count({ where }),
          prisma.movie.findMany({
            where,
            skip,
            take: limit,
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              titleNative: true,
              coverImage: true,
              bannerImage: true,
              runtime: true,
              releaseDateYear: true,
              averageScore: true,
              tvdbUpdatedAt: true,
              genres: { select: { id: true, name: true } },
            },
          }),
        ])
        const mappedItems = items.map((x) => ({ ...x, duration: x.runtime }))
        const { results, total: combinedTotal } = mergeWithExternal(mappedItems, externalStubs, 'movie', total)
        return {
          success: true,
          category,
          query: cleanQuery,
          results,
          pagination: {
            page,
            limit,
            total: combinedTotal,
            hasMore: skip + results.length < combinedTotal,
          },
        }
      }

      case 'tv': {
        const where = {
          OR: [
            { titlePrimary: { contains: cleanQuery, mode: 'insensitive' as const } },
            { titleSecondary: { contains: cleanQuery, mode: 'insensitive' as const } },
            { titleNative: { contains: cleanQuery, mode: 'insensitive' as const } },
          ],
        }
        const [total, items] = await Promise.all([
          prisma.tv.count({ where }),
          prisma.tv.findMany({
            where,
            skip,
            take: limit,
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              titleNative: true,
              coverImage: true,
              bannerImage: true,
              episodeCount: true,
              firstAiredYear: true,
              averageScore: true,
              tvdbUpdatedAt: true,
              genres: { select: { id: true, name: true } },
            },
          }),
        ])
        const mappedItems = items.map((x) => ({ ...x, releaseDateYear: x.firstAiredYear }))
        const { results, total: combinedTotal } = mergeWithExternal(mappedItems, externalStubs, 'tv', total)
        return {
          success: true,
          category,
          query: cleanQuery,
          results,
          pagination: {
            page,
            limit,
            total: combinedTotal,
            hasMore: skip + results.length < combinedTotal,
          },
        }
      }

      case 'games': {
        const where = {
          OR: [
            { titlePrimary: { contains: cleanQuery, mode: 'insensitive' as const } },
            { titleSecondary: { contains: cleanQuery, mode: 'insensitive' as const } },
          ],
        }
        const [total, items] = await Promise.all([
          prisma.game.count({ where }),
          prisma.game.findMany({
            where,
            skip,
            take: limit,
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              coverImage: true,
              bannerImage: true,
              platforms: true,
              releaseDateYear: true,
              averageScore: true,
              igdbUpdatedAt: true,
              genres: { select: { id: true, name: true } },
            },
          }),
        ])
        const { results, total: combinedTotal } = mergeWithExternal(items, externalStubs, 'game', total)
        return {
          success: true,
          category,
          query: cleanQuery,
          results,
          pagination: {
            page,
            limit,
            total: combinedTotal,
            hasMore: skip + results.length < combinedTotal,
          },
        }
      }

      case 'music': {
        const where = {
          OR: [
            { titlePrimary: { contains: cleanQuery, mode: 'insensitive' as const } },
            { titleSecondary: { contains: cleanQuery, mode: 'insensitive' as const } },
            { artistName: { contains: cleanQuery, mode: 'insensitive' as const } },
          ],
        }
        const [total, items] = await Promise.all([
          prisma.music.count({ where }),
          prisma.music.findMany({
            where,
            skip,
            take: limit,
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              artistName: true,
              coverImage: true,
              type: true,
              duration: true,
              releaseDateYear: true,
              album: { select: { titlePrimary: true } },
              genres: { select: { id: true, name: true } },
            },
          }),
        ])
        const mappedItems = items.map((x) => ({
          ...x,
          artist: x.artistName,
          albumTitle: x.album?.titlePrimary ?? null,
          durationMs: x.duration ? x.duration * 1000 : null,
        }))
        const { results, total: combinedTotal } = mergeWithExternal(mappedItems, externalStubs, 'music', total)
        return {
          success: true,
          category,
          query: cleanQuery,
          results,
          pagination: {
            page,
            limit,
            total: combinedTotal,
            hasMore: skip + results.length < combinedTotal,
          },
        }
      }

      case 'books': {
        const where = {
          OR: [
            { titlePrimary: { contains: cleanQuery, mode: 'insensitive' as const } },
            { titleSecondary: { contains: cleanQuery, mode: 'insensitive' as const } },
          ],
        }
        const [total, items] = await Promise.all([
          prisma.book.count({ where }),
          prisma.book.findMany({
            where,
            skip,
            take: limit,
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              authors: true,
              coverImage: true,
              pageCount: true,
              releaseDateYear: true,
              averageScore: true,
              genres: { select: { id: true, name: true } },
            },
          }),
        ])
        const { results, total: combinedTotal } = mergeWithExternal(items, externalStubs, 'book', total)
        return {
          success: true,
          category,
          query: cleanQuery,
          results,
          pagination: {
            page,
            limit,
            total: combinedTotal,
            hasMore: skip + results.length < combinedTotal,
          },
        }
      }

      case 'characters': {
        const where = {
          OR: [
            { namePrimary: { contains: cleanQuery, mode: 'insensitive' as const } },
            { nameNative: { contains: cleanQuery, mode: 'insensitive' as const } },
          ],
        }
        const [total, items] = await Promise.all([
          prisma.character.count({ where }),
          prisma.character.findMany({
            where,
            skip,
            take: limit,
            select: {
              id: true,
              namePrimary: true,
              nameNative: true,
              image: true,
              gender: true,
              age: true,
              description: true,
            },
          }),
        ])
        const merged = mergeWithExternal(items, externalStubs, 'characters', total)
        return {
          success: true,
          category,
          query: cleanQuery,
          results: merged.results,
          pagination: {
            page,
            limit,
            total: merged.total,
            hasMore: skip + merged.results.length < merged.total,
          },
        }
      }

      case 'people': {
        const where = {
          OR: [
            { namePrimary: { contains: cleanQuery, mode: 'insensitive' as const } },
            { nameNative: { contains: cleanQuery, mode: 'insensitive' as const } },
          ],
        }
        const [total, items] = await Promise.all([
          prisma.person.count({ where }),
          prisma.person.findMany({
            where,
            skip,
            take: limit,
            select: {
              id: true,
              namePrimary: true,
              nameNative: true,
              image: true,
              language: true,
              primaryOccupations: true,
              description: true,
            },
          }),
        ])
        const merged = mergeWithExternal(items, externalStubs, 'people', total)
        return {
          success: true,
          category,
          query: cleanQuery,
          results: merged.results,
          pagination: {
            page,
            limit,
            total: merged.total,
            hasMore: skip + merged.results.length < merged.total,
          },
        }
      }

      case 'studios': {
        const where = {
          name: { contains: cleanQuery, mode: 'insensitive' as const },
        }
        const [total, items] = await Promise.all([
          prisma.studio.count({ where }),
          prisma.studio.findMany({
            where,
            skip,
            take: limit,
            select: {
              id: true,
              name: true,
              isAnimationStudio: true,
              siteUrl: true,
              favorites: true,
            },
          }),
        ])
        return {
          success: true,
          category,
          query: cleanQuery,
          results: items,
          pagination: {
            page,
            limit,
            total,
            hasMore: skip + items.length < total,
          },
        }
      }

      case 'media':
      default: {
        // Multi-media search across anime, manga, tv, movie, game, book, music, other
        const [anime, manga, tv, movie, game, book, music, other] = await Promise.all([
          prisma.anime.findMany({
            where: {
              OR: [
                { titlePrimary: { contains: cleanQuery, mode: 'insensitive' } },
                { titleSecondary: { contains: cleanQuery, mode: 'insensitive' } },
              ],
            },
            take: limit,
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              coverImage: true,
              format: true,
              averageScore: true,
            },
          }),
          prisma.manga.findMany({
            where: {
              OR: [
                { titlePrimary: { contains: cleanQuery, mode: 'insensitive' } },
                { titleSecondary: { contains: cleanQuery, mode: 'insensitive' } },
              ],
            },
            take: limit,
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              coverImage: true,
              format: true,
              averageScore: true,
            },
          }),
          prisma.tv.findMany({
            where: {
              OR: [
                { titlePrimary: { contains: cleanQuery, mode: 'insensitive' } },
                { titleSecondary: { contains: cleanQuery, mode: 'insensitive' } },
              ],
            },
            take: limit,
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              coverImage: true,
              averageScore: true,
            },
          }),
          prisma.movie.findMany({
            where: {
              OR: [
                { titlePrimary: { contains: cleanQuery, mode: 'insensitive' } },
                { titleSecondary: { contains: cleanQuery, mode: 'insensitive' } },
              ],
            },
            take: limit,
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              coverImage: true,
              averageScore: true,
            },
          }),
          prisma.game.findMany({
            where: {
              OR: [
                { titlePrimary: { contains: cleanQuery, mode: 'insensitive' } },
                { titleSecondary: { contains: cleanQuery, mode: 'insensitive' } },
              ],
            },
            take: limit,
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              coverImage: true,
              averageScore: true,
            },
          }),
          prisma.book.findMany({
            where: {
              OR: [
                { titlePrimary: { contains: cleanQuery, mode: 'insensitive' } },
                { titleSecondary: { contains: cleanQuery, mode: 'insensitive' } },
              ],
            },
            take: limit,
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              coverImage: true,
              averageScore: true,
            },
          }),
          prisma.music.findMany({
            where: {
              OR: [
                { titlePrimary: { contains: cleanQuery, mode: 'insensitive' } },
                { artistName: { contains: cleanQuery, mode: 'insensitive' } },
              ],
            },
            take: limit,
            select: {
              id: true,
              titlePrimary: true,
              artistName: true,
              coverImage: true,
            },
          }),
          prisma.other.findMany({
            where: {
              isPublished: true,
              OR: [
                { titlePrimary: { contains: cleanQuery, mode: 'insensitive' } },
                { titleSecondary: { contains: cleanQuery, mode: 'insensitive' } },
                { description: { contains: cleanQuery, mode: 'insensitive' } },
              ],
            },
            take: limit,
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              coverImage: true,
              averageScore: true,
              format: true,
            },
          }),
        ])

        const combined = [
          ...anime.map((x) => ({ ...x, mediaType: 'anime' })),
          ...manga.map((x) => ({ ...x, mediaType: 'manga' })),
          ...tv.map((x) => ({ ...x, mediaType: 'tv' })),
          ...movie.map((x) => ({ ...x, mediaType: 'movie' })),
          ...game.map((x) => ({ ...x, mediaType: 'game' })),
          ...book.map((x) => ({ ...x, mediaType: 'book' })),
          ...music.map((x) => ({ ...x, mediaType: 'music' })),
          ...other.map((x) => ({ ...x, mediaType: 'other' })),
        ]

        const total = combined.length
        const results = combined.slice(skip, skip + limit)

        return {
          success: true,
          category: 'media',
          query: cleanQuery,
          results,
          pagination: {
            page,
            limit,
            total,
            hasMore: skip + results.length < total,
          },
        }
      }

      case 'other': {
        const where = {
          isPublished: true,
          OR: [
            { titlePrimary: { contains: cleanQuery, mode: 'insensitive' as const } },
            { titleSecondary: { contains: cleanQuery, mode: 'insensitive' as const } },
            { description: { contains: cleanQuery, mode: 'insensitive' as const } },
          ],
        }
        const [total, items] = await Promise.all([
          prisma.other.count({ where }),
          prisma.other.findMany({
            where,
            skip,
            take: limit,
            orderBy: [{ popularity: 'desc' }, { averageScore: 'desc' }],
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              description: true,
              coverImage: true,
              bannerImage: true,
              format: true,
              startDate: true,
              endDate: true,
              averageScore: true,
              favorites: true,
              popularity: true,
              progressFields: true,
              incrementFieldKey: true,
              statuses: true,
              creatorId: true,
              creator: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
          }),
        ])

        const results = items.map((x) => ({
          ...x,
          mediaType: 'other',
        }))

        return {
          success: true,
          category,
          query: cleanQuery,
          results,
          pagination: {
            page,
            limit,
            total,
            hasMore: skip + results.length < total,
          },
        }
      }
    }
  }
}
