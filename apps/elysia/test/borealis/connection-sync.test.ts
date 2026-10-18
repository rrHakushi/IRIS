import { describe, expect, it, beforeEach } from 'bun:test'
import { prisma, type ConnectionProvider } from '@IRIS/database'
import {
  ConnectionSyncQueueManager,
  isProviderSupportedForMediaType,
  type ConnectionSyncJobData,
} from '../../src/services/carina/connection-sync.queue'
import {
  createConnectionProviderWorker,
  processConnectionSyncJob,
  handleJobFailure,
  PROVIDER_WORKER_CONFIGS,
} from '../../src/workers/connection-sync.wrk'
import { CarinaNotificationsServ } from '../../src/services/carina/notifications.serv'
import { ConnectionRateLimitError, AniListAdapter } from '@IRIS/connections'
import { BorealisListsServ } from '../../src/services/borealis/lists.serv'

describe('Borealis Media Connection Sync Queue & Worker Test Suite', () => {
  let enqueuedJobs: Array<{
    queueProvider: ConnectionProvider
    name: string
    data: ConnectionSyncJobData
    opts?: any
  }> = []

  beforeEach(() => {
    enqueuedJobs = []

    // Mock BullMQ queues for each provider
    const createMockQueue = (provider: ConnectionProvider) => ({
      add: async (name: string, data: ConnectionSyncJobData, opts?: any) => {
        enqueuedJobs.push({ queueProvider: provider, name, data, opts })
        return {
          id: `job-${enqueuedJobs.length}`,
          name,
          data,
          opts,
        }
      },
      getWaitingCount: async () => 0,
      getActiveCount: async () => 0,
      getCompletedCount: async () => 0,
      getFailedCount: async () => 0,
      getDelayedCount: async () => 0,
      close: async () => {},
    })

    ;(ConnectionSyncQueueManager as any).getQueue = (provider: ConnectionProvider) =>
      createMockQueue(provider)
  })

  describe('1. Provider & Media Type Compatibility', () => {
    it('correctly maps supported connection providers per media type', () => {
      // ANIME: ANILIST, MAL, SIMKL, BANGUMI
      expect(isProviderSupportedForMediaType('ANILIST', 'ANIME')).toBe(true)
      expect(isProviderSupportedForMediaType('MAL', 'ANIME')).toBe(true)
      expect(isProviderSupportedForMediaType('SIMKL', 'ANIME')).toBe(true)
      expect(isProviderSupportedForMediaType('BANGUMI', 'ANIME')).toBe(true)

      // MANGA: ANILIST, MAL, BANGUMI (not SIMKL)
      expect(isProviderSupportedForMediaType('ANILIST', 'MANGA')).toBe(true)
      expect(isProviderSupportedForMediaType('MAL', 'MANGA')).toBe(true)
      expect(isProviderSupportedForMediaType('BANGUMI', 'MANGA')).toBe(true)
      expect(isProviderSupportedForMediaType('SIMKL', 'MANGA')).toBe(false)

      // MOVIE / TV: SIMKL (not ANILIST, MAL)
      expect(isProviderSupportedForMediaType('SIMKL', 'MOVIE')).toBe(true)
      expect(isProviderSupportedForMediaType('SIMKL', 'TV')).toBe(true)
      expect(isProviderSupportedForMediaType('ANILIST', 'TV')).toBe(false)
      expect(isProviderSupportedForMediaType('MAL', 'MOVIE')).toBe(false)

      // GAME, BOOK, MUSIC: BANGUMI
      expect(isProviderSupportedForMediaType('BANGUMI', 'GAME')).toBe(true)
      expect(isProviderSupportedForMediaType('BANGUMI', 'BOOK')).toBe(true)
      expect(isProviderSupportedForMediaType('BANGUMI', 'MUSIC')).toBe(true)
      expect(isProviderSupportedForMediaType('ANILIST', 'GAME')).toBe(false)
      expect(isProviderSupportedForMediaType('MAL', 'BOOK')).toBe(false)
      expect(isProviderSupportedForMediaType('SIMKL', 'MUSIC')).toBe(false)
    })
  })

  describe('2. Job Enqueueing & 2 Attempts Configuration', () => {
    it('enqueues sync jobs with attempts: 2 and exponential backoff', async () => {
      await ConnectionSyncQueueManager.enqueueSyncJobs({
        userId: 'user-123',
        mediaType: 'ANIME',
        mediaId: 101,
        mediaTitle: 'Frieren: Beyond Journey\'s End',
        entry: {
          status: 'WATCHING',
          progress: 5,
          score: 9.5,
          notes: 'Masterpiece',
        },
        connections: {
          anilist: { id: 154587 },
          mal: 52991,
          simkl: { id: 2012345 },
          bangumi: { id: 398604 },
        },
      })

      // All 4 providers support ANIME
      expect(enqueuedJobs.length).toBe(4)

      for (const job of enqueuedJobs) {
        // Must strictly have attempts: 2 as instructed by user
        expect(job.opts?.attempts).toBe(2)
        expect(job.opts?.backoff).toEqual({
          type: 'exponential',
          delay: 2000,
        })
        expect(job.data.userId).toBe('user-123')
        expect(job.data.mediaId).toBe(101)
        expect(job.data.mediaTitle).toBe('Frieren: Beyond Journey\'s End')
        expect(job.data.payload.status).toBe('WATCHING')
        expect(job.data.payload.progress).toBe(5)
        expect(job.data.payload.score).toBe(9.5)
      }

      const anilistJob = enqueuedJobs.find((j) => j.queueProvider === 'ANILIST')
      expect(anilistJob).toBeDefined()
      expect(anilistJob?.data.providerMediaId).toBe(154587)

      const malJob = enqueuedJobs.find((j) => j.queueProvider === 'MAL')
      expect(malJob).toBeDefined()
      expect(malJob?.data.providerMediaId).toBe(52991)
    })

    it('filters out unsupported providers for a given media type', async () => {
      await ConnectionSyncQueueManager.enqueueSyncJobs({
        userId: 'user-456',
        mediaType: 'TV',
        mediaId: 202,
        mediaTitle: 'Breaking Bad',
        entry: {
          status: 'COMPLETED',
          progress: 62,
        },
        connections: {
          anilist: { id: 99999 }, // Unsupported for TV
          mal: { id: 88888 },     // Unsupported for TV
          simkl: { id: 10001 },   // Supported for TV
        },
      })

      // Only Simkl should be enqueued
      expect(enqueuedJobs.length).toBe(1)
      expect(enqueuedJobs[0]!.queueProvider).toBe('SIMKL')
      expect(enqueuedJobs[0]!.data.providerMediaId).toBe(10001)
      expect(enqueuedJobs[0]!.opts?.attempts).toBe(2)
    })
  })

  describe('3. Worker Rate Limiter & Concurrency Configurations', () => {
    it('sets strict per-provider concurrency and rate limits', () => {
      expect(PROVIDER_WORKER_CONFIGS.ANILIST).toEqual({ concurrency: 3, max: 80, duration: 60000 })
      expect(PROVIDER_WORKER_CONFIGS.MAL).toEqual({ concurrency: 1, max: 30, duration: 60000 })
      expect(PROVIDER_WORKER_CONFIGS.SIMKL).toEqual({ concurrency: 2, max: 40, duration: 60000 })
      expect(PROVIDER_WORKER_CONFIGS.BANGUMI).toEqual({ concurrency: 3, max: 60, duration: 60000 })
    })

    it('creates worker with configured limits for provider', () => {
      const worker = createConnectionProviderWorker('MAL')
      expect(worker.name).toBe('connection-sync-mal')
      expect(worker.opts.concurrency).toBe(1)
      expect(worker.opts.limiter?.max).toBe(30)
      expect(worker.opts.limiter?.duration).toBe(60000)
      worker.close()
    })
  })

  describe('4. Job Processor Execution & Retry Triggers', () => {
    it('notifies user and skips retrying if user connection does not exist', async () => {
      let createdNotif: any = null
      ;(prisma.connection.findFirst as any) = async () => null
      ;(CarinaNotificationsServ.createNotification as any) = async (data: any) => {
        createdNotif = data
        return { id: 'notif-1' }
      }

      const mockJob: any = {
        data: {
          userId: 'user-789',
          provider: 'ANILIST',
          providerMediaId: 1001,
          mediaType: 'ANIME',
          mediaId: 10,
          mediaTitle: 'Steins;Gate',
          payload: { status: 'COMPLETED', progress: 24 },
          autoInjected: false,
        },
        opts: { attempts: 2 },
        attemptsMade: 0,
      }

      const result = await processConnectionSyncJob(mockJob)
      expect(result).toBe(false)
      expect(createdNotif).toBeDefined()
      expect(createdNotif.userId).toBe('user-789')
      expect(createdNotif.content.title).toContain('AniList Not Connected')
    })

    it('successfully processes job and updates connection lastSyncedAt', async () => {
      let updatedConnection = false
      let adapterUpdated = false

      ;(prisma.connection.findFirst as any) = async () => ({
        id: 'conn-1',
        userId: 'user-100',
        provider: 'ANILIST',
        encryptedData: 'encrypted-test-data',
        status: 'CONNECTED',
      })
      ;(prisma.connection.update as any) = async (args: any) => {
        if (args?.data?.lastSyncedAt) {
          updatedConnection = true
        }
        return { id: 'conn-1' }
      }

      const mockAdapter = {
        id: 'ANILIST',
        displayName: 'AniList',
        updateMediaEntry: async (_creds: any, payload: any) => {
          adapterUpdated = true
          expect(payload.mediaId).toBe(1234)
          expect(payload.progress).toBe(12)
          return { success: true }
        },
      }

      const mockJob: any = {
        data: {
          userId: 'user-100',
          provider: 'ANILIST',
          providerMediaId: 1234,
          mediaType: 'ANIME',
          mediaId: 50,
          mediaTitle: 'Cowboy Bebop',
          payload: { status: 'COMPLETED', progress: 12 },
        },
        opts: { attempts: 2 },
        attemptsMade: 0,
      }

      const result = await processConnectionSyncJob(mockJob, undefined, {
        adapter: mockAdapter,
        decrypt: () => ({
          accessToken: 'valid-token',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        }),
      })

      expect(result).toBe(true)
      expect(adapterUpdated).toBe(true)
      expect(updatedConnection).toBe(true)
    })

    it('properly maps MANGA READING status to AniList CURRENT', async () => {
      let passedStatus = ''
      const anilistAdapter = new AniListAdapter()
      ;(anilistAdapter as any).executeGraphQL = async (_query: string, vars: any) => {
        passedStatus = vars.status
        return { data: { SaveMediaListEntry: { id: 123, status: vars.status } } }
      }

      await anilistAdapter.updateMediaEntry(
        { accessToken: 'mock-token' },
        {
          mediaId: 85297,
          mediaType: 'MANGA',
          status: 'READING',
          progress: 10,
        }
      )

      expect(passedStatus).toBe('CURRENT')
    })

    it('pauses worker and throws ConnectionRateLimitError on 429 response', async () => {
      ;(prisma.connection.findFirst as any) = async () => ({
        id: 'conn-rate',
        userId: 'user-rate',
        provider: 'ANILIST',
        encryptedData: 'encrypted-data',
        status: 'CONNECTED',
      })

      const mockAdapter = {
        id: 'ANILIST',
        displayName: 'AniList',
        updateMediaEntry: async () => {
          throw new ConnectionRateLimitError('AniList rate limited', 'ANILIST', 15)
        },
      }

      let rateLimitDuration = 0
      const mockWorker: any = {
        rateLimit: (duration: number) => {
          rateLimitDuration = duration
        },
      }

      const mockJob: any = {
        data: {
          userId: 'user-rate',
          provider: 'ANILIST',
          providerMediaId: 9999,
          mediaType: 'ANIME',
          mediaId: 10,
          mediaTitle: 'Rate Limited Anime',
          payload: { status: 'WATCHING', progress: 1 },
        },
        opts: { attempts: 2 },
        attemptsMade: 0,
      }

      expect(
        processConnectionSyncJob(mockJob, mockWorker, {
          adapter: mockAdapter,
          decrypt: () => ({ accessToken: 'valid-token' }),
        })
      ).rejects.toThrow(ConnectionRateLimitError)

      try {
        await processConnectionSyncJob(mockJob, mockWorker, {
          adapter: mockAdapter,
          decrypt: () => ({ accessToken: 'valid-token' }),
        })
      } catch {}
      expect(rateLimitDuration).toBe(15000)
    })
  })

  describe('5. Complete Failure Notification After 2 Attempts', () => {
    it('dispatches HIGH priority notification to user when all 2 attempts fail', async () => {
      let notifiedPayload: any = null
      let updatedErrorMsg = ''

      ;(CarinaNotificationsServ.createNotification as any) = async (data: any) => {
        notifiedPayload = data
        return { id: 'notif-fail' }
      }
      ;(prisma.connection.updateMany as any) = async (args: any) => {
        if (args?.data?.errorMessage) {
          updatedErrorMsg = args.data.errorMessage
        }
        return { count: 1 }
      }

      const mockJob: any = {
        data: {
          userId: 'user-fail',
          provider: 'ANILIST',
          providerMediaId: 5555,
          mediaType: 'ANIME',
          mediaId: 99,
          mediaTitle: 'Chainsaw Man',
          payload: { status: 'WATCHING', progress: 4 },
        },
        opts: { attempts: 2 },
        attemptsMade: 2, // 2nd attempt failed -> exhausted!
      }

      const err = new Error('AniList GraphQL downstream 500 server error')

      await handleJobFailure('ANILIST', mockJob, err)

      expect(notifiedPayload).toBeDefined()
      expect(notifiedPayload.userId).toBe('user-fail')
      expect(notifiedPayload.app).toBe('IRIS List')
      expect(notifiedPayload.category).toBe('Connections')
      expect(notifiedPayload.type).toBe('INFO')
      expect(notifiedPayload.priority).toBe('HIGH')
      expect(notifiedPayload.content.title).toBe('AniList Sync Failed')
      expect(notifiedPayload.content.body).toContain('Chainsaw Man')
      expect(notifiedPayload.content.body).toContain('AniList GraphQL downstream 500 server error')
      expect(updatedErrorMsg).toContain('AniList GraphQL downstream 500 server error')
    })
  })

  describe('6. Borealis List Mutation Integration', () => {
    it('enqueues connection sync jobs on upsertAnimeEntry', async () => {
      ;(prisma.anime.findUnique as any) = async () => ({
        id: 1,
        episodeCount: 12,
        status: 'FINISHED',
        titlePrimary: 'Death Note',
        titleSecondary: 'Desu Noto',
      })
      ;(prisma.animeList.upsert as any) = async (args: any) => ({
        id: 10,
        userId: 'user-test',
        animeId: 1,
        status: args.create.status,
        progress: args.create.progress,
        score: args.create.score,
        notes: args.create.notes,
        rewatched: args.create.rewatched,
        private: args.create.private,
        startedAt: args.create.startedAt,
        completedAt: args.create.completedAt,
        connections: args.create.connections,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await BorealisListsServ.upsertAnimeEntry('user-test', 1, {
        status: 'COMPLETED',
        progress: 12,
        score: 10,
        connections: {
          anilist: { id: 1535 },
        },
      })

      expect(enqueuedJobs.length).toBe(1)
      expect(enqueuedJobs[0]!.queueProvider).toBe('ANILIST')
      expect(enqueuedJobs[0]!.data.providerMediaId).toBe(1535)
      expect(enqueuedJobs[0]!.data.mediaTitle).toBe('Death Note')
      expect(enqueuedJobs[0]!.data.payload.progress).toBe(12)
      expect(enqueuedJobs[0]!.opts?.attempts).toBe(2)
    })

    it('enqueues connection sync jobs on incrementAnime', async () => {
      ;(prisma.anime.findUnique as any) = async () => ({
        id: 2,
        episodeCount: 24,
        status: 'RELEASING',
        titlePrimary: 'Jujutsu Kaisen',
        titleSecondary: 'Sorcery Fight',
      })
      ;(prisma.animeList.findUnique as any) = async () => ({
        id: 20,
        userId: 'user-test',
        animeId: 2,
        status: 'WATCHING',
        progress: 3,
        score: null,
        notes: null,
        rewatched: 0,
        connections: {
          anilist: { id: 113415 },
        },
      })
      ;(prisma.animeList.upsert as any) = async (args: any) => ({
        id: 20,
        userId: 'user-test',
        animeId: 2,
        status: args.update.status,
        progress: args.update.progress,
        score: null,
        notes: null,
        rewatched: 0,
        startedAt: new Date(),
        completedAt: null,
        connections: { anilist: { id: 113415 } },
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await BorealisListsServ.incrementAnime('user-test', 2, {
        count: 1,
      })

      expect(enqueuedJobs.length).toBe(1)
      expect(enqueuedJobs[0]!.queueProvider).toBe('ANILIST')
      expect(enqueuedJobs[0]!.data.providerMediaId).toBe(113415)
      expect(enqueuedJobs[0]!.data.mediaTitle).toBe('Jujutsu Kaisen')
      expect(enqueuedJobs[0]!.data.payload.progress).toBe(4) // 3 + 1
      expect(enqueuedJobs[0]!.opts?.attempts).toBe(2)
    })
  })
})
