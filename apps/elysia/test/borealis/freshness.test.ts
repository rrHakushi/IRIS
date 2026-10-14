import { describe, expect, it, beforeEach } from 'bun:test'
import {
  evaluateRecordFreshness,
  getEntityFreshness,
  isRecordHydrated,
  normalizeToStartOfDay,
} from '../../src/services/borealis/freshness'
import { MediaQueueManager } from '../../src/services/borealis/queue'
import { MediaPreviewSyncer } from '../../src/services/borealis/syncer/media-preview.syncer'
import { prisma } from '@IRIS/database'

describe('Borealis: Smart Freshness Evaluation & Calendar Checks', () => {
  describe('normalizeToStartOfDay', () => {
    it('strips hours, minutes, seconds, and milliseconds', () => {
      const dt = new Date('2026-10-14T17:45:32.891Z')
      const normalized = normalizeToStartOfDay(dt)
      expect(normalized.getHours()).toBe(0)
      expect(normalized.getMinutes()).toBe(0)
      expect(normalized.getSeconds()).toBe(0)
      expect(normalized.getMilliseconds()).toBe(0)
    })
  })

  describe('isRecordHydrated', () => {
    it('returns false when provider updated timestamp is null, undefined, or 0', () => {
      expect(isRecordHydrated('ANIME', { alUpdatedAt: null })).toBe(false)
      expect(isRecordHydrated('ANIME', { alUpdatedAt: undefined })).toBe(false)
      expect(isRecordHydrated('ANIME', { alUpdatedAt: 0 })).toBe(false)

      expect(isRecordHydrated('MANGA', { alUpdatedAt: null })).toBe(false)
      expect(isRecordHydrated('TV', { tvdbUpdatedAt: null })).toBe(false)
      expect(isRecordHydrated('MOVIE', { tvdbUpdatedAt: null })).toBe(false)
      expect(isRecordHydrated('BOOK', { googleBooksUpdatedAt: null })).toBe(false)
      expect(isRecordHydrated('GAME', { igdbUpdatedAt: null })).toBe(false)
      expect(isRecordHydrated('MUSIC', { deezerUpdatedAt: null })).toBe(false)
    })

    it('returns true when provider updated timestamp is a positive number', () => {
      expect(isRecordHydrated('ANIME', { alUpdatedAt: 1720000000 })).toBe(true)
      expect(isRecordHydrated('MANGA', { alUpdatedAt: 1720000000 })).toBe(true)
      expect(isRecordHydrated('TV', { tvdbUpdatedAt: 123456 })).toBe(true)
      expect(isRecordHydrated('MOVIE', { tvdbUpdatedAt: 123456 })).toBe(true)
      expect(isRecordHydrated('BOOK', { googleBooksUpdatedAt: 123456 })).toBe(true)
      expect(isRecordHydrated('GAME', { igdbUpdatedAt: 123456 })).toBe(true)
      expect(isRecordHydrated('MUSIC', { deezerUpdatedAt: 123456 })).toBe(true)
    })
  })

  describe('evaluateRecordFreshness - Status Thresholds & Calendar Math', () => {
    const fixedNow = new Date('2026-10-14T14:30:00.000Z')

    it('always evaluates unhydrated stubs as stale (isFresh: false)', () => {
      const stub = {
        updatedAt: new Date('2026-10-14T08:00:00.000Z'), // Updated today
        status: 'FINISHED',
        alUpdatedAt: null, // Never hydrated!
      }
      const evalResult = evaluateRecordFreshness('ANIME', stub, fixedNow)
      expect(evalResult.isFresh).toBe(false)
      expect(evalResult.isHydrated).toBe(false)
      expect(evalResult.reason).toContain('Unhydrated stub')
    })

    it('3-Month Group: fresh when updated less than 3 calendar months ago', () => {
      // 2 months and 20 days ago (e.g. 2026-07-25)
      const recentFinished = {
        updatedAt: new Date('2026-07-25T10:00:00.000Z'),
        status: 'FINISHED',
        alUpdatedAt: 1721890000,
      }
      const evalResult = evaluateRecordFreshness('ANIME', recentFinished, fixedNow)
      expect(evalResult.isFresh).toBe(true)
      expect(evalResult.statusGroup).toBe('three-months')
      expect(evalResult.reason).toContain('fresh until 2026-10-25')
    })

    it('3-Month Group: stale when updated 3 or more calendar months ago', () => {
      // Exactly 3 months ago (2026-07-14)
      const exactlyThreeMonths = {
        updatedAt: new Date('2026-07-14T09:00:00.000Z'),
        status: 'FINISHED',
        alUpdatedAt: 1720940000,
      }
      const evalResult = evaluateRecordFreshness('ANIME', exactlyThreeMonths, fixedNow)
      expect(evalResult.isFresh).toBe(false)
      expect(evalResult.statusGroup).toBe('three-months')
      expect(evalResult.reason).toContain('reached 3-month threshold')

      // Older than 3 months (2026-05-01)
      const olderFinished = {
        updatedAt: new Date('2026-05-01T00:00:00.000Z'),
        status: 'ENDED',
        tvdbUpdatedAt: 1714520000,
      }
      const evalResult2 = evaluateRecordFreshness('TV', olderFinished, fixedNow)
      expect(evalResult2.isFresh).toBe(false)
    })

    it('3-Month Group includes CANCELLED, RELEASED, and PUBLISHED', () => {
      for (const st of ['CANCELLED', 'CANCELED', 'RELEASED', 'PUBLISHED']) {
        const item = {
          updatedAt: new Date('2026-09-01T00:00:00.000Z'), // ~1.5 months ago
          status: st,
          igdbUpdatedAt: 1725150000,
        }
        const evalResult = evaluateRecordFreshness('GAME', item, fixedNow)
        expect(evalResult.isFresh).toBe(true)
        expect(evalResult.statusGroup).toBe('three-months')
      }
    })

    it('1-Week Group: fresh when updated less than 7 calendar days ago', () => {
      // 6 days ago (2026-10-08)
      const sixDaysAgo = {
        updatedAt: new Date('2026-10-08T23:59:59.000Z'),
        status: 'RELEASING',
        alUpdatedAt: 1728430000,
      }
      const evalResult = evaluateRecordFreshness('ANIME', sixDaysAgo, fixedNow)
      expect(evalResult.isFresh).toBe(true)
      expect(evalResult.statusGroup).toBe('one-week')
      expect(evalResult.reason).toContain('fresh until 2026-10-15')
    })

    it('1-Week Group: stale when updated 7 or more calendar days ago', () => {
      // Exactly 7 days ago (2026-10-07)
      const sevenDaysAgo = {
        updatedAt: new Date('2026-10-07T00:00:00.000Z'),
        status: 'RELEASING',
        alUpdatedAt: 1728260000,
      }
      const evalResult = evaluateRecordFreshness('ANIME', sevenDaysAgo, fixedNow)
      expect(evalResult.isFresh).toBe(false)
      expect(evalResult.statusGroup).toBe('one-week')
      expect(evalResult.reason).toContain('reached 1-week threshold')
    })

    it('1-Week Group applies to UNKNOWN, UPCOMING, and IN_PRODUCTION', () => {
      for (const st of ['UNKNOWN', 'UPCOMING', 'IN_PRODUCTION', 'NOT_YET_RELEASED', 'HIATUS']) {
        const item = {
          updatedAt: new Date('2026-10-11T00:00:00.000Z'), // 3 days ago
          status: st,
          alUpdatedAt: 1728600000,
        }
        const evalResult = evaluateRecordFreshness('ANIME', item, fixedNow)
        expect(evalResult.isFresh).toBe(true)
        expect(evalResult.statusGroup).toBe('one-week')
      }
    })
  })

  describe('Integration with MediaQueueManager & Previews', () => {
    let mockAnimeDb: any = null
    let enqueuedJobs: any[] = []

    beforeEach(() => {
      enqueuedJobs = []
      ;(MediaQueueManager.getQueue as any) = () => ({
        add: async (name: string, data: any, opts: any) => {
          const job = { id: opts?.jobId || `job-${Date.now()}`, name, data, opts }
          enqueuedJobs.push(job)
          return job
        },
      })
    })

    it('MediaQueueManager skips queueing when local entity is already fresh', async () => {
      // Mock Anime in DB: FINISHED and updated 2 weeks ago (less than 3 months)
      mockAnimeDb = {
        id: 501,
        status: 'FINISHED',
        updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        alUpdatedAt: 1720000000,
      }

      ;(prisma.anime.findUnique as any) = async ({ where }: any) => {
        if (where.id === 501) return mockAnimeDb
        return null
      }

      const job = await MediaQueueManager.enqueueMediaUpdate('ANIME', 501, {
        externalId: 206949,
      })

      // Since it's fresh, queueing should be skipped
      expect(job).toBeNull()
      expect(enqueuedJobs.length).toBe(0)
    })

    it('MediaQueueManager bypasses freshness check when forceRefresh: true is passed', async () => {
      // Mock Anime in DB: fresh
      mockAnimeDb = {
        id: 501,
        status: 'FINISHED',
        updatedAt: new Date(), // updated today!
        alUpdatedAt: 1720000000,
      }

      ;(prisma.anime.findUnique as any) = async ({ where }: any) => {
        if (where.id === 501) return mockAnimeDb
        return null
      }

      const job = await MediaQueueManager.enqueueMediaUpdate('ANIME', 501, {
        externalId: 206949,
        forceRefresh: true, // Manual user refresh
      })

      // Force refresh enqueues the job even though it was updated today
      expect(job).not.toBeNull()
      expect(enqueuedJobs.length).toBe(1)
    })

    it('MediaPreviewSyncer returns queuedForFetch: false for fresh existing stubs', async () => {
      ;(prisma.anime.findUnique as any) = async ({ where }: any) => {
        if (where.anilistId === 206949) {
          return {
            id: 603,
            titlePrimary: 'Nia Liston',
            titleSecondary: null,
            titleNative: null,
            coverImage: null,
            isAdult: false,
            format: 'TV',
            seasonYear: 2026,
            seasonSeason: 'FALL',
            status: 'FINISHED',
            updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago (fresh for FINISHED)
            alUpdatedAt: 1720000000,
          }
        }
        return null
      }

      const preview = await MediaPreviewSyncer.upsertAnimeSearchPreview({
        id: 206949,
        title: { userPreferred: 'Nia Liston' },
        format: 'TV',
      } as any)

      expect(preview.id).toBe(603)
      expect(preview.queuedForFetch).toBe(false)
    })

    it('MediaPreviewSyncer returns queuedForFetch: true for stale or unhydrated existing stubs', async () => {
      ;(prisma.anime.findUnique as any) = async ({ where }: any) => {
        if (where.anilistId === 206949) {
          return {
            id: 603,
            titlePrimary: 'Nia Liston',
            titleSecondary: null,
            titleNative: null,
            coverImage: null,
            isAdult: false,
            format: 'TV',
            seasonYear: 2026,
            seasonSeason: 'FALL',
            status: 'FINISHED',
            updatedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000), // 4 months ago (stale!)
            alUpdatedAt: 1720000000,
          }
        }
        return null
      }

      const preview = await MediaPreviewSyncer.upsertAnimeSearchPreview({
        id: 206949,
        title: { userPreferred: 'Nia Liston' },
        format: 'TV',
      } as any)

      expect(preview.id).toBe(603)
      expect(preview.queuedForFetch).toBe(true)
    })
  })
})
