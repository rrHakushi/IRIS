import type { IConnection } from "@IRIS/api";

/**
 * Returns a configured API connection instance for `@IRIS/api` fetch calls.
 *
 * @param customHost - Optional host override.
 * @returns Configured IConnection object.
 */
export function getApiConnection(customHost?: string): IConnection {
  const host =
    customHost ??
    process.env.NEXT_PUBLIC_SERVER_URL ??
    process.env.SERVER_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:3000";

  return {
    host,
  };
}
