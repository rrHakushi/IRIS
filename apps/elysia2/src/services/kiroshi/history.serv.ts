import { prisma } from '@IRIS/database'
import { decryptConnectionData } from '@IRIS/connections'
import { NotFound } from '../../lib/errors'

export class KiroshiHistoryServ {
  /**
   * Retrieves decrypted search query history for the user, with 30-day retention and deduplication.
   */
  public static async getHistory(userId: string, limitStr?: string) {
    const limit = Math.min(100, Math.max(1, parseInt(limitStr || '30', 10) || 30))
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const records = await prisma.searchHistory.findMany({
      where: {
        userId,
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
      take: limit * 2, // Take extra to accommodate query deduplication
    })

    const seen = new Set<string>()
    const history: Array<{
      id: string
      query: string
      category: string
      createdAt: string
    }> = []

    for (const rec of records) {
      try {
        const plainQuery = decryptConnectionData<string>(rec.encryptedQuery, userId)
        const normalized = plainQuery.trim().toLowerCase()
        if (!seen.has(normalized)) {
          seen.add(normalized)
          history.push({
            id: rec.id,
            query: plainQuery,
            category: rec.category || 'general',
            createdAt: rec.createdAt.toISOString(),
          })
          if (history.length >= limit) break
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
   * Deletes all search history records for the user.
   */
  public static async clearHistory(userId: string) {
    await prisma.searchHistory.deleteMany({
      where: { userId },
    })

    return {
      success: true,
      message: 'Search history cleared successfully',
    }
  }

  /**
   * Deletes an individual search history record by ID.
   */
  public static async deleteHistoryItem(userId: string, id: string) {
    const result = await prisma.searchHistory.deleteMany({
      where: { id, userId },
    })

    if (result.count === 0) {
      throw new NotFound('Search history record not found.')
    }

    return {
      success: true,
      message: 'Search history item removed',
    }
  }
}
