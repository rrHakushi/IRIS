import { treaty } from "@elysia/eden"
import type { App } from "@NamelessLiberty/elysia"

export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/elysia`
  }
  const url =
    typeof Bun !== "undefined" ? Bun.env.ELYSIA_URL : process.env.ELYSIA_URL
  if (!url) {
    throw new Error("Missing required environment variable: ELYSIA_URL")
  }
  return url
}

export const API_URL =
  typeof window !== "undefined"
    ? `${window.location.origin}/elysia`
    : (typeof Bun !== "undefined" ? Bun.env.ELYSIA_URL : process.env.ELYSIA_URL) || ""

let browserClient: ReturnType<typeof treaty<App>> | null = null

function getClient(): ReturnType<typeof treaty<App>> {
  if (typeof window !== "undefined") {
    if (!browserClient) {
      browserClient = treaty<App>(`${window.location.origin}/elysia`, {
        fetch: {
          credentials: "include",
        },
      })
    }
    return browserClient
  }

  const url =
    typeof Bun !== "undefined" ? Bun.env.ELYSIA_URL : process.env.ELYSIA_URL
  if (!url) {
    throw new Error("Missing required environment variable: ELYSIA_URL")
  }
  return treaty<App>(url, {
    fetch: {
      credentials: "include",
    },
  })
}

export const elysia: ReturnType<typeof treaty<App>> = new Proxy(
  {} as ReturnType<typeof treaty<App>>,
  {
    get(_target, prop) {
      return (getClient() as any)[prop]
    },
  }
)

export type ElysiaClient = ReturnType<typeof treaty<App>>


