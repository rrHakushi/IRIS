import { t, type UnwrapSchema } from 'elysia'

export const KiroshiSearchModel = {
  // --- GET /kiroshi/search ---
  searchQuery: t.Object({
    q: t.String({ minLength: 1, description: 'Search query terms' }),
    category: t.Optional(
      t.String({
        default: 'general',
        description: 'Search category (general, images, videos, news, map, music, it, science, files, social_media)',
      })
    ),
    pageno: t.Optional(t.String({ default: '1', description: 'Page number for pagination' })),
    time_range: t.Optional(
      t.String({ description: 'Time range filter (e.g. day, week, month, year)' })
    ),
    language: t.Optional(t.String({ default: 'auto', description: 'Language code' })),
    safesearch: t.Optional(t.String({ description: 'SafeSearch level: 0 (off), 1 (moderate), 2 (strict)' })),
    isPrivate: t.Optional(
      t.String({ description: 'Set to "true" to omit saving this query to search history' })
    ),
  }),

  searchResultItem: t.Object({
    title: t.String({ description: 'Result title' }),
    url: t.String({ description: 'Destination web URL' }),
    content: t.String({ description: 'Snippet summary or address text' }),
    engine: t.Optional(t.String({ description: 'Primary backend search engine source' })),
    engines: t.Optional(t.Array(t.String(), { description: 'Aggregated search engines contributing this result' })),
    publishedDate: t.Optional(t.Nullable(t.Any())),
    thumbnail: t.Optional(t.Nullable(t.String())),
    img_src: t.Optional(t.Nullable(t.String())),
    resolution: t.Optional(t.Nullable(t.String())),
    template: t.Optional(t.String()),
    score: t.Optional(t.Number()),
  }),

  searchInfobox: t.Object({
    infobox: t.String({ description: 'Infobox title / entity type' }),
    id: t.Optional(t.Nullable(t.String())),
    content: t.Optional(t.Nullable(t.String())),
    img_src: t.Optional(t.Nullable(t.String())),
    urls: t.Optional(
      t.Array(
        t.Object({
          title: t.Optional(t.Nullable(t.String())),
          url: t.Optional(t.Nullable(t.String())),
        })
      )
    ),
    attributes: t.Optional(t.Array(t.Any())),
  }),

  searchResponse: t.Object({
    success: t.Boolean(),
    query: t.String(),
    category: t.String(),
    page: t.Number(),
    numberOfResults: t.Number(),
    results: t.Array(
      t.Object({
        title: t.String(),
        url: t.String(),
        content: t.String(),
        engine: t.Optional(t.String()),
        engines: t.Optional(t.Array(t.String())),
        publishedDate: t.Optional(t.Nullable(t.Any())),
        thumbnail: t.Optional(t.Nullable(t.String())),
        img_src: t.Optional(t.Nullable(t.String())),
        resolution: t.Optional(t.Nullable(t.String())),
        template: t.Optional(t.String()),
        score: t.Optional(t.Number()),
      })
    ),
    suggestions: t.Array(t.Any()),
    answers: t.Array(t.Any()),
    infoboxes: t.Array(
      t.Object({
        infobox: t.String(),
        id: t.Optional(t.Nullable(t.String())),
        content: t.Optional(t.Nullable(t.String())),
        img_src: t.Optional(t.Nullable(t.String())),
        urls: t.Optional(
          t.Array(
            t.Object({
              title: t.Optional(t.Nullable(t.String())),
              url: t.Optional(t.Nullable(t.String())),
            })
          )
        ),
        attributes: t.Optional(t.Array(t.Any())),
      })
    ),
    corrections: t.Array(t.Any()),
    responseTimeMs: t.Number(),
  }),

  // --- GET /kiroshi/suggestions ---
  suggestionsQuery: t.Object({
    q: t.String({ minLength: 1, description: 'Prefix query to retrieve autocomplete suggestions for' }),
    format: t.Optional(t.String({ description: 'Response format: "json" (default) or "opensearch"' })),
  }),

  suggestionsResponse: t.Union([
    t.Object({
      suggestions: t.Array(t.String(), { description: 'Autocomplete query suggestions' }),
    }),
    t.Array(t.Any(), { description: 'OpenSearch format [query, suggestions]' }),
  ]),

  // Detailed RFC 9457 Error Schemas
  badRequestError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("bad-request")' }),
    title: t.String({ description: 'Short summary ("Bad Request")' }),
    status: t.Literal(400, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed failure explanation' }),
    code: t.String({ description: 'Machine-readable token ("bad-request")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Bad request or missing query parameter' }),

  unauthorizedError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("unauthorized")' }),
    title: t.String({ description: 'Short summary ("Unauthorized")' }),
    status: t.Literal(401, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed unauthorized explanation' }),
    code: t.String({ description: 'Machine-readable token ("unauthorized")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Unauthorized request or invalid authentication credentials' }),

  tooManyRequestsError: t.Object({
    type: t.String({ description: 'Slug identifying rate limit exceeded ("too-many-requests")' }),
    title: t.String({ description: 'Short summary ("Too Many Requests")' }),
    status: t.Literal(429, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Rate limit exceeded explanation' }),
    code: t.String({ description: 'Machine-readable token ("too-many-requests")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'SearXNG rate limit exceeded' }),

  badGatewayError: t.Object({
    type: t.String({ description: 'Slug identifying upstream failure ("bad-gateway")' }),
    title: t.String({ description: 'Short summary ("Bad Gateway")' }),
    status: t.Literal(502, { description: 'HTTP status code' }),
    detail: t.String({ description: 'SearXNG upstream connection or response failure explanation' }),
    code: t.String({ description: 'Machine-readable token ("bad-gateway")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Could not communicate with upstream SearXNG service' }),

  validationError: t.Object({
    type: t.String({ description: 'Slug identifying validation failure ("validation")' }),
    title: t.String({ description: 'Short summary ("Unprocessable Content")' }),
    status: t.Literal(422, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Field validation error details from TypeBox schema validator' }),
    code: t.String({ description: 'Machine-readable token ("validation")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Request query validation failed' }),
} as const

export type KiroshiSearchModel = {
  [k in keyof typeof KiroshiSearchModel]: UnwrapSchema<(typeof KiroshiSearchModel)[k]>
}
