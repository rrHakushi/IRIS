import { logger } from "../utils/logger.js"
import { wsHub, WebSocketHub } from "./websocket-hub.js"
import {
  sendNotification,
  encryptNotificationContent,
  decryptNotificationContent,
  logNotificationServiceStatus,
} from "./notification.service.js"
import {
  mediaQueueService,
  MediaQueueService,
  mediaDbSyncer,
  MediaDbSyncer,
  queueAnimeFetch,
  queueMangaFetch,
  queueTvFetch,
  queueMovieFetch,
  queueBookFetch,
  queueGameFetch,
  queueMusicFetch,
} from "./media-queue/index.js"
import { statsQueueService, StatsQueueService } from "./stats-queue.service.js"
import {
  listImportService,
  ListImportService,
} from "./connections/list-import.service.js"
import {
  listExportService,
  ListExportService,
} from "./lists/list-export.service.js"
import {
  listFileImportService,
  ListFileImportService,
} from "./lists/list-file-import.service.js"
import {
  activityService,
  ActivityService,
  recordMediaListActivity,
  purgeOldActivities,
} from "./activity.service.js"

const loadedServices: string[] = [
  "websocket-hub",
  "notification",
  "media-queue",
  "stats-queue",
  "list-import",
  "list-export",
  "list-file-import",
  "activity",
]

/**
 * Initializes and logs status for all core Elysia backend services.
 */
export function initServices(): void {
  WebSocketHub.logStatus()
  logNotificationServiceStatus()
  MediaQueueService.logStatus()
  StatsQueueService.logStatus()
  ListImportService.logStatus()
  ListExportService.logStatus()
  ListFileImportService.logStatus()
  ActivityService.logStatus()
  activityService.initCron()

  logger.service.total(loadedServices.length)
}

export {
  wsHub,
  WebSocketHub,
  sendNotification,
  encryptNotificationContent,
  decryptNotificationContent,
  mediaQueueService,
  MediaQueueService,
  mediaDbSyncer,
  MediaDbSyncer,
  queueAnimeFetch,
  queueMangaFetch,
  queueTvFetch,
  queueMovieFetch,
  queueBookFetch,
  queueGameFetch,
  queueMusicFetch,
  statsQueueService,
  StatsQueueService,
  listImportService,
  ListImportService,
  listExportService,
  ListExportService,
  listFileImportService,
  ListFileImportService,
}
export * from "./media-queue/types.js"
export * from "./media-queue/providers/index.js"
export * from "./connections/list-import.service.js"
export * from "./connections/connection-media-sync.service.js"
export * from "./activity.service.js"
export * from "./media-stats.service.js"
