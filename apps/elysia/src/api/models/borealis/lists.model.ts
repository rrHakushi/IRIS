import { t, type UnwrapSchema } from 'elysia'
import { LIST_STATUSES } from '@Iris/db'

/**
 * Unified list status accepted/returned by every list type.
 * IN_PROGRESS, ON_HOLD, DROPPED, COMPLETED, PLANNED
 */
export const ListStatusSchema = t.Union([
  t.Literal('IN_PROGRESS'),
  t.Literal('ON_HOLD'),
  t.Literal('DROPPED'),
  t.Literal('COMPLETED'),
  t.Literal('PLANNED'),
])

/**
 * Reusable pagination metadata schema (40 per page default)
 */
export const PaginationMetaSchema = t.Object({
  page: t.Number({ description: 'Current page number' }),
  limit: t.Number({ description: 'Items per page limit (default 40)' }),
  total: t.Number({ description: 'Total number of items' }),
  totalPages: t.Number({ description: 'Total number of pages available' }),
  hasMore: t.Boolean({ description: 'Whether additional pages exist beyond this one' }),
})

export const BorealisListsModel = {
  // Shared pagination schema
  paginationMeta: PaginationMetaSchema,

  // --- Path Parameter Schemas ---
  animeParam: t.Object({
    animeId: t.Numeric({ minimum: 1, description: 'Anime unique ID' }),
  }),
  mangaParam: t.Object({
    mangaId: t.Numeric({ minimum: 1, description: 'Manga unique ID' }),
  }),
  movieParam: t.Object({
    movieId: t.Numeric({ minimum: 1, description: 'Movie unique ID' }),
  }),
  tvParam: t.Object({
    tvId: t.Numeric({ minimum: 1, description: 'TV show unique ID' }),
  }),
  gameParam: t.Object({
    gameId: t.Numeric({ minimum: 1, description: 'Game unique ID' }),
  }),
  bookParam: t.Object({
    bookId: t.Numeric({ minimum: 1, description: 'Book unique ID' }),
  }),
  musicParam: t.Object({
    musicId: t.Numeric({ minimum: 1, description: 'Music unique ID' }),
  }),
  otherParam: t.Object({
    otherId: t.Numeric({ minimum: 1, description: 'Other item unique ID' }),
  }),

  // --- List Query Schema ---
  listQuery: t.Object({
    page: t.Optional(t.Numeric({ default: 1, minimum: 1, description: 'Page number' })),
    limit: t.Optional(t.Numeric({ default: 40, minimum: 1, maximum: 250, description: 'Items per page (default 40)' })),
    status: t.Optional(t.String({ description: 'Filter by list status (IN_PROGRESS, ON_HOLD, DROPPED, COMPLETED, PLANNED) or ALL' })),
    format: t.Optional(t.String({ description: 'Filter by format e.g. app, activity, or comma-separated' })),
    mediaFormat: t.Optional(t.String({ description: 'Filter by media format' })),
    genre: t.Optional(t.String({ description: 'Filter by genre(s) comma-separated' })),
    year: t.Optional(t.String({ description: 'Filter by release year(s) comma-separated' })),
    mediaStatus: t.Optional(t.String({ description: 'Filter by media status(es) comma-separated' })),
    sortBy: t.Optional(t.String({ description: 'Sort field (updatedAt, createdAt, score, progress, title)' })),
    order: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')], { default: 'desc' })),
    q: t.Optional(t.String({ description: 'Search title within list' })),
    userId: t.Optional(t.String({ description: 'Target user ID (for public profile lists)' })),
  }),

  // --- Stats / Filters Query Schema ---
  statsQuery: t.Optional(
    t.Object({
      userId: t.Optional(t.String({ description: 'Target user ID' })),
      year: t.Optional(t.Numeric({ description: 'Filter year e.g. 2026' })),
      quarter: t.Optional(t.Numeric({ minimum: 1, maximum: 4, description: 'Filter quarter 1-4' })),
      month: t.Optional(t.Numeric({ minimum: 1, maximum: 12, description: 'Filter month 1-12' })),
    })
  ),

  // --- Mutation Body Schemas ---
  animeBody: t.Object({
    status: t.Optional(ListStatusSchema),
    progress: t.Optional(t.Number({ minimum: 0, description: 'Episodes watched' })),
    score: t.Optional(t.Nullable(t.Number({ minimum: 0, maximum: 10, description: 'Rating score (0-10)' }))),
    notes: t.Optional(t.Nullable(t.String({ description: 'Personal notes' }))),
    rewatched: t.Optional(t.Number({ minimum: 0, description: 'Rewatch count' })),
    private: t.Optional(t.Boolean({ default: false, description: 'Private entry' })),
    startedAt: t.Optional(t.Nullable(t.String({ description: 'Start date ISO string' }))),
    completedAt: t.Optional(t.Nullable(t.String({ description: 'Completion date ISO string' }))),
    rewatchHistory: t.Optional(t.Any()),
    connections: t.Optional(t.Any()),
  }),

  animeIncrementBody: t.Optional(
    t.Object({
      count: t.Optional(t.Number({ default: 1, minimum: 1, description: 'Number of episodes to increment by' })),
      status: t.Optional(ListStatusSchema),
      connections: t.Optional(t.Any({ description: 'Optional connection overrides' })),
    })
  ),

  mangaBody: t.Object({
    status: t.Optional(ListStatusSchema),
    chaptersProgress: t.Optional(t.Number({ minimum: 0, description: 'Chapters read' })),
    volumesProgress: t.Optional(t.Number({ minimum: 0, description: 'Volumes read' })),
    score: t.Optional(t.Nullable(t.Number({ minimum: 0, maximum: 10, description: 'Rating score (0-10)' }))),
    notes: t.Optional(t.Nullable(t.String({ description: 'Personal notes' }))),
    reread: t.Optional(t.Number({ minimum: 0, description: 'Reread count' })),
    private: t.Optional(t.Boolean({ default: false, description: 'Private entry' })),
    startedAt: t.Optional(t.Nullable(t.String({ description: 'Start date ISO string' }))),
    completedAt: t.Optional(t.Nullable(t.String({ description: 'Completion date ISO string' }))),
    rereadHistory: t.Optional(t.Any()),
    connections: t.Optional(t.Any()),
  }),

  mangaIncrementBody: t.Optional(
    t.Object({
      count: t.Optional(t.Number({ default: 1, minimum: 1, description: 'Number of chapters/volumes to increment by' })),
      type: t.Optional(t.Union([t.Literal('chapter'), t.Literal('volume')], { default: 'chapter', description: 'Progress type' })),
      status: t.Optional(ListStatusSchema),
      connections: t.Optional(t.Any({ description: 'Optional connection overrides' })),
    })
  ),

  movieBody: t.Object({
    status: t.Optional(ListStatusSchema),
    score: t.Optional(t.Nullable(t.Number({ minimum: 0, maximum: 10, description: 'Rating score (0-10)' }))),
    notes: t.Optional(t.Nullable(t.String({ description: 'Personal notes' }))),
    rewatched: t.Optional(t.Number({ minimum: 0, description: 'Rewatch count' })),
    private: t.Optional(t.Boolean({ default: false, description: 'Private entry' })),
    startedAt: t.Optional(t.Nullable(t.String({ description: 'Start date ISO string' }))),
    completedAt: t.Optional(t.Nullable(t.String({ description: 'Completion date ISO string' }))),
    rewatchHistory: t.Optional(t.Any()),
    connections: t.Optional(t.Any()),
  }),

  movieIncrementBody: t.Optional(
    t.Object({
      count: t.Optional(t.Number({ default: 1, minimum: 1, description: 'Number of rewatches to increment by' })),
      connections: t.Optional(t.Any({ description: 'Optional connection overrides' })),
    })
  ),

  tvBody: t.Object({
    status: t.Optional(ListStatusSchema),
    progress: t.Optional(t.Number({ minimum: 0, description: 'Episodes watched' })),
    score: t.Optional(t.Nullable(t.Number({ minimum: 0, maximum: 10, description: 'Rating score (0-10)' }))),
    notes: t.Optional(t.Nullable(t.String({ description: 'Personal notes' }))),
    rewatched: t.Optional(t.Number({ minimum: 0, description: 'Rewatch count' })),
    private: t.Optional(t.Boolean({ default: false, description: 'Private entry' })),
    startedAt: t.Optional(t.Nullable(t.String({ description: 'Start date ISO string' }))),
    completedAt: t.Optional(t.Nullable(t.String({ description: 'Completion date ISO string' }))),
    rewatchHistory: t.Optional(t.Any()),
    connections: t.Optional(t.Any()),
  }),

  tvIncrementBody: t.Optional(
    t.Object({
      count: t.Optional(t.Number({ default: 1, minimum: 1, description: 'Number of episodes to increment by' })),
      status: t.Optional(ListStatusSchema),
      connections: t.Optional(t.Any({ description: 'Optional connection overrides' })),
    })
  ),

  gameBody: t.Object({
    status: t.Optional(ListStatusSchema),
    progress: t.Optional(t.Number({ minimum: 0, description: 'Hours or playtime progress' })),
    score: t.Optional(t.Nullable(t.Number({ minimum: 0, maximum: 10, description: 'Rating score (0-10)' }))),
    notes: t.Optional(t.Nullable(t.String({ description: 'Personal notes' }))),
    replayed: t.Optional(t.Number({ minimum: 0, description: 'Replayed count' })),
    private: t.Optional(t.Boolean({ default: false, description: 'Private entry' })),
    startedAt: t.Optional(t.Nullable(t.String({ description: 'Start date ISO string' }))),
    completedAt: t.Optional(t.Nullable(t.String({ description: 'Completion date ISO string' }))),
    replayHistory: t.Optional(t.Any()),
    connections: t.Optional(t.Any()),
  }),

  gameIncrementBody: t.Optional(
    t.Object({
      count: t.Optional(t.Number({ default: 1, minimum: 1, description: 'Number of hours to increment by' })),
      status: t.Optional(ListStatusSchema),
      connections: t.Optional(t.Any({ description: 'Optional connection overrides' })),
    })
  ),

  bookBody: t.Object({
    status: t.Optional(ListStatusSchema),
    progressPages: t.Optional(t.Number({ minimum: 0, description: 'Pages read' })),
    progressChapters: t.Optional(t.Number({ minimum: 0, description: 'Chapters read' })),
    progressVolumes: t.Optional(t.Number({ minimum: 0, description: 'Volumes read' })),
    score: t.Optional(t.Nullable(t.Number({ minimum: 0, maximum: 10, description: 'Rating score (0-10)' }))),
    notes: t.Optional(t.Nullable(t.String({ description: 'Personal notes' }))),
    reread: t.Optional(t.Number({ minimum: 0, description: 'Reread count' })),
    private: t.Optional(t.Boolean({ default: false, description: 'Private entry' })),
    startedAt: t.Optional(t.Nullable(t.String({ description: 'Start date ISO string' }))),
    completedAt: t.Optional(t.Nullable(t.String({ description: 'Completion date ISO string' }))),
    rereadHistory: t.Optional(t.Any()),
    connections: t.Optional(t.Any()),
  }),

  bookIncrementBody: t.Optional(
    t.Object({
      count: t.Optional(t.Number({ default: 1, minimum: 1, description: 'Number of pages/chapters to increment by' })),
      type: t.Optional(t.Union([t.Literal('page'), t.Literal('chapter'), t.Literal('volume')], { default: 'page', description: 'Progress type' })),
      status: t.Optional(ListStatusSchema),
      connections: t.Optional(t.Any({ description: 'Optional connection overrides' })),
    })
  ),

  musicBody: t.Object({
    status: t.Optional(ListStatusSchema),
    score: t.Optional(t.Nullable(t.Number({ minimum: 0, maximum: 10, description: 'Rating score (0-10)' }))),
    playCount: t.Optional(t.Number({ minimum: 0, description: 'Number of times listened' })),
    notes: t.Optional(t.Nullable(t.String({ description: 'Personal notes' }))),
    private: t.Optional(t.Boolean({ default: false, description: 'Private entry' })),
    startedAt: t.Optional(t.Nullable(t.String({ description: 'Start date ISO string' }))),
    completedAt: t.Optional(t.Nullable(t.String({ description: 'Completion date ISO string' }))),
    connections: t.Optional(t.Any()),
  }),

  musicIncrementBody: t.Optional(
    t.Object({
      count: t.Optional(t.Number({ default: 1, minimum: 1, description: 'Number of listens to increment by' })),
      connections: t.Optional(t.Any({ description: 'Optional connection overrides' })),
    })
  ),

  otherBody: t.Object({
    status: t.Optional(ListStatusSchema),
    progress: t.Optional(t.Number({ minimum: 0, description: 'Single progress value for backwards-compat' })),
    progressValues: t.Optional(t.Any({ description: 'Key-value map of progress values: { [fieldKey]: number }' })),
    score: t.Optional(t.Nullable(t.Number({ minimum: 0, maximum: 10, description: 'Rating score (0-10)' }))),
    notes: t.Optional(t.Nullable(t.String({ description: 'Personal notes' }))),
    private: t.Optional(t.Boolean({ default: false, description: 'Private entry' })),
    startedAt: t.Optional(t.Nullable(t.String({ description: 'Start date ISO string' }))),
    completedAt: t.Optional(t.Nullable(t.String({ description: 'Completion date ISO string' }))),
  }),

  otherIncrementBody: t.Optional(
    t.Object({
      count: t.Optional(t.Number({ default: 1, minimum: 1, description: 'Increment count' })),
      status: t.Optional(ListStatusSchema),
      connections: t.Optional(t.Any({ description: 'Optional connection overrides' })),
    })
  ),

  // --- Response Schemas ---
  listResponse: t.Object({
    success: t.Boolean(),
    items: t.Array(
      t.Object({
        entry: t.Any({ description: 'User list entry record' }),
        media: t.Any({ description: 'Catalog media details' }),
      })
    ),
    pagination: PaginationMetaSchema,
  }),

  singleResponse: t.Object({
    success: t.Boolean(),
    inList: t.Boolean(),
    entry: t.Nullable(t.Any({ description: 'List entry data or null if not in list' })),
    media: t.Optional(t.Nullable(t.Any({ description: 'Associated media metadata' }))),
  }),

  upsertResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
    entry: t.Any({ description: 'Created or updated list entry' }),
  }),

  deleteResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
  }),

  statsResponse: t.Object({
    success: t.Boolean(),
    stats: t.Optional(
      t.Object({
        total: t.Number({ description: 'Total items in user list' }),
        statusCounts: t.Record(t.String(), t.Number(), { description: 'Counts grouped by list status' }),
        meanScore: t.Number({ description: 'Average score of scored entries' }),
        totalProgress: t.Number({ description: 'Cumulative progress (episodes, chapters, hours, pages, or plays)' }),
        scoreDistribution: t.Array(
          t.Object({
            score: t.Number(),
            count: t.Number(),
          }),
          { description: 'Score distribution histogram' }
        ),
        formatCounts: t.Optional(t.Record(t.String(), t.Number())),
      })
    ),
    data: t.Optional(t.Any({ description: 'Detailed individual media stats' })),
  }),

  filtersResponse: t.Object({
    success: t.Boolean(),
    statuses: t.Array(t.Object({ value: t.String(), count: t.Number() })),
    formats: t.Array(t.Object({ value: t.String(), count: t.Number() })),
    mediaStatuses: t.Optional(t.Array(t.Object({ value: t.String(), count: t.Number() }))),
    genres: t.Array(t.Object({ value: t.String(), count: t.Number() })),
    years: t.Array(t.Object({ value: t.Number(), count: t.Number() })),
  }),

  // --- Global List Operations Schemas ---
  exportQuery: t.Optional(
    t.Object({
      format: t.Optional(t.String({ default: 'iris-json', description: 'Export format: iris-json' })),
      types: t.Optional(t.String({ description: 'Comma-separated media types e.g. anime,manga,tv,movie,game,book,music,custom_lists' })),
    })
  ),

  exportResponse: t.Object({
    success: t.Boolean(),
    version: t.String(),
    exportedAt: t.String(),
    source: t.String(),
    username: t.String(),
    lists: t.Object({
      anime: t.Optional(t.Array(t.Any())),
      manga: t.Optional(t.Array(t.Any())),
      tv: t.Optional(t.Array(t.Any())),
      movie: t.Optional(t.Array(t.Any())),
      game: t.Optional(t.Array(t.Any())),
      book: t.Optional(t.Array(t.Any())),
      music: t.Optional(t.Array(t.Any())),
      customLists: t.Optional(t.Array(t.Any())),
    }),
  }),

  // --- Export Shares Schemas ---
  listSharesResponse: t.Object({
    success: t.Boolean(),
    shares: t.Array(
      t.Object({
        id: t.String(),
        description: t.Nullable(t.String()),
        mediaTypes: t.Array(t.String()),
        createdAt: t.String(),
        expiresAt: t.Nullable(t.String()),
        lastUsedAt: t.Nullable(t.String()),
        isExpired: t.Boolean(),
      })
    ),
  }),

  createShareBody: t.Object({
    password: t.String({ minLength: 4 }),
    mediaTypes: t.Array(t.String(), { minItems: 1 }),
    description: t.Optional(t.String()),
    expiresInHours: t.Optional(t.Nullable(t.Number())),
  }),

  createShareResponse: t.Object({
    success: t.Boolean(),
    shareId: t.String(),
    expiresAt: t.Nullable(t.String()),
  }),

  revokeShareParam: t.Object({
    shareId: t.String({ minLength: 1 }),
  }),

  revokeShareResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
  }),

  importBody: t.Object({
    items: t.Optional(
      t.Array(
        t.Object({
          mediaType: t.Union([
            t.Literal('anime'),
            t.Literal('manga'),
            t.Literal('tv'),
            t.Literal('movie'),
            t.Literal('game'),
            t.Literal('book'),
            t.Literal('music'),
            t.Literal('custom_lists'),
          ]),
          title: t.String(),
          externalIds: t.Optional(t.Record(t.String(), t.Any())),
          status: t.String(),
          progress: t.Optional(t.Number()),
          progressVolumes: t.Optional(t.Nullable(t.Number())),
          progressPages: t.Optional(t.Nullable(t.Number())),
          progressChapters: t.Optional(t.Nullable(t.Number())),
          score: t.Optional(t.Nullable(t.Number())),
          notes: t.Optional(t.Nullable(t.String())),
          rewatched: t.Optional(t.Number()),
          reread: t.Optional(t.Number()),
          replayed: t.Optional(t.Number()),
          playCount: t.Optional(t.Number()),
          private: t.Optional(t.Boolean()),
          startedAt: t.Optional(t.Nullable(t.String())),
          completedAt: t.Optional(t.Nullable(t.String())),
          connections: t.Optional(t.Any()),
          customListName: t.Optional(t.String()),
          customNotes: t.Optional(t.Nullable(t.String())),
          order: t.Optional(t.Number()),
        })
      )
    ),
    lists: t.Optional(t.Any({ description: 'Full exported lists object from IRIS JSON backup' })),
    skipExisting: t.Optional(t.Boolean({ default: false, description: 'Skip items that already exist in list' })),
  }),

  importResponse: t.Object({
    success: t.Boolean(),
    imported: t.Number(),
    updated: t.Number(),
    skipped: t.Number(),
    queued: t.Number(),
    total: t.Number(),
  }),

  fetchRemoteBody: t.Object({
    url: t.String({ description: 'Remote IRIS export URL' }),
    password: t.Optional(t.String({ description: 'Password for the remote export share' })),
  }),

  fetchRemoteResponse: t.Object({
    success: t.Boolean(),
    data: t.Any(),
  }),

  globalStatsQuery: t.Optional(
    t.Object({
      year: t.Optional(t.Numeric({ description: 'Filter year e.g. 2026' })),
      quarter: t.Optional(t.Numeric({ minimum: 1, maximum: 4, description: 'Filter quarter 1-4' })),
      month: t.Optional(t.Numeric({ minimum: 1, maximum: 12, description: 'Filter month 1-12' })),
      userId: t.Optional(t.String({ description: 'Target user ID' })),
    })
  ),

  globalStatsResponse: t.Object({
    success: t.Boolean(),
    data: t.Object({
      isPeriodFiltered: t.Boolean(),
      period: t.Optional(
        t.Nullable(
          t.Object({
            year: t.Optional(t.Number()),
            quarter: t.Optional(t.Number()),
            month: t.Optional(t.Number()),
          })
        )
      ),
      overview: t.Object({
        totalTitles: t.Number(),
        completedTitles: t.Number(),
        planningCount: t.Number(),
        totalTimeMinutes: t.Number(),
        daysConsumed: t.Number(),
        daysPlanned: t.Number(),
        meanScore: t.Number(),
        standardDeviation: t.Number(),
        scoredCount: t.Number(),
      }),
      mediaBreakdown: t.Array(
        t.Object({
          mediaType: t.String(),
          count: t.Number(),
          hours: t.Number(),
          percentage: t.Number(),
        })
      ),
      statusDistribution: t.Array(
        t.Object({
          name: t.String(),
          count: t.Number(),
          percentage: t.Number(),
        })
      ),
      scoreDistribution: t.Object({
        scores: t.Array(
          t.Object({
            score: t.Number(),
            count: t.Number(),
          })
        ),
        unratedCount: t.Number(),
      }),
      activityYearGraph: t.Array(
        t.Object({
          year: t.Number(),
          titles: t.Number(),
          meanScore: t.Number(),
          hours: t.Number(),
        })
      ),
      topGenres: t.Array(
        t.Object({
          genre: t.String(),
          count: t.Number(),
          meanScore: t.Number(),
          hours: t.Number(),
        })
      ),
      monthlyActivity: t.Array(
        t.Object({
          year: t.Number(),
          month: t.Number(),
          count: t.Number(),
        })
      ),
    }),
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
  }, { description: 'Authentication required' }),

  notFoundError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("not-found")' }),
    title: t.String({ description: 'Short summary ("Not Found")' }),
    status: t.Literal(404, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed missing resource explanation' }),
    code: t.String({ description: 'Machine-readable token ("not-found")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Resource or entry not found' }),

  validationError: t.Object({
    type: t.String({ description: 'Slug identifying validation failure ("validation")' }),
    title: t.String({ description: 'Short summary ("Unprocessable Content")' }),
    status: t.Literal(422, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Field validation error details from TypeBox schema validator' }),
    code: t.String({ description: 'Machine-readable token ("validation")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Request payload validation failed' }),
} as const

export type BorealisListsModel = {
  [k in keyof typeof BorealisListsModel]: UnwrapSchema<(typeof BorealisListsModel)[k]>
}
