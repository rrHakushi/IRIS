import { logger } from "../utils/logger.js";
import { wsHub, WebSocketHub } from "./websocket-hub.js";
import {
  sendNotification,
  encryptNotificationContent,
  decryptNotificationContent,
  logNotificationServiceStatus,
} from "./notification.service.js";
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
} from "./media-queue/index.js";

const loadedServices: string[] = ["websocket-hub", "notification", "media-queue"];

/**
 * Initializes and logs status for all core Elysia backend services.
 */
export function initServices(): void {
  WebSocketHub.logStatus();
  logNotificationServiceStatus();
  MediaQueueService.logStatus();

  logger.service.total(loadedServices.length);
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
};
export * from "./media-queue/types.js";
export * from "./media-queue/providers/index.js";
