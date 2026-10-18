import { prisma } from '@IRIS/database'
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
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    })
    const userSettings = (dbUser?.settings as any) || {}
    const historyEnabled = userSettings?.search?.historyEnabled !== false
    if (!historyEnabled) {
      return { success: true, id: '' }
    }

    const encryptedQuery = data.query ? encryptConnectionData(data.query, userId) : null

    const record = await prisma.searchHistory.create({
      data: {
        userId,
        type: 'site',
        url: data.url,
        title: data.title,
        thumbnail: data.thumbnail,
        category: data.category || 'general',
        encryptedQuery,
      },
    })

    // Retention cleanup in background
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    prisma.searchHistory
      .deleteMany({
        where: {
          userId,
          createdAt: { lt: thirtyDaysAgo },
        },
      })
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

    const records = await prisma.searchHistory.findMany({
      where: {
        userId,
        createdAt: { gte: thirtyDaysAgo },
        ...(typeFilter && typeFilter !== 'all' ? { type: typeFilter } : {}),
        ...(categoryFilter && categoryFilter !== 'all' ? { category: categoryFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit * 2,
    })

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
            createdAt: rec.createdAt.toISOString(),
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
              createdAt: rec.createdAt.toISOString(),
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
    await prisma.searchHistory.deleteMany({
      where: {
        userId,
        ...(type && type !== 'all' ? { type } : {}),
      },
    })

    return {
      success: true,
      message: 'History cleared successfully',
    }
  }

  /**
   * Deletes an individual history record by ID.
   */
  public static async deleteHistoryItem(userId: string, id: string) {
    const result = await prisma.searchHistory.deleteMany({
      where: { id, userId },
    })

    if (result.count === 0) {
      throw new NotFound('History record not found.')
    }

    return {
      success: true,
      message: 'History item removed',
    }
  }
}

