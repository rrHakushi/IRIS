import { t, type UnwrapSchema } from 'elysia'

export const BorealisMediaModel = {
  mediaCatalogQuery: t.Optional(
    t.Object({
      page: t.Optional(t.Numeric({ default: 1, minimum: 1, description: 'Page number' })),
      limit: t.Optional(t.Numeric({ default: 40, minimum: 1, maximum: 100, description: 'Items per page (default 40)' })),
      search: t.Optional(t.String({ description: 'Filter by search keyword in titles' })),
      genres: t.Optional(t.String({ description: 'Comma-separated genre names' })),
      formats: t.Optional(t.String({ description: 'Comma-separated formats' })),
      statuses: t.Optional(t.String({ description: 'Comma-separated statuses' })),
      years: t.Optional(t.String({ description: 'Comma-separated years' })),
      season: t.Optional(t.String({ description: 'Season filter (WINTER, SPRING, SUMMER, FALL)' })),
      sortBy: t.Optional(
        t.Union(
          [
            t.Literal('popularity'),
            t.Literal('score'),
            t.Literal('title'),
            t.Literal('releaseDate'),
            t.Literal('trending'),
            t.Literal('favorites'),
            t.Literal('updatedAt'),
          ],
          { default: 'popularity' }
        )
      ),
      sortOrder: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')], { default: 'desc' })),
    })
  ),

  mediaCatalogResponse: t.Object({
    success: t.Boolean(),
    items: t.Array(
      t.Object({
        id: t.Number(),
        mediaType: t.String(),
        titlePrimary: t.String(),
        titleSecondary: t.Nullable(t.String()),
        titleNative: t.Nullable(t.String()),
        coverImage: t.Nullable(t.String()),
        bannerImage: t.Nullable(t.String()),
        format: t.String(),
        status: t.String(),
        year: t.Nullable(t.Number()),
        season: t.Optional(t.Nullable(t.String())),
        unitsCount: t.Optional(t.Nullable(t.Number())),
        averageScore: t.Nullable(t.Number()),
        genres: t.Array(t.Object({ id: t.Number(), name: t.String() })),
      })
    ),
    pagination: t.Object({
      page: t.Number(),
      limit: t.Number(),
      total: t.Number(),
      totalPages: t.Number(),
      hasMore: t.Boolean(),
    }),
  }),

  mediaFiltersResponse: t.Object({
    success: t.Boolean(),
    statuses: t.Array(t.Object({ value: t.String(), count: t.Number() })),
    formats: t.Array(t.Object({ value: t.String(), count: t.Number() })),
    genres: t.Array(t.Object({ value: t.String(), count: t.Number() })),
    years: t.Array(t.Object({ value: t.Number(), count: t.Number() })),
    seasons: t.Optional(t.Array(t.Object({ value: t.String(), count: t.Number() }))),
  }),

  mediaDetailParam: t.Object({
    id: t.Numeric({ minimum: 1, description: 'Media ID' }),
  }),

  mediaDetailResponse: t.Object({
    success: t.Boolean(),
    media: t.Any({ description: 'Full media metadata including characters, staff, relations, genres' }),
  }),

  mediaRefreshResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
    timestamp: t.String(),
  }),

  similarQuery: t.Optional(
    t.Object({
      limit: t.Optional(t.Numeric({ default: 10, minimum: 1, maximum: 50, description: 'Number of recommendations' })),
    })
  ),

  similarResponse: t.Object({
    success: t.Boolean(),
    sourceId: t.Number(),
    items: t.Array(
      t.Object({
        id: t.Number(),
        mediaType: t.String(),
        titlePrimary: t.String(),
        titleSecondary: t.Nullable(t.String()),
        titleNative: t.Nullable(t.String()),
        coverImage: t.Nullable(t.String()),
        bannerImage: t.Nullable(t.String()),
        format: t.String(),
        status: t.String(),
        year: t.Nullable(t.Number()),
        averageScore: t.Nullable(t.Number()),
        similarityScore: t.Number({ description: 'Weighted similarity score (0-100)' }),
        matchReasons: t.Array(t.String(), { description: 'Explanations for why this recommendation matches' }),
        genres: t.Array(t.Object({ id: t.Number(), name: t.String() })),
      })
    ),
  }),

  // RFC 9457 Problem Details
  notFoundError: t.Object(
    {
      type: t.String(),
      title: t.String(),
      status: t.Literal(404),
      detail: t.String(),
      code: t.String(),
      instance: t.Optional(t.String()),
    },
    { description: 'Media not found' }
  ),

  validationError: t.Object(
    {
      type: t.String(),
      title: t.String(),
      status: t.Literal(422),
      detail: t.String(),
      code: t.String(),
      instance: t.Optional(t.String()),
    },
    { description: 'Validation error' }
  ),
} as const

export type BorealisMediaModel = {
  [k in keyof typeof BorealisMediaModel]: UnwrapSchema<(typeof BorealisMediaModel)[k]>
}
