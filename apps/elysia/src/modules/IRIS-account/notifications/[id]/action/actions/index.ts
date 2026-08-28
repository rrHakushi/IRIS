import type {
  NotificationActionContext,
  NotificationActionResult,
  NotificationActionHandler,
} from "./types";
import { quickConnectApproveAction } from "./quickconnect-approve";

export * from "./types";
export { quickConnectApproveAction };

/**
 * Registry mapping action identifiers to their individual handler files.
 */
const actionsRegistry = new Map<string, NotificationActionHandler>([
  ["auth.quickconnect.approve", quickConnectApproveAction],
]);

/**
 * Register a custom action handler.
 */
export function registerNotificationAction(
  name: string,
  handler: NotificationActionHandler
) {
  actionsRegistry.set(name, handler);
}

/**
 * Executes a notification action by delegating to its individual handler file.
 */
export async function executeNotificationAction(
  handlerName: string,
  ctx: NotificationActionContext
): Promise<NotificationActionResult> {
  const handler = actionsRegistry.get(handlerName);
  if (!handler) {
    console.warn(
      `[NotificationActionRegistry] No handler found for '${handlerName}'`
    );
    return { success: true };
  }

  try {
    const result = await handler(ctx);
    return result || { success: true };
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Notification action execution failed";
    console.error(
      `[NotificationActionRegistry] Error executing '${handlerName}':`,
      err
    );
    return { success: false, error: errorMsg };
  }
}
