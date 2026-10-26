import { prisma, and, or, type MediaType } from '@Iris/db'

export interface HydratedMediaTarget {
  id: number
  titlePrimary: string
  titleSecondary?: string | null
  titleNative?: string | null
  coverImage?: string | null
  format?: string | null
  seasonYear?: number | null
}

export interface HydratedMediaRelationItem {
  id: number
  sourceType: string
  sourceId: number
  targetType: string
  targetId: number
  type: string
  target: HydratedMediaTarget | null
}

function invertRelationType(type: string): string {
  switch (type) {
    case 'PREQUEL':
      return 'SEQUEL'
    case 'SEQUEL':
      return 'PREQUEL'
    case 'PARENT':
      return 'SIDE_STORY'
    case 'SIDE_STORY':
      return 'PARENT'
    case 'SUMMARY':
      return 'PARENT'
    default:
      return type
  }
}

export async function fetchMediaRelations(
  sourceType: MediaType,
  sourceId: number
): Promise<HydratedMediaRelationItem[]> {
  const rawRelations = await prisma.orm.public.MediaRelation
    .where((r) =>
      or(
        and(r.sourceType.eq(sourceType), r.sourceId.eq(sourceId)),
        and(r.targetType.eq(sourceType), r.targetId.eq(sourceId))
      )
    )
    .all()

  if (!rawRelations || rawRelations.length === 0) {
    return []
  }

  const relationMap = new Map<
    string,
    {
      id: number
      sourceType: string
      sourceId: number
      targetType: string
      targetId: number
      type: string
    }
  >()

  for (const rel of rawRelations) {
    if (rel.sourceType === sourceType && rel.sourceId === sourceId) {
      const key = `${rel.targetType}:${rel.targetId}:${rel.type}`
      relationMap.set(key, {
        id: rel.id,
        sourceType: rel.sourceType,
        sourceId: rel.sourceId,
        targetType: rel.targetType,
        targetId: rel.targetId,
        type: rel.type,
      })
    } else if (rel.targetType === sourceType && rel.targetId === sourceId) {
      const invertedType = invertRelationType(rel.type)
      const key = `${rel.sourceType}:${rel.sourceId}:${invertedType}`
      if (!relationMap.has(key)) {
        relationMap.set(key, {
          id: rel.id,
          sourceType,
          sourceId,
          targetType: rel.sourceType,
          targetId: rel.sourceId,
          type: invertedType,
        })
      }
    }
  }

  const relations = Array.from(relationMap.values())
  if (relations.length === 0) {
    return []
  }

  const animeIds: number[] = []
  const mangaIds: number[] = []
  const movieIds: number[] = []
  const tvIds: number[] = []
  const gameIds: number[] = []
  const bookIds: number[] = []
  const musicIds: number[] = []

  for (const r of relations) {
    switch (r.targetType) {
      case 'ANIME':
        animeIds.push(r.targetId)
        break
      case 'MANGA':
        mangaIds.push(r.targetId)
        break
      case 'MOVIE':
        movieIds.push(r.targetId)
        break
      case 'TV':
        tvIds.push(r.targetId)
        break
      case 'GAME':
        gameIds.push(r.targetId)
        break
      case 'BOOK':
        bookIds.push(r.targetId)
        break
      case 'MUSIC':
      case 'MUSIC_TRACK':
      case 'MUSIC_ALBUM':
        musicIds.push(r.targetId)
        break
    }
  }

  const targetMap = new Map<string, HydratedMediaTarget>()
  const queries: PromiseLike<void>[] = []

  if (animeIds.length > 0) {
    queries.push(
      prisma.orm.public.Anime
        .where((a) => a.id.in(Array.from(new Set(animeIds))))
        .select(
          'id',
          'titlePrimary',
          'titleSecondary',
          'titleNative',
          'coverImage',
          'format',
          'seasonYear',
          'startDateYear'
        )
        .all()
        .then((items) => {
          for (const item of items) {
            targetMap.set(`ANIME:${item.id}`, {
              id: item.id,
              titlePrimary: item.titlePrimary,
              titleSecondary: item.titleSecondary,
              titleNative: item.titleNative,
              coverImage: item.coverImage,
              format: item.format,
              seasonYear: item.seasonYear ?? item.startDateYear ?? null,
            })
          }
        })
    )
  }

  if (mangaIds.length > 0) {
    queries.push(
      prisma.orm.public.Manga
        .where((m) => m.id.in(Array.from(new Set(mangaIds))))
        .select(
          'id',
          'titlePrimary',
          'titleSecondary',
          'titleNative',
          'coverImage',
          'format',
          'startDateYear'
        )
        .all()
        .then((items) => {
          for (const item of items) {
            targetMap.set(`MANGA:${item.id}`, {
              id: item.id,
              titlePrimary: item.titlePrimary,
              titleSecondary: item.titleSecondary,
              titleNative: item.titleNative,
              coverImage: item.coverImage,
              format: item.format,
              seasonYear: item.startDateYear ?? null,
            })
          }
        })
    )
  }

  if (movieIds.length > 0) {
    queries.push(
      prisma.orm.public.Movie
        .where((m) => m.id.in(Array.from(new Set(movieIds))))
        .select(
          'id',
          'titlePrimary',
          'titleSecondary',
          'titleNative',
          'coverImage',
          'releaseDateYear'
        )
        .all()
        .then((items) => {
          for (const item of items) {
            targetMap.set(`MOVIE:${item.id}`, {
              id: item.id,
              titlePrimary: item.titlePrimary,
              titleSecondary: item.titleSecondary,
              titleNative: item.titleNative,
              coverImage: item.coverImage,
              format: 'MOVIE',
              seasonYear: item.releaseDateYear ?? null,
            })
          }
        })
    )
  }

  if (tvIds.length > 0) {
    queries.push(
      prisma.orm.public.Tv
        .where((t) => t.id.in(Array.from(new Set(tvIds))))
        .select(
          'id',
          'titlePrimary',
          'titleSecondary',
          'titleNative',
          'coverImage',
          'showType',
          'firstAiredYear'
        )
        .all()
        .then((items) => {
          for (const item of items) {
            targetMap.set(`TV:${item.id}`, {
              id: item.id,
              titlePrimary: item.titlePrimary,
              titleSecondary: item.titleSecondary,
              titleNative: item.titleNative,
              coverImage: item.coverImage,
              format: item.showType || 'TV',
              seasonYear: item.firstAiredYear ?? null,
            })
          }
        })
    )
  }

  if (gameIds.length > 0) {
    queries.push(
      prisma.orm.public.Game
        .where((g) => g.id.in(Array.from(new Set(gameIds))))
        .select(
          'id',
          'titlePrimary',
          'titleSecondary',
          'titleNative',
          'coverImage',
          'releaseDateYear'
        )
        .all()
        .then((items) => {
          for (const item of items) {
            targetMap.set(`GAME:${item.id}`, {
              id: item.id,
              titlePrimary: item.titlePrimary,
              titleSecondary: item.titleSecondary,
              titleNative: item.titleNative,
              coverImage: item.coverImage,
              format: 'GAME',
              seasonYear: item.releaseDateYear ?? null,
            })
          }
        })
    )
  }

  if (bookIds.length > 0) {
    queries.push(
      prisma.orm.public.Book
        .where((b) => b.id.in(Array.from(new Set(bookIds))))
        .select(
          'id',
          'titlePrimary',
          'titleSecondary',
          'coverImage',
          'format',
          'releaseDateYear'
        )
        .all()
        .then((items) => {
          for (const item of items) {
            targetMap.set(`BOOK:${item.id}`, {
              id: item.id,
              titlePrimary: item.titlePrimary,
              titleSecondary: item.titleSecondary,
              titleNative: null,
              coverImage: item.coverImage,
              format: item.format || 'BOOK',
              seasonYear: item.releaseDateYear ?? null,
            })
          }
        })
    )
  }

  if (musicIds.length > 0) {
    const uniqueMusicIds = Array.from(new Set(musicIds))
    queries.push(
      prisma.orm.public.Music
        .where((m) => m.id.in(uniqueMusicIds))
        .select(
          'id',
          'titlePrimary',
          'titleSecondary',
          'titleNative',
          'coverImage',
          'type',
          'releaseDateYear'
        )
        .all()
        .then((items) => {
          for (const item of items) {
            const entry: HydratedMediaTarget = {
              id: item.id,
              titlePrimary: item.titlePrimary,
              titleSecondary: item.titleSecondary,
              titleNative: item.titleNative,
              coverImage: item.coverImage,
              format: item.type || 'MUSIC',
              seasonYear: item.releaseDateYear ?? null,
            }
            targetMap.set(`MUSIC:${item.id}`, entry)
            targetMap.set(`MUSIC_TRACK:${item.id}`, entry)
            targetMap.set(`MUSIC_ALBUM:${item.id}`, entry)
          }
        })
    )
  }

  await Promise.all(queries)

  return relations.map((r) => ({
    ...r,
    target: targetMap.get(`${r.targetType}:${r.targetId}`) ?? null,
  }))
}
