import { prisma, countOf, toDate, type MediaType } from '@Iris/db'
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

function encryptNotes(notes: string | null | undefined, _userId?: string): string | null {
  if (!notes) return null
  return notes
}

function decryptNotes(notes: string | null | undefined, _userId?: string): string | null {
  if (!notes) return null
  return notes
}

function formatPlaylist(p: any, entriesCount?: number) {
  const count =
    entriesCount !== undefined
      ? entriesCount
      : typeof p.entries === 'number'
      ? p.entries
      : p._count?.entries ?? 0

  return {
    id: p.id,
    userId: p.userId,
    name: p.name,
    description: p.description ?? null,
    isDefault: p.isDefault,
    isPrivate: p.isPrivate,
    coverImage: p.coverImage ?? null,
    order: p.order,
    entriesCount: count,
    createdAt: toDate(p.createdAt).toISOString(),
    updatedAt: toDate(p.updatedAt).toISOString(),
  }
}

function formatEntry(e: any, userId?: string) {
  return {
    id: e.id,
    listId: e.listId,
    mediaType: e.mediaType,
    mediaId: e.mediaId,
    order: e.order,
    customNotes: userId ? decryptNotes(e.customNotes, userId) : (e.customNotes ?? null),
    addedAt: toDate(e.addedAt).toISOString(),
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

    let q = prisma.orm.public.CustomList.where({ userId })
    if (query?.q) {
      q = q.where((cl) => cl.name.ilike(`%${query.q!.trim()}%`))
    }
    if (query?.isPrivate !== undefined) {
      q = q.where({ isPrivate: Boolean(query.isPrivate) })
    }

    const [total, playlists] = await Promise.all([
      countOf(q),
      q
        .offset(skip)
        .limit(limit)
        .orderBy([
          (cl) => cl.order.asc(),
          (cl) => cl.createdAt.desc(),
        ])
        .include('entries', (e) => e.count())
        .all(),
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

    const created = await prisma.orm.public.CustomList.create({
      userId,
      name,
      description: body.description ?? null,
      isPrivate: body.isPrivate ?? false,
      coverImage: body.coverImage ?? null,
      order: body.order ?? 0,
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
    const existing = await prisma.orm.public.CustomList
      .where({ id: playlistId, userId })
      .include('entries', (e) => e.count())
      .first()

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

    const updated = await prisma.orm.public.CustomList
      .where({ id: playlistId })
      .update(updateData)

    const entriesCount =
      typeof existing.entries === 'number' ? existing.entries : 0

    return {
      success: true,
      message: 'Playlist updated successfully',
      playlist: formatPlaylist(updated, entriesCount),
    }
  }

  /**
   * Delete a playlist owned by user.
   */
  public static async deletePlaylist(userId: string, playlistId: string) {
    const existing = await prisma.orm.public.CustomList
      .where({ id: playlistId, userId })
      .first()

    if (!existing) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }

    await prisma.orm.public.CustomList.where({ id: playlistId }).delete()

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
    const playlist = await prisma.orm.public.CustomList
      .where({ id: playlistId })
      .include('entries', (e) => e.count())
      .first()

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

    let q = prisma.orm.public.CustomListEntry.where({ listId: playlistId })
    if (query?.mediaType) {
      q = q.where({ mediaType: query.mediaType.toUpperCase() as MediaType })
    }
    if (query?.q) {
      q = q.where((cle) => cle.customNotes.ilike(`%${query.q!.trim()}%`))
    }

    let itemsQ = q
    if (query?.sortBy === 'addedAt') {
      itemsQ = itemsQ.orderBy((cle) =>
        order === 'desc' ? cle.addedAt.desc() : cle.addedAt.asc()
      )
    } else {
      itemsQ = itemsQ.orderBy((cle) =>
        order === 'desc' ? cle.order.desc() : cle.order.asc()
      )
    }

    const [total, entries] = await Promise.all([
      countOf(q),
      itemsQ
        .offset(skip)
        .limit(limit)
        .include('anime', (a) =>
          a.select(
            'id',
            'titlePrimary',
            'titleSecondary',
            'coverImage',
            'bannerImage',
            'format',
            'status',
            'averageScore'
          )
        )
        .include('manga', (m) =>
          m.select(
            'id',
            'titlePrimary',
            'titleSecondary',
            'coverImage',
            'bannerImage',
            'format',
            'status',
            'averageScore'
          )
        )
        .include('movie', (m) =>
          m.select(
            'id',
            'titlePrimary',
            'titleSecondary',
            'coverImage',
            'bannerImage',
            'status',
            'averageScore'
          )
        )
        .include('tv', (t) =>
          t.select(
            'id',
            'titlePrimary',
            'titleSecondary',
            'coverImage',
            'bannerImage',
            'status',
            'averageScore'
          )
        )
        .include('game', (g) =>
          g.select(
            'id',
            'titlePrimary',
            'titleSecondary',
            'coverImage',
            'bannerImage',
            'status',
            'averageScore'
          )
        )
        .include('book', (b) =>
          b.select(
            'id',
            'titlePrimary',
            'titleSecondary',
            'coverImage',
            'bannerImage',
            'status',
            'averageScore'
          )
        )
        .include('music', (mu) =>
          mu.select(
            'id',
            'titlePrimary',
            'titleSecondary',
            'coverImage',
            'status',
            'artistName'
          )
        )
        .all(),
    ])

    const entriesCount =
      typeof playlist.entries === 'number' ? playlist.entries : 0

    return {
      success: true,
      playlist: {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description ?? null,
        isPrivate: playlist.isPrivate,
        coverImage: playlist.coverImage ?? null,
        entriesCount,
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
          entry: formatEntry(item, playlist.userId),
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
    const playlist = await prisma.orm.public.CustomList
      .where({ id: playlistId, userId })
      .first()

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
      const highest = await prisma.orm.public.CustomListEntry
        .where({ listId: playlistId })
        .orderBy((cle) => cle.order.desc())
        .select('order')
        .first()
      order = (highest?.order ?? 0) + 1
    }

    const isMusic = ['MUSIC', 'MUSIC_ALBUM', 'MUSIC_TRACK'].includes(mediaType)

    const existingEntry = await prisma.orm.public.CustomListEntry
      .where({ listId: playlistId, mediaType, mediaId })
      .first()

    let entry: any
    if (existingEntry) {
      entry = await prisma.orm.public.CustomListEntry
        .where({ id: existingEntry.id })
        .update({
          order,
          ...(body.customNotes !== undefined
            ? { customNotes: encryptNotes(body.customNotes, userId) }
            : {}),
        })
    } else {
      entry = await prisma.orm.public.CustomListEntry.create({
        listId: playlistId,
        mediaType,
        mediaId,
        order,
        customNotes: body.customNotes
          ? encryptNotes(body.customNotes, userId)
          : null,
        animeId: mediaType === 'ANIME' ? mediaId : null,
        mangaId: mediaType === 'MANGA' ? mediaId : null,
        movieId: mediaType === 'MOVIE' ? mediaId : null,
        tvId: mediaType === 'TV' ? mediaId : null,
        gameId: mediaType === 'GAME' ? mediaId : null,
        bookId: mediaType === 'BOOK' ? mediaId : null,
        musicId: isMusic ? mediaId : null,
      })
    }

    return {
      success: true,
      message: 'Entry added to playlist successfully',
      entry: formatEntry(entry, userId),
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
    const playlist = await prisma.orm.public.CustomList
      .where({ id: playlistId, userId })
      .first()

    if (!playlist) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }

    // Handle batch reorder
    if (body.reorder && Array.isArray(body.reorder)) {
      for (const item of body.reorder) {
        await prisma.orm.public.CustomListEntry
          .where({ id: item.id, listId: playlistId })
          .update({ order: Number(item.order) })
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
      entry = await prisma.orm.public.CustomListEntry
        .where({ id: body.id, listId: playlistId })
        .first()
    } else if (body.mediaType && body.mediaId) {
      entry = await prisma.orm.public.CustomListEntry
        .where({
          listId: playlistId,
          mediaType: body.mediaType.toUpperCase() as MediaType,
          mediaId: Number(body.mediaId),
        })
        .first()
    }

    if (!entry) {
      throw new NotFound('Playlist entry not found')
    }

    const updateData: any = {}
    if (body.order !== undefined) updateData.order = Number(body.order)
    if (body.customNotes !== undefined)
      updateData.customNotes = encryptNotes(body.customNotes, userId)

    const updated = await prisma.orm.public.CustomListEntry
      .where({ id: entry.id })
      .update(updateData)

    return {
      success: true,
      message: 'Playlist entry updated successfully',
      entry: formatEntry(updated, userId),
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
    const playlist = await prisma.orm.public.CustomList
      .where({ id: playlistId, userId })
      .first()

    if (!playlist) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }

    let entry: any = null
    if (target.id) {
      entry = await prisma.orm.public.CustomListEntry
        .where({ id: target.id, listId: playlistId })
        .first()
    } else if (target.mediaType && target.mediaId) {
      entry = await prisma.orm.public.CustomListEntry
        .where({
          listId: playlistId,
          mediaType: target.mediaType.toUpperCase() as MediaType,
          mediaId: Number(target.mediaId),
        })
        .first()
    }

    if (!entry) {
      throw new NotFound('Playlist entry not found')
    }

    await prisma.orm.public.CustomListEntry.where({ id: entry.id }).delete()

    return {
      success: true,
      message: 'Entry removed from playlist successfully',
    }
  }
}
