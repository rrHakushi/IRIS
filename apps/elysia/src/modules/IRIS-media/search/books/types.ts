import { t } from "elysia"

export const BookSearchResultSchema = t.Object({
  id: t.Number(),
  titlePrimary: t.String(),
  titleSecondary: t.Nullable(t.String()),
  coverImage: t.Nullable(t.String()),
  authors: t.Array(t.String()),
  releaseDateYear: t.Nullable(t.Number()),
  queuedForFetch: t.Optional(t.Boolean()),
})

export const BookSearchResponseSchema = t.Array(BookSearchResultSchema)

export interface BookSearchResultItem {
  id: number
  titlePrimary: string
  titleSecondary: string | null
  coverImage: string | null
  authors: string[]
  releaseDateYear: number | null
  queuedForFetch?: boolean
}

export type BookSearchResponse = BookSearchResultItem[]
