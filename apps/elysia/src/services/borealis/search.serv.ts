import { prisma, countOf, or } from '@IRIS/database'
import { BadRequest } from '../../lib/errors'
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

  const existingIds = new Set(items.map((x) => x.id))
  const newStubs = externalStubs
    .filter((stub) => !existingIds.has(stub.id))
    .map((stub) => ({
      ...stub,
      mediaType,
      queuedForFetch: true,
    }))

  const combined = [...results, ...newStubs]
  return {
    results: combined,
    total: total + newStubs.length,
  }
}

export class BorealisSearchServ {
  /**
   * Unified catalog search across media formats and entities.
   */
  public static async search(query: SearchQuery) {
    const rawQuery = query.q
    if (!rawQuery || rawQuery.trim().length === 0) {
      throw new BadRequest('Query parameter "q" cannot be empty.')
    }

    const cleanQuery = rawQuery.trim()
    const category = query.category || 'media'
    const page = Math.max(1, Number(query.page || 1))
    const limit = Math.min(50, Math.max(1, Number(query.limit || 20)))
    const skip = (page - 1) * limit
    const isExternal =
      query.external === true ||
      query.external === 'true' ||
      query.external === '1'

    let externalStubs: PreviewResult[] = []
    if (
      isExternal &&
      [
        'anime',
        'manga',
        'movies',
        'tv',
        'games',
        'books',
        'music',
        'characters',
        'people',
        'staff',
      ].includes(category)
    ) {
      externalStubs = await BorealisExternalSearchServ.enqueueSearchFetch(
        category,
        cleanQuery,
        limit
      )
    }

    switch (category) {
      case 'anime': {
        const q = prisma.orm.public.Anime.where((a) =>
          or(
            a.titlePrimary.ilike(`%${cleanQuery}%`),
            a.titleSecondary.ilike(`%${cleanQuery}%`),
            a.titleNative.ilike(`%${cleanQuery}%`)
          )
        )
        const [total, items] = await Promise.all([
          countOf(q),
          q
            .offset(skip)
            .limit(limit)
            .select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'titleNative',
              'coverImage',
              'bannerImage',
              'format',
              'status',
              'seasonYear',
              'seasonSeason',
              'episodeCount',
              'averageScore',
              'alUpdatedAt'
            )
            .include('genres', (g) =>
              g.include('genre', (ge) => ge.select('id', 'name'))
            )
            .all(),
        ])
        const mappedItems = items.map((x) => ({
          ...x,
          genres: (x.genres || [])
            .filter((g) => Boolean(g.genre))
            .map((g) => ({
              id: g.genre!.id,
              name: g.genre!.name,
            })),
        }))
        const { results, total: combinedTotal } = mergeWithExternal(
          mappedItems,
          externalStubs,
          'anime',
          total
        )
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
        const q = prisma.orm.public.Manga.where((m) =>
          or(
            m.titlePrimary.ilike(`%${cleanQuery}%`),
            m.titleSecondary.ilike(`%${cleanQuery}%`),
            m.titleNative.ilike(`%${cleanQuery}%`)
          )
        )
        const [total, items] = await Promise.all([
          countOf(q),
          q
            .offset(skip)
            .limit(limit)
            .select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'titleNative',
              'coverImage',
              'bannerImage',
              'format',
              'status',
              'startDateYear',
              'chapterCount',
              'volumeCount',
              'averageScore',
              'alUpdatedAt'
            )
            .include('genres', (g) =>
              g.include('genre', (ge) => ge.select('id', 'name'))
            )
            .all(),
        ])
        const mappedItems = items.map((x) => ({
          ...x,
          genres: (x.genres || [])
            .filter((g) => Boolean(g.genre))
            .map((g) => ({
              id: g.genre!.id,
              name: g.genre!.name,
            })),
        }))
        const { results, total: combinedTotal } = mergeWithExternal(
          mappedItems,
          externalStubs,
          'manga',
          total
        )
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
        const q = prisma.orm.public.Movie.where((m) =>
          or(
            m.titlePrimary.ilike(`%${cleanQuery}%`),
            m.titleSecondary.ilike(`%${cleanQuery}%`),
            m.titleNative.ilike(`%${cleanQuery}%`)
          )
        )
        const [total, items] = await Promise.all([
          countOf(q),
          q
            .offset(skip)
            .limit(limit)
            .select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'titleNative',
              'coverImage',
              'bannerImage',
              'runtime',
              'releaseDateYear',
              'averageScore',
              'tvdbUpdatedAt'
            )
            .include('genres', (g) =>
              g.include('genre', (ge) => ge.select('id', 'name'))
            )
            .all(),
        ])
        const mappedItems = items.map((x) => ({
          ...x,
          duration: x.runtime,
          genres: (x.genres || [])
            .filter((g) => Boolean(g.genre))
            .map((g) => ({
              id: g.genre!.id,
              name: g.genre!.name,
            })),
        }))
        const { results, total: combinedTotal } = mergeWithExternal(
          mappedItems,
          externalStubs,
          'movie',
          total
        )
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
        const q = prisma.orm.public.Tv.where((t) =>
          or(
            t.titlePrimary.ilike(`%${cleanQuery}%`),
            t.titleSecondary.ilike(`%${cleanQuery}%`),
            t.titleNative.ilike(`%${cleanQuery}%`)
          )
        )
        const [total, items] = await Promise.all([
          countOf(q),
          q
            .offset(skip)
            .limit(limit)
            .select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'titleNative',
              'coverImage',
              'bannerImage',
              'episodeCount',
              'firstAiredYear',
              'averageScore',
              'tvdbUpdatedAt'
            )
            .include('genres', (g) =>
              g.include('genre', (ge) => ge.select('id', 'name'))
            )
            .all(),
        ])
        const mappedItems = items.map((x) => ({
          ...x,
          releaseDateYear: x.firstAiredYear,
          genres: (x.genres || [])
            .filter((g) => Boolean(g.genre))
            .map((g) => ({
              id: g.genre!.id,
              name: g.genre!.name,
            })),
        }))
        const { results, total: combinedTotal } = mergeWithExternal(
          mappedItems,
          externalStubs,
          'tv',
          total
        )
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
        const q = prisma.orm.public.Game.where((g) =>
          or(
            g.titlePrimary.ilike(`%${cleanQuery}%`),
            g.titleSecondary.ilike(`%${cleanQuery}%`)
          )
        )
        const [total, items] = await Promise.all([
          countOf(q),
          q
            .offset(skip)
            .limit(limit)
            .select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'coverImage',
              'bannerImage',
              'platforms',
              'releaseDateYear',
              'averageScore',
              'igdbUpdatedAt'
            )
            .include('genres', (g) =>
              g.include('genre', (ge) => ge.select('id', 'name'))
            )
            .all(),
        ])
        const mappedItems = items.map((x) => ({
          ...x,
          platforms: [...x.platforms],
          genres: (x.genres || [])
            .filter((g) => Boolean(g.genre))
            .map((g) => ({
              id: g.genre!.id,
              name: g.genre!.name,
            })),
        }))
        const { results, total: combinedTotal } = mergeWithExternal(
          mappedItems,
          externalStubs,
          'game',
          total
        )
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
        const q = prisma.orm.public.Music.where((m) =>
          or(
            m.titlePrimary.ilike(`%${cleanQuery}%`),
            m.titleSecondary.ilike(`%${cleanQuery}%`),
            m.artistName.ilike(`%${cleanQuery}%`)
          )
        )
        const [total, items] = await Promise.all([
          countOf(q),
          q
            .offset(skip)
            .limit(limit)
            .select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'artistName',
              'coverImage',
              'type',
              'duration',
              'releaseDateYear'
            )
            .include('album', (a) => a.select('titlePrimary'))
            .include('genres', (g) =>
              g.include('genre', (ge) => ge.select('id', 'name'))
            )
            .all(),
        ])
        const mappedItems = items.map((x) => ({
          ...x,
          artist: x.artistName,
          albumTitle: x.album?.titlePrimary ?? null,
          durationMs: x.duration ? x.duration * 1000 : null,
          genres: (x.genres || [])
            .filter((g) => Boolean(g.genre))
            .map((g) => ({
              id: g.genre!.id,
              name: g.genre!.name,
            })),
        }))
        const { results, total: combinedTotal } = mergeWithExternal(
          mappedItems,
          externalStubs,
          'music',
          total
        )
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
        const q = prisma.orm.public.Book.where((b) =>
          or(
            b.titlePrimary.ilike(`%${cleanQuery}%`),
            b.titleSecondary.ilike(`%${cleanQuery}%`)
          )
        )
        const [total, items] = await Promise.all([
          countOf(q),
          q
            .offset(skip)
            .limit(limit)
            .select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'authors',
              'coverImage',
              'pageCount',
              'releaseDateYear',
              'averageScore'
            )
            .include('genres', (g) =>
              g.include('genre', (ge) => ge.select('id', 'name'))
            )
            .all(),
        ])
        const mappedItems = items.map((x) => ({
          ...x,
          authors: [...x.authors],
          genres: (x.genres || [])
            .filter((g) => Boolean(g.genre))
            .map((g) => ({
              id: g.genre!.id,
              name: g.genre!.name,
            })),
        }))
        const { results, total: combinedTotal } = mergeWithExternal(
          mappedItems,
          externalStubs,
          'book',
          total
        )
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
        const q = prisma.orm.public.Character.where((c) =>
          or(
            c.namePrimary.ilike(`%${cleanQuery}%`),
            c.nameNative.ilike(`%${cleanQuery}%`)
          )
        )
        const [total, items] = await Promise.all([
          countOf(q),
          q
            .offset(skip)
            .limit(limit)
            .select(
              'id',
              'namePrimary',
              'nameNative',
              'image',
              'gender',
              'age',
              'description'
            )
            .all(),
        ])
        const merged = mergeWithExternal(
          items,
          externalStubs,
          'characters',
          total
        )
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
        const q = prisma.orm.public.Person.where((p) =>
          or(
            p.namePrimary.ilike(`%${cleanQuery}%`),
            p.nameNative.ilike(`%${cleanQuery}%`)
          )
        )
        const [total, items] = await Promise.all([
          countOf(q),
          q
            .offset(skip)
            .limit(limit)
            .select(
              'id',
              'namePrimary',
              'nameNative',
              'image',
              'language',
              'primaryOccupations',
              'description'
            )
            .all(),
        ])
        const mappedItems = items.map((x) => ({
          ...x,
          primaryOccupations: [...x.primaryOccupations],
        }))
        const merged = mergeWithExternal(
          mappedItems,
          externalStubs,
          'people',
          total
        )
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
        const q = prisma.orm.public.Studio.where((s) =>
          s.name.ilike(`%${cleanQuery}%`)
        )
        const [total, items] = await Promise.all([
          countOf(q),
          q
            .offset(skip)
            .limit(limit)
            .select('id', 'name', 'isAnimationStudio', 'siteUrl', 'favorites')
            .all(),
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
        const [anime, manga, tv, movie, game, book, music, other] =
          await Promise.all([
            prisma.orm.public.Anime.where((a) =>
              or(
                a.titlePrimary.ilike(`%${cleanQuery}%`),
                a.titleSecondary.ilike(`%${cleanQuery}%`)
              )
            )
              .limit(limit)
              .select(
                'id',
                'titlePrimary',
                'titleSecondary',
                'coverImage',
                'format',
                'averageScore'
              )
              .all(),
            prisma.orm.public.Manga.where((m) =>
              or(
                m.titlePrimary.ilike(`%${cleanQuery}%`),
                m.titleSecondary.ilike(`%${cleanQuery}%`)
              )
            )
              .limit(limit)
              .select(
                'id',
                'titlePrimary',
                'titleSecondary',
                'coverImage',
                'format',
                'averageScore'
              )
              .all(),
            prisma.orm.public.Tv.where((t) =>
              or(
                t.titlePrimary.ilike(`%${cleanQuery}%`),
                t.titleSecondary.ilike(`%${cleanQuery}%`)
              )
            )
              .limit(limit)
              .select(
                'id',
                'titlePrimary',
                'titleSecondary',
                'coverImage',
                'averageScore'
              )
              .all(),
            prisma.orm.public.Movie.where((m) =>
              or(
                m.titlePrimary.ilike(`%${cleanQuery}%`),
                m.titleSecondary.ilike(`%${cleanQuery}%`)
              )
            )
              .limit(limit)
              .select(
                'id',
                'titlePrimary',
                'titleSecondary',
                'coverImage',
                'averageScore'
              )
              .all(),
            prisma.orm.public.Game.where((g) =>
              or(
                g.titlePrimary.ilike(`%${cleanQuery}%`),
                g.titleSecondary.ilike(`%${cleanQuery}%`)
              )
            )
              .limit(limit)
              .select(
                'id',
                'titlePrimary',
                'titleSecondary',
                'coverImage',
                'averageScore'
              )
              .all(),
            prisma.orm.public.Book.where((b) =>
              or(
                b.titlePrimary.ilike(`%${cleanQuery}%`),
                b.titleSecondary.ilike(`%${cleanQuery}%`)
              )
            )
              .limit(limit)
              .select(
                'id',
                'titlePrimary',
                'titleSecondary',
                'coverImage',
                'averageScore'
              )
              .all(),
            prisma.orm.public.Music.where((m) =>
              or(
                m.titlePrimary.ilike(`%${cleanQuery}%`),
                m.artistName.ilike(`%${cleanQuery}%`)
              )
            )
              .limit(limit)
              .select('id', 'titlePrimary', 'artistName', 'coverImage')
              .all(),
            prisma.orm.public.Other.where({ isPublished: true })
              .where((o) =>
                or(
                  o.titlePrimary.ilike(`%${cleanQuery}%`),
                  o.titleSecondary.ilike(`%${cleanQuery}%`),
                  o.description.ilike(`%${cleanQuery}%`)
                )
              )
              .limit(limit)
              .select(
                'id',
                'titlePrimary',
                'titleSecondary',
                'coverImage',
                'averageScore',
                'format'
              )
              .all(),
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
        const q = prisma.orm.public.Other.where({ isPublished: true }).where(
          (o) =>
            or(
              o.titlePrimary.ilike(`%${cleanQuery}%`),
              o.titleSecondary.ilike(`%${cleanQuery}%`),
              o.description.ilike(`%${cleanQuery}%`)
            )
        )
        const [total, items] = await Promise.all([
          countOf(q),
          q
            .offset(skip)
            .limit(limit)
            .orderBy([(o) => o.popularity.desc(), (o) => o.averageScore.desc()])
            .select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'description',
              'coverImage',
              'bannerImage',
              'format',
              'startDate',
              'endDate',
              'averageScore',
              'favorites',
              'popularity',
              'progressFields',
              'incrementFieldKey',
              'creatorId'
            )
            .include('creator', (c) => c.select('id', 'username'))
            .all(),
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
