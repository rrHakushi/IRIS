import type { PrismaClient } from "@IRIS/database"
import {
  getConnectionAdapter,
  decryptConnectionData,
  encryptConnectionData,
  type ConnectionProvider,
  type ConnectionCredentials,
  type ConnectionProviderAdapter,
  type UpdateMediaPayload,
} from "@IRIS/connections"
import { sendNotification } from "../notification.service.js"
import { logger } from "@/utils/logger"
import { NotificationType, NotificationPriority } from "@IRIS/database"

export interface SyncConnectionMediaOptions {
  userId: string
  username?: string
  animeId: number
  animeTitle: string
  entry: {
    status: string
    progress: number
    score?: number | null
    notes?: string | null
    rewatched?: number
    startedAt?: Date | string | null
    completedAt?: Date | string | null
  }
  connections: Record<string, any>
  prisma: PrismaClient
}

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  ANILIST: "AniList",
  MAL: "MyAnimeList",
  SIMKL: "Simkl",
  BANGUMI: "Bangumi",
}

async function sendSyncNotification({
  userId,
  title,
  body,
  icon,
}: {
  userId: string
  title: string
  body: string
  icon?: string
}): Promise<void> {
  try {
    await sendNotification({
      userId,
      app: "IRIS List",
      category: "Connections",
      type: NotificationType.INFO,
      priority: NotificationPriority.NORMAL,
      content: {
        title,
        body,
        icon,
        link: `/settings?tab=connections`,
      },
    })
  } catch (err: any) {
    logger.warn(
      `[ConnectionSync] Could not deliver sync notification to user ${userId}: ${err?.message || err}`
    )
  }
}

/**
 * Synchronizes an anime entry to all external services listed in `options.connections`.
 * Uses the user's decrypted tokens from the database and refreshes expired tokens automatically.
 * Partial failures trigger in-app notifications and never crash or terminate the request.
 */
export async function syncConnectionMedia(
  options: SyncConnectionMediaOptions
): Promise<void> {
  const { connections, prisma, userId, animeTitle } = options
  if (!connections || typeof connections !== "object") return

  const providerKeys = Object.keys(connections)
  if (providerKeys.length === 0) return

  // Fetch active connections for this specific user
  const userConnections = await prisma.connection.findMany({
    where: {
      userId,
      status: { in: ["CONNECTED", "EXPIRED"] },
    },
  })

  const tasks = providerKeys.map(async (providerKey) => {
    const rawConn = connections[providerKey]
    if (!rawConn || typeof rawConn !== "object") return

    // Skip if user explicitly disabled sync on this connection
    if (rawConn.sync === false) return

    const providerId = Number(rawConn.id ?? rawConn.simklId ?? rawConn.providerId)
    if (Number.isNaN(providerId) || providerId <= 0) return

    const normProvider = providerKey.trim().toUpperCase() as ConnectionProvider
    const displayName = PROVIDER_DISPLAY_NAMES[normProvider] || normProvider

    let adapter: ConnectionProviderAdapter
    try {
      adapter = getConnectionAdapter(normProvider)
    } catch {
      return
    }

    if (!adapter.updateMediaEntry) return

    // Find the user's active connection for this provider
    const userConn = userConnections.find((c) => c.provider === normProvider)
    if (!userConn) {
      await sendSyncNotification({
        userId,
        title: `${displayName} Not Connected`,
        body: `Could not sync "${animeTitle}" to ${displayName}. Please connect your ${displayName} account in Settings > Connections.`,
        icon: adapter.iconUrl,
      })
      return
    }

    // Decrypt credentials using the user's secret key
    let credentials: ConnectionCredentials
    try {
      credentials = decryptConnectionData<ConnectionCredentials>(
        userConn.encryptedData,
        userId
      )
    } catch (err: any) {
      await sendSyncNotification({
        userId,
        title: `${displayName} Authentication Error`,
        body: `Failed to decrypt credentials for ${displayName}. Please reconnect your account.`,
        icon: adapter.iconUrl,
      })
      return
    }

    // Proactive token refresh if expiring (< 5 minutes left)
    const isExpiring =
      userConn.expiresAt &&
      new Date(userConn.expiresAt).getTime() - Date.now() < 300000
    if (isExpiring && credentials.refreshToken && adapter.refreshAccessToken) {
      try {
        const refreshed = await adapter.refreshAccessToken(credentials.refreshToken)
        credentials = { ...credentials, ...refreshed }
        const updatedEncrypted = encryptConnectionData(credentials, userId)
        const newExpiresAt = refreshed.expiresAt
          ? new Date(refreshed.expiresAt)
          : null
        await prisma.connection.update({
          where: { id: userConn.id },
          data: {
            encryptedData: updatedEncrypted,
            expiresAt: newExpiresAt,
            status: "CONNECTED",
          },
        })
      } catch (refreshErr: any) {
        logger.warn(
          `[ConnectionSync] Proactive token refresh failed for ${normProvider}: ${refreshErr?.message || refreshErr}`
        )
      }
    }

    // Apply overrides and progress offset
    let connStatus = options.entry.status
    if (rawConn.overrideStatus && rawConn.status) {
      connStatus = rawConn.status
    }

    let connProgress = options.entry.progress
    if (
      rawConn.progressOffset !== undefined &&
      rawConn.progressOffset !== null
    ) {
      connProgress =
        (options.entry.progress || 0) + Number(rawConn.progressOffset)
    } else if (
      rawConn.overrideProgress &&
      rawConn.progress !== undefined &&
      rawConn.progress !== null
    ) {
      connProgress = Number(rawConn.progress)
    }

    let connScore = options.entry.score
    if (rawConn.score !== undefined && rawConn.score !== null) {
      connScore = Number(rawConn.score)
    }

    let connStartDate = options.entry.startedAt
    if (rawConn.overrideDates && rawConn.startedAt !== undefined) {
      connStartDate = rawConn.startedAt
    }

    let connEndDate = options.entry.completedAt
    if (rawConn.overrideDates && rawConn.completedAt !== undefined) {
      connEndDate = rawConn.completedAt
    }

    let connNotes = options.entry.notes
    if (rawConn.notes !== undefined) {
      connNotes = rawConn.notes
    }

    let connRewatched = options.entry.rewatched
    if (rawConn.rewatched !== undefined) {
      connRewatched = Number(rawConn.rewatched)
    }

    const updatePayload: UpdateMediaPayload = {
      mediaId: providerId,
      mediaType: "ANIME",
      status: connStatus,
      progress: connProgress,
      score: connScore,
      notes: connNotes,
      rewatched: connRewatched,
      startedAt: connStartDate,
      completedAt: connEndDate,
    }

    // Execute provider update with automatic 401 retry
    try {
      await adapter.updateMediaEntry(credentials, updatePayload)
    } catch (firstErr: any) {
      const isAuthErr =
        firstErr?.statusCode === 401 ||
        firstErr?.name === "ConnectionAuthError" ||
        /unauthorized|token/i.test(firstErr?.message || "")

      if (isAuthErr && credentials.refreshToken && adapter.refreshAccessToken) {
        try {
          const refreshed = await adapter.refreshAccessToken(
            credentials.refreshToken
          )
          credentials = { ...credentials, ...refreshed }
          const updatedEncrypted = encryptConnectionData(credentials, userId)
          const newExpiresAt = refreshed.expiresAt
            ? new Date(refreshed.expiresAt)
            : null
          await prisma.connection.update({
            where: { id: userConn.id },
            data: {
              encryptedData: updatedEncrypted,
              expiresAt: newExpiresAt,
              status: "CONNECTED",
            },
          })

          await adapter.updateMediaEntry(credentials, updatePayload)
        } catch (retryErr: any) {
          throw retryErr
        }
      } else {
        throw firstErr
      }
    }

    // Update lastSyncedAt on successful sync
    await prisma.connection.update({
      where: { id: userConn.id },
      data: { lastSyncedAt: new Date() },
    })
  })

  // Settle all connection updates without throwing or interrupting the request
  const results = await Promise.allSettled(tasks)

  for (let i = 0; i < results.length; i++) {
    const res = results[i]!
    if (res.status === "rejected") {
      const providerKey = providerKeys[i]!
      const normProvider = providerKey.trim().toUpperCase() as ConnectionProvider
      const displayName = PROVIDER_DISPLAY_NAMES[normProvider] || normProvider
      const errMsg = res.reason?.message || String(res.reason)

      logger.warn(
        `[ConnectionSync] Failed to sync "${animeTitle}" to ${displayName}: ${errMsg}`
      )

      await sendSyncNotification({
        userId,
        title: `${displayName} Sync Failed`,
        body: `Failed to update "${animeTitle}" on ${displayName}: ${errMsg}`,
      })
    }
  }
}
