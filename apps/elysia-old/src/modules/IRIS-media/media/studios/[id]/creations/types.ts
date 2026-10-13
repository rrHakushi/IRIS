import { t } from "@/router"
import type { UnwrapSchema } from "elysia"
import { StudioCreationItemSchema } from "../types"

export const StudioCreationsQuerySchema = t.Optional(
  t.Object({
    limit: t.Optional(t.Union([t.String(), t.Number()])),
    cursor: t.Optional(t.Union([t.String(), t.Number()])),
    mediaType: t.Optional(t.String()),
    sortBy: t.Optional(
      t.Union([
        t.Literal("releaseDate"),
        t.Literal("popularity"),
        t.Literal("score"),
        t.Literal("favorites"),
        t.Literal("title"),
      ])
    ),
    order: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
  })
)

export const StudioCreationsResponseSchema = t.Object({
  success: t.Boolean(),
  studioId: t.Number(),
  items: t.Array(StudioCreationItemSchema),
  pagination: t.Object({
    nextCursor: t.Nullable(t.Number()),
    hasMore: t.Boolean(),
    total: t.Number(),
  }),
})

export type StudioCreationsResponse = UnwrapSchema<
  typeof StudioCreationsResponseSchema
>
