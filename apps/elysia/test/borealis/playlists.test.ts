import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia, ValidationError } from 'elysia'
import { borealisPlaylists } from '../../src/api/controllers/borealis/playlists.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { prisma } from '@IRIS/database'

// -----------------------------------------------------------------------------
// In-Memory Database Mock for Playlists and Entries
// -----------------------------------------------------------------------------

interface MockUser {
  id: string
  username: string
  email: string
  permissions: number[]
  customization: any
  passwordChangedAt: Date | null
}

interface MockCustomList {
  id: string
  userId: string
  name: string
  description: string | null
  isDefault: boolean
  isPrivate: boolean
  coverImage: string | null
  order: number
  createdAt: Date
  updatedAt: Date
}

interface MockCustomListEntry {
  id: string
  listId: string
  mediaType: string
  mediaId: number
  order: number
  customNotes: string | null
  addedAt: Date
  animeId?: number | null
  mangaId?: number | null
  movieId?: number | null
  tvId?: number | null
  gameId?: number | null
  bookId?: number | null
  musicId?: number | null
}

let mockUsers: MockUser[] = []
let mockPlaylists: MockCustomList[] = []
let mockEntries: MockCustomListEntry[] = []
let nextPlaylistId = 1
let nextEntryId = 1

function setupPrismaMock() {
  nextPlaylistId = 1
  nextEntryId = 1
  mockPlaylists = []
  mockEntries = []

  mockUsers = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'alice',
      email: 'alice@example.com',
      permissions: [],
      customization: {},
      passwordChangedAt: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      username: 'bob',
      email: 'bob@example.com',
      permissions: [],
      customization: {},
      passwordChangedAt: null,
    },
  ]

    // Mock User
    ; (prisma.user.findUnique as any) = async ({ where }: any) => {
      return mockUsers.find((u) => u.id === where.id) ?? null
    }

    // Mock CustomList
    ; (prisma.customList.count as any) = async ({ where }: any) => {
      return mockPlaylists.filter((p) => {
        if (where.userId && p.userId !== where.userId) return false
        if (where.name?.contains && !p.name.toLowerCase().includes(where.name.contains.toLowerCase())) return false
        if (where.isPrivate !== undefined && p.isPrivate !== where.isPrivate) return false
        return true
      }).length
    }

    ; (prisma.customList.findMany as any) = async ({ where, skip = 0, take = 20 }: any) => {
      let filtered = mockPlaylists.filter((p) => {
        if (where.userId && p.userId !== where.userId) return false
        if (where.name?.contains && !p.name.toLowerCase().includes(where.name.contains.toLowerCase())) return false
        if (where.isPrivate !== undefined && p.isPrivate !== where.isPrivate) return false
        return true
      })
      return filtered.slice(skip, skip + take).map((p) => ({
        ...p,
        _count: {
          entries: mockEntries.filter((e) => e.listId === p.id).length,
        },
      }))
    }

    ; (prisma.customList.findUnique as any) = async ({ where }: any) => {
      const p = mockPlaylists.find((item) => item.id === where.id)
      if (!p) return null
      return {
        ...p,
        _count: {
          entries: mockEntries.filter((e) => e.listId === p.id).length,
        },
      }
    }

    ; (prisma.customList.findFirst as any) = async ({ where }: any) => {
      const p = mockPlaylists.find((item) => {
        if (where.id && item.id !== where.id) return false
        if (where.userId && item.userId !== where.userId) return false
        return true
      })
      if (!p) return null
      return {
        ...p,
        _count: {
          entries: mockEntries.filter((e) => e.listId === p.id).length,
        },
      }
    }

    ; (prisma.customList.create as any) = async ({ data }: any) => {
      const now = new Date()
      const p: MockCustomList = {
        id: `playlist-${nextPlaylistId++}`,
        userId: data.userId,
        name: data.name,
        description: data.description ?? null,
        isDefault: data.isDefault ?? false,
        isPrivate: data.isPrivate ?? false,
        coverImage: data.coverImage ?? null,
        order: data.order ?? 0,
        createdAt: now,
        updatedAt: now,
      }
      mockPlaylists.push(p)
      return p
    }

    ; (prisma.customList.update as any) = async ({ where, data }: any) => {
      const idx = mockPlaylists.findIndex((p) => p.id === where.id)
      if (idx === -1) throw new Error('Playlist not found')
      const current = mockPlaylists[idx]!
      const updated = {
        ...current,
        ...data,
        updatedAt: new Date(),
      }
      mockPlaylists[idx] = updated
      return updated
    }

    ; (prisma.customList.delete as any) = async ({ where }: any) => {
      const idx = mockPlaylists.findIndex((p) => p.id === where.id)
      if (idx === -1) throw new Error('Playlist not found')
      const [deleted] = mockPlaylists.splice(idx, 1)
      mockEntries = mockEntries.filter((e) => e.listId !== deleted!.id)
      return deleted
    }

    // Mock CustomListEntry
    ; (prisma.customListEntry.count as any) = async ({ where }: any) => {
      return mockEntries.filter((e) => {
        if (where.listId && e.listId !== where.listId) return false
        if (where.mediaType && e.mediaType !== where.mediaType) return false
        return true
      }).length
    }

    ; (prisma.customListEntry.findMany as any) = async ({ where, skip = 0, take = 40, orderBy }: any) => {
      let filtered = mockEntries.filter((e) => {
        if (where.listId && e.listId !== where.listId) return false
        if (where.mediaType && e.mediaType !== where.mediaType) return false
        return true
      })
      filtered.sort((a, b) => a.order - b.order)
      return filtered.slice(skip, skip + take).map((e) => ({
        ...e,
        anime: e.mediaType === 'ANIME' ? { id: e.mediaId, titlePrimary: 'Test Anime', coverImage: 'https://example.com/cover.jpg' } : null,
        manga: null,
        movie: null,
        tv: null,
        game: null,
        book: null,
        music: null,
      }))
    }

    ; (prisma.customListEntry.findFirst as any) = async ({ where, orderBy }: any) => {
      if (where.listId && orderBy?.order === 'desc') {
        const items = mockEntries.filter((e) => e.listId === where.listId).sort((a, b) => b.order - a.order)
        return items[0] ?? null
      }
      return mockEntries.find((e) => {
        if (where.id && e.id !== where.id) return false
        if (where.listId && e.listId !== where.listId) return false
        return true
      }) ?? null
    }

    ; (prisma.customListEntry.findUnique as any) = async ({ where }: any) => {
      if (where.listId_mediaType_mediaId) {
        const { listId, mediaType, mediaId } = where.listId_mediaType_mediaId
        return mockEntries.find((e) => e.listId === listId && e.mediaType === mediaType && e.mediaId === mediaId) ?? null
      }
      return null
    }

    ; (prisma.customListEntry.upsert as any) = async ({ where, create, update }: any) => {
      const { listId, mediaType, mediaId } = where.listId_mediaType_mediaId
      const idx = mockEntries.findIndex((e) => e.listId === listId && e.mediaType === mediaType && e.mediaId === mediaId)

      if (idx !== -1) {
        const current = mockEntries[idx]!
        const updated = {
          ...current,
          ...update,
        }
        mockEntries[idx] = updated
        return updated
      } else {
        const entry: MockCustomListEntry = {
          id: `entry-${nextEntryId++}`,
          listId,
          mediaType,
          mediaId,
          order: create.order ?? 1,
          customNotes: create.customNotes ?? null,
          addedAt: new Date(),
          animeId: create.animeId,
          mangaId: create.mangaId,
          movieId: create.movieId,
          tvId: create.tvId,
          gameId: create.gameId,
          bookId: create.bookId,
          musicId: create.musicId,
        }
        mockEntries.push(entry)
        return entry
      }
    }

    ; (prisma.customListEntry.update as any) = async ({ where, data }: any) => {
      const idx = mockEntries.findIndex((e) => e.id === where.id)
      if (idx === -1) throw new Error('Entry not found')
      const current = mockEntries[idx]!
      const updated = {
        ...current,
        ...data,
      }
      mockEntries[idx] = updated
      return updated
    }

    ; (prisma.customListEntry.updateMany as any) = async ({ where, data }: any) => {
      let count = 0
      for (let i = 0; i < mockEntries.length; i++) {
        if (mockEntries[i]!.id === where.id && mockEntries[i]!.listId === where.listId) {
          mockEntries[i] = {
            ...mockEntries[i]!,
            ...data,
          }
          count++
        }
      }
      return { count }
    }

    ; (prisma.customListEntry.delete as any) = async ({ where }: any) => {
      const idx = mockEntries.findIndex((e) => e.id === where.id)
      if (idx === -1) throw new Error('Entry not found')
      const [deleted] = mockEntries.splice(idx, 1)
      return deleted
    }
}

// -----------------------------------------------------------------------------
// Test App Initialization
// -----------------------------------------------------------------------------

const app = new Elysia()
  .error(({ error, set }) => {
    if (isHttpError(error)) {
      set.status = error.status
      return error.toResponse()
    }
    if (error instanceof ValidationError) {
      set.status = 422
      return {
        type: 'validation',
        title: 'Unprocessable Content',
        status: 422,
        code: 'validation',
        detail: error.message,
      }
    }
  })
  .use(borealisPlaylists)

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------

describe('Comprehensive Borealis Playlists Test Suite', () => {
  let aliceToken: string
  let bobToken: string
  const ALICE_ID = '00000000-0000-0000-0000-000000000001'
  const BOB_ID = '00000000-0000-0000-0000-000000000002'

  beforeEach(async () => {
    setupPrismaMock()

    aliceToken = await signUserJwt({
      id: ALICE_ID,
      username: 'alice',
      email: 'alice@example.com',
    })

    bobToken = await signUserJwt({
      id: BOB_ID,
      username: 'bob',
      email: 'bob@example.com',
    })
  })

  describe('GET & POST /borealis/playlists', () => {
    it('GET /borealis/playlists fails (401) when unauthenticated', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/playlists'))
      expect(res.status).toBe(401)
    })

    it('GET /borealis/playlists returns empty list initially', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/playlists', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.playlists).toEqual([])
      expect(data.pagination.total).toBe(0)
    })

    it('POST /borealis/playlists fails (422) when name is empty', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/playlists', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ name: '' }),
        })
      )
      expect(res.status).toBe(422)
    })

    it('POST /borealis/playlists successfully creates a new custom playlist', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/playlists', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Favorite Anime & Movies',
            description: 'My curated collection of masterpieces',
            isPrivate: true,
            coverImage: 'https://example.com/cover.jpg',
          }),
        })
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.playlist.name).toBe('Favorite Anime & Movies')
      expect(data.playlist.isPrivate).toBe(true)
      expect(data.playlist.entriesCount).toBe(0)
    })
  })

  describe('PATCH & DELETE /borealis/playlists/:playlistId', () => {
    it('PATCH /borealis/playlists/:playlistId updates details', async () => {
      // Create playlist
      const createRes = await app.handle(
        new Request('http://localhost/borealis/playlists', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ name: 'Summer Vibes' }),
        })
      )
      const { playlist } = (await createRes.json()) as any

      // Update playlist
      const updateRes = await app.handle(
        new Request(`http://localhost/borealis/playlists/${playlist.id}`, {
          method: 'PATCH',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Summer Chill',
            description: 'Relaxing playlist',
            isPrivate: false,
          }),
        })
      )
      expect(updateRes.status).toBe(200)
      const updateData = (await updateRes.json()) as any
      expect(updateData.playlist.name).toBe('Summer Chill')
      expect(updateData.playlist.description).toBe('Relaxing playlist')
      expect(updateData.playlist.isPrivate).toBe(false)
    })

    it('PATCH /borealis/playlists/:playlistId fails (404) when playlist belongs to another user', async () => {
      const createRes = await app.handle(
        new Request('http://localhost/borealis/playlists', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ name: 'Alice Private List' }),
        })
      )
      const { playlist } = (await createRes.json()) as any

      const updateRes = await app.handle(
        new Request(`http://localhost/borealis/playlists/${playlist.id}`, {
          method: 'PATCH',
          headers: {
            authorization: `Bearer ${bobToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ name: 'Bob Hijack' }),
        })
      )
      expect(updateRes.status).toBe(404)
    })

    it('DELETE /borealis/playlists/:playlistId deletes playlist', async () => {
      const createRes = await app.handle(
        new Request('http://localhost/borealis/playlists', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ name: 'Temporary Playlist' }),
        })
      )
      const { playlist } = (await createRes.json()) as any

      const delRes = await app.handle(
        new Request(`http://localhost/borealis/playlists/${playlist.id}`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(delRes.status).toBe(200)

      // Verify it no longer exists
      const getRes = await app.handle(
        new Request(`http://localhost/borealis/playlists/${playlist.id}`, {
          method: 'PATCH',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ name: 'Should Fail' }),
        })
      )
      expect(getRes.status).toBe(404)
    })
  })

  describe('Playlist Entries (/:playlistId/entries)', () => {
    it('POST, GET, PATCH, and DELETE /borealis/playlists/:playlistId/entries', async () => {
      // 1. Create playlist
      const createRes = await app.handle(
        new Request('http://localhost/borealis/playlists', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ name: 'Anime Queue' }),
        })
      )
      const { playlist } = (await createRes.json()) as any

      // 2. Add entry (ANIME 1)
      const addRes = await app.handle(
        new Request(`http://localhost/borealis/playlists/${playlist.id}/entries`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            mediaType: 'ANIME',
            mediaId: 1,
            customNotes: 'Must watch soon',
            order: 1,
          }),
        })
      )
      expect(addRes.status).toBe(200)
      const addData = (await addRes.json()) as any
      expect(addData.success).toBe(true)
      expect(addData.entry.mediaId).toBe(1)
      expect(addData.entry.customNotes).toBe('Must watch soon')

      // Add second entry (ANIME 2)
      await app.handle(
        new Request(`http://localhost/borealis/playlists/${playlist.id}/entries`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            mediaType: 'ANIME',
            mediaId: 2,
            order: 2,
          }),
        })
      )

      // 3. GET entries
      const entriesRes = await app.handle(
        new Request(`http://localhost/borealis/playlists/${playlist.id}/entries`, {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(entriesRes.status).toBe(200)
      const entriesData = (await entriesRes.json()) as any
      expect(entriesData.items.length).toBe(2)
      expect(entriesData.playlist.name).toBe('Anime Queue')
      expect(entriesData.items[0].entry.mediaId).toBe(1)
      expect(entriesData.items[0].media.titlePrimary).toBe('Test Anime')

      // 4. PATCH entry (update custom notes)
      const patchRes = await app.handle(
        new Request(`http://localhost/borealis/playlists/${playlist.id}/entries`, {
          method: 'PATCH',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            mediaType: 'ANIME',
            mediaId: 1,
            customNotes: 'Started watching!',
            order: 10,
          }),
        })
      )
      expect(patchRes.status).toBe(200)

      // 5. PATCH batch reorder
      const reorderRes = await app.handle(
        new Request(`http://localhost/borealis/playlists/${playlist.id}/entries`, {
          method: 'PATCH',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            reorder: [
              { id: addData.entry.id, order: 2 },
            ],
          }),
        })
      )
      expect(reorderRes.status).toBe(200)

      // 6. DELETE entry
      const delEntryRes = await app.handle(
        new Request(`http://localhost/borealis/playlists/${playlist.id}/entries`, {
          method: 'DELETE',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            id: addData.entry.id,
          }),
        })
      )
      expect(delEntryRes.status).toBe(200)

      // Verify entry was removed
      const finalEntriesRes = await app.handle(
        new Request(`http://localhost/borealis/playlists/${playlist.id}/entries`, {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      const finalEntriesData = (await finalEntriesRes.json()) as any
      expect(finalEntriesData.items.length).toBe(1)
      expect(finalEntriesData.items[0].entry.mediaId).toBe(2)
    })
  })
})
