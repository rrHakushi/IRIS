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

export const BorealisPlaylistsModel = {
  // Shared pagination schema
  paginationMeta: PaginationMetaSchema,

  // --- Path Parameter Schemas ---
  playlistParam: t.Object({
    playlistId: t.String({
      minLength: 1,
      description: 'Playlist / Custom List unique ID (UUID)',
    }),
  }),

  // Shared playlist item representation
  playlistItem: t.Object({
    id: t.String({ description: 'Playlist ID (UUID)' }),
    userId: t.String({ description: 'Owner user ID (UUID)' }),
    name: t.String({ description: 'Playlist name' }),
    description: t.Nullable(t.String({ description: 'Playlist description' })),
    isDefault: t.Boolean({ description: 'Whether list is default system list' }),
    isPrivate: t.Boolean({ description: 'Whether playlist is private to the owner' }),
    coverImage: t.Nullable(t.String({ description: 'Cover image URL or URI' })),
    order: t.Number({ description: 'Sorting order value' }),
    entriesCount: t.Number({ description: 'Total entries count in this playlist' }),
    createdAt: t.String({ description: 'Creation ISO timestamp' }),
    updatedAt: t.String({ description: 'Last update ISO timestamp' }),
  }),

  // --- GET /borealis/playlists (Get user custom playlists) ---
  listPlaylistsQuery: t.Object({
    page: t.Optional(t.Numeric({ default: 1, minimum: 1, description: 'Page number' })),
    limit: t.Optional(t.Numeric({ default: 20, minimum: 1, maximum: 100, description: 'Playlists per page' })),
    q: t.Optional(t.String({ description: 'Search playlist by name' })),
    isPrivate: t.Optional(t.Boolean({ description: 'Filter by privacy flag' })),
  }),

  listPlaylistsResponse: t.Object({
    success: t.Boolean(),
    playlists: t.Array(
      t.Object({
        id: t.String(),
        userId: t.String(),
        name: t.String(),
        description: t.Nullable(t.String()),
        isDefault: t.Boolean(),
        isPrivate: t.Boolean(),
        coverImage: t.Nullable(t.String()),
        order: t.Number(),
        entriesCount: t.Number(),
        createdAt: t.String(),
        updatedAt: t.String(),
      })
    ),
    pagination: PaginationMetaSchema,
  }),

  // --- POST /borealis/playlists (Create new playlist) ---
  createPlaylistBody: t.Object({
    name: t.String({
      minLength: 1,
      maxLength: 100,
      description: 'Playlist title',
    }),
    description: t.Optional(t.Nullable(t.String({ description: 'Optional playlist description' }))),
    isPrivate: t.Optional(t.Boolean({ default: false, description: 'Whether playlist is private' })),
    coverImage: t.Optional(t.Nullable(t.String({ description: 'Cover image URL' }))),
    order: t.Optional(t.Number({ default: 0, description: 'Sort order position' })),
  }),

  createPlaylistResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
    playlist: t.Object({
      id: t.String(),
      userId: t.String(),
      name: t.String(),
      description: t.Nullable(t.String()),
      isDefault: t.Boolean(),
      isPrivate: t.Boolean(),
      coverImage: t.Nullable(t.String()),
      order: t.Number(),
      entriesCount: t.Number(),
      createdAt: t.String(),
      updatedAt: t.String(),
    }),
  }),

  // --- PATCH /borealis/playlists/:playlistId (Update playlist details) ---
  updatePlaylistBody: t.Object({
    name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
    description: t.Optional(t.Nullable(t.String())),
    isPrivate: t.Optional(t.Boolean()),
    coverImage: t.Optional(t.Nullable(t.String())),
    order: t.Optional(t.Number()),
  }),

  updatePlaylistResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
    playlist: t.Object({
      id: t.String(),
      userId: t.String(),
      name: t.String(),
      description: t.Nullable(t.String()),
      isDefault: t.Boolean(),
      isPrivate: t.Boolean(),
      coverImage: t.Nullable(t.String()),
      order: t.Number(),
      entriesCount: t.Number(),
      createdAt: t.String(),
      updatedAt: t.String(),
    }),
  }),

  // --- DELETE /borealis/playlists/:playlistId (Delete playlist) ---
  deletePlaylistResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
  }),

  // --- GET /borealis/playlists/:playlistId/entries (Get playlist entries) ---
  getEntriesQuery: t.Object({
    page: t.Optional(t.Numeric({ default: 1, minimum: 1, description: 'Page number' })),
    limit: t.Optional(t.Numeric({ default: 40, minimum: 1, maximum: 100, description: 'Entries per page' })),
    mediaType: t.Optional(t.String({ description: 'Filter by mediaType (ANIME, MANGA, MOVIE, TV, GAME, BOOK, MUSIC)' })),
    q: t.Optional(t.String({ description: 'Search entries by title or custom notes' })),
    sortBy: t.Optional(t.String({ description: 'Sort field (order, addedAt, title)' })),
    order: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')], { default: 'asc' })),
  }),

  getEntriesResponse: t.Object({
    success: t.Boolean(),
    playlist: t.Object({
      id: t.String(),
      name: t.String(),
      description: t.Nullable(t.String()),
      isPrivate: t.Boolean(),
      coverImage: t.Nullable(t.String()),
      entriesCount: t.Number(),
    }),
    items: t.Array(
      t.Object({
        entry: t.Object({
          id: t.String({ description: 'Entry UUID' }),
          listId: t.String({ description: 'Playlist UUID' }),
          mediaType: t.String({ description: 'Media type enum' }),
          mediaId: t.Number({ description: 'Media ID' }),
          order: t.Number({ description: 'Entry sort order' }),
          customNotes: t.Nullable(t.String({ description: 'User custom notes' })),
          addedAt: t.String({ description: 'Addition ISO timestamp' }),
        }),
        media: t.Optional(t.Nullable(t.Any({ description: 'Media details' }))),
      })
    ),
    pagination: PaginationMetaSchema,
  }),

  // --- POST /borealis/playlists/:playlistId/entries (Add entry to playlist) ---
  addEntryBody: t.Object({
    mediaType: t.String({
      description: 'Media type (ANIME, MANGA, MOVIE, TV, GAME, BOOK, MUSIC, MUSIC_ALBUM, MUSIC_TRACK, OTHER)',
    }),
    mediaId: t.Number({
      minimum: 1,
      description: 'Media catalog ID',
    }),
    order: t.Optional(t.Number({ description: 'Optional explicit order index' })),
    customNotes: t.Optional(t.Nullable(t.String({ description: 'Personal notes for this playlist item' }))),
  }),

  addEntryResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
    entry: t.Object({
      id: t.String(),
      listId: t.String(),
      mediaType: t.String(),
      mediaId: t.Number(),
      order: t.Number(),
      customNotes: t.Nullable(t.String()),
      addedAt: t.String(),
    }),
  }),

  // --- PATCH /borealis/playlists/:playlistId/entries (Update entry in playlist) ---
  updateEntryBody: t.Object({
    id: t.Optional(t.String({ description: 'Entry unique ID (UUID)' })),
    mediaType: t.Optional(t.String({ description: 'Media type enum' })),
    mediaId: t.Optional(t.Number({ minimum: 1, description: 'Media ID' })),
    order: t.Optional(t.Number({ description: 'Updated order position' })),
    customNotes: t.Optional(t.Nullable(t.String({ description: 'Updated custom notes' }))),
    reorder: t.Optional(
      t.Array(
        t.Object({
          id: t.String({ description: 'Entry UUID' }),
          order: t.Number({ description: 'New order position' }),
        }),
        { description: 'Batch reorder entries in playlist' }
      )
    ),
  }),

  updateEntryResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
    entry: t.Optional(t.Nullable(t.Any())),
  }),

  // --- DELETE /borealis/playlists/:playlistId/entries (Remove entry from playlist) ---
  removeEntryBody: t.Optional(
    t.Object({
      id: t.Optional(t.String({ description: 'Entry UUID' })),
      mediaType: t.Optional(t.String({ description: 'Media type' })),
      mediaId: t.Optional(t.Number({ minimum: 1, description: 'Media ID' })),
    })
  ),

  removeEntryQuery: t.Object({
    id: t.Optional(t.String({ description: 'Entry UUID' })),
    mediaType: t.Optional(t.String({ description: 'Media type' })),
    mediaId: t.Optional(t.Numeric({ minimum: 1, description: 'Media ID' })),
  }),

  removeEntryResponse: t.Object({
    success: t.Boolean(),
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
  }, { description: 'Authentication required' }),

  forbiddenError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("forbidden")' }),
    title: t.String({ description: 'Short summary ("Forbidden")' }),
    status: t.Literal(403, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed forbidden explanation' }),
    code: t.String({ description: 'Machine-readable token ("forbidden")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Access to playlist denied' }),

  notFoundError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("not-found")' }),
    title: t.String({ description: 'Short summary ("Not Found")' }),
    status: t.Literal(404, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed missing resource explanation' }),
    code: t.String({ description: 'Machine-readable token ("not-found")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Playlist or entry not found' }),

  validationError: t.Object({
    type: t.String({ description: 'Slug identifying validation failure ("validation")' }),
    title: t.String({ description: 'Short summary ("Unprocessable Content")' }),
    status: t.Literal(422, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Field validation error details from TypeBox schema validator' }),
    code: t.String({ description: 'Machine-readable token ("validation")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Request payload validation failed' }),
} as const

export type BorealisPlaylistsModel = {
  [k in keyof typeof BorealisPlaylistsModel]: UnwrapSchema<(typeof BorealisPlaylistsModel)[k]>
}
