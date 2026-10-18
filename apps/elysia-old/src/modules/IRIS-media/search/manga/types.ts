import { t } from "elysia"

export const MangaSearchResultSchema = t.Object({
  id: t.Number(),
  titlePrimary: t.String(),
  titleSecondary: t.Nullable(t.String()),
  titleNative: t.Nullable(t.String()),
  coverImage: t.Nullable(t.String()),
  isAdult: t.Boolean(),
  format: t.String(),
  startDateYear: t.Nullable(t.Number()),
  queuedForFetch: t.Optional(t.Boolean()),
})

export const MangaSearchResponseSchema = t.Array(MangaSearchResultSchema)

export interface MangaSearchResultItem {
  id: number
  titlePrimary: string
  titleSecondary: string | null
  titleNative: string | null
  coverImage: string | null
  isAdult: boolean
  format: string
  startDateYear: number | null
  queuedForFetch?: boolean
}

export type MangaSearchResponse = MangaSearchResultItem[]
