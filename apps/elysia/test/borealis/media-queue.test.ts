import { describe, expect, it, beforeEach } from 'bun:test'
import { prisma } from '@IRIS/database'
import {
  MediaQueueManager,
  syncActiveMedia,
  MEDIA_QUEUE_NAME,
  type MediaJobData,
} from '../../src/services/borealis/queue'
import {
  executeMediaUpdate,
  createMediaWorker,
} from '../../src/workers/media.wrk'

describe('Borealis Media Queue & Weekly Cron Worker Test Suite', () => {
  let enqueuedJobs: Array<{ name: string; data: MediaJobData; opts?: any }> = []

  beforeEach(() => {
    enqueuedJobs = []

    // Mock BullMQ queue.add & upsertJobScheduler
    const mockQueue = {
      add: async (name: string, data: MediaJobData, opts?: any) => {
        enqueuedJobs.push({ name, data, opts })
        return {
          id: `job-${enqueuedJobs.length}`,
          name,
          data,
          opts,
        }
      },
      upsertJobScheduler: async (
        jobSchedulerId: string,
        repeatOpts: any,
        jobTemplate: any
      ) => {
        enqueuedJobs.push({
          name: jobTemplate?.name ?? jobSchedulerId,
          data: jobTemplate?.data,
          opts: { repeat: repeatOpts, jobId: jobSchedulerId },
        })
        return { id: jobSchedulerId }
      },
      getWaitingCount: async () => 0,
      getActiveCount: async () => 0,
      getCompletedCount: async () => 0,
      getFailedCount: async () => 0,
      getDelayedCount: async () => 0,
      close: async () => {},
    }

    // Intercept getQueue
    ;(MediaQueueManager as any).getQueue = () => mockQueue
  })

  it('scans active/releasing/hiatus media across categories and queues them with depth 0', async () => {
    // Mock Prisma findMany queries for active items
    ;((prisma as any).anime.findMany as any) = async () => [
      { id: 101, anilistId: 15000, status: 'RELEASING' },
      { id: 102, anilistId: 15001, status: 'HIATUS' },
    ]
    ;((prisma as any).manga.findMany as any) = async () => [
      { id: 201, anilistId: 25000, status: 'RELEASING' },
    ]
    ;((prisma as any).tv.findMany as any) = async () => [
      { id: 301, tvDBId: 'tv-3001', status: 'RETURNING_SERIES' },
    ]
    ;((prisma as any).movie.findMany as any) = async () => [
      { id: 401, tvDBId: 'mov-4001', status: 'IN_PRODUCTION' },
    ]
    ;((prisma as any).book.findMany as any) = async () => [
      { id: 501, googleBookId: 'book-5001', status: 'RELEASING' },
    ]
    ;((prisma as any).game.findMany as any) = async () => [
      { id: 601, igdbId: 'game-6001', status: 'EARLY_ACCESS' },
    ]

    const stats = await syncActiveMedia()

    expect(stats.anime).toBe(2)
    expect(stats.manga).toBe(1)
    expect(stats.tv).toBe(1)
    expect(stats.movie).toBe(1)
    expect(stats.book).toBe(1)
    expect(stats.game).toBe(1)
    expect(stats.total).toBe(7)

    // Verify all 7 jobs were enqueued with depth: 0 to protect connections
    expect(enqueuedJobs.length).toBe(7)
    for (const job of enqueuedJobs) {
      expect(job.data.type).toBe('media-update')
      if (job.data.type === 'media-update') {
        expect(job.data.depth).toBe(0)
        expect(job.data.triggeredBy).toBe('cron')
        expect(job.data.priority).toBe(10)
        expect(job.opts?.jobId).toBeDefined()
        expect(job.opts?.jobId).toContain('-W')
      }
    }
  })

  it('enqueues on-demand manual refresh with higher priority and depth 0', async () => {
    const job = await MediaQueueManager.enqueueMediaUpdate('ANIME', 999, {
      externalId: 12345,
      priority: 1,
      triggeredBy: 'manual',
    })

    expect(job).toBeDefined()
    expect(enqueuedJobs.length).toBe(1)
    const enqueued = enqueuedJobs[0]!
    expect(enqueued.data.type).toBe('media-update')
    if (enqueued.data.type === 'media-update') {
      expect(enqueued.data.mediaType).toBe('ANIME')
      expect(enqueued.data.mediaId).toBe(999)
      expect(enqueued.data.externalId).toBe(12345)
      expect(enqueued.data.depth).toBe(0)
      expect(enqueued.data.priority).toBe(1)
      expect(enqueued.data.triggeredBy).toBe('manual')
    }
  })

  it('registers weekly Sunday midnight repeatable cron job pattern "0 0 * * 0"', async () => {
    await MediaQueueManager.scheduleWeeklyActiveMediaSync()

    expect(enqueuedJobs.length).toBe(1)
    const cronJob = enqueuedJobs[0]!
    expect(cronJob.name).toBe('weekly-active-media-sync')
    expect(cronJob.data.type).toBe('weekly-active-sync')
    expect(cronJob.opts?.repeat?.pattern).toBe('0 0 * * 0')
    expect(cronJob.opts?.jobId).toBe('weekly-active-media-sync-cron')
  })

  it('processes media update jobs updating timestamps with depth 0 isolation', async () => {
    let updatedAnimeId: number | undefined
    let updatedMangaId: number | undefined

    ;((prisma as any).anime.update as any) = async ({ where }: any) => {
      updatedAnimeId = where.id
      return {}
    }
    ;((prisma as any).manga.update as any) = async ({ where }: any) => {
      updatedMangaId = where.id
      return {}
    }

    const animeSuccess = await executeMediaUpdate('ANIME', 777, 1000, 0)
    expect(animeSuccess).toBe(true)
    expect(updatedAnimeId).toBe(777)

    const mangaSuccess = await executeMediaUpdate('MANGA', 888, 2000, 0)
    expect(mangaSuccess).toBe(true)
    expect(updatedMangaId).toBe(888)
  })

  it('configures media worker with rate limit protections (max 5 jobs/sec, concurrency 2)', () => {
    const worker = createMediaWorker()
    expect(worker.name).toBe(MEDIA_QUEUE_NAME)
    expect(worker.opts.concurrency).toBe(2)
    expect(worker.opts.limiter).toBeDefined()
    expect(worker.opts.limiter?.max).toBe(5)
    expect(worker.opts.limiter?.duration).toBe(1000)
    worker.close()
  })
})
