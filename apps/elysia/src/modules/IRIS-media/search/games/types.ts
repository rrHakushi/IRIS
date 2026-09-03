import { t } from "elysia"

export const GameSearchResultSchema = t.Object({
  id: t.Number(),
  titlePrimary: t.String(),
  titleSecondary: t.Nullable(t.String()),
  coverImage: t.Nullable(t.String()),
  releaseDateYear: t.Nullable(t.Number()),
})

export const GameSearchResponseSchema = t.Array(GameSearchResultSchema)

export interface GameSearchResultItem {
  id: number
  titlePrimary: string
  titleSecondary: string | null
  coverImage: string | null
  releaseDateYear: number | null
}

export type GameSearchResponse = GameSearchResultItem[]
