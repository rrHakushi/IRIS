import { t, type UnwrapSchema } from 'elysia'

export const KiroshiHistoryModel = {
  // Params
  historyParam: t.Object({
    id: t.String({
      minLength: 1,
      description: 'Search history record ID (UUID)',
    }),
  }),

  // Query
  historyQuery: t.Object({
    limit: t.Optional(
      t.String({
        description: 'Number of search history entries to retrieve (default: 30, max: 100)',
      })
    ),
    type: t.Optional(
      t.String({
        description: 'Filter entries by type ("all", "query", "site")',
      })
    ),
    category: t.Optional(
      t.String({
        description: 'Filter entries by category ("general", "images", "videos", "news")',
      })
    ),
  }),

  trackClickBody: t.Object({
    url: t.String({ minLength: 1, description: 'Destination URL of the clicked site or media' }),
    title: t.String({ description: 'Title or label of the clicked result' }),
    category: t.Optional(t.String({ description: 'Result category (general, images, videos, news)' })),
    thumbnail: t.Optional(t.String({ description: 'Thumbnail preview image URL' })),
    query: t.Optional(t.String({ description: 'Active search query context' })),
  }),

  trackClickResponse: t.Object({
    success: t.Boolean(),
    id: t.String(),
  }),

  historyDeleteQuery: t.Object({
    id: t.Optional(
      t.String({
        description: 'Optional individual search history record ID to delete',
      })
    ),
  }),

  // Schemas
  historyItem: t.Object({
    id: t.String({ description: 'Unique search history record ID (UUID)' }),
    type: t.String({ description: 'Record type: "query" or "site"' }),
    query: t.String({ description: 'Search query string or query context' }),
    category: t.String({ description: 'Search category' }),
    url: t.Optional(t.String({ description: 'Destination URL for visited sites' })),
    title: t.Optional(t.String({ description: 'Title for visited sites' })),
    thumbnail: t.Optional(t.String({ description: 'Thumbnail URL for images/videos' })),
    createdAt: t.String({ description: 'Creation ISO timestamp' }),
  }),

  historyResponse: t.Object({
    success: t.Boolean(),
    history: t.Array(
      t.Object({
        id: t.String(),
        type: t.String(),
        query: t.String(),
        category: t.String(),
        url: t.Optional(t.String()),
        title: t.Optional(t.String()),
        thumbnail: t.Optional(t.String()),
        createdAt: t.String(),
      })
    ),
  }),

  deleteHistoryResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
  }),

  // Detailed RFC 9457 Error Schemas
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

  notFoundError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("not-found")' }),
    title: t.String({ description: 'Short summary ("Not Found")' }),
    status: t.Literal(404, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed missing item explanation' }),
    code: t.String({ description: 'Machine-readable token ("not-found")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Search history record not found' }),

  validationError: t.Object({
    type: t.String({ description: 'Slug identifying validation failure ("validation")' }),
    title: t.String({ description: 'Short summary ("Unprocessable Content")' }),
    status: t.Literal(422, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Field validation error details from TypeBox schema validator' }),
    code: t.String({ description: 'Machine-readable token ("validation")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Request payload or parameter validation failed' }),
} as const

export type KiroshiHistoryModel = {
  [k in keyof typeof KiroshiHistoryModel]: UnwrapSchema<(typeof KiroshiHistoryModel)[k]>
}
