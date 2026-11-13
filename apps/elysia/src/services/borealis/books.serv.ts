import { prisma, countOf, or, and, toDate, type MediaType } from '@NamelessLiberty/db'
import { NotFound } from '../../lib/errors'
import { getProfileCustomization } from '@NamelessLiberty/shared'
import { MediaQueueManager } from './queue'
import { fetchMediaRelations } from './media-relations.helper'
import { MediaEntitySyncer } from './syncer/media-entity.syncer'
import { fetchTopCharacters, flattenGenres, flattenTags, imageSource } from './media-overview.helper'

export interface BookCatalogQuery {
  cursor?: number
  page?: number
  limit?: number
  search?: string
  genres?: string
  tags?: string
  formats?: string
  statuses?: string
  years?: string
  authors?: string
  publishers?: string
  sortBy?:
    | 'popularity'
    | 'score'
    | 'title'
    | 'releaseDate'
    | 'trending'
    | 'favorites'
    | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
}

function parseList(val?: unknown): string[] {
  if (!val || typeof val !== 'string') return []
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export class BorealisBooksServ {
  public static async getCatalog(query?: BookCatalogQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 50)))
    const skip = query?.cursor ? 0 : (page - 1) * limit

    const search = query?.search?.trim()
    const genres = parseList(query?.genres)
    const tags = parseList(query?.tags)
    const statuses = parseList(query?.statuses)
    const years = parseList(query?.years).map((y) => Number(y)).filter((y) => !isNaN(y))
    const authors = parseList(query?.authors)
    const publishers = parseList(query?.publishers)
    const sortBy = query?.sortBy ?? 'popularity'
    const sortOrder = query?.sortOrder ?? (sortBy === 'title' ? 'asc' : 'desc')

    let q = prisma.orm.public.Book
    if (search) {
      q = q.where((m) =>
        or(
          m.titlePrimary.ilike(`%${search}%`),
          m.titleSecondary.ilike(`%${search}%`),
          m.subtitle.ilike(`%${search}%`)
        )
      )
    }
    if (genres.length > 0) {
      q = q.where((m) =>
        m.genres.some((g) => g.genre.some((ge) => ge.name.in(genres)))
      )
    }
    if (tags.length > 0) {
      q = q.where((m) =>
        m.tags.some((t) => t.tag.some((te) => te.name.in(tags)))
      )
    }
    if (statuses.length > 0) {
      q = q.where((m) => m.status.in(statuses as any))
    }
    if (years.length > 0) {
      q = q.where((m) => m.releaseDateYear.in(years))
    }
    if (query?.cursor) {
      q = q.where((m) =>
        sortOrder === 'asc' ? m.id.gt(query.cursor!) : m.id.lt(query.cursor!)
      )
    }

    let itemsQ = q
    if (sortBy === 'score') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.averageScore.asc() : x.averageScore.desc()
      )
    } else if (sortBy === 'title') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.titlePrimary.asc() : x.titlePrimary.desc()
      )
    } else if (sortBy === 'releaseDate') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.releaseDateYear.asc() : x.releaseDateYear.desc()
      )
    } else if (sortBy === 'favorites') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.favorites.asc() : x.favorites.desc()
      )
    } else if (sortBy === 'updatedAt') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.updatedAt.asc() : x.updatedAt.desc()
      )
    } else {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.popularity.asc() : x.popularity.desc()
      )
    }

    const [total, rawItems] = await Promise.all([
      countOf(q),
      itemsQ
        .offset(skip)
        .limit(limit)
        .include('genres', (g) => g.include('genre'))
        .include('tags', (t) => t.include('tag'))
        .all(),
    ])

    const items = rawItems.map((m: any) => ({
      id: m.id,
      titlePrimary: m.titlePrimary,
      titleSecondary: m.titleSecondary ?? null,
      titleNative: m.subtitle ?? null,
      coverImage: m.coverImage ?? null,
      bannerImage: m.bannerImage ?? null,
      averageScore: m.averageScore ?? null,
      format: m.format ?? null,
      status: m.status ?? null,
      startDateYear: m.releaseDateYear ?? null,
      description: m.description ?? null,
      genres: flattenGenres(m.genres),
      tags: flattenTags(m.tags),
    }))

    const nextCursor = items.length === limit ? items[items.length - 1]!.id : null
    const hasMore = query?.cursor ? nextCursor !== null : skip + limit < total

    return {
      success: true,
      items,
      nextCursor,
      hasMore,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore,
      },
    }
  }

  public static async getFilters() {
    const [allBooks, allGenres] = await Promise.all([
      prisma.orm.public.Book.select('status', 'format', 'releaseDateYear').all(),
      prisma.orm.public.Genre.select('id', 'name')
        .include('books', (b) => b.count())
        .orderBy((g) => g.name.asc())
        .all(),
    ])

    const statusCounts: Record<string, number> = {}
    const formatCounts: Record<string, number> = {}
    const yearCounts: Record<number, number> = {}

    for (const b of allBooks) {
      if (b.status) statusCounts[b.status] = (statusCounts[b.status] || 0) + 1
      if (b.format) formatCounts[b.format] = (formatCounts[b.format] || 0) + 1
      if (b.releaseDateYear) yearCounts[b.releaseDateYear] = (yearCounts[b.releaseDateYear] || 0) + 1
    }

    return {
      success: true,
      statuses: Object.entries(statusCounts).map(([value, count]) => ({ value, count })),
      formats: Object.entries(formatCounts).map(([value, count]) => ({ value, count })),
      genres: allGenres.map((g: any) => ({ value: g.name, count: g.books ?? 0 })),
      tags: [],
      years: Object.entries(yearCounts)
        .map(([value, count]) => ({ value: Number(value), count }))
        .sort((a, b) => b.value - a.value),
    }
  }

  public static async getById(id: number) {
    const raw = await prisma.orm.public.Book
      .where({ id })
      .include('genres', (g) => g.include('genre'))
      .include('tags', (t) => t.include('tag'))
      .first()

    if (!raw) {
      throw new NotFound(`Book with ID ${id} not found`)
    }

    const characters = await fetchTopCharacters('BOOK', id)

    const media = {
      id: raw.id,
      characters,
      titlePrimary: raw.titlePrimary,
      titleSecondary: raw.titleSecondary ?? null,
      titleNative: raw.subtitle ?? null,
      subtitle: raw.subtitle ?? null,
      coverImage: raw.coverImage ?? null,
      bannerImage: raw.bannerImage ?? null,
      description: raw.description ?? null,
      originalLanguage: raw.originalLanguage ?? null,
      countryOfOrigin: raw.countryOfOrigin ?? null,
      authors: raw.authors ?? [],
      publishers: raw.publishers ?? [],
      series: raw.series ?? null,
      seriesPosition: raw.seriesPosition ?? null,
      pageCount: raw.pageCount ?? null,
      chapterCount: raw.chapterCount ?? null,
      volumeCount: raw.volumeCount ?? null,
      startDateYear: raw.releaseDateYear ?? null,
      startDateMonth: raw.releaseDateMonth ?? null,
      startDateDay: raw.releaseDateDay ?? null,
      genres: flattenGenres(raw.genres),
      subjects: raw.subjects ?? [],
      tags: flattenTags(raw.tags),
      format: raw.format ?? null,
      status: raw.status ?? null,
      averageScore: raw.averageScore ?? null,
      favorites: raw.favorites ?? 0,
      popularity: raw.popularity ?? 0,
      isAdult: raw.isAdult ?? false,
      synonyms: raw.synonyms ?? [],
      ageRating: raw.ageRating ?? null,
      ageRatingGuide: raw.ageRatingGuide ?? null,
      retailPrice: raw.retailPrice ?? null,
      retailPriceCurrency: raw.retailPriceCurrency ?? null,
      updatedAt: toDate(raw.updatedAt).toISOString(),
      googleBookId: raw.googleBookId ?? null,
      isbn10: raw.isbn10 ?? null,
      isbn13: raw.isbn13 ?? null,
      openLibraryId: raw.openLibraryId ?? null,
      externalLinks: {
        website: raw.website ?? null,
        siteUrl: raw.siteUrl ?? null,
        previewLink: raw.previewLink ?? null,
        infoLink: raw.infoLink ?? null,
        buyLink: raw.buyLink ?? null,
      },
      sources: (raw as any).sources ?? null,
    }

    return { success: true, media }
  }

  public static async refresh(id: number) {
    const book = await prisma.orm.public.Book.where({ id }).select('id', 'googleBookId').first()
    if (!book) throw new NotFound(`Book with ID ${id} not found`)

    try {
      const synced = await MediaEntitySyncer.syncBook(id, book.googleBookId)
      if (synced) {
        return { success: true, message: 'Book refreshed successfully' }
      }
    } catch {
      // Fallback to queue
    }

    await MediaQueueManager.enqueueMediaUpdate('BOOK', id, {
      externalId: book.googleBookId,
      priority: 1,
      depth: 0,
      maxDepth: 0,
    })
    return { success: true, message: 'Book refresh enqueued' }
  }

  public static async getSimilar(id: number) {
    const book = await prisma.orm.public.Book.where({ id })
      .include('genres', (g) => g.include('genre'))
      .first()
    if (!book) throw new NotFound(`Book with ID ${id} not found`)

    const genreIds = (book.genres || [])
      .map((g: any) => g.genreId ?? g.genre?.id)
      .filter(Boolean)

    let q = prisma.orm.public.Book.where((b) => b.id.neq(id))
    if (genreIds.length > 0) {
      q = q.where((b) =>
        b.genres.some((bg) => bg.genreId.in(genreIds))
      )
    }

    const raw = await q
      .orderBy((b) => b.popularity.desc())
      .limit(24)
      .include('genres', (g) => g.include('genre'))
      .include('tags', (t) => t.include('tag'))
      .all()

    const similar = raw.map((m: any) => ({
      id: m.id,
      titlePrimary: m.titlePrimary,
      titleSecondary: m.titleSecondary ?? null,
      titleNative: m.subtitle ?? null,
      coverImage: m.coverImage ?? null,
      bannerImage: m.bannerImage ?? null,
      averageScore: m.averageScore ?? null,
      format: m.format ?? null,
      status: m.status ?? null,
      startDateYear: m.releaseDateYear ?? null,
      description: m.description ?? null,
      genres: flattenGenres(m.genres),
      tags: flattenTags(m.tags),
    }))

    return { success: true, similar }
  }

  public static async getRelations(id: number) {
    const raw = await fetchMediaRelations('BOOK' as MediaType, id)
    return {
      success: true,
      relations: raw.map((r) => ({
        id: r.id,
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        targetType: r.targetType,
        targetId: r.targetId,
        type: r.type,
        data: r.target
          ? {
              id: r.target.id,
              titlePrimary: r.target.titlePrimary,
              titleSecondary: r.target.titleSecondary ?? null,
              titleNative: r.target.titleNative ?? null,
              coverImage: r.target.coverImage ?? null,
              bannerImage: r.target.bannerImage ?? null,
              averageScore: r.target.averageScore ?? null,
              format: r.target.format ?? null,
              status: r.target.status ?? null,
              startDateYear: r.target.seasonYear ?? null,
              description: r.target.description ?? null,
              genres: Array.isArray(r.target.genres) ? r.target.genres : [],
              tags: [],
            }
          : null,
      })),
    }
  }

  public static async getCharacters(id: number) {
    const raw = await prisma.orm.public.MediaCharacter
      .where((mc) => and(mc.mediaType.eq('BOOK' as MediaType), mc.mediaId.eq(id)))
      .include('character')
      .all()

    return {
      success: true,
      characters: raw.map((c: any) => ({
        id: c.id,
        mediaId: c.mediaId,
        mediaType: c.mediaType,
        characterId: c.characterId,
        actorId: c.actorId ?? null,
        role: c.role,
        characterData: {
          id: c.character.id,
          namePrimary: c.character.namePrimary,
          nameNative: c.character.nameNative ?? null,
          age: c.character.age ?? null,
          gender: c.character.gender ?? null,
          dateOfBirthDay: c.character.dateOfBirthDay ?? null,
          dateOfBirthMonth: c.character.dateOfBirthMonth ?? null,
          dateOfBirthYear: c.character.dateOfBirthYear ?? null,
          description: c.character.description ?? null,
          image: c.character.image ?? null,
        },
      })),
    }
  }

  public static async getStaff(id: number) {
    const raw = await prisma.orm.public.MediaStaff
      .where((ms) => and(ms.mediaType.eq('BOOK' as MediaType), ms.mediaId.eq(id)))
      .include('person')
      .all()

    return {
      success: true,
      staff: raw.map((s: any) => ({
        id: s.id,
        mediaId: s.mediaId,
        mediaType: s.mediaType,
        personId: s.personId,
        role: s.role,
        customRole: s.customRole ?? null,
        personData: {
          id: s.person.id,
          namePrimary: s.person.namePrimary,
          nameNative: s.person.nameNative ?? null,
          nameAlternative: s.person.nameAlternative ?? [],
          image: s.person.image ?? null,
          gender: s.person.gender ?? null,
          language: s.person.language ?? null,
          description: s.person.description ?? null,
        },
      })),
    }
  }

  public static async getImages(id: number) {
    const book = await prisma.orm.public.Book.where({ id })
      .select('images')
      .first()
    if (!book) throw new NotFound(`Book with ID ${id} not found`)
    return {
      success: true,
      images: {
        googlebooks: imageSource(book.images, 'googlebooks'),
        openlibrary: imageSource(book.images, 'openlibrary'),
      },
    }
  }
  public static async getStats(id: number) {
    const book = await prisma.orm.public.Book.where({ id })
      .select(
        'averageScore',
        'favorites',
        'popularity',
        'scoreDistribution',
        'statusDistribution',
        'googleBooksRating',
        'googleBooksRatingsCount'
      )
      .first()
    if (!book) throw new NotFound(`Book with ID ${id} not found`)

    return {
      success: true,
      stats: {
        averageScore: book.averageScore ?? null,
        favorites: book.favorites ?? 0,
        popularity: book.popularity ?? 0,
        scoreDistribution: book.scoreDistribution ?? {},
        statusDistribution: book.statusDistribution ?? {},
        googleBooksRating: book.googleBooksRating ?? null,
        googleBooksRatingsCount: book.googleBooksRatingsCount ?? null,
      },
    }
  }

  public static async getFriends(id: number, currentUserId?: string) {
    if (!currentUserId) return { success: true, friends: [] }

    const userFriends = await prisma.orm.public.Friend
      .where({ userId: currentUserId })
      .select('friendId')
      .all()

    const friendIds = userFriends.map((f) => f.friendId)
    if (friendIds.length === 0) return { success: true, friends: [] }

    const rawEntries = await prisma.orm.public.BookList
      .where((l) => and(l.bookId.eq(id), l.private.eq(false), l.userId.in(friendIds)))
      .include('user', (u: any) => u.select('id', 'username', 'customization'))
      .all()

    const friends = rawEntries.map((raw: any) => {
      const profile = getProfileCustomization(raw.user?.customization)
      return {
        id: raw.id,
        userId: raw.userId,
        status: raw.status,
        score: raw.score,
        primaryProgress: raw.progressChapters,
        secondaryProgress: raw.progressVolumes,
        progress: raw.progressChapters,
        volumesProgress: raw.progressVolumes,
        updatedAt: toDate(raw.updatedAt).toISOString(),
        user: {
          id: raw.user?.id || raw.userId,
          username: raw.user?.username || 'Unknown',
          customization: raw.user?.customization || null,
          displayName: profile.displayName || raw.user?.username || 'Unknown',
          avatarUrl: profile.avatarUrl || null,
          avatarFrame: profile.avatarFrame || null,
          displayNameStyle: profile.displayNameStyle || null,
        },
      }
    })

    return { success: true, friends }
  }

  public static async getPeople(id: number, query?: { page?: number; limit?: number; status?: string }) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 40)))
    const skip = (page - 1) * limit
    const filterStatus = query?.status?.toUpperCase()?.trim()

    let q = prisma.orm.public.BookList.where({ bookId: id, private: false })
    if (filterStatus) q = q.where({ status: filterStatus as any })

    const [total, rawEntries] = await Promise.all([
      countOf(q),
      q
        .orderBy((item: any) => item.updatedAt.desc())
        .offset(skip)
        .limit(limit)
        .include('user', (u: any) => u.select('id', 'username', 'customization'))
        .all(),
    ])

    const people = rawEntries.map((raw: any) => {
      const profile = getProfileCustomization(raw.user?.customization)
      return {
        id: raw.id,
        userId: raw.userId,
        status: raw.status,
        score: raw.score,
        primaryProgress: raw.progressChapters,
        secondaryProgress: raw.progressVolumes,
        progress: raw.progressChapters,
        volumesProgress: raw.progressVolumes,
        updatedAt: toDate(raw.updatedAt).toISOString(),
        user: {
          id: raw.user?.id || raw.userId,
          username: raw.user?.username || 'Unknown',
          customization: raw.user?.customization || null,
          displayName: profile.displayName || raw.user?.username || 'Unknown',
          avatarUrl: profile.avatarUrl || null,
          avatarFrame: profile.avatarFrame || null,
          displayNameStyle: profile.displayNameStyle || null,
        },
      }
    })

    return {
      success: true,
      mediaType: 'book',
      mediaId: id,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      people,
    }
  }

  public static async getRecommendations(_id: number) {
    return { success: true, recommendations: [] }
  }
}
