import { t, type UnwrapSchema } from 'elysia'

export const BorealisEntitiesModel = {
  // ===========================================================================
  // Characters
  // ===========================================================================
  characterCatalogQuery: t.Optional(
    t.Object({
      page: t.Optional(t.Numeric({ default: 1, minimum: 1, description: 'Page number' })),
      limit: t.Optional(t.Numeric({ default: 40, minimum: 1, maximum: 100, description: 'Items per page (default 40)' })),
      search: t.Optional(t.String({ description: 'Filter by character name keyword' })),
      gender: t.Optional(t.String({ description: 'Filter by gender' })),
      sortBy: t.Optional(
        t.Union([t.Literal('popularity'), t.Literal('favorites'), t.Literal('name')], { default: 'popularity' })
      ),
      sortOrder: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')], { default: 'desc' })),
    })
  ),

  characterCatalogResponse: t.Object({
    success: t.Boolean(),
    items: t.Array(
      t.Object({
        id: t.Number(),
        namePrimary: t.String(),
        nameNative: t.Nullable(t.String()),
        image: t.Nullable(t.String()),
        gender: t.Nullable(t.String()),
        age: t.Nullable(t.String()),
        favorites: t.Nullable(t.Number()),
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

  characterFiltersResponse: t.Object({
    success: t.Boolean(),
    genders: t.Array(t.Object({ value: t.String(), count: t.Number() })),
    total: t.Number(),
  }),

  characterDetailResponse: t.Object({
    success: t.Boolean(),
    character: t.Any({ description: 'Full character metadata including media appearances and voice actors' }),
  }),

  // ===========================================================================
  // People
  // ===========================================================================
  personCatalogQuery: t.Optional(
    t.Object({
      page: t.Optional(t.Numeric({ default: 1, minimum: 1, description: 'Page number' })),
      limit: t.Optional(t.Numeric({ default: 40, minimum: 1, maximum: 100, description: 'Items per page (default 40)' })),
      search: t.Optional(t.String({ description: 'Filter by person name keyword' })),
      occupation: t.Optional(t.String({ description: 'Filter by primary occupation' })),
      language: t.Optional(t.String({ description: 'Filter by language' })),
      gender: t.Optional(t.String({ description: 'Filter by gender' })),
      sortBy: t.Optional(
        t.Union([t.Literal('popularity'), t.Literal('favorites'), t.Literal('name')], { default: 'popularity' })
      ),
      sortOrder: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')], { default: 'desc' })),
    })
  ),

  personCatalogResponse: t.Object({
    success: t.Boolean(),
    items: t.Array(
      t.Object({
        id: t.Number(),
        namePrimary: t.String(),
        nameNative: t.Nullable(t.String()),
        image: t.Nullable(t.String()),
        primaryOccupations: t.Array(t.String()),
        language: t.Nullable(t.String()),
        gender: t.Nullable(t.String()),
        favorites: t.Nullable(t.Number()),
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

  personFiltersResponse: t.Object({
    success: t.Boolean(),
    occupations: t.Array(t.Object({ value: t.String(), count: t.Number() })),
    languages: t.Array(t.Object({ value: t.String(), count: t.Number() })),
    genders: t.Array(t.Object({ value: t.String(), count: t.Number() })),
    total: t.Number(),
  }),

  personDetailResponse: t.Object({
    success: t.Boolean(),
    person: t.Any({ description: 'Full person metadata including voiced characters, staff roles, and music releases' }),
  }),

  // ===========================================================================
  // Studios
  // ===========================================================================
  studioCatalogQuery: t.Optional(
    t.Object({
      page: t.Optional(t.Numeric({ default: 1, minimum: 1, description: 'Page number' })),
      limit: t.Optional(t.Numeric({ default: 40, minimum: 1, maximum: 100, description: 'Items per page (default 40)' })),
      search: t.Optional(t.String({ description: 'Filter by studio name keyword' })),
      isAnimationStudio: t.Optional(t.Boolean({ description: 'Filter by animation studio' })),
      sortBy: t.Optional(
        t.Union([t.Literal('popularity'), t.Literal('favorites'), t.Literal('name')], { default: 'popularity' })
      ),
      sortOrder: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')], { default: 'desc' })),
    })
  ),

  studioCatalogResponse: t.Object({
    success: t.Boolean(),
    items: t.Array(
      t.Object({
        id: t.Number(),
        name: t.String(),
        isAnimationStudio: t.Boolean(),
        siteUrl: t.Nullable(t.String()),
        favorites: t.Nullable(t.Number()),
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

  studioFiltersResponse: t.Object({
    success: t.Boolean(),
    types: t.Array(t.Object({ value: t.String(), count: t.Number() })),
    total: t.Number(),
  }),

  studioDetailResponse: t.Object({
    success: t.Boolean(),
    studio: t.Any({ description: 'Full studio metadata including creations across all media types' }),
  }),

  // ===========================================================================
  // Common / Errors
  // ===========================================================================
  entityDetailParam: t.Object({
    id: t.Numeric({ minimum: 1, description: 'Entity ID' }),
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
    { description: 'Entity not found' }
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

export type BorealisEntitiesModel = {
  [k in keyof typeof BorealisEntitiesModel]: UnwrapSchema<(typeof BorealisEntitiesModel)[k]>
}
