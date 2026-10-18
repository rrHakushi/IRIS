import { t } from "@/router"
import type { UnwrapSchema } from "elysia"

export const StudioCreationItemSchema = t.Object({
  id: t.Number(),
  mediaType: t.String(),
  mediaId: t.Number(),
  isMain: t.Boolean(),
  titlePrimary: t.String(),
  titleSecondary: t.Nullable(t.String()),
  titleNative: t.Nullable(t.String()),
  coverImage: t.Nullable(t.String()),
  bannerImage: t.Nullable(t.String()),
  format: t.Nullable(t.String()),
  releaseYear: t.Nullable(t.Number()),
  averageScore: t.Nullable(t.Number()),
  popularity: t.Nullable(t.Number()),
  favorites: t.Nullable(t.Number()),
  genres: t.Array(t.String()),
  status: t.Nullable(t.String()),
})

export type StudioCreationItem = UnwrapSchema<typeof StudioCreationItemSchema>

export const StudioResponseSchema = t.Object({
  id: t.Number(),
  name: t.String(),
  isAnimationStudio: t.Boolean(),
  siteUrl: t.Nullable(t.String()),
  favorites: t.Nullable(t.Number()),
  alFavorites: t.Nullable(t.Number()),
  sources: t.Nullable(t.Any()),
  creationsCount: t.Number(),
  creations: t.Array(StudioCreationItemSchema),
  pagination: t.Object({
    nextCursor: t.Nullable(t.Number()),
    hasMore: t.Boolean(),
    total: t.Number(),
  }),
})

export type StudioDetails = UnwrapSchema<typeof StudioResponseSchema>
