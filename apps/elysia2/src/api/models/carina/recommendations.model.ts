import { t, type UnwrapSchema } from 'elysia'

/**
 * Reusable pagination metadata schema
 */
export const PaginationMetaSchema = t.Object({
  page: t.Number({ description: 'Current page number' }),
  limit: t.Number({ description: 'Items per page limit' }),
  total: t.Number({ description: 'Total number of items' }),
  totalPages: t.Number({ description: 'Total number of pages available' }),
  hasMore: t.Boolean({ description: 'Whether additional pages exist beyond this one' }),
})

export const CarinaRecommendationsModel = {
  // Shared pagination schema
  paginationMeta: PaginationMetaSchema,

  // --- Path Parameter Schemas ---
  mediaParam: t.Object({
    type: t.String({
      minLength: 1,
      description: 'Media domain type (anime, manga, movie, tv, game, book, music)',
    }),
    id: t.Numeric({
      minimum: 1,
      description: 'Media item unique ID',
    }),
  }),

  recommendationParam: t.Object({
    id: t.Numeric({
      minimum: 1,
      description: 'Recommendation unique numerical ID',
    }),
  }),

  // Shared author preview representation
  authorPreview: t.Object({
    id: t.String({ description: 'Author user ID (UUID)' }),
    username: t.String({ description: 'Author username' }),
    displayName: t.Nullable(t.String({ description: 'Author display name' })),
    avatarUrl: t.Nullable(t.String({ description: 'Author avatar image URL' })),
    avatarFrame: t.Nullable(t.String({ description: 'Author avatar frame URL' })),
    bannerUrl: t.Nullable(t.String({ description: 'Author banner image URL' })),
  }),

  // Shared recommendation item representation
  recommendationItem: t.Object({
    id: t.Number({ description: 'Recommendation unique identifier' }),
    userId: t.String({ description: 'Author user ID (UUID)' }),
    sourceType: t.String({ description: 'Origin media domain (ANIME, MANGA, etc.)' }),
    sourceId: t.Number({ description: 'Origin media ID' }),
    targetType: t.String({ description: 'Recommended media domain' }),
    targetId: t.Number({ description: 'Recommended media ID' }),
    body: t.Nullable(t.String({ description: 'Recommendation review / explanation' })),
    upvotes: t.Number({ description: 'Total helpful upvotes' }),
    downvotes: t.Number({ description: 'Total unhelpful downvotes' }),
    score: t.Number({ description: 'Net score (upvotes - downvotes)' }),
    userVote: t.Optional(t.Nullable(t.String({ description: 'Current user vote if authenticated (UPVOTE, DOWNVOTE, or null)' }))),
    author: t.Object({
      id: t.String(),
      username: t.String(),
      displayName: t.Nullable(t.String()),
      avatarUrl: t.Nullable(t.String()),
      avatarFrame: t.Nullable(t.String()),
      bannerUrl: t.Nullable(t.String()),
    }),
    createdAt: t.String({ description: 'Creation ISO timestamp' }),
    updatedAt: t.String({ description: 'Last update ISO timestamp' }),
  }),

  // --- POST /carina/recommendations (Submit media recommendation) ---
  submitBody: t.Object({
    sourceType: t.String({
      minLength: 1,
      description: 'Origin media domain (anime, manga, movie, tv, game, book, music)',
    }),
    sourceId: t.Number({
      minimum: 1,
      description: 'Origin media item ID',
    }),
    targetType: t.String({
      minLength: 1,
      description: 'Recommended media domain',
    }),
    targetId: t.Number({
      minimum: 1,
      description: 'Recommended media item ID',
    }),
    body: t.Optional(
      t.String({
        maxLength: 5000,
        description: 'Optional explanation of why you recommend this media',
      })
    ),
  }),

  submitResponse: t.Object({
    success: t.Boolean(),
    recommendation: t.Object({
      id: t.Number(),
      userId: t.String(),
      sourceType: t.String(),
      sourceId: t.Number(),
      targetType: t.String(),
      targetId: t.Number(),
      body: t.Nullable(t.String()),
      upvotes: t.Number(),
      downvotes: t.Number(),
      score: t.Number(),
      author: t.Object({
        id: t.String(),
        username: t.String(),
        displayName: t.Nullable(t.String()),
        avatarUrl: t.Nullable(t.String()),
        avatarFrame: t.Nullable(t.String()),
        bannerUrl: t.Nullable(t.String()),
      }),
      createdAt: t.String(),
      updatedAt: t.String(),
    }),
    message: t.String(),
  }),

  // --- GET /carina/recommendations/:type/:id (Get recommendations for media) ---
  listRecommendationsQuery: t.Object({
    page: t.Optional(t.Number({ default: 1, minimum: 1, description: 'Page number' })),
    limit: t.Optional(t.Number({ default: 10, minimum: 1, maximum: 50, description: 'Recommendations per page' })),
  }),

  listRecommendationsResponse: t.Object({
    success: t.Boolean(),
    total: t.Number({ description: 'Total recommendations for media' }),
    recommendations: t.Array(
      t.Object({
        id: t.Number(),
        userId: t.String(),
        sourceType: t.String(),
        sourceId: t.Number(),
        targetType: t.String(),
        targetId: t.Number(),
        body: t.Nullable(t.String()),
        upvotes: t.Number(),
        downvotes: t.Number(),
        score: t.Number(),
        userVote: t.Optional(t.Nullable(t.String())),
        author: t.Object({
          id: t.String(),
          username: t.String(),
          displayName: t.Nullable(t.String()),
          avatarUrl: t.Nullable(t.String()),
          avatarFrame: t.Nullable(t.String()),
          bannerUrl: t.Nullable(t.String()),
        }),
        createdAt: t.String(),
        updatedAt: t.String(),
      })
    ),
    pagination: PaginationMetaSchema,
  }),

  // --- DELETE /carina/recommendations/:id (Delete recommendation) ---
  deleteResponse: t.Object({
    success: t.Boolean(),
    id: t.Number(),
    message: t.String(),
  }),

  // --- POST /carina/recommendations/:id/vote (Vote on recommendation) ---
  voteBody: t.Object({
    voteType: t.Union([
      t.Literal('UPVOTE'),
      t.Literal('DOWNVOTE'),
      t.Literal('NONE'),
    ], { description: 'Vote action: UPVOTE, DOWNVOTE, or NONE to remove' }),
  }),

  voteResponse: t.Object({
    success: t.Boolean(),
    id: t.Number(),
    upvotes: t.Number(),
    downvotes: t.Number(),
    score: t.Number(),
    userVote: t.Nullable(t.String()),
    message: t.String(),
  }),

  // --- Detailed RFC 9457 Error Schemas ---
  badRequestError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("bad-request")' }),
    title: t.String({ description: 'Short summary ("Bad Request")' }),
    status: t.Literal(400, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed failure explanation' }),
    code: t.String({ description: 'Machine-readable token ("bad-request")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Bad request or self-recommendation' }),

  unauthorizedError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("unauthorized")' }),
    title: t.String({ description: 'Short summary ("Unauthorized")' }),
    status: t.Literal(401, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed unauthorized explanation' }),
    code: t.String({ description: 'Machine-readable token ("unauthorized")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Unauthorized request or invalid authentication credentials' }),

  forbiddenError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("forbidden")' }),
    title: t.String({ description: 'Short summary ("Forbidden")' }),
    status: t.Literal(403, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed forbidden explanation' }),
    code: t.String({ description: 'Machine-readable token ("forbidden")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Insufficient permissions to delete recommendation' }),

  notFoundError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("not-found")' }),
    title: t.String({ description: 'Short summary ("Not Found")' }),
    status: t.Literal(404, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed missing recommendation explanation' }),
    code: t.String({ description: 'Machine-readable token ("not-found")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Recommendation not found' }),

  validationError: t.Object({
    type: t.String({ description: 'Slug identifying validation failure ("validation")' }),
    title: t.String({ description: 'Short summary ("Unprocessable Content")' }),
    status: t.Literal(422, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Field validation error details from TypeBox schema validator' }),
    code: t.String({ description: 'Machine-readable token ("validation")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Request payload validation failed' }),
} as const

export type CarinaRecommendationsModel = {
  [k in keyof typeof CarinaRecommendationsModel]: UnwrapSchema<(typeof CarinaRecommendationsModel)[k]>
}
