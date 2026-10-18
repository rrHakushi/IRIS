import { elysia } from "./elysia"

export interface KiroshiClickPayload {
  url: string
  title: string
  category?: string
  thumbnail?: string
  query?: string
}

/**
 * Tracks a clicked search result, image, video, or site non-blockingly.
 */
export function trackKiroshiClick(payload: KiroshiClickPayload): void {
  if (!payload.url) return
  try {
    elysia.kiroshi.history.track
      .post({
        url: payload.url,
        title: payload.title || payload.url,
        category: payload.category || "general",
        thumbnail: payload.thumbnail,
        query: payload.query,
      })
      .catch(() => {})
  } catch {
    // Fire-and-forget; never block the user's action
  }
}
