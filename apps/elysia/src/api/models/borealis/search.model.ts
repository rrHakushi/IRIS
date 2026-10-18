import { t, type UnwrapSchema } from 'elysia'

export const BorealisSearchModel = {
  searchQuery: t.Object({
    q: t.String({
      minLength: 1,
      description: 'Search query string',
    }),
    category: t.Optional(
      t.Union(
        [
          t.Literal('media'),
          t.Literal('anime'),
          t.Literal('manga'),
          t.Literal('movies'),
          t.Literal('tv'),
          t.Literal('games'),
          t.Literal('music'),
          t.Literal('books'),
          t.Literal('characters'),
          t.Literal('people'),
          t.Literal('staff'),
          t.Literal('studios'),
          t.Literal('other'),
        ],
        { default: 'media', description: 'Search catalog category' }
      )
    ),
    page: t.Optional(t.Numeric({ default: 1, minimum: 1, description: 'Page number' })),
    limit: t.Optional(t.Numeric({ default: 20, minimum: 1, maximum: 50, description: 'Results per page' })),
    external: t.Optional(
      t.Boolean({ default: false, description: 'Whether to query external providers and enqueue fetch jobs' })
    ),
  }),

  searchResponse: t.Object({
    success: t.Boolean(),
    category: t.String(),
    query: t.String(),
    results: t.Array(t.Any()),
    pagination: t.Object({
      page: t.Number(),
      limit: t.Number(),
      total: t.Number(),
      hasMore: t.Boolean(),
    }),
  }),

  // RFC 9457 Problem Details
  badRequestError: t.Object(
    {
      type: t.String(),
      title: t.String(),
      status: t.Literal(400),
      detail: t.String(),
      code: t.String(),
      instance: t.Optional(t.String()),
    },
    { description: 'Bad request or empty query' }
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

export type BorealisSearchModel = {
  [k in keyof typeof BorealisSearchModel]: UnwrapSchema<(typeof BorealisSearchModel)[k]>
}
