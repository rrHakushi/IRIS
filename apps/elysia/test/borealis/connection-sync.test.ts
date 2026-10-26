import { describe, expect, it, beforeEach } from 'bun:test'
import { prisma, type ConnectionProvider } from '@Iris/db'
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

  describe('2. Job Enqueueing & 4 Attempts Configuration', () => {
    it('enqueues sync jobs with attempts: 4 and fixed 60s backoff', async () => {
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
        // Must have attempts: 4 (1 initial + 3 retries for 429)
        expect(job.opts?.attempts).toBe(4)
        expect(job.opts?.backoff).toEqual({
          type: 'fixed',
          delay: 60000,
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
      expect(enqueuedJobs[0]!.opts?.attempts).toBe(4)
      expect(enqueuedJobs[0]!.opts?.backoff).toEqual({
        type: 'fixed',
        delay: 60000,
      })
    })

    it('enqueues jobs with string slug IDs for providers like HIKKA', async () => {
      await ConnectionSyncQueueManager.enqueueSyncJobs({
        userId: 'user-slug-test',
        mediaType: 'MANGA',
        mediaId: 153,
        mediaTitle: 'Kakegurui',
        entry: {
          status: 'READING',
          progress: 5,
        },
        connections: {
          hikka: { id: 'kakegurui-ffec17' },
        },
      })

      expect(enqueuedJobs.length).toBe(1)
      expect(enqueuedJobs[0]!.queueProvider).toBe('HIKKA')
      expect(enqueuedJobs[0]!.data.providerMediaId).toBe('kakegurui-ffec17')
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
      prisma.orm.public.Connection.where = (() => ({
        first: async () => null,
      })) as any

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
        opts: { attempts: 4 },
        attemptsMade: 0,
      }

      const result = await processConnectionSyncJob(mockJob)
      expect(result).toBe(false)
      expect(createdNotif).toBeDefined()
      expect(createdNotif.userId).toBe('user-789')
      expect(createdNotif.app).toBe('Borealis')
      expect(createdNotif.content.title).toContain('AniList Not Connected')
    })

    it('successfully processes job and updates connection lastSyncedAt', async () => {
      let updatedConnection = false
      let adapterUpdated = false

      prisma.orm.public.Connection.where = (() => ({
        first: async () => ({
          id: 'conn-1',
          userId: 'user-100',
          provider: 'ANILIST',
          encryptedData: 'encrypted-test-data',
          status: 'CONNECTED',
        }),
        update: async (args: any) => {
          if (args?.lastSyncedAt) {
            updatedConnection = true
          }
          return { id: 'conn-1' }
        },
      })) as any

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
        opts: { attempts: 4 },
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
      prisma.orm.public.Connection.where = (() => ({
        first: async () => ({
          id: 'conn-rate',
          userId: 'user-rate',
          provider: 'ANILIST',
          encryptedData: 'encrypted-data',
          status: 'CONNECTED',
        }),
      })) as any

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
        opts: { attempts: 4 },
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
      // Math.max(15, 60) * 1000 = 60000ms minimum rate limit pause
      expect(rateLimitDuration).toBe(60000)
    })
  })

  describe('5. Complete Failure Notification & 429 Retries', () => {
    it('dispatches HIGH priority notification to user immediately on non-429 terminal failure', async () => {
      let notifiedPayload: any = null
      let updatedErrorMsg = ''

      ;(CarinaNotificationsServ.createNotification as any) = async (data: any) => {
        notifiedPayload = data
        return { id: 'notif-fail' }
      }
      prisma.orm.public.Connection.where = (() => ({
        updateAndCount: async (args: any) => {
          if (args?.errorMessage) {
            updatedErrorMsg = args.errorMessage
          }
          return 1
        },
      })) as any

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
        opts: { attempts: 4 },
        attemptsMade: 1, // 1st attempt failed with non-429 error!
      }

      const err = new Error('AniList GraphQL downstream 500 server error')

      await handleJobFailure('ANILIST', mockJob, err)

      expect(notifiedPayload).toBeDefined()
      expect(notifiedPayload.userId).toBe('user-fail')
      expect(notifiedPayload.app).toBe('Borealis')
      expect(notifiedPayload.category).toBe('Connections')
      expect(notifiedPayload.type).toBe('INFO')
      expect(notifiedPayload.priority).toBe('HIGH')
      expect(notifiedPayload.content.title).toBe('AniList Sync Failed')
      expect(notifiedPayload.content.body).toContain('Chainsaw Man')
      expect(notifiedPayload.content.body).toContain('AniList GraphQL downstream 500 server error')
      expect(updatedErrorMsg).toContain('AniList GraphQL downstream 500 server error')
    })

    it('does NOT retry on 404 errors and discards job immediately', async () => {
      let discarded = false
      let notified = false

      ;(CarinaNotificationsServ.createNotification as any) = async () => {
        notified = true
        return { id: 'notif-404' }
      }

      const mockJob: any = {
        data: {
          userId: 'user-404',
          provider: 'BANGUMI',
          providerMediaId: 108783,
          mediaType: 'MANGA',
          mediaId: 153,
          mediaTitle: 'Kakegurui',
          payload: { status: 'READING', progress: 1 },
        },
        opts: { attempts: 4 },
        attemptsMade: 1,
        discard: async () => {
          discarded = true
        },
      }

      const err = new Error('[BANGUMI] Request failed with status 404: Page Not Found')

      await handleJobFailure('BANGUMI', mockJob, err)

      expect(discarded).toBe(true)
      expect(notified).toBe(true)
    })

    it('does NOT dispatch notification on 429 rate limit attempts prior to exhaustion', async () => {
      let notifiedPayload: any = null

      ;(CarinaNotificationsServ.createNotification as any) = async (data: any) => {
        notifiedPayload = data
        return { id: 'notif-fail' }
      }

      const mockJob: any = {
        data: {
          userId: 'user-rate',
          provider: 'ANILIST',
          providerMediaId: 5555,
          mediaType: 'ANIME',
          mediaId: 99,
          mediaTitle: 'Chainsaw Man',
          payload: { status: 'WATCHING', progress: 4 },
        },
        opts: { attempts: 4 },
        attemptsMade: 1, // attempt 1/4
      }

      const rateLimitErr = new ConnectionRateLimitError('Too Many Requests', 'ANILIST', 60)

      await handleJobFailure('ANILIST', mockJob, rateLimitErr)
      expect(notifiedPayload).toBeNull()

      mockJob.attemptsMade = 2
      await handleJobFailure('ANILIST', mockJob, rateLimitErr)
      expect(notifiedPayload).toBeNull()

      mockJob.attemptsMade = 3
      await handleJobFailure('ANILIST', mockJob, rateLimitErr)
      expect(notifiedPayload).toBeNull()
    })

    it('dispatches HIGH priority notification on 429 rate limit once all 4 attempts (3 retries) are exhausted', async () => {
      let notifiedPayload: any = null
      let updatedErrorMsg = ''

      ;(CarinaNotificationsServ.createNotification as any) = async (data: any) => {
        notifiedPayload = data
        return { id: 'notif-fail' }
      }
      prisma.orm.public.Connection.where = (() => ({
        updateAndCount: async (args: any) => {
          if (args?.errorMessage) {
            updatedErrorMsg = args.errorMessage
          }
          return 1
        },
      })) as any

      const mockJob: any = {
        data: {
          userId: 'user-rate',
          provider: 'ANILIST',
          providerMediaId: 5555,
          mediaType: 'ANIME',
          mediaId: 99,
          mediaTitle: 'Chainsaw Man',
          payload: { status: 'WATCHING', progress: 4 },
        },
        opts: { attempts: 4 },
        attemptsMade: 4, // 4th attempt failed -> exhausted 3 retries!
      }

      const rateLimitErr = new ConnectionRateLimitError('Rate limit exceeded after 3 retries', 'ANILIST', 60)

      await handleJobFailure('ANILIST', mockJob, rateLimitErr)

      expect(notifiedPayload).toBeDefined()
      expect(notifiedPayload.userId).toBe('user-rate')
      expect(notifiedPayload.app).toBe('Borealis')
      expect(notifiedPayload.priority).toBe('HIGH')
      expect(notifiedPayload.content.title).toBe('AniList Sync Failed')
      expect(notifiedPayload.content.body).toContain('Chainsaw Man')
      expect(updatedErrorMsg).toContain('Rate limit exceeded')
    })
  })

  describe('6. Borealis List Mutation Integration', () => {
    it('enqueues connection sync jobs with attempts: 4 on upsertAnimeEntry', async () => {
      prisma.orm.public.Anime.where = (() => ({
        select: () => ({
          first: async () => ({
            id: 1,
            episodeCount: 12,
            status: 'FINISHED',
            titlePrimary: 'Death Note',
            titleSecondary: 'Desu Noto',
          }),
        }),
        first: async () => ({
          id: 1,
          episodeCount: 12,
          status: 'FINISHED',
          titlePrimary: 'Death Note',
          titleSecondary: 'Desu Noto',
        }),
      })) as any

      prisma.orm.public.AnimeList.where = (() => ({
        first: async () => null,
      })) as any

      prisma.orm.public.AnimeList.create = (async (args: any) => ({
        id: 10,
        userId: 'user-test',
        animeId: 1,
        status: args?.data?.status ?? 'COMPLETED',
        progress: args?.data?.progress ?? 12,
        score: args?.data?.score ?? 10,
        notes: args?.data?.notes,
        rewatched: args?.data?.rewatched ?? 0,
        private: false,
        startedAt: new Date(),
        completedAt: new Date(),
        connections: args?.data?.connections ?? { anilist: { id: 1535 } },
        createdAt: new Date(),
        updatedAt: new Date(),
      })) as any

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
      expect(enqueuedJobs[0]!.opts?.attempts).toBe(4)
      expect(enqueuedJobs[0]!.opts?.backoff).toEqual({
        type: 'fixed',
        delay: 60000,
      })
    })

    it('enqueues connection sync jobs with attempts: 4 on incrementAnime', async () => {
      prisma.orm.public.Anime.where = (() => ({
        select: () => ({
          first: async () => ({
            id: 2,
            episodeCount: 24,
            status: 'RELEASING',
            titlePrimary: 'Jujutsu Kaisen',
            titleSecondary: 'Sorcery Fight',
          }),
        }),
        first: async () => ({
          id: 2,
          episodeCount: 24,
          status: 'RELEASING',
          titlePrimary: 'Jujutsu Kaisen',
          titleSecondary: 'Sorcery Fight',
        }),
      })) as any

      prisma.orm.public.AnimeList.where = (() => ({
        first: async () => ({
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
        }),
        update: async (args: any) => ({
          id: 20,
          userId: 'user-test',
          animeId: 2,
          status: args?.status ?? 'WATCHING',
          progress: args?.progress ?? 4,
          score: null,
          notes: null,
          rewatched: 0,
          startedAt: new Date(),
          completedAt: null,
          connections: args?.connections ?? { anilist: { id: 113415 } },
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      })) as any

      await BorealisListsServ.incrementAnime('user-test', 2, {
        count: 1,
      })

      expect(enqueuedJobs.length).toBe(1)
      expect(enqueuedJobs[0]!.queueProvider).toBe('ANILIST')
      expect(enqueuedJobs[0]!.data.providerMediaId).toBe(113415)
      expect(enqueuedJobs[0]!.data.mediaTitle).toBe('Jujutsu Kaisen')
      expect(enqueuedJobs[0]!.data.payload.progress).toBe(4) // 3 + 1
      expect(enqueuedJobs[0]!.opts?.attempts).toBe(4)
      expect(enqueuedJobs[0]!.opts?.backoff).toEqual({
        type: 'fixed',
        delay: 60000,
      })
    })
  })
})
