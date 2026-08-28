import { treaty, type Treaty } from "@elysiajs/eden";
import type { App } from "@IRIS/elysia";

const rawApiUrl =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const API_URL = rawApiUrl.replace(
  /\$\{ELYSIA_PORT\}|\$ELYSIA_PORT/g,
  "4000"
);

export type ElysiaClient = Treaty.Create<App>;

export const elysia: ElysiaClient = treaty<App>(API_URL);

/**
 * Creates an Eden Treaty client with an optional Authorization header
 * for testing authenticated endpoints.
 */
export function createAuthClient(token?: string | null): ElysiaClient {
  return treaty<App>(API_URL, {
    headers: token
      ? {
          authorization: `Bearer ${token}`,
        }
      : undefined,
  });
}