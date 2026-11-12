"use client"

import { useEffect, useState } from "react"
import { elysia } from "@/lib/elysia"

export type MediaSection =
  | "relations"
  | "characters"
  | "staff"
  | "episodes"
  | "seasons"
  | "images"
  | "stats"
  | "similar"

export interface SectionState<T> {
  data: T | null
  isLoading: boolean
  error: boolean
}

// Module-level cache: survives tab switches (tab components unmount) and revisits.
const dataCache = new Map<string, unknown>()
const inFlight = new Map<string, Promise<unknown>>()

const ROUTE_KEYS: Record<string, { route: string; idKey: string }> = {
  anime: { route: "anime", idKey: "animeId" },
  manga: { route: "manga", idKey: "mangaId" },
  tv: { route: "tv", idKey: "tvId" },
  movie: { route: "movies", idKey: "movieId" },
  movies: { route: "movies", idKey: "movieId" },
  game: { route: "games", idKey: "gameId" },
  games: { route: "games", idKey: "gameId" },
  book: { route: "books", idKey: "bookId" },
  books: { route: "books", idKey: "bookId" },
  music: { route: "music", idKey: "musicId" },
}

function fetchSection(category: string, id: number, section: MediaSection) {
  const cfg = ROUTE_KEYS[category.toLowerCase()]
  if (!cfg) return Promise.resolve(null)
  const node = (elysia.borealis as any)[cfg.route]({ [cfg.idKey]: id })[section]
  return node.get(section === "similar" ? { query: { limit: 24 } } : undefined)
}

export function useMediaSection<T = any>(
  category: string,
  id: number,
  section: MediaSection,
  enabled: boolean
): SectionState<T> {
  const key = `${category}:${id}:${section}`
  const [state, setState] = useState<SectionState<T>>(() => ({
    data: (dataCache.get(key) as T | undefined) ?? null,
    isLoading: false,
    error: false,
  }))

  useEffect(() => {
    if (!enabled) return
    if (dataCache.has(key)) {
      setState({ data: dataCache.get(key) as T, isLoading: false, error: false })
      return
    }

    let cancelled = false
    setState({ data: null, isLoading: true, error: false })

    let req = inFlight.get(key)
    if (!req) {
      req = Promise.resolve(fetchSection(category, id, section)).finally(() =>
        inFlight.delete(key)
      )
      inFlight.set(key, req)
    }

    req
      .then((res: any) => {
        if (res?.error || !res?.data) throw new Error("failed")
        dataCache.set(key, res.data)
        if (!cancelled)
          setState({ data: res.data as T, isLoading: false, error: false })
      })
      .catch(() => {
        if (!cancelled) setState({ data: null, isLoading: false, error: true })
      })

    return () => {
      cancelled = true
    }
  }, [key, enabled, category, id, section])

  return state
}

export function pickList(data: any, keys: string[]): any[] {
  if (Array.isArray(data)) return data
  for (const k of keys) if (Array.isArray(data?.[k])) return data[k]
  return []
}

