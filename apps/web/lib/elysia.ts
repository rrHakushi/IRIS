import { treaty, type Treaty } from "@elysiajs/eden"
import type { App } from "@IRIS/elysia"

function resolveApiUrl(): string {
  if (typeof window !== "undefined") {
    if (window.location.hostname.endsWith("runerra.org")) {
      return "https://api.runerra.org"
    }
    if (
      process.env.NEXT_PUBLIC_API_URL &&
      !process.env.NEXT_PUBLIC_API_URL.includes("localhost")
    ) {
      return process.env.NEXT_PUBLIC_API_URL
    }
    if (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    ) {
      return "http://localhost:4000"
    }
  }

  const rawApiUrl =
    process.env.ELYSIA_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000"

  return rawApiUrl.replace(/\$\{ELYSIA_PORT\}|\$ELYSIA_PORT/g, "4000")
}

export const API_URL = resolveApiUrl()

export type ElysiaClient = Treaty.Create<App>

export const elysia: ElysiaClient = treaty<App>(API_URL, {
  fetch: {
    credentials: "include",
  },
})

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
  })
}
