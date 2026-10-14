import { describe, expect, it, beforeEach, mock } from 'bun:test'
import { prisma } from '@IRIS/database'
import { anilistProvider, deezerProvider } from '../../src/services/borealis/providers'
import { MediaEntitySyncer } from '../../src/services/borealis/syncer/media-entity.syncer'
import { MediaQueueManager } from '../../src/services/borealis/queue'
import { executeMediaUpdate } from '../../src/workers/media.wrk'

describe('Borealis: Media Relations Cascade & Deezer Queueing', () => {
  let createdAnimeStubs: any[] = []
  let createdMangaStubs: any[] = []
  let createdMusicStubs: any[] = []
  let upsertedRelations: any[] = []
  let updatedAnime: any[] = []
  let enqueuedJobs: any[] = []

  beforeEach(() => {
    createdAnimeStubs = []
    createdMangaStubs = []
    createdMusicStubs = []
    upsertedRelations = []
    updatedAnime = []
    enqueuedJobs = []

    // Mock Prisma Anime
    ;(prisma.anime.findUnique as any) = async ({ where }: any) => {
      if (where.id === 603 || where.anilistId === 206949) {
        return { id: 603, anilistId: 206949, titlePrimary: 'Nia Liston' }
      }
      return createdAnimeStubs.find((a) => a.anilistId === where.anilistId) || null
    }

    ;(prisma.anime.create as any) = async ({ data }: any) => {
      const created = { id: 700 + createdAnimeStubs.length, ...data }
      createdAnimeStubs.push(created)
      return created
    }

    ;(prisma.anime.update as any) = async ({ where, data }: any) => {
      updatedAnime.push({ id: where.id, ...data })
      return { id: where.id, ...data }
    }

    // Mock Prisma Manga
    ;(prisma.manga.findUnique as any) = async ({ where }: any) => {
      return createdMangaStubs.find((m) => m.anilistId === where.anilistId) || null
    }

    ;(prisma.manga.create as any) = async ({ data }: any) => {
      const created = { id: 800 + createdMangaStubs.length, ...data }
      createdMangaStubs.push(created)
      return created
    }

    ;(prisma.manga.update as any) = async ({ where, data }: any) => {
      return { id: where.id, ...data }
    }

    // Mock Prisma Music
    ;(prisma.music.findFirst as any) = async () => null
    ;(prisma.music.findUnique as any) = async () => null
    ;(prisma.music.create as any) = async ({ data }: any) => {
      const created = { id: 900 + createdMusicStubs.length, ...data }
      createdMusicStubs.push(created)
      return created
    }
    ;(prisma.music.upsert as any) = async ({ create, update, where }: any) => {
      const created = { id: 900 + createdMusicStubs.length, ...create }
      createdMusicStubs.push(created)
      return created
    }

    // Mock Prisma MediaRelation
    ;(prisma.mediaRelation.upsert as any) = async ({ create, where }: any) => {
      upsertedRelations.push(create)
      return { id: upsertedRelations.length, ...create }
    }

    // Mock MediaQueueManager.getQueue
    ;(MediaQueueManager.getQueue as any) = () => ({
      add: async (name: string, data: any, opts: any) => {
        const job = { id: opts?.jobId || `job-${Date.now()}`, name, data, opts }
        enqueuedJobs.push(job)
        return job
      },
    })
  })

  it('AniList provider paces requests at 2000ms for degraded rate limit', () => {
    expect((anilistProvider as any).minDelayMs).toBe(2000)
    expect((anilistProvider as any).rateLimitRemaining).toBeLessThanOrEqual(30)
    expect((anilistProvider as any).rateLimitRemaining).toBeGreaterThanOrEqual(0)
  })

  it('discovers manga adaptation relation, creates stub, and saves MediaRelation edge', async () => {
    // Mock AniList fetchAnime payload with adaptation manga relation
    anilistProvider.fetchAnime = async () =>
      ({
        id: 206949,
        title: { userPreferred: 'Kyouran Reijou Nia Liston', english: 'Nia Liston: The Merciless Maiden' },
        relations: {
          edges: [
            {
              relationType: 'ADAPTATION',
              node: {
                id: 151608,
                type: 'MANGA',
                format: 'MANGA',
                title: { userPreferred: 'Kyouran Reijou Nia Liston Manga' },
                coverImage: { large: 'https://example.com/nia-manga.jpg' },
              },
            },
          ],
        },
      } as any)

    const result = await MediaEntitySyncer.syncAnime(603, 206949)

    expect(result.synced).toBe(true)
    expect(result.discoveredRelations.length).toBe(1)
    expect(result.discoveredRelations[0]!.targetType).toBe('MANGA')
    expect(result.discoveredRelations[0]!.targetExternalId).toBe(151608)
    expect(result.discoveredRelations[0]!.type).toBe('ADAPTATION')

    // Verified Manga stub created
    expect(createdMangaStubs.length).toBe(1)
    expect(createdMangaStubs[0]!.anilistId).toBe(151608)
    expect(createdMangaStubs[0]!.titlePrimary).toBe('Kyouran Reijou Nia Liston Manga')

    // Verified MediaRelation edge created
    expect(upsertedRelations.length).toBe(1)
    expect(upsertedRelations[0]!.sourceType).toBe('ANIME')
    expect(upsertedRelations[0]!.sourceId).toBe(603)
    expect(upsertedRelations[0]!.targetType).toBe('MANGA')
    expect(upsertedRelations[0]!.targetId).toBe(createdMangaStubs[0]!.id)
    expect(upsertedRelations[0]!.type).toBe('ADAPTATION')
  })

  it('queues Deezer music when relation has format: MUSIC and creates Music stub', async () => {
    // Mock Deezer searchTracks
    deezerProvider.searchTracks = async (query: string) => [
      {
        id: 1234567,
        title: 'Nia Liston Opening Theme',
        duration: 210,
        artist: { id: 99, name: 'Anime Artist' },
        album: { id: 88, title: 'Anime OST Single', cover_big: 'https://example.com/single.jpg' },
      } as any,
    ]

    anilistProvider.fetchAnime = async () =>
      ({
        id: 206949,
        title: { userPreferred: 'Nia Liston' },
        relations: {
          edges: [
            {
              relationType: 'OTHER',
              node: {
                id: 99999,
                type: 'ANIME',
                format: 'MUSIC',
                title: { userPreferred: 'Nia Liston Theme Song' },
              },
            },
          ],
        },
      } as any)

    const result = await MediaEntitySyncer.syncAnime(603, 206949)

    expect(result.synced).toBe(true)
    // Music relations are handled directly via Deezer without being in discoveredRelations for AniList recursion
    expect(result.discoveredRelations.length).toBe(0)

    // Music stub was created
    expect(createdMusicStubs.length).toBe(1)
    expect(createdMusicStubs[0]!.titlePrimary).toBe('Nia Liston Opening Theme')
    expect(createdMusicStubs[0]!.deezerId).toBe('1234567')

    // MediaRelation edge to MUSIC was created
    expect(upsertedRelations.some((r) => r.targetType === 'MUSIC' && r.sourceId === 603)).toBe(true)

    // MediaQueue enqueued Deezer update job
    expect(
      enqueuedJobs.some((j) => j.data.mediaType === 'MUSIC' && String(j.data.externalId) === '1234567')
    ).toBe(true)
  })

  it('cascades connected nodes recursively when maxDepth is undefined (Infinity)', async () => {
    anilistProvider.fetchAnime = async () =>
      ({
        id: 206949,
        title: { userPreferred: 'Nia Liston' },
        relations: {
          edges: [
            {
              relationType: 'ADAPTATION',
              node: {
                id: 151608,
                type: 'MANGA',
                format: 'MANGA',
                title: { userPreferred: 'Nia Liston Manga' },
              },
            },
          ],
        },
      } as any)

    const success = await executeMediaUpdate('ANIME', 603, 206949, 0, undefined, [])

    expect(success).toBe(true)
    // Verify relation was enqueued with depth 1 and priority 3
    expect(enqueuedJobs.length).toBe(1)
    const enqueued = enqueuedJobs[0]!
    expect(enqueued.data.mediaType).toBe('MANGA')
    expect(enqueued.data.depth).toBe(1)
    expect(enqueued.data.priority).toBe(3)
    expect(enqueued.data.triggeredBy).toBe('sync')
    expect(enqueued.data.lineage).toEqual(['media-update-ANIME-603'])
  })

  it('detects cycles in lineage and skips re-queueing visited nodes', async () => {
    anilistProvider.fetchAnime = async () =>
      ({
        id: 206949,
        title: { userPreferred: 'Nia Liston' },
        relations: {
          edges: [
            {
              relationType: 'SEQUEL',
              node: {
                id: 206950,
                type: 'ANIME',
                format: 'TV',
                title: { userPreferred: 'Nia Liston Season 2' },
              },
            },
          ],
        },
      } as any)

    // First execution: Anime 603 queues Anime 700 (Season 2)
    await executeMediaUpdate('ANIME', 603, 206949, 0, undefined, [])
    expect(enqueuedJobs.length).toBe(1)
    const nextJob = enqueuedJobs[0]!

    // Clear enqueued list
    enqueuedJobs = []

    // Simulate Season 2 having a PREQUEL edge back to Anime 603
    anilistProvider.fetchAnime = async () =>
      ({
        id: 206950,
        title: { userPreferred: 'Nia Liston Season 2' },
        relations: {
          edges: [
            {
              relationType: 'PREQUEL',
              node: {
                id: 206949,
                type: 'ANIME',
                format: 'TV',
                title: { userPreferred: 'Nia Liston' },
              },
            },
          ],
        },
      } as any)

    // Run Season 2 with lineage containing Anime 603
    await executeMediaUpdate(
      'ANIME',
      nextJob.data.mediaId,
      206950,
      nextJob.data.depth,
      nextJob.data.maxDepth,
      nextJob.data.lineage
    )

    // Should NOT enqueue Anime 603 because of cycle detection!
    expect(enqueuedJobs.length).toBe(0)
  })

  it('does NOT cascade relations when maxDepth is 0 (weekly cron & single details refresh)', async () => {
    anilistProvider.fetchAnime = async () =>
      ({
        id: 206949,
        title: { userPreferred: 'Nia Liston' },
        relations: {
          edges: [
            {
              relationType: 'ADAPTATION',
              node: {
                id: 151608,
                type: 'MANGA',
                format: 'MANGA',
                title: { userPreferred: 'Nia Liston Manga' },
              },
            },
          ],
        },
      } as any)

    // Run with maxDepth: 0
    const success = await executeMediaUpdate('ANIME', 603, 206949, 0, 0, [])

    expect(success).toBe(true)
    // No child relation jobs should be enqueued when maxDepth is 0
    expect(enqueuedJobs.length).toBe(0)
  })
})
