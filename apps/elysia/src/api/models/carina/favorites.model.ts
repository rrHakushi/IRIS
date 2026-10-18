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

export const CarinaFavoritesModel = {
  // Shared pagination schema
  paginationMeta: PaginationMetaSchema,

  // --- Path Parameter Schemas (Strictly IDs) ---
  favoriteParam: t.Object({
    category: t.String({
      minLength: 1,
      description: 'Favorite category / domain (anime, manga, movie, tv, game, book, music_album, music_track, character, person, studio, user)',
    }),
    targetId: t.Numeric({
      minimum: 1,
      description: 'Target media or entity unique numerical ID',
    }),
  }),

  // Shared favorite item representation
  favoriteItem: t.Object({
    id: t.String({ description: 'Favorite record unique ID (UUID)' }),
    userId: t.String({ description: 'User ID (UUID)' }),
    type: t.String({ description: 'Favorite type enum (ANIME, MANGA, etc.)' }),
    targetId: t.Number({ description: 'Target entity numerical ID' }),
    createdAt: t.String({ description: 'Creation ISO timestamp' }),
  }),

  // --- POST /carina/favorites (Add media to user favorites) ---
  addFavoriteBody: t.Object({
    category: t.Optional(
      t.String({
        minLength: 1,
        description: 'Favorite category / type (anime, manga, movie, tv, game, book, music_album, music_track, character, person, studio, user)',
      })
    ),
    type: t.Optional(
      t.String({
        minLength: 1,
        description: 'Alias for category',
      })
    ),
    targetId: t.Number({
      minimum: 1,
      description: 'Target media unique numerical ID',
    }),
  }),

  addFavoriteResponse: t.Object({
    success: t.Boolean(),
    favorite: t.Object({
      id: t.String(),
      userId: t.String(),
      type: t.String(),
      targetId: t.Number(),
      createdAt: t.String(),
    }),
    message: t.String(),
  }),

  // --- GET /carina/favorites/:category/:targetId (Check if target is in favorites) ---
  checkFavoriteResponse: t.Object({
    success: t.Boolean(),
    isFavorite: t.Boolean({ description: 'Whether the target entity is favorited by the user' }),
    favorite: t.Nullable(
      t.Object({
        id: t.String(),
        userId: t.String(),
        type: t.String(),
        targetId: t.Number(),
        createdAt: t.String(),
      }),
      { description: 'Favorite record details if found, otherwise null' }
    ),
  }),

  // --- DELETE /carina/favorites/:category/:targetId (Remove target from favorites) ---
  removeFavoriteResponse: t.Object({
    success: t.Boolean(),
    targetId: t.Number(),
    category: t.String(),
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
  }, { description: 'Invalid category or parameters' }),

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
  }, { description: 'Insufficient permissions' }),

  notFoundError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("not-found")' }),
    title: t.String({ description: 'Short summary ("Not Found")' }),
    status: t.Literal(404, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed missing favorite explanation' }),
    code: t.String({ description: 'Machine-readable token ("not-found")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Favorite not found' }),

  validationError: t.Object({
    type: t.String({ description: 'Slug identifying validation failure ("validation")' }),
    title: t.String({ description: 'Short summary ("Unprocessable Content")' }),
    status: t.Literal(422, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Field validation error details from TypeBox schema validator' }),
    code: t.String({ description: 'Machine-readable token ("validation")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Request payload validation failed' }),
} as const

export type CarinaFavoritesModel = {
  [k in keyof typeof CarinaFavoritesModel]: UnwrapSchema<(typeof CarinaFavoritesModel)[k]>
}
