import { prisma, toDate, normalizeMediaStatus } from '@IRIS/database'
import { LogFactory, c } from '@Iris/logger'
import type { MediaType } from './queue'

const logger = new LogFactory('Borealis:Freshness')

export interface FreshnessRecord {
  updatedAt?: Date | string | null
  status?: string | null
  alUpdatedAt?: number | null
  malUpdatedAt?: number | null
  tvdbUpdatedAt?: number | null
  googleBooksUpdatedAt?: number | null
  igdbUpdatedAt?: number | null
  deezerUpdatedAt?: number | null
}

export interface FreshnessEvaluation {
  isFresh: boolean
  isHydrated: boolean
  statusGroup: 'three-months' | 'one-week'
  reason: string
}

/**
 * Unified statuses considered finished: released or cancelled.
 * Media with these statuses must be at least 3 calendar months old to be eligible for update.
 */
export const THREE_MONTH_STATUSES = new Set(['RELEASED', 'CANCELLED'])

/**
 * Normalizes a date to midnight (00:00:00.000) so time of day is completely ignored
 * in accordance with the day/month calendar difference rule.
 */
export function normalizeToStartOfDay(date: Date | string | number): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Checks if a record has completed its initial external provider data fetch.
 * Stubs created with null provider timestamps are unhydrated and must always be fetched.
 */
export function isRecordHydrated(mediaType: MediaType, record: FreshnessRecord): boolean {
  switch (mediaType) {
    case 'ANIME':
    case 'MANGA':
      return record.alUpdatedAt !== null && record.alUpdatedAt !== undefined && record.alUpdatedAt > 0
    case 'TV':
    case 'MOVIE':
      return record.tvdbUpdatedAt !== null && record.tvdbUpdatedAt !== undefined && record.tvdbUpdatedAt > 0
    case 'BOOK':
      return (
        record.googleBooksUpdatedAt !== null &&
        record.googleBooksUpdatedAt !== undefined &&
        record.googleBooksUpdatedAt > 0
      )
    case 'GAME':
      return record.igdbUpdatedAt !== null && record.igdbUpdatedAt !== undefined && record.igdbUpdatedAt > 0
    case 'MUSIC':
      return record.deezerUpdatedAt !== null && record.deezerUpdatedAt !== undefined && record.deezerUpdatedAt > 0
    default:
      return true
  }
}

/**
 * Evaluates whether a media entity record is still fresh in the local database.
 *
 * Rules:
 * - If record does not exist or has no updatedAt -> stale (must fetch).
 * - If record is an unhydrated stub (missing provider sync timestamp) -> stale (must fetch initial payload).
 * - Finished/Ended/Released/Published/Cancelled -> fresh unless ≥ 3 calendar months old.
 * - Releasing/Upcoming/In Production/Unknown etc. -> fresh unless ≥ 7 calendar days old.
 * - Date comparison normalizes both dates to start-of-day (ignoring time).
 */
export function evaluateRecordFreshness(
  mediaType: MediaType,
  record: FreshnessRecord | null | undefined,
  now: Date = new Date()
): FreshnessEvaluation {
  if (!record || !record.updatedAt) {
    return {
      isFresh: false,
      isHydrated: false,
      statusGroup: 'one-week',
      reason: 'Record does not exist or has no updatedAt timestamp',
    }
  }

  const hydrated = isRecordHydrated(mediaType, record)
  if (!hydrated) {
    return {
      isFresh: false,
      isHydrated: false,
      statusGroup: 'one-week',
      reason: 'Unhydrated stub (missing provider sync timestamp)',
    }
  }

  const today = normalizeToStartOfDay(now)
  const lastUpdated = normalizeToStartOfDay(record.updatedAt)

  const normStatus = normalizeMediaStatus(record.status)
  const isThreeMonthStatus = THREE_MONTH_STATUSES.has(normStatus)

  if (isThreeMonthStatus) {
    const targetDate = new Date(lastUpdated)
    targetDate.setMonth(targetDate.getMonth() + 3)

    const isFresh = today.getTime() < targetDate.getTime()
    return {
      isFresh,
      isHydrated: true,
      statusGroup: 'three-months',
      reason: isFresh
        ? `Status "${normStatus}" is fresh until ${targetDate.toISOString().split('T')[0]}`
        : `Status "${normStatus}" reached 3-month threshold (${targetDate.toISOString().split('T')[0]})`,
    }
  } else {
    const targetDate = new Date(lastUpdated)
    targetDate.setDate(targetDate.getDate() + 7)

    const isFresh = today.getTime() < targetDate.getTime()
    return {
      isFresh,
      isHydrated: true,
      statusGroup: 'one-week',
      reason: isFresh
        ? `Status "${normStatus || 'UNKNOWN'}" is fresh until ${targetDate.toISOString().split('T')[0]}`
        : `Status "${normStatus || 'UNKNOWN'}" reached 1-week threshold (${targetDate.toISOString().split('T')[0]})`,
    }
  }
}

/**
 * Queries the database for a media item's timestamps and evaluates its freshness.
 */
export async function getEntityFreshness(
  mediaType: MediaType,
  mediaId: number,
  now: Date = new Date()
): Promise<FreshnessEvaluation> {
  let record: FreshnessRecord | null = null

  try {
    switch (mediaType) {
      case 'ANIME': {
        const res = await prisma.orm.public.Anime.where({ id: mediaId })
          .select('updatedAt', 'status', 'alUpdatedAt')
          .first()
        if (res) {
          record = {
            updatedAt: toDate(res.updatedAt),
            status: res.status,
            alUpdatedAt: res.alUpdatedAt,
          }
        }
        break
      }
      case 'MANGA': {
        const res = await prisma.orm.public.Manga.where({ id: mediaId })
          .select('updatedAt', 'status', 'alUpdatedAt')
          .first()
        if (res) {
          record = {
            updatedAt: toDate(res.updatedAt),
            status: res.status,
            alUpdatedAt: res.alUpdatedAt,
          }
        }
        break
      }
      case 'TV': {
        const res = await prisma.orm.public.Tv.where({ id: mediaId })
          .select('updatedAt', 'status', 'tvdbUpdatedAt')
          .first()
        if (res) {
          record = {
            updatedAt: toDate(res.updatedAt),
            status: res.status,
            tvdbUpdatedAt: res.tvdbUpdatedAt,
          }
        }
        break
      }
      case 'MOVIE': {
        const res = await prisma.orm.public.Movie.where({ id: mediaId })
          .select('updatedAt', 'status', 'tvdbUpdatedAt')
          .first()
        if (res) {
          record = {
            updatedAt: toDate(res.updatedAt),
            status: res.status,
            tvdbUpdatedAt: res.tvdbUpdatedAt,
          }
        }
        break
      }
      case 'BOOK': {
        const res = await prisma.orm.public.Book.where({ id: mediaId })
          .select('updatedAt', 'status', 'googleBooksUpdatedAt')
          .first()
        if (res) {
          record = {
            updatedAt: toDate(res.updatedAt),
            status: res.status,
            googleBooksUpdatedAt: res.googleBooksUpdatedAt,
          }
        }
        break
      }
      case 'GAME': {
        const res = await prisma.orm.public.Game.where({ id: mediaId })
          .select('updatedAt', 'status', 'igdbUpdatedAt')
          .first()
        if (res) {
          record = {
            updatedAt: toDate(res.updatedAt),
            status: res.status,
            igdbUpdatedAt: res.igdbUpdatedAt,
          }
        }
        break
      }
      case 'MUSIC': {
        const res = await prisma.orm.public.Music.where({ id: mediaId })
          .select('updatedAt', 'status', 'deezerUpdatedAt')
          .first()
        if (res) {
          record = {
            updatedAt: toDate(res.updatedAt),
            status: res.status,
            deezerUpdatedAt: res.deezerUpdatedAt,
          }
        }
        break
      }
    }
  } catch (err: any) {
    logger.warn(`Failed to query ${mediaType} #${mediaId} for freshness check: ${err?.message || err}`)
    return {
      isFresh: false,
      isHydrated: false,
      statusGroup: 'one-week',
      reason: 'Failed to query database',
    }
  }

  return evaluateRecordFreshness(mediaType, record, now)
}
