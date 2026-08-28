import type { Notification } from "@IRIS/database";
import type { SessionUser } from "../../../../../../plugins/session";
import type { prisma as PrismaType } from "@IRIS/database";
import type { CacheInstance } from "../../../../../../utils/cache";

export interface NotificationActionContext {
  notification: Notification;
  action: string;
  resolvedStatus: "CONFIRMED" | "REJECTED" | "SUBMITTED";
  payload: unknown;
  sessionUser: SessionUser;
  prisma: typeof PrismaType;
  cache: CacheInstance;
}

export interface NotificationActionResult {
  success: boolean;
  message?: string;
  error?: string;
  resultPayload?: Record<string, unknown> | null;
}

export type NotificationActionHandler = (
  ctx: NotificationActionContext
) => Promise<NotificationActionResult | void>;
