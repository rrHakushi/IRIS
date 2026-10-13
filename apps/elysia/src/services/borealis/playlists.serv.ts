import { prisma, type MediaType } from '@IRIS/database'
import { NotFound, BadRequest, Forbidden } from '../../lib/errors'

export interface ListPlaylistsQuery {
  page?: number
  limit?: number
  q?: string
  isPrivate?: boolean
}

export interface GetEntriesQuery {
  page?: number
  limit?: number
  mediaType?: string
  q?: string
  sortBy?: string
  order?: 'asc' | 'desc'
}

function formatPlaylist(p: any, entriesCount?: number) {
  return {
    id: p.id,
    userId: p.userId,
    name: p.name,
    description: p.description ?? null,
    isDefault: p.isDefault,
    isPrivate: p.isPrivate,
    coverImage: p.coverImage ?? null,
    order: p.order,
    entriesCount: entriesCount !== undefined ? entriesCount : p._count?.entries ?? 0,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
    updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : String(p.updatedAt),
  }
}

function formatEntry(e: any) {
  return {
    id: e.id,
    listId: e.listId,
    mediaType: e.mediaType,
    mediaId: e.mediaId,
    order: e.order,
    customNotes: e.customNotes ?? null,
    addedAt: e.addedAt instanceof Date ? e.addedAt.toISOString() : String(e.addedAt),
  }
}

export class BorealisPlaylistsServ {
  /**
   * List custom playlists belonging to the user.
   */
  public static async listPlaylists(userId: string, query?: ListPlaylistsQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 20)))
    const skip = (page - 1) * limit

    const where: any = { userId }
    if (query?.q) {
      where.name = { contains: query.q.trim(), mode: 'insensitive' }
    }
    if (query?.isPrivate !== undefined) {
      where.isPrivate = Boolean(query.isPrivate)
    }

    const [total, playlists] = await Promise.all([
      prisma.customList.count({ where }),
      prisma.customList.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isDefault: 'desc' }, { order: 'asc' }, { createdAt: 'desc' }],
        include: {
          _count: {
            select: { entries: true },
          },
        },
      }),
    ])

    return {
      success: true,
      playlists: playlists.map((p) => formatPlaylist(p)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: page * limit < total,
      },
    }
  }

  /**
   * Create a new custom playlist for the user.
   */
  public static async createPlaylist(
    userId: string,
    body: {
      name: string
      description?: string | null
      isPrivate?: boolean
      coverImage?: string | null
      order?: number
    }
  ) {
    const name = body.name.trim()
    if (!name) {
      throw new BadRequest('Playlist name cannot be empty')
    }

    const created = await prisma.customList.create({
      data: {
        userId,
        name,
        description: body.description ?? null,
        isPrivate: body.isPrivate ?? false,
        coverImage: body.coverImage ?? null,
        order: body.order ?? 0,
      },
    })

    return {
      success: true,
      message: 'Playlist created successfully',
      playlist: formatPlaylist(created, 0),
    }
  }

  /**
   * Update details of an existing playlist owned by user.
   */
  public static async updatePlaylist(
    userId: string,
    playlistId: string,
    body: {
      name?: string
      description?: string | null
      isPrivate?: boolean
      coverImage?: string | null
      order?: number
    }
  ) {
    const existing = await prisma.customList.findFirst({
      where: { id: playlistId, userId },
      include: {
        _count: { select: { entries: true } },
      },
    })
    if (!existing) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }

    const updateData: any = {}
    if (body.name !== undefined) {
      const trimmed = body.name.trim()
      if (!trimmed) throw new BadRequest('Playlist name cannot be empty')
      updateData.name = trimmed
    }
    if (body.description !== undefined) updateData.description = body.description
    if (body.isPrivate !== undefined) updateData.isPrivate = Boolean(body.isPrivate)
    if (body.coverImage !== undefined) updateData.coverImage = body.coverImage
    if (body.order !== undefined) updateData.order = Number(body.order)

    const updated = await prisma.customList.update({
      where: { id: playlistId },
      data: updateData,
    })

    return {
      success: true,
      message: 'Playlist updated successfully',
      playlist: formatPlaylist(updated, existing._count.entries),
    }
  }

  /**
   * Delete a playlist owned by user.
   */
  public static async deletePlaylist(userId: string, playlistId: string) {
    const existing = await prisma.customList.findFirst({
      where: { id: playlistId, userId },
    })
    if (!existing) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }

    await prisma.customList.delete({
      where: { id: playlistId },
    })

    return {
      success: true,
      message: 'Playlist deleted successfully',
    }
  }

  /**
   * Get entries of a playlist with pagination and resolved media details.
   */
  public static async getPlaylistEntries(
    userId: string,
    playlistId: string,
    query?: GetEntriesQuery
  ) {
    const playlist = await prisma.customList.findUnique({
      where: { id: playlistId },
      include: {
        _count: { select: { entries: true } },
      },
    })
    if (!playlist) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }

    // Access control: private playlists can only be viewed by the owner
    if (playlist.isPrivate && playlist.userId !== userId) {
      throw new Forbidden('Access to this playlist is denied')
    }

    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 40)))
    const skip = (page - 1) * limit
    const order = query?.order === 'desc' ? 'desc' : 'asc'

    const where: any = { listId: playlistId }
    if (query?.mediaType) {
      where.mediaType = query.mediaType.toUpperCase() as MediaType
    }
    if (query?.q) {
      where.customNotes = { contains: query.q.trim(), mode: 'insensitive' }
    }

    let orderBy: any = { order }
    if (query?.sortBy === 'addedAt') {
      orderBy = { addedAt: order }
    }

    const [total, entries] = await Promise.all([
      prisma.customListEntry.count({ where }),
      prisma.customListEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          anime: {
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              coverImage: true,
              bannerImage: true,
              format: true,
              status: true,
              averageScore: true,
            },
          },
          manga: {
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              coverImage: true,
              bannerImage: true,
              format: true,
              status: true,
              averageScore: true,
            },
          },
          movie: {
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              coverImage: true,
              bannerImage: true,
              status: true,
              averageScore: true,
            },
          },
          tv: {
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              coverImage: true,
              bannerImage: true,
              status: true,
              averageScore: true,
            },
          },
          game: {
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              coverImage: true,
              bannerImage: true,
              status: true,
              averageScore: true,
            },
          },
          book: {
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              coverImage: true,
              bannerImage: true,
              status: true,
              averageScore: true,
            },
          },
          music: {
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              coverImage: true,
              status: true,
              artistName: true,
            },
          },
        },
      }),
    ])

    return {
      success: true,
      playlist: {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description ?? null,
        isPrivate: playlist.isPrivate,
        coverImage: playlist.coverImage ?? null,
        entriesCount: playlist._count.entries,
      },
      items: entries.map((item) => {
        const media =
          item.anime ||
          item.manga ||
          item.movie ||
          item.tv ||
          item.game ||
          item.book ||
          item.music ||
          null

        return {
          entry: formatEntry(item),
          media,
        }
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: page * limit < total,
      },
    }
  }

  /**
   * Add a media entry to the playlist.
   */
  public static async addPlaylistEntry(
    userId: string,
    playlistId: string,
    body: {
      mediaType: string
      mediaId: number
      order?: number
      customNotes?: string | null
    }
  ) {
    const playlist = await prisma.customList.findFirst({
      where: { id: playlistId, userId },
    })
    if (!playlist) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }

    const mediaType = body.mediaType.toUpperCase() as MediaType
    const mediaId = Number(body.mediaId)
    if (!mediaId || isNaN(mediaId)) {
      throw new BadRequest('Valid mediaId is required')
    }

    // Determine auto-order if not supplied
    let order = body.order
    if (order === undefined) {
      const highest = await prisma.customListEntry.findFirst({
        where: { listId: playlistId },
        orderBy: { order: 'desc' },
        select: { order: true },
      })
      order = (highest?.order ?? 0) + 1
    }

    const isMusic = ['MUSIC', 'MUSIC_ALBUM', 'MUSIC_TRACK'].includes(mediaType)

    const entry = await prisma.customListEntry.upsert({
      where: {
        listId_mediaType_mediaId: {
          listId: playlistId,
          mediaType,
          mediaId,
        },
      },
      create: {
        listId: playlistId,
        mediaType,
        mediaId,
        order,
        customNotes: body.customNotes ?? null,
        animeId: mediaType === 'ANIME' ? mediaId : null,
        mangaId: mediaType === 'MANGA' ? mediaId : null,
        movieId: mediaType === 'MOVIE' ? mediaId : null,
        tvId: mediaType === 'TV' ? mediaId : null,
        gameId: mediaType === 'GAME' ? mediaId : null,
        bookId: mediaType === 'BOOK' ? mediaId : null,
        musicId: isMusic ? mediaId : null,
      },
      update: {
        order,
        ...(body.customNotes !== undefined ? { customNotes: body.customNotes } : {}),
      },
    })

    return {
      success: true,
      message: 'Entry added to playlist successfully',
      entry: formatEntry(entry),
    }
  }

  /**
   * Update an entry in the playlist (order, notes, or batch reorder).
   */
  public static async updatePlaylistEntry(
    userId: string,
    playlistId: string,
    body: {
      id?: string
      mediaType?: string
      mediaId?: number
      order?: number
      customNotes?: string | null
      reorder?: Array<{ id: string; order: number }>
    }
  ) {
    const playlist = await prisma.customList.findFirst({
      where: { id: playlistId, userId },
    })
    if (!playlist) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }

    // Handle batch reorder
    if (body.reorder && Array.isArray(body.reorder)) {
      for (const item of body.reorder) {
        await prisma.customListEntry.updateMany({
          where: { id: item.id, listId: playlistId },
          data: { order: Number(item.order) },
        })
      }
      return {
        success: true,
        message: 'Playlist entries reordered successfully',
        entry: null,
      }
    }

    // Single entry update
    let entry: any = null
    if (body.id) {
      entry = await prisma.customListEntry.findFirst({
        where: { id: body.id, listId: playlistId },
      })
    } else if (body.mediaType && body.mediaId) {
      entry = await prisma.customListEntry.findUnique({
        where: {
          listId_mediaType_mediaId: {
            listId: playlistId,
            mediaType: body.mediaType.toUpperCase() as MediaType,
            mediaId: Number(body.mediaId),
          },
        },
      })
    }

    if (!entry) {
      throw new NotFound('Playlist entry not found')
    }

    const updateData: any = {}
    if (body.order !== undefined) updateData.order = Number(body.order)
    if (body.customNotes !== undefined) updateData.customNotes = body.customNotes

    const updated = await prisma.customListEntry.update({
      where: { id: entry.id },
      data: updateData,
    })

    return {
      success: true,
      message: 'Playlist entry updated successfully',
      entry: formatEntry(updated),
    }
  }

  /**
   * Remove an entry from the playlist.
   */
  public static async removePlaylistEntry(
    userId: string,
    playlistId: string,
    target: {
      id?: string
      mediaType?: string
      mediaId?: number
    }
  ) {
    const playlist = await prisma.customList.findFirst({
      where: { id: playlistId, userId },
    })
    if (!playlist) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }

    let entry: any = null
    if (target.id) {
      entry = await prisma.customListEntry.findFirst({
        where: { id: target.id, listId: playlistId },
      })
    } else if (target.mediaType && target.mediaId) {
      entry = await prisma.customListEntry.findUnique({
        where: {
          listId_mediaType_mediaId: {
            listId: playlistId,
            mediaType: target.mediaType.toUpperCase() as MediaType,
            mediaId: Number(target.mediaId),
          },
        },
      })
    }

    if (!entry) {
      throw new NotFound('Playlist entry not found')
    }

    await prisma.customListEntry.delete({
      where: { id: entry.id },
    })

    return {
      success: true,
      message: 'Entry removed from playlist successfully',
    }
  }
}
