import { treaty } from "@elysia/eden"
import type { App } from "@IRIS/elysia"

export const API_URL =
  (typeof Bun !== "undefined" ? Bun.env.NEXT_PUBLIC_API_URL : process.env.NEXT_PUBLIC_API_URL) || "http://localhost:4000"

export const elysia = treaty<App>(API_URL, {
  fetch: {
    credentials: "include",
  },
})

export type ElysiaClient = typeof elysia

