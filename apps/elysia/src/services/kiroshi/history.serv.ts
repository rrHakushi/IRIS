import { prisma, toDate } from '@IRIS/database'
import { decryptConnectionData, encryptConnectionData } from '@IRIS/connections'
import { NotFound } from '../../lib/errors'

export class KiroshiHistoryServ {
  /**
   * Records a clicked site, image, or video in the user's search history.
   */
  public static async recordClick(
    userId: string,
    data: {
      url: string
      title: string
      category?: string
      thumbnail?: string
      query?: string
    }
  ) {
    const dbUser = await prisma.orm.public.User
      .select('settings')
      .first({ id: userId })
    const userSettings = (dbUser?.settings as any) || {}
    const historyEnabled = userSettings?.search?.historyEnabled !== false
    if (!historyEnabled) {
      return { success: true, id: '' }
    }

    const encryptedQuery = data.query ? encryptConnectionData(data.query, userId) : null

    const record = await prisma.orm.public.SearchHistory.create({
      userId,
      type: 'site',
      url: data.url,
      title: data.title,
      thumbnail: data.thumbnail,
      category: data.category || 'general',
      encryptedQuery,
    })

    // Retention cleanup in background
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    prisma.orm.public.SearchHistory
      .where({ userId })
      .where((s) => s.createdAt.lt(thirtyDaysAgo))
      .deleteAll()
      .toArray()
      .catch(() => {})

    return {
      success: true,
      id: record.id,
    }
  }

  /**
   * Retrieves decrypted search query and visited site history for the user,
   * with 30-day retention and query deduplication.
   */
  public static async getHistory(
    userId: string,
    options?: {
      limit?: string
      type?: string
      category?: string
    }
  ) {
    const limit = Math.min(100, Math.max(1, parseInt(options?.limit || '50', 10) || 50))
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const typeFilter = options?.type
    const categoryFilter = options?.category

    let query = prisma.orm.public.SearchHistory
      .where({ userId })
      .where((s) => s.createdAt.gte(thirtyDaysAgo))
    if (typeFilter && typeFilter !== 'all') {
      query = query.where({ type: typeFilter })
    }
    if (categoryFilter && categoryFilter !== 'all') {
      query = query.where({ category: categoryFilter })
    }

    const records = await query
      .orderBy((s) => s.createdAt.desc())
      .limit(limit * 2)
      .all()

    const seenQueries = new Set<string>()
    const history: Array<{
      id: string
      type: string
      query: string
      category: string
      url?: string
      title?: string
      thumbnail?: string
      createdAt: string
    }> = []

    for (const rec of records) {
      try {
        const itemType = rec.type || 'query'

        if (itemType === 'site') {
          let plainQuery = ''
          if (rec.encryptedQuery) {
            try {
              plainQuery = decryptConnectionData<string>(rec.encryptedQuery, userId)
            } catch {
              // ignore query decryption failure
            }
          }

          history.push({
            id: rec.id,
            type: 'site',
            query: plainQuery,
            category: rec.category || 'general',
            url: rec.url || '',
            title: rec.title || rec.url || 'Visited Site',
            thumbnail: rec.thumbnail || undefined,
            createdAt: toDate(rec.createdAt).toISOString(),
          })
          if (history.length >= limit) break
        } else {
          // 'query' type
          if (!rec.encryptedQuery) continue
          const plainQuery = decryptConnectionData<string>(rec.encryptedQuery, userId)
          const normalized = plainQuery.trim().toLowerCase()
          if (!seenQueries.has(normalized)) {
            seenQueries.add(normalized)
            history.push({
              id: rec.id,
              type: 'query',
              query: plainQuery,
              category: rec.category || 'general',
              createdAt: toDate(rec.createdAt).toISOString(),
            })
            if (history.length >= limit) break
          }
        }
      } catch {
        // Skip any corrupted record
      }
    }

    return {
      success: true,
      history,
    }
  }

  /**
   * Deletes search history records for the user.
   */
  public static async clearHistory(userId: string, type?: string) {
    let query = prisma.orm.public.SearchHistory.where({ userId })
    if (type && type !== 'all') {
      query = query.where({ type })
    }
    await query.deleteAll()

    return {
      success: true,
      message: 'History cleared successfully',
    }
  }

  /**
   * Deletes an individual history record by ID.
   */
  public static async deleteHistoryItem(userId: string, id: string) {
    const deletedCount = await prisma.orm.public.SearchHistory
      .where({ id, userId })
      .deleteAndCount()

    if (deletedCount === 0) {
      throw new NotFound('History record not found.')
    }

    return {
      success: true,
      message: 'History item removed',
    }
  }
}
