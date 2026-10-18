import type { PrismaClient } from "@IRIS/database"

export interface MediaRelationItem {
  id: number
  sourceType: string
  sourceId: number
  targetType: string
  targetId: number
  type: string
  target: any | null
}

function invertRelationType(type: string): string {
  switch (type) {
    case "PREQUEL":
      return "SEQUEL"
    case "SEQUEL":
      return "PREQUEL"
    case "PARENT":
      return "SIDE_STORY"
    case "SIDE_STORY":
      return "PARENT"
    case "SUMMARY":
      return "PARENT"
    default:
      return type
  }
}

export async function fetchMediaRelations(
  prisma: PrismaClient,
  sourceType:
    | "ANIME"
    | "MANGA"
    | "MOVIE"
    | "TV"
    | "GAME"
    | "BOOK"
    | "MUSIC"
    | "MUSIC_ALBUM"
    | "MUSIC_TRACK",
  sourceId: number
): Promise<MediaRelationItem[]> {
  const rawRelations = await prisma.mediaRelation.findMany({
    where: {
      sourceType: sourceType as any,
      sourceId,
    },
  })

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
      const key = `${rel.targetType}:${rel.targetId}`
      relationMap.set(key, {
        id: rel.id,
        sourceType: rel.sourceType,
        sourceId: rel.sourceId,
        targetType: rel.targetType,
        targetId: rel.targetId,
        type: rel.type,
      })
    } else if (rel.targetType === sourceType && rel.targetId === sourceId) {
      const key = `${rel.sourceType}:${rel.sourceId}`
      if (!relationMap.has(key)) {
        relationMap.set(key, {
          id: rel.id,
          sourceType,
          sourceId,
          targetType: rel.sourceType,
          targetId: rel.sourceId,
          type: invertRelationType(rel.type),
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
  const musicTrackIds: number[] = []
  const musicAlbumIds: number[] = []

  for (const r of relations) {
    switch (r.targetType) {
      case "ANIME":
        animeIds.push(r.targetId)
        break
      case "MANGA":
        mangaIds.push(r.targetId)
        break
      case "MOVIE":
        movieIds.push(r.targetId)
        break
      case "TV":
        tvIds.push(r.targetId)
        break
      case "GAME":
        gameIds.push(r.targetId)
        break
      case "BOOK":
        bookIds.push(r.targetId)
        break
      case "MUSIC":
      case "MUSIC_TRACK":
        musicTrackIds.push(r.targetId)
        break
      case "MUSIC_ALBUM":
        musicAlbumIds.push(r.targetId)
        break
    }
  }

  const targetMap = new Map<string, any>()
  const queries: Promise<void>[] = []

  if (animeIds.length > 0) {
    queries.push(
      prisma.anime
        .findMany({
          where: { id: { in: animeIds } },
          select: {
            id: true,
            titlePrimary: true,
            titleSecondary: true,
            titleNative: true,
            coverImage: true,
            format: true,
          },
        })
        .then((items) => {
          for (const item of items) {
            targetMap.set(`ANIME:${item.id}`, item)
          }
        })
    )
  }

  if (mangaIds.length > 0) {
    queries.push(
      prisma.manga
        .findMany({
          where: { id: { in: mangaIds } },
          select: {
            id: true,
            titlePrimary: true,
            titleSecondary: true,
            titleNative: true,
            coverImage: true,
            format: true,
          },
        })
        .then((items) => {
          for (const item of items) {
            targetMap.set(`MANGA:${item.id}`, item)
          }
        })
    )
  }

  if (movieIds.length > 0) {
    queries.push(
      prisma.movie
        .findMany({
          where: { id: { in: movieIds } },
          select: {
            id: true,
            titlePrimary: true,
            titleSecondary: true,
            titleNative: true,
            coverImage: true,
          },
        })
        .then((items) => {
          for (const item of items) {
            targetMap.set(`MOVIE:${item.id}`, item)
          }
        })
    )
  }

  if (tvIds.length > 0) {
    queries.push(
      prisma.tv
        .findMany({
          where: { id: { in: tvIds } },
          select: {
            id: true,
            titlePrimary: true,
            titleSecondary: true,
            titleNative: true,
            coverImage: true,
          },
        })
        .then((items) => {
          for (const item of items) {
            targetMap.set(`TV:${item.id}`, item)
          }
        })
    )
  }

  if (gameIds.length > 0) {
    queries.push(
      prisma.game
        .findMany({
          where: { id: { in: gameIds } },
          select: {
            id: true,
            titlePrimary: true,
            titleSecondary: true,
            titleNative: true,
            coverImage: true,
          },
        })
        .then((items) => {
          for (const item of items) {
            targetMap.set(`GAME:${item.id}`, item)
          }
        })
    )
  }

  if (bookIds.length > 0) {
    queries.push(
      prisma.book
        .findMany({
          where: { id: { in: bookIds } },
          select: {
            id: true,
            titlePrimary: true,
            titleSecondary: true,
            coverImage: true,
          },
        })
        .then((items) => {
          for (const item of items) {
            targetMap.set(`BOOK:${item.id}`, item)
          }
        })
    )
  }

  if (musicTrackIds.length > 0 || musicAlbumIds.length > 0) {
    const allMusicIds = Array.from(
      new Set([...musicTrackIds, ...musicAlbumIds])
    )
    queries.push(
      prisma.music
        .findMany({
          where: { id: { in: allMusicIds } },
          select: {
            id: true,
            titlePrimary: true,
            titleSecondary: true,
            titleNative: true,
            coverImage: true,
            artistName: true,
            type: true,
          },
        })
        .then((items) => {
          for (const item of items) {
            targetMap.set(`MUSIC:${item.id}`, item)
            targetMap.set(`MUSIC_TRACK:${item.id}`, item)
            targetMap.set(`MUSIC_ALBUM:${item.id}`, item)
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
