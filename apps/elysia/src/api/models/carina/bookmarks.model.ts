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

export const CarinaBookmarksModel = {
  // Shared pagination schema
  paginationMeta: PaginationMetaSchema,

  // --- Path Parameter Schemas (Strictly IDs) ---
  bookmarkParam: t.Object({
    bookmarkId: t.String({
      minLength: 1,
      description: 'Bookmark unique identifier (UUID)',
    }),
  }),

  // Shared bookmark item representation
  bookmarkItem: t.Object({
    id: t.String({ description: 'Bookmark unique identifier (UUID)' }),
    userId: t.String({ description: 'Owner user ID (UUID)' }),
    title: t.String({ description: 'Bookmark title' }),
    url: t.String({ description: 'Bookmark target URL' }),
    icon: t.Nullable(t.String({ description: 'Icon name or URI' })),
    color: t.Nullable(t.String({ description: 'Bookmark color code' })),
    pinned: t.Boolean({ description: 'Whether bookmark is pinned' }),
    appId: t.Nullable(t.String({ description: 'Associated Iris app/module ID' })),
    group: t.Nullable(t.String({ description: 'Group or folder name' })),
    order: t.Number({ description: 'Sorting order value' }),
    createdAt: t.String({ description: 'Creation ISO timestamp' }),
    updatedAt: t.String({ description: 'Last update ISO timestamp' }),
  }),

  // --- GET /carina/bookmarks (Get user bookmarks - 10 per page default) ---
  listBookmarksQuery: t.Object({
    page: t.Optional(t.Number({ default: 1, minimum: 1, description: 'Page number' })),
    limit: t.Optional(t.Number({ default: 10, minimum: 1, maximum: 50, description: 'Bookmarks per page' })),
    group: t.Optional(t.String({ description: 'Filter bookmarks by group/folder' })),
    pinned: t.Optional(t.Boolean({ description: 'Filter bookmarks by pinned flag' })),
  }),

  listBookmarksResponse: t.Object({
    success: t.Boolean(),
    bookmarks: t.Array(
      t.Object({
        id: t.String(),
        userId: t.String(),
        title: t.String(),
        url: t.String(),
        icon: t.Nullable(t.String()),
        color: t.Nullable(t.String()),
        pinned: t.Boolean(),
        appId: t.Nullable(t.String()),
        group: t.Nullable(t.String()),
        order: t.Number(),
        createdAt: t.String(),
        updatedAt: t.String(),
      })
    ),
    groups: t.Optional(t.Array(t.String({ description: 'Unique group/folder names' }))),
    pagination: PaginationMetaSchema,
  }),

  // --- PUT /carina/bookmarks (Reorder and batch-update bookmarks) ---
  putBookmarksBody: t.Object({
    bookmarks: t.Array(
      t.Object({
        id: t.String(),
        title: t.String(),
        url: t.String(),
        icon: t.Optional(t.Nullable(t.String())),
        color: t.Optional(t.Nullable(t.String())),
        pinned: t.Optional(t.Boolean()),
        appId: t.Optional(t.Nullable(t.String())),
        group: t.Optional(t.Nullable(t.String())),
        order: t.Optional(t.Number()),
        createdAt: t.Optional(t.String()),
      })
    ),
  }),

  putBookmarksResponse: t.Object({
    success: t.Boolean(),
    bookmarks: t.Array(
      t.Object({
        id: t.String(),
        userId: t.String(),
        title: t.String(),
        url: t.String(),
        icon: t.Nullable(t.String()),
        color: t.Nullable(t.String()),
        pinned: t.Boolean(),
        appId: t.Nullable(t.String()),
        group: t.Nullable(t.String()),
        order: t.Number(),
        createdAt: t.String(),
        updatedAt: t.String(),
      })
    ),
  }),

  // --- POST /carina/bookmarks (Create bookmark) ---
  createBookmarkBody: t.Object({
    title: t.String({
      minLength: 1,
      maxLength: 255,
      description: 'Bookmark title',
    }),
    url: t.String({
      minLength: 1,
      description: 'Bookmark target URL',
    }),
    icon: t.Optional(t.Nullable(t.String({ description: 'Icon identifier' }))),
    color: t.Optional(t.Nullable(t.String({ description: 'Color hex code' }))),
    pinned: t.Optional(t.Boolean({ default: false, description: 'Whether bookmark is pinned' })),
    appId: t.Optional(t.Nullable(t.String({ description: 'App identifier' }))),
    group: t.Optional(t.Nullable(t.String({ description: 'Group name' }))),
    order: t.Optional(t.Number({ default: 0, description: 'Sort order position' })),
  }),

  createBookmarkResponse: t.Object({
    success: t.Boolean(),
    bookmark: t.Object({
      id: t.String(),
      userId: t.String(),
      title: t.String(),
      url: t.String(),
      icon: t.Nullable(t.String()),
      color: t.Nullable(t.String()),
      pinned: t.Boolean(),
      appId: t.Nullable(t.String()),
      group: t.Nullable(t.String()),
      order: t.Number(),
      createdAt: t.String(),
      updatedAt: t.String(),
    }),
    message: t.String(),
  }),

  // --- PATCH /carina/bookmarks/:bookmarkId (Update bookmark) ---
  updateBookmarkBody: t.Object({
    title: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
    url: t.Optional(t.String({ minLength: 1 })),
    icon: t.Optional(t.Nullable(t.String())),
    color: t.Optional(t.Nullable(t.String())),
    pinned: t.Optional(t.Boolean()),
    appId: t.Optional(t.Nullable(t.String())),
    group: t.Optional(t.Nullable(t.String())),
    order: t.Optional(t.Number()),
  }),

  updateBookmarkResponse: t.Object({
    success: t.Boolean(),
    bookmark: t.Object({
      id: t.String(),
      userId: t.String(),
      title: t.String(),
      url: t.String(),
      icon: t.Nullable(t.String()),
      color: t.Nullable(t.String()),
      pinned: t.Boolean(),
      appId: t.Nullable(t.String()),
      group: t.Nullable(t.String()),
      order: t.Number(),
      createdAt: t.String(),
      updatedAt: t.String(),
    }),
    message: t.String(),
  }),

  // --- DELETE /carina/bookmarks/:bookmarkId (Delete bookmark) ---
  deleteBookmarkResponse: t.Object({
    success: t.Boolean(),
    id: t.String(),
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
  }, { description: 'Bad request or invalid parameters' }),

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
  }, { description: 'Insufficient permissions to modify bookmark' }),

  notFoundError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("not-found")' }),
    title: t.String({ description: 'Short summary ("Not Found")' }),
    status: t.Literal(404, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed missing bookmark explanation' }),
    code: t.String({ description: 'Machine-readable token ("not-found")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Bookmark not found' }),

  validationError: t.Object({
    type: t.String({ description: 'Slug identifying validation failure ("validation")' }),
    title: t.String({ description: 'Short summary ("Unprocessable Content")' }),
    status: t.Literal(422, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Field validation error details from TypeBox schema validator' }),
    code: t.String({ description: 'Machine-readable token ("validation")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Request payload validation failed' }),
} as const

export type CarinaBookmarksModel = {
  [k in keyof typeof CarinaBookmarksModel]: UnwrapSchema<(typeof CarinaBookmarksModel)[k]>
}
