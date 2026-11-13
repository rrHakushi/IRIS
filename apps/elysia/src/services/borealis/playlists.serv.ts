import { prisma, countOf, toDate, or, type MediaType } from '@Iris/db'
import { NotFound, BadRequest, Forbidden } from '../../lib/errors'
import { getProfileCustomization } from '@IRIS/shared'
import { IRISBitField, IRISFlags } from '@IRIS/permissions'
import { ActivityServ } from '../carina/activity.serv'
import { CarinaUsersServ } from '../carina/users.serv'

export interface ListPlaylistsQuery {
  page?: number
  limit?: number
  q?: string
  isPrivate?: boolean
  mediaType?: string
  mediaId?: number
}

export interface GetEntriesQuery {
  page?: number
  limit?: number
  mediaType?: string
  q?: string
  sortBy?: string
  order?: 'asc' | 'desc'
}



function formatUser(user: { id: string; username: string; customization?: any } | null | undefined) {
  if (!user) return null
  const profile = getProfileCustomization(user.customization)
  const trimmed = typeof profile.displayName === 'string' ? profile.displayName.trim() : ''
  return {
    id: user.id,
    username: user.username,
    displayName: trimmed !== '' ? trimmed : null,
    avatarUrl: profile.avatarUrl ?? null,
  }
}

function formatPlaylist(p: any, entriesCount?: number, role?: string, isOwner?: boolean, owner?: any, covers?: string[]) {
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
    covers: covers ?? p.covers ?? [],
    order: p.order,
    entriesCount: count,
    role: role ?? 'OWNER',
    isOwner: isOwner !== undefined ? isOwner : true,
    owner: owner ?? null,
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
    customNotes: e.customNotes ?? null,
    addedAt: toDate(e.addedAt).toISOString(),
  }
}

export class BorealisPlaylistsServ {
  /**
   * Helper to check access levels (Owner, Editor, Viewer) for a custom playlist.
   */
  public static async getPlaylistAccess(playlistId: string, userId: string) {
    const playlist = await prisma.orm.public.CustomList
      .where({ id: playlistId })
      .include('user', (u) => u.select('id', 'username', 'customization'))
      .include('collaborators', (c) => c.select('id', 'userId', 'role'))
      .first()

    if (!playlist) {
      return { playlist: null, canView: false, canEdit: false, isOwner: false, role: null }
    }

    const isOwner = playlist.userId === userId
    const collab = (playlist.collaborators as any[])?.find((c: any) => c.userId === userId)
    const role: 'OWNER' | 'EDITOR' | 'VIEWER' | null = isOwner
      ? 'OWNER'
      : collab
      ? (collab.role as 'EDITOR' | 'VIEWER')
      : null

    const canEdit = isOwner || role === 'EDITOR'
    const canView = isOwner || !!role || !playlist.isPrivate

    return {
      playlist,
      canView,
      canEdit,
      isOwner,
      role,
    }
  }

  /**
   * List custom playlists belonging to the user or where user is a collaborator.
   */
  public static async listPlaylists(userId: string, query?: ListPlaylistsQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 20)))
    const skip = (page - 1) * limit

    // Find lists where user is a collaborator
    const collabRecords = await prisma.orm.public.CustomListCollaborator
      .where({ userId })
      .all()
    const collabListIds = collabRecords.map((c: any) => c.listId)
    const collabRoleMap = new Map<string, string>(
      collabRecords.map((c: any) => [c.listId, c.role])
    )

    let q = prisma.orm.public.CustomList
    if (collabListIds.length > 0) {
      q = q.where((cl) => or(cl.userId.eq(userId), cl.id.in(collabListIds)))
    } else {
      q = q.where({ userId })
    }

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
        .include('user', (u) => u.select('id', 'username', 'customization'))
        .include('entries', (e) => e.count())
        .all(),
    ])

    const playlistIds = playlists.map((p: any) => p.id)
    const coversMap = new Map<string, string[]>()

    if (playlistIds.length > 0) {
      try {
        const topEntries = await prisma.orm.public.CustomListEntry
          .where((cle) => cle.listId.in(playlistIds))
          .orderBy((cle) => cle.order.asc())
          .include('anime', (a) => a.select('coverImage'))
          .include('manga', (m) => m.select('coverImage'))
          .include('movie', (m) => m.select('coverImage'))
          .include('tv', (t) => t.select('coverImage'))
          .include('game', (g) => g.select('coverImage'))
          .include('book', (b) => b.select('coverImage'))
          .include('music', (mu) => mu.select('coverImage'))
          .all()

        for (const entry of topEntries) {
          const cover =
            (entry as any).anime?.coverImage ||
            (entry as any).manga?.coverImage ||
            (entry as any).movie?.coverImage ||
            (entry as any).tv?.coverImage ||
            (entry as any).game?.coverImage ||
            (entry as any).book?.coverImage ||
            (entry as any).music?.coverImage ||
            null

          if (cover) {
            const list = coversMap.get((entry as any).listId) || []
            if (list.length < 5) {
              list.push(cover)
              coversMap.set((entry as any).listId, list)
            }
          }
        }
      } catch (err) {
        console.error('[PlaylistsServ] Failed to fetch top entries for covers:', err)
      }
    }

    let containing = new Set<string>()
    if (query?.mediaType && query?.mediaId && playlists.length > 0) {
      const mType = String(query.mediaType).toUpperCase() as MediaType
      const mId = Number(query.mediaId)
      const entries = await prisma.orm.public.CustomListEntry
        .where({ mediaType: mType, mediaId: mId })
        .all()
      const ids = new Set(playlists.map((p: any) => p.id))
      containing = new Set(
        entries.map((e: any) => e.listId).filter((id: string) => ids.has(id))
      )
    }
    const checkMembership = Boolean(query?.mediaType && query?.mediaId)

    return {
      success: true,
      playlists: playlists.map((p: any) => {
        const isOwner = p.userId === userId
        const role = isOwner ? 'OWNER' : (collabRoleMap.get(p.id) || 'VIEWER')
        const owner = formatUser(p.user)

        return {
          ...formatPlaylist(p, undefined, role, isOwner, owner, coversMap.get(p.id) || []),
          ...(checkMembership ? { containsMedia: containing.has(p.id) } : {}),
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

    // Log activity respecting list privacy
    prisma.orm.public.ActivityLog.create({
      userId,
      type: 'CUSTOM_LIST_CREATED',
      title: name,
      isPrivate: Boolean(created.isPrivate),
      metadata: {
        customListId: created.id,
        listName: name,
        coverImage: created.coverImage ?? null,
        action: 'LIST_CREATED',
      },
    }).catch(() => {})

    CarinaUsersServ.evaluateBadgesNonBlocking(userId)

    return {
      success: true,
      message: 'Playlist created successfully',
      playlist: formatPlaylist(created, 0, 'OWNER', true),
    }
  }

  /**
   * Update details of an existing playlist (owner or editor).
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
    const access = await this.getPlaylistAccess(playlistId, userId)
    if (!access.playlist) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }
    if (!access.canEdit) {
      throw new Forbidden('You do not have permission to edit this playlist')
    }

    const updateData: any = {}
    if (body.name !== undefined) {
      const trimmed = body.name.trim()
      if (!trimmed) throw new BadRequest('Playlist name cannot be empty')
      updateData.name = trimmed
    }
    if (body.description !== undefined) updateData.description = body.description
    if (body.isPrivate !== undefined) {
      // Only owner can change privacy
      if (!access.isOwner) {
        throw new Forbidden('Only the list owner can change playlist privacy')
      }
      updateData.isPrivate = Boolean(body.isPrivate)
    }
    if (body.coverImage !== undefined) updateData.coverImage = body.coverImage
    if (body.order !== undefined) updateData.order = Number(body.order)

    const updated = await prisma.orm.public.CustomList
      .where({ id: playlistId })
      .update(updateData)

    // Keep existing playlist activity entries aligned if playlist privacy changes
    if (body.isPrivate !== undefined) {
      const nextPrivate = Boolean(body.isPrivate)
      const collabs = await prisma.orm.public.CustomListCollaborator
        .where({ listId: playlistId })
        .select('userId')
        .all()
      const memberIds = Array.from(
        new Set([access.playlist.userId, ...collabs.map((c: any) => c.userId)])
      )
      setImmediate(async () => {
        try {
          const logs = await prisma.orm.public.ActivityLog
            .where((a: any) => a.userId.in(memberIds))
            .select('id', 'metadata')
            .all()
          const matchingIds = logs
            .filter((l: any) => (l.metadata as any)?.customListId === playlistId)
            .map((l: any) => l.id)
          if (matchingIds.length > 0) {
            await prisma.orm.public.ActivityLog
              .where((a: any) => a.id.in(matchingIds))
              .update({ isPrivate: nextPrivate })
          }
        } catch {}
      })
    }

    const count = await prisma.orm.public.CustomListEntry
      .where({ listId: playlistId })
      .all()

    return {
      success: true,
      message: 'Playlist updated successfully',
      playlist: formatPlaylist(updated, count.length, access.role || 'EDITOR', access.isOwner),
    }
  }

  /**
   * Delete a playlist (strictly owner only).
   */
  public static async deletePlaylist(userId: string, playlistId: string) {
    const existing = await prisma.orm.public.CustomList
      .where({ id: playlistId })
      .first()

    if (!existing) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }

    if (existing.userId !== userId) {
      throw new Forbidden('Only the list owner can delete this playlist')
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
    const access = await this.getPlaylistAccess(playlistId, userId)
    if (!access.playlist) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }
    if (!access.canView) {
      throw new Forbidden('Access to this playlist is denied')
    }

    const playlist = access.playlist

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

    return {
      success: true,
      playlist: {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description ?? null,
        isPrivate: playlist.isPrivate,
        coverImage: playlist.coverImage ?? null,
        entriesCount: total,
        role: access.role || 'VIEWER',
        isOwner: access.isOwner,
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
   * Add a media entry to the playlist (owner or editor).
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
    const access = await this.getPlaylistAccess(playlistId, userId)
    if (!access.playlist) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }
    if (!access.canEdit) {
      throw new Forbidden('You do not have permission to add entries to this playlist')
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
            ? { customNotes: body.customNotes }
            : {}),
        })
    } else {
      entry = await prisma.orm.public.CustomListEntry.create({
        listId: playlistId,
        mediaType,
        mediaId,
        order,
        customNotes: body.customNotes
          ? body.customNotes
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

    // Record activity (non-blocking media summary lookup + list privacy propagation)
    const playlistIsPrivate = Boolean(access.playlist.isPrivate)
    const listName = access.playlist.name
    setImmediate(async () => {
      try {
        const mediaSummary = await ActivityServ.resolveEntitySummary(mediaType, mediaId)
        await prisma.orm.public.ActivityLog.create({
          userId,
          type: 'LIST_ITEM_ADDED',
          mediaType,
          mediaId,
          title: mediaSummary.title || `${mediaType} #${mediaId}`,
          isPrivate: playlistIsPrivate,
          metadata: {
            customListId: playlistId,
            listName,
            coverImage: mediaSummary.coverImage,
            itemTitle: mediaSummary.title,
            action: 'ENTRY_ADDED',
          },
        })
      } catch {}
    })

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
    const access = await this.getPlaylistAccess(playlistId, userId)
    if (!access.playlist) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }
    if (!access.canEdit) {
      throw new Forbidden('You do not have permission to modify entries in this playlist')
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
      updateData.customNotes = body.customNotes

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
    const access = await this.getPlaylistAccess(playlistId, userId)
    if (!access.playlist) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }
    if (!access.canEdit) {
      throw new Forbidden('You do not have permission to remove entries from this playlist')
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

    // Record activity with media title/cover and list privacy
    const playlistIsPrivate = Boolean(access.playlist.isPrivate)
    const listName = access.playlist.name
    setImmediate(async () => {
      try {
        const mediaSummary = await ActivityServ.resolveEntitySummary(
          entry.mediaType,
          entry.mediaId
        )
        await prisma.orm.public.ActivityLog.create({
          userId,
          type: 'LIST_ITEM_REMOVED',
          mediaType: entry.mediaType,
          mediaId: entry.mediaId,
          title: mediaSummary.title || `${entry.mediaType} #${entry.mediaId}`,
          isPrivate: playlistIsPrivate,
          metadata: {
            customListId: playlistId,
            listName,
            coverImage: mediaSummary.coverImage,
            itemTitle: mediaSummary.title,
            action: 'ENTRY_REMOVED',
          },
        })
      } catch {}
    })

    return {
      success: true,
      message: 'Entry removed from playlist successfully',
    }
  }

  /**
   * Reorder entries in bulk by passing ordered array of entry IDs.
   */
  public static async reorderEntries(userId: string, playlistId: string, entryIds: string[]) {
    const access = await this.getPlaylistAccess(playlistId, userId)
    if (!access.playlist) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }
    if (!access.canEdit) {
      throw new Forbidden('You do not have permission to reorder this playlist')
    }

    for (let i = 0; i < entryIds.length; i++) {
      await prisma.orm.public.CustomListEntry
        .where({ id: entryIds[i], listId: playlistId })
        .update({ order: i })
    }

    return {
      success: true,
      message: 'Playlist entries reordered successfully',
    }
  }

  /**
   * List collaborators of a playlist.
   */
  public static async listCollaborators(userId: string, playlistId: string) {
    const access = await this.getPlaylistAccess(playlistId, userId)
    if (!access.playlist) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }
    if (!access.canView) {
      throw new Forbidden('Access denied')
    }

    const collabs = await prisma.orm.public.CustomListCollaborator
      .where({ listId: playlistId })
      .include('user', (u) => u.select('id', 'username', 'customization'))
      .all()

    return {
      success: true,
      collaborators: collabs.map((c: any) => ({
        id: c.id,
        userId: c.userId,
        role: c.role,
        createdAt: toDate(c.createdAt).toISOString(),
        user: formatUser(c.user) || {
          id: c.userId,
          username: 'Unknown',
          displayName: null,
          avatarUrl: null,
        },
      })),
    }
  }

  /**
   * Add a collaborator by username (Owner only).
   */
  public static async addCollaborator(
    userId: string,
    playlistId: string,
    body: { username: string; role?: 'EDITOR' | 'VIEWER' }
  ) {
    const access = await this.getPlaylistAccess(playlistId, userId)
    if (!access.playlist) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }
    if (!access.isOwner) {
      throw new Forbidden('Only the list owner can add collaborators')
    }

    const username = body.username.trim()
    const target = await prisma.orm.public.User
      .where((u) => u.username.ilike(username))
      .select('id', 'username', 'customization')
      .first()

    if (!target) {
      throw new NotFound(`User @${username} not found`)
    }

    if (target.id === userId) {
      throw new BadRequest('You cannot add yourself as a collaborator')
    }

    const existing = await prisma.orm.public.CustomListCollaborator
      .where({ listId: playlistId, userId: target.id })
      .first()

    if (existing) {
      throw new BadRequest(`@${target.username} is already a collaborator on this list`)
    }

    const role = body.role || 'EDITOR'
    const collab = await prisma.orm.public.CustomListCollaborator.create({
      listId: playlistId,
      userId: target.id,
      role,
    })

    prisma.orm.public.ActivityLog.create({
      userId,
      type: 'CUSTOM_LIST_CREATED',
      title: access.playlist.name,
      isPrivate: Boolean(access.playlist.isPrivate),
      metadata: {
        customListId: playlistId,
        listName: access.playlist.name,
        coverImage: access.playlist.coverImage ?? null,
        action: 'COLLABORATOR_ADDED',
        targetUsername: target.username,
        role,
      },
    }).catch(() => {})

    return {
      success: true,
      message: `Added @${target.username} as collaborator`,
      collaborator: {
        id: collab.id,
        userId: collab.userId,
        role: collab.role,
        createdAt: toDate(collab.createdAt).toISOString(),
        user: formatUser(target)!,
      },
    }
  }

  /**
   * Update a collaborator's role (Owner only).
   */
  public static async updateCollaborator(
    userId: string,
    playlistId: string,
    collaboratorId: string,
    role: 'EDITOR' | 'VIEWER'
  ) {
    const access = await this.getPlaylistAccess(playlistId, userId)
    if (!access.playlist) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }
    if (!access.isOwner) {
      throw new Forbidden('Only the list owner can update collaborator roles')
    }

    const collab = await prisma.orm.public.CustomListCollaborator
      .where({ id: collaboratorId, listId: playlistId })
      .first()

    if (!collab) {
      throw new NotFound('Collaborator not found')
    }

    const updated = await prisma.orm.public.CustomListCollaborator
      .where({ id: collaboratorId })
      .update({ role })

    if (!updated) {
      throw new NotFound('Failed to update collaborator')
    }

    return {
      success: true,
      message: 'Collaborator role updated successfully',
      collaborator: {
        id: updated.id,
        userId: updated.userId,
        role: updated.role,
        createdAt: toDate(updated.createdAt).toISOString(),
      },
    }
  }

  /**
   * Remove a collaborator (Owner or the collaborator leaving).
   */
  public static async removeCollaborator(
    userId: string,
    playlistId: string,
    collaboratorId: string
  ) {
    const access = await this.getPlaylistAccess(playlistId, userId)
    if (!access.playlist) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }

    const collab = await prisma.orm.public.CustomListCollaborator
      .where({ id: collaboratorId, listId: playlistId })
      .first()

    if (!collab) {
      throw new NotFound('Collaborator not found')
    }

    if (!access.isOwner && collab.userId !== userId) {
      throw new Forbidden('You do not have permission to remove this collaborator')
    }

    await prisma.orm.public.CustomListCollaborator
      .where({ id: collaboratorId })
      .delete()

    return {
      success: true,
      message: 'Collaborator removed successfully',
    }
  }

  /**
   * List comments on a custom playlist.
   */
  public static async listComments(
    userId: string,
    playlistId: string,
    query?: { page?: number; limit?: number }
  ) {
    const access = await this.getPlaylistAccess(playlistId, userId)
    if (!access.playlist) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }
    if (!access.canView) {
      throw new Forbidden('Access denied')
    }

    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(50, Number(query?.limit ?? 20)))
    const skip = (page - 1) * limit

    const commentQ = prisma.orm.public.ListComment.where({ customListId: playlistId })

    const [total, rawComments] = await Promise.all([
      countOf(commentQ),
      commentQ
        .orderBy((c) => c.createdAt.desc())
        .offset(skip)
        .limit(limit)
        .include('author', (u) => u.select('id', 'username', 'customization'))
        .include('reply', (r) =>
          r.include('author', (u) => u.select('id', 'username', 'customization'))
        )
        .all(),
    ])

    const comments = rawComments.map((c: any) => ({
      id: c.id,
      listOwnerId: c.listOwnerId,
      customListId: c.customListId,
      authorId: c.authorId,
      content: c.content,
      isSpoiler: c.isSpoiler,
      createdAt: toDate(c.createdAt).toISOString(),
      updatedAt: toDate(c.updatedAt).toISOString(),
      author: formatUser(c.author),
      reply: c.reply
        ? {
            id: c.reply.id,
            commentId: c.reply.commentId,
            authorId: c.reply.authorId,
            content: c.reply.content,
            createdAt: toDate(c.reply.createdAt).toISOString(),
            updatedAt: toDate(c.reply.updatedAt).toISOString(),
            author: formatUser(c.reply.author),
          }
        : null,
    }))

    return {
      success: true,
      comments,
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
   * Post a comment on a custom playlist.
   */
  public static async createComment(
    userId: string,
    playlistId: string,
    body: { content: string; isSpoiler?: boolean }
  ) {
    const access = await this.getPlaylistAccess(playlistId, userId)
    if (!access.playlist) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }
    if (!access.canView) {
      throw new Forbidden('Access denied')
    }

    const trimmed = body.content.trim()
    if (!trimmed) {
      throw new BadRequest('Comment content cannot be empty')
    }

    const created = await prisma.orm.public.ListComment.create({
      listOwnerId: access.playlist.userId,
      customListId: playlistId,
      mediaType: 'custom',
      authorId: userId,
      content: trimmed,
      isSpoiler: Boolean(body.isSpoiler),
    })

    const comment = await prisma.orm.public.ListComment
      .where({ id: created.id })
      .include('author', (u) => u.select('id', 'username', 'customization'))
      .first()

    return {
      success: true,
      comment: {
        id: comment!.id,
        listOwnerId: comment!.listOwnerId,
        customListId: comment!.customListId,
        authorId: comment!.authorId,
        content: comment!.content,
        isSpoiler: comment!.isSpoiler,
        createdAt: toDate(comment!.createdAt).toISOString(),
        updatedAt: toDate(comment!.updatedAt).toISOString(),
        author: formatUser((comment as any).author),
        reply: null,
      },
    }
  }

  /**
   * Delete a comment on a custom playlist.
   */
  public static async deleteComment(
    user: { id: string; permissions: number[] },
    playlistId: string,
    commentId: string
  ) {
    const access = await this.getPlaylistAccess(playlistId, user.id)
    if (!access.playlist) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }

    const comment = await prisma.orm.public.ListComment
      .where({ id: commentId, customListId: playlistId })
      .first()

    if (!comment) {
      throw new NotFound('Comment not found')
    }

    const isAuthor = comment.authorId === user.id
    const isOwner = access.isOwner
    const isAdmin = new IRISBitField(user.permissions).has(IRISFlags.ADMINISTRATOR)

    if (!isAuthor && !isOwner && !isAdmin) {
      throw new Forbidden('You do not have permission to delete this comment')
    }

    await prisma.orm.public.ListComment.where({ id: comment.id }).delete()

    return {
      success: true,
      message: 'Comment deleted successfully',
    }
  }

  /**
   * Get chronological activity log for a custom playlist.
   */
  public static async listActivity(
    userId: string,
    playlistId: string,
    query?: { page?: number; limit?: number },
    permissions: number[] = []
  ) {
    const access = await this.getPlaylistAccess(playlistId, userId)
    if (!access.playlist) {
      throw new NotFound(`Playlist with ID ${playlistId} not found`)
    }
    if (!access.canView) {
      throw new Forbidden('Access denied')
    }

    const page = Math.max(1, query?.page ?? 1)
    const limit = Math.max(1, Math.min(50, query?.limit ?? 15))
    const skip = (page - 1) * limit

    const collaboratorIds = ((access.playlist.collaborators as any[]) || []).map((c: any) => c.userId)
    const memberIds = Array.from(new Set([access.playlist.userId, ...collaboratorIds]))

    const rawMemberLogs = await prisma.orm.public.ActivityLog
      .where((a) => a.userId.in(memberIds))
      .orderBy((a) => a.createdAt.desc())
      .include('user')
      .all()

    const matchingLogs = rawMemberLogs.filter(
      (l: any) => l.metadata && (l.metadata as any).customListId === playlistId
    )

    const isAdmin = new IRISBitField(permissions).has(IRISFlags.ADMINISTRATOR)
    const total = matchingLogs.length
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const hasMore = page < totalPages
    const pageSlice = matchingLogs.slice(skip, skip + limit)

    let listLogs = await ActivityServ.formatActivityEntries(pageSlice, {
      viewerUserId: userId,
      isAdmin,
    })

    // If no explicit logs exist and viewer is on page 1, surface playlist creation event
    if (total === 0 && page === 1) {
      listLogs = await ActivityServ.formatActivityEntries(
        [
          {
            id: `created-${access.playlist.id}`,
            userId: access.playlist.userId,
            type: 'CUSTOM_LIST_CREATED',
            mediaType: null,
            mediaId: null,
            status: null,
            progress: null,
            progressVolumes: null,
            score: null,
            title: access.playlist.name,
            content: `Created playlist "${access.playlist.name}"`,
            metadata: {
              customListId: access.playlist.id,
              listName: access.playlist.name,
              coverImage: access.playlist.coverImage ?? null,
              action: 'LIST_CREATED',
            },
            isPrivate: Boolean(access.playlist.isPrivate),
            isSpoiler: false,
            likeCount: 0,
            replyCount: 0,
            createdAt: access.playlist.createdAt,
            user: access.playlist.user,
          },
        ],
        { viewerUserId: null, isOwner: false, isAdmin: false }
      )
    }

    return {
      success: true,
      activity: listLogs,
      pagination: {
        page,
        limit,
        total: total === 0 ? 1 : total,
        totalPages,
        hasMore,
      },
    }
  }
}
