import { t, type UnwrapSchema } from 'elysia'

export const ProgressFieldSchema = t.Object({
  key: t.String({ minLength: 1, description: 'Unique identifier key for progress field' }),
  label: t.String({ minLength: 1, description: 'Display label for progress field' }),
  unit: t.Optional(t.Nullable(t.String({ description: 'Optional unit of measurement (e.g. ep, ch, pages)' }))),
  max: t.Optional(t.Nullable(t.Number({ minimum: 1, description: 'Optional maximum value for completion' }))),
})

export const BorealisOtherModel = {
  catalogQuery: t.Optional(
    t.Object({
      cursor: t.Optional(t.Numeric({ description: 'Cursor ID for pagination' })),
      page: t.Optional(t.Numeric({ default: 1, minimum: 1, description: 'Page number' })),
      limit: t.Optional(t.Numeric({ default: 50, minimum: 1, maximum: 100, description: 'Items per page (default 50)' })),
      search: t.Optional(t.String({ description: 'Filter by search keyword in titles' })),
      formats: t.Optional(t.String({ description: 'Comma-separated formats' })),
      statuses: t.Optional(t.String({ description: 'Comma-separated statuses' })),
      years: t.Optional(t.String({ description: 'Comma-separated years' })),
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
    years: t.Array(t.Object({ value: t.Number(), count: t.Number() })),
  }),

  otherParam: t.Object({
    otherId: t.Numeric({ minimum: 1, description: 'Other item unique ID' }),
  }),

  progressField: ProgressFieldSchema,

  createOtherBody: t.Object({
    titlePrimary: t.String({ minLength: 1, description: 'Primary title for custom item' }),
    titleSecondary: t.Optional(t.Nullable(t.String({ description: 'Secondary or alternative title' }))),
    description: t.Optional(t.Nullable(t.String({ description: 'Item description or notes' }))),
    coverImage: t.Optional(t.Nullable(t.String({ description: 'Cover image URL' }))),
    bannerImage: t.Optional(t.Nullable(t.String({ description: 'Banner image URL' }))),
    format: t.Optional(t.Nullable(t.String({ description: 'Format of custom item (normalized to lowercase, e.g. app, activity, course, habit, workout, project, podcast, other)' }))),
    startDate: t.Optional(t.Nullable(t.String({ description: 'Start date ISO string' }))),
    endDate: t.Optional(t.Nullable(t.String({ description: 'End date ISO string' }))),
    isPublished: t.Optional(t.Boolean({ default: false, description: 'Whether item is published to public search' })),
    progressFields: t.Array(ProgressFieldSchema, {
      minItems: 1,
      description: 'At least one progress field definition is required',
    }),
    incrementFieldKey: t.String({
      minLength: 1,
      description: 'Designated field key to increment via /increment route (max 1)',
    }),
  }),

  updateOtherBody: t.Object({
    titlePrimary: t.Optional(t.String({ minLength: 1, description: 'Primary title for custom item' })),
    titleSecondary: t.Optional(t.Nullable(t.String({ description: 'Secondary or alternative title' }))),
    description: t.Optional(t.Nullable(t.String({ description: 'Item description or notes' }))),
    coverImage: t.Optional(t.Nullable(t.String({ description: 'Cover image URL' }))),
    bannerImage: t.Optional(t.Nullable(t.String({ description: 'Banner image URL' }))),
    format: t.Optional(t.Nullable(t.String({ description: 'Format of custom item (normalized to lowercase, e.g. app, activity, course, habit, workout, project, podcast, other)' }))),
    startDate: t.Optional(t.Nullable(t.String({ description: 'Start date ISO string' }))),
    endDate: t.Optional(t.Nullable(t.String({ description: 'End date ISO string' }))),
    isPublished: t.Optional(t.Boolean({ description: 'Whether item is published to public search' })),
    progressFields: t.Optional(
      t.Array(ProgressFieldSchema, {
        minItems: 1,
        description: 'Updated progress field definitions',
      })
    ),
    incrementFieldKey: t.Optional(
      t.String({
        minLength: 1,
        description: 'Designated field key to increment via /increment route (max 1)',
      })
    ),
  }),

  uploadAssetBody: t.Object({
    file: t.File({ description: 'Image file (JPEG, PNG, WebP, GIF, max 1MB)' }),
    type: t.Union([t.Literal('cover'), t.Literal('banner')], {
      description: 'Image asset type',
    }),
  }),

  uploadAssetResponse: t.Object({
    success: t.Boolean(),
    url: t.String({ description: 'Public URL of uploaded and converted image' }),
  }),

  itemResponse: t.Object({
    success: t.Boolean(),
    item: t.Any({ description: 'Custom item details' }),
  }),

  forkResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
    item: t.Any({ description: 'Cloned private item details' }),
    entry: t.Optional(t.Any({ description: 'Updated list entry if repointed' })),
  }),

  deleteResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
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
    people: t.Array(
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

  recommendationsResponse: t.Object({
    success: t.Boolean(),
    recommendations: t.Array(t.Any()),
  }),

  // RFC 9457 Problem Details
  unauthorizedError: t.Object({
    type: t.String(),
    title: t.String(),
    status: t.Literal(401),
    detail: t.String(),
    code: t.String(),
  }),

  forbiddenError: t.Object({
    type: t.String(),
    title: t.String(),
    status: t.Literal(403),
    detail: t.String(),
    code: t.String(),
  }),

  notFoundError: t.Object({
    type: t.String(),
    title: t.String(),
    status: t.Literal(404),
    detail: t.String(),
    code: t.String(),
  }),

  conflictError: t.Object({
    type: t.String(),
    title: t.String(),
    status: t.Literal(409),
    detail: t.String(),
    code: t.String(),
  }),

  validationError: t.Object({
    type: t.String(),
    title: t.String(),
    status: t.Literal(422),
    detail: t.String(),
    code: t.String(),
    errors: t.Optional(t.Array(t.Any())),
  }),
}

export type CreateOtherBody = UnwrapSchema<typeof BorealisOtherModel.createOtherBody>
export type UpdateOtherBody = UnwrapSchema<typeof BorealisOtherModel.updateOtherBody>
export type OtherCatalogQuery = UnwrapSchema<typeof BorealisOtherModel.catalogQuery>
export type OtherPeopleQuery = UnwrapSchema<typeof BorealisOtherModel.peopleQuery>
