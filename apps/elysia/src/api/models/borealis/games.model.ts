import { t, type UnwrapSchema } from 'elysia'

export const BorealisGamesModel = {
  catalogQuery: t.Optional(
    t.Object({
      cursor: t.Optional(t.Numeric({ description: 'Cursor ID for pagination' })),
      page: t.Optional(t.Numeric({ default: 1, minimum: 1, description: 'Page number' })),
      limit: t.Optional(t.Numeric({ default: 50, minimum: 1, maximum: 100, description: 'Items per page (default 50)' })),
      search: t.Optional(t.String({ description: 'Filter by search keyword in titles' })),
      genres: t.Optional(t.String({ description: 'Comma-separated genre names' })),
      tags: t.Optional(t.String({ description: 'Comma-separated tag names' })),
      formats: t.Optional(t.String({ description: 'Comma-separated formats' })),
      statuses: t.Optional(t.String({ description: 'Comma-separated statuses' })),
      years: t.Optional(t.String({ description: 'Comma-separated years' })),
      platforms: t.Optional(t.String({ description: 'Comma-separated platforms' })),
      developers: t.Optional(t.String({ description: 'Comma-separated developers' })),
      publishers: t.Optional(t.String({ description: 'Comma-separated publishers' })),
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

  catalogResponse: t.Object({
    success: t.Boolean(),
    items: t.Array(
      t.Object({
        id: t.Number(),
        titlePrimary: t.String(),
        titleSecondary: t.Nullable(t.String()),
        titleNative: t.Nullable(t.String()),
        coverImage: t.Nullable(t.String()),
        bannerImage: t.Nullable(t.String()),
        averageScore: t.Nullable(t.Number()),
        format: t.Nullable(t.String()),
        status: t.Nullable(t.String()),
        startDateYear: t.Nullable(t.Number()),
        description: t.Nullable(t.String()),
        genres: t.Array(t.Any()),
        tags: t.Array(t.Any()),
      })
    ),
    nextCursor: t.Nullable(t.Number()),
    hasMore: t.Boolean(),
    total: t.Number(),
    pagination: t.Optional(
      t.Object({
        page: t.Number(),
        limit: t.Number(),
        total: t.Number(),
        totalPages: t.Number(),
        hasMore: t.Boolean(),
      })
    ),
  }),

  filtersResponse: t.Object({
    success: t.Boolean(),
    statuses: t.Array(t.Object({ value: t.String(), count: t.Number() })),
    formats: t.Array(t.Object({ value: t.String(), count: t.Number() })),
    genres: t.Array(t.Object({ value: t.String(), count: t.Number() })),
    tags: t.Array(t.Object({ value: t.String(), count: t.Number() })),
    years: t.Array(t.Object({ value: t.Number(), count: t.Number() })),
    platforms: t.Optional(t.Array(t.Object({ value: t.String(), count: t.Number() }))),
    developers: t.Optional(t.Array(t.Object({ value: t.String(), count: t.Number() }))),
    publishers: t.Optional(t.Array(t.Object({ value: t.String(), count: t.Number() }))),
  }),

  param: t.Object({
    gameId: t.Numeric({ minimum: 1, description: 'Game ID' }),
  }),

  detailResponse: t.Object({
    success: t.Boolean(),
    media: t.Any({ description: 'Game overview metadata' }),
  }),

  refreshResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
    timestamp: t.String(),
  }),

  similarQuery: t.Optional(
    t.Object({
      limit: t.Optional(t.Numeric({ default: 24, minimum: 1, maximum: 50, description: 'Number of recommendations' })),
    })
  ),

  similarResponse: t.Object({
    success: t.Boolean(),
    sourceId: t.Number(),
    items: t.Array(
      t.Object({
        id: t.Number(),
        titlePrimary: t.String(),
        titleSecondary: t.Nullable(t.String()),
        titleNative: t.Nullable(t.String()),
        coverImage: t.Nullable(t.String()),
        bannerImage: t.Nullable(t.String()),
        averageScore: t.Nullable(t.Number()),
        format: t.Nullable(t.String()),
        status: t.Nullable(t.String()),
        startDateYear: t.Nullable(t.Number()),
        description: t.Nullable(t.String()),
        genres: t.Array(t.Any()),
        tags: t.Array(t.Any()),
      })
    ),
  }),

  relationsResponse: t.Object({
    success: t.Boolean(),
    relations: t.Array(
      t.Object({
        id: t.Number(),
        sourceType: t.String(),
        sourceId: t.Number(),
        targetType: t.String(),
        targetId: t.Number(),
        type: t.String(),
        data: t.Any(),
        target: t.Optional(t.Any()),
      })
    ),
  }),

  charactersResponse: t.Object({
    success: t.Boolean(),
    characters: t.Array(
      t.Object({
        id: t.Number(),
        mediaId: t.Number(),
        mediaType: t.String(),
        characterId: t.Number(),
        actorId: t.Optional(t.Nullable(t.Number())),
        role: t.String(),
        characterData: t.Object({
          id: t.Number(),
          namePrimary: t.String(),
          nameNative: t.Nullable(t.String()),
          age: t.Optional(t.Nullable(t.String())),
          gender: t.Optional(t.Nullable(t.String())),
          dateOfBirthDay: t.Optional(t.Nullable(t.Number())),
          dateOfBirthMonth: t.Optional(t.Nullable(t.Number())),
          dateOfBirthYear: t.Optional(t.Nullable(t.Number())),
          description: t.Optional(t.Nullable(t.String())),
          image: t.Optional(t.Nullable(t.String())),
        }),
        actorData: t.Optional(
          t.Nullable(
            t.Object({
              id: t.Number(),
              namePrimary: t.String(),
              nameNative: t.Nullable(t.String()),
              language: t.Nullable(t.String()),
              image: t.Nullable(t.String()),
              description: t.Optional(t.Nullable(t.String())),
            })
          )
        ),
      })
    ),
  }),

  staffResponse: t.Object({
    success: t.Boolean(),
    staff: t.Array(
      t.Object({
        id: t.Number(),
        mediaId: t.Number(),
        mediaType: t.String(),
        personId: t.Number(),
        role: t.String(),
        customRole: t.Nullable(t.String()),
        personData: t.Object({
          id: t.Number(),
          namePrimary: t.String(),
          nameNative: t.Nullable(t.String()),
          nameAlternative: t.Optional(t.Array(t.String())),
          image: t.Nullable(t.String()),
          gender: t.Optional(t.Nullable(t.String())),
          language: t.Optional(t.Nullable(t.String())),
          description: t.Optional(t.Nullable(t.String())),
        }),
      })
    ),
  }),

  imagesResponse: t.Object({
    success: t.Boolean(),
    images: t.Any(),
  }),

  statsResponse: t.Object({
    success: t.Boolean(),
    stats: t.Any(),
  }),

  peopleQuery: t.Optional(
    t.Object({
      page: t.Optional(t.Numeric({ default: 1, minimum: 1, description: 'Page number' })),
      limit: t.Optional(t.Numeric({ default: 40, minimum: 1, maximum: 100, description: 'Items per page' })),
      status: t.Optional(t.String({ description: 'Filter by list status' })),
    })
  ),

  friendsResponse: t.Object({
    success: t.Boolean(),
    friends: t.Array(
      t.Object({
        id: t.Union([t.Number(), t.String()]),
        userId: t.String(),
        status: t.String(),
        score: t.Nullable(t.Number()),
        primaryProgress: t.Nullable(t.Number()),
        secondaryProgress: t.Optional(t.Nullable(t.Number())),
        progress: t.Optional(t.Nullable(t.Number())),
        volumesProgress: t.Optional(t.Nullable(t.Number())),
        updatedAt: t.String(),
        user: t.Object({
          id: t.String(),
          username: t.String(),
          displayName: t.Nullable(t.String()),
          avatarUrl: t.Nullable(t.String()),
          avatarFrame: t.Nullable(t.String()),
          displayNameStyle: t.Optional(t.Any()),
          customization: t.Optional(t.Any()),
        }),
      })
    ),
  }),

  peopleResponse: t.Object({
    success: t.Boolean(),
    mediaType: t.String(),
    mediaId: t.Number(),
    total: t.Number(),
    page: t.Number(),
    limit: t.Number(),
    totalPages: t.Number(),
    hasMore: t.Boolean(),
    people: t.Array(
      t.Object({
        id: t.Number(),
        userId: t.String(),
        status: t.String(),
        score: t.Nullable(t.Number()),
        primaryProgress: t.Nullable(t.Number()),
        secondaryProgress: t.Optional(t.Nullable(t.Number())),
        progress: t.Optional(t.Nullable(t.Number())),
        volumesProgress: t.Optional(t.Nullable(t.Number())),
        updatedAt: t.String(),
        user: t.Object({
          id: t.String(),
          username: t.String(),
          displayName: t.String(),
          avatarUrl: t.Nullable(t.String()),
          avatarFrame: t.Nullable(t.String()),
          displayNameStyle: t.Optional(t.Any()),
          customization: t.Optional(t.Any()),
        }),
      })
    ),
  }),

  recommendationsResponse: t.Object({
    success: t.Boolean(),
    recommendations: t.Array(t.Any()),
  }),

  notFoundError: t.Object(
    {
      type: t.String(),
      title: t.String(),
      status: t.Literal(404),
      detail: t.String(),
      code: t.String(),
      instance: t.Optional(t.String()),
    },
    { description: 'Game not found' }
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

  unauthorizedError: t.Object(
    {
      type: t.String(),
      title: t.String(),
      status: t.Literal(401),
      detail: t.String(),
      code: t.String(),
      instance: t.Optional(t.String()),
    },
    { description: 'Unauthorized' }
  ),
} as const

export type BorealisGamesModel = {
  [k in keyof typeof BorealisGamesModel]: UnwrapSchema<(typeof BorealisGamesModel)[k]>
}

