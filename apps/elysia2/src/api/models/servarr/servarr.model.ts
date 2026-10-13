import { t, type UnwrapSchema } from 'elysia'

export const ServarrModel = {
  appParam: t.Object({
    app: t.Union([t.Literal('radarr'), t.Literal('sonarr')], {
      description: 'Servarr application (radarr or sonarr)',
    }),
  }),

  // ===========================================================================
  // 1. Blocklist
  // ===========================================================================
  blocklistQuery: t.Optional(
    t.Object({
      page: t.Optional(t.Numeric()),
      pageSize: t.Optional(t.Numeric()),
      sortKey: t.Optional(t.String()),
      sortDirection: t.Optional(
        t.Union([t.Literal('ascending'), t.Literal('descending')])
      ),
    })
  ),

  blocklistResponse: t.Object({
    success: t.Boolean(),
    connected: t.Boolean(),
    provider: t.String(),
    page: t.Optional(t.Number()),
    pageSize: t.Optional(t.Number()),
    totalRecords: t.Optional(t.Number()),
    records: t.Array(t.Any()),
    message: t.Optional(t.String()),
  }),

  deleteBlocklistQuery: t.Optional(
    t.Object({
      id: t.Optional(t.Numeric()),
    })
  ),

  deleteBlocklistBody: t.Optional(
    t.Object({
      ids: t.Optional(t.Array(t.Number())),
    })
  ),

  deleteBlocklistResponse: t.Object({
    success: t.Boolean(),
    connected: t.Boolean(),
    provider: t.String(),
    message: t.Optional(t.String()),
  }),

  // ===========================================================================
  // 2. Command
  // ===========================================================================
  commandBody: t.Object({
    command: t.Optional(
      t.Union([
        t.Literal('refresh'),
        t.Literal('rssSync'),
        t.Literal('searchMissing'),
        t.Literal('custom'),
      ])
    ),
    name: t.Optional(t.String()),
    movieId: t.Optional(t.Number()),
    movieIds: t.Optional(t.Array(t.Number())),
    seriesId: t.Optional(t.Number()),
    seriesIds: t.Optional(t.Array(t.Number())),
    files: t.Optional(t.Array(t.Number())),
    body: t.Optional(t.Record(t.String(), t.Any())),
  }),

  commandResponse: t.Object({
    success: t.Boolean(),
    provider: t.String(),
    command: t.String(),
    message: t.String(),
    data: t.Optional(t.Any()),
  }),

  // ===========================================================================
  // 3. Files
  // ===========================================================================
  filesQuery: t.Optional(
    t.Object({
      movieId: t.Optional(t.Numeric()),
      seriesId: t.Optional(t.Numeric()),
    })
  ),

  filesResponse: t.Object({
    success: t.Boolean(),
    provider: t.String(),
    movieId: t.Optional(t.Number()),
    seriesId: t.Optional(t.Number()),
    files: t.Array(t.Any()),
    message: t.Optional(t.String()),
  }),

  deleteFileQuery: t.Optional(
    t.Object({
      fileId: t.Optional(t.Numeric()),
    })
  ),

  deleteFileBody: t.Optional(
    t.Object({
      fileId: t.Optional(t.Numeric()),
    })
  ),

  deleteFileResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
  }),

  // ===========================================================================
  // 4. History
  // ===========================================================================
  historyQuery: t.Optional(
    t.Object({
      page: t.Optional(t.Numeric()),
      pageSize: t.Optional(t.Numeric()),
      sortKey: t.Optional(t.String()),
      sortDirection: t.Optional(
        t.Union([t.Literal('ascending'), t.Literal('descending')])
      ),
      eventType: t.Optional(t.Numeric()),
      movieId: t.Optional(t.Numeric()),
      seriesId: t.Optional(t.Numeric()),
      episodeId: t.Optional(t.Numeric()),
      downloadId: t.Optional(t.String()),
    })
  ),

  historyResponse: t.Object({
    success: t.Boolean(),
    connected: t.Boolean(),
    provider: t.String(),
    page: t.Optional(t.Number()),
    pageSize: t.Optional(t.Number()),
    totalRecords: t.Optional(t.Number()),
    records: t.Array(t.Any()),
    message: t.Optional(t.String()),
  }),

  // ===========================================================================
  // 5. Indexer
  // ===========================================================================
  indexerResponse: t.Object({
    success: t.Boolean(),
    provider: t.String(),
    indexers: t.Array(t.Any()),
    message: t.Optional(t.String()),
  }),

  // ===========================================================================
  // 6. Library
  // ===========================================================================
  mediaItem: t.Object({
    id: t.Union([t.String(), t.Number()]),
    title: t.String(),
    originalTitle: t.Optional(t.Nullable(t.String())),
    year: t.Optional(t.Nullable(t.Number())),
    overview: t.Optional(t.Nullable(t.String())),
    monitored: t.Boolean(),
    hasFile: t.Optional(t.Boolean()),
    qualityProfile: t.Optional(t.Nullable(t.String())),
    qualityProfileId: t.Optional(t.Nullable(t.Number())),
    sizeOnDisk: t.Optional(t.Nullable(t.Number())),
    status: t.Optional(t.Nullable(t.String())),
    added: t.Optional(t.Nullable(t.String())),
    posterUrl: t.Optional(t.Nullable(t.String())),
    fanartUrl: t.Optional(t.Nullable(t.String())),
    tmdbId: t.Optional(t.Nullable(t.Number())),
    tvdbId: t.Optional(t.Nullable(t.Number())),
    imdbId: t.Optional(t.Nullable(t.String())),
    path: t.Optional(t.Nullable(t.String())),
    genres: t.Optional(t.Nullable(t.Array(t.String()))),
    episodeCount: t.Optional(t.Nullable(t.Number())),
    episodeFileCount: t.Optional(t.Nullable(t.Number())),
    seasonCount: t.Optional(t.Nullable(t.Number())),
  }),

  libraryResponse: t.Object({
    success: t.Boolean(),
    connected: t.Boolean(),
    provider: t.String(),
    hostUrl: t.Optional(t.Nullable(t.String())),
    isLocalFallback: t.Optional(t.Boolean()),
    items: t.Array(
      t.Object({
        id: t.Union([t.String(), t.Number()]),
        title: t.String(),
        originalTitle: t.Optional(t.Nullable(t.String())),
        year: t.Optional(t.Nullable(t.Number())),
        overview: t.Optional(t.Nullable(t.String())),
        monitored: t.Boolean(),
        hasFile: t.Optional(t.Boolean()),
        qualityProfile: t.Optional(t.Nullable(t.String())),
        qualityProfileId: t.Optional(t.Nullable(t.Number())),
        sizeOnDisk: t.Optional(t.Nullable(t.Number())),
        status: t.Optional(t.Nullable(t.String())),
        added: t.Optional(t.Nullable(t.String())),
        posterUrl: t.Optional(t.Nullable(t.String())),
        fanartUrl: t.Optional(t.Nullable(t.String())),
        tmdbId: t.Optional(t.Nullable(t.Number())),
        tvdbId: t.Optional(t.Nullable(t.Number())),
        imdbId: t.Optional(t.Nullable(t.String())),
        path: t.Optional(t.Nullable(t.String())),
        genres: t.Optional(t.Nullable(t.Array(t.String()))),
        episodeCount: t.Optional(t.Nullable(t.Number())),
        episodeFileCount: t.Optional(t.Nullable(t.Number())),
        seasonCount: t.Optional(t.Nullable(t.Number())),
      })
    ),
    totalCount: t.Number(),
    message: t.Optional(t.String()),
  }),

  // ===========================================================================
  // 7. Lookup
  // ===========================================================================
  lookupQuery: t.Optional(
    t.Object({
      term: t.Optional(t.String()),
    })
  ),

  lookupResponse: t.Object({
    success: t.Boolean(),
    connected: t.Boolean(),
    provider: t.String(),
    records: t.Array(t.Any()),
    rootFolders: t.Optional(t.Array(t.Any())),
    qualityProfiles: t.Optional(t.Array(t.Any())),
    message: t.Optional(t.String()),
  }),

  addLookupBody: t.Any(),

  addLookupResponse: t.Object({
    success: t.Boolean(),
    connected: t.Boolean(),
    provider: t.String(),
    movie: t.Optional(t.Any()),
    series: t.Optional(t.Any()),
    data: t.Optional(t.Any()),
    message: t.Optional(t.String()),
  }),

  // ===========================================================================
  // 8. Manage (Batch Update / Delete)
  // ===========================================================================
  managePutBody: t.Object({
    movieIds: t.Optional(t.Array(t.Number())),
    seriesIds: t.Optional(t.Array(t.Number())),
    ids: t.Optional(t.Array(t.Number())),
    monitored: t.Optional(t.Boolean()),
    qualityProfileId: t.Optional(t.Number()),
    minimumAvailability: t.Optional(t.String()),
    seriesType: t.Optional(
      t.Union([
        t.Literal('standard'),
        t.Literal('daily'),
        t.Literal('anime'),
      ])
    ),
    seasonFolder: t.Optional(t.Boolean()),
    rootFolderPath: t.Optional(t.String()),
  }),

  managePutResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
    data: t.Optional(t.Any()),
  }),

  manageDeleteBody: t.Object({
    movieIds: t.Optional(t.Array(t.Number())),
    seriesIds: t.Optional(t.Array(t.Number())),
    ids: t.Optional(t.Array(t.Number())),
    deleteFiles: t.Optional(t.Boolean()),
    addImportListExclusion: t.Optional(t.Boolean()),
  }),

  manageDeleteResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
  }),

  // ===========================================================================
  // 9. Manual Import
  // ===========================================================================
  manualImportQuery: t.Optional(
    t.Object({
      folder: t.Optional(t.String()),
      downloadId: t.Optional(t.String()),
      movieId: t.Optional(t.Numeric()),
      seriesId: t.Optional(t.Numeric()),
      filterExistingFiles: t.Optional(t.Boolean()),
    })
  ),

  manualImportResponse: t.Object({
    success: t.Boolean(),
    provider: t.String(),
    items: t.Array(t.Any()),
    message: t.Optional(t.String()),
  }),

  manualImportBody: t.Object({
    files: t.Array(t.Any()),
  }),

  executeManualImportResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
    data: t.Optional(t.Any()),
  }),

  // ===========================================================================
  // 10. Queue
  // ===========================================================================
  queueQuery: t.Optional(
    t.Object({
      page: t.Optional(t.Numeric()),
      pageSize: t.Optional(t.Numeric()),
      sortKey: t.Optional(t.String()),
      sortDirection: t.Optional(
        t.Union([t.Literal('ascending'), t.Literal('descending')])
      ),
    })
  ),

  queueResponse: t.Object({
    success: t.Boolean(),
    connected: t.Boolean(),
    provider: t.String(),
    page: t.Optional(t.Number()),
    pageSize: t.Optional(t.Number()),
    totalRecords: t.Optional(t.Number()),
    records: t.Array(t.Any()),
    message: t.Optional(t.String()),
  }),

  deleteQueueQuery: t.Optional(
    t.Object({
      id: t.Optional(t.Numeric()),
      removeFromClient: t.Optional(t.Union([t.Boolean(), t.String()])),
      blocklist: t.Optional(t.Union([t.Boolean(), t.String()])),
      skipRedownload: t.Optional(t.Union([t.Boolean(), t.String()])),
    })
  ),

  deleteQueueBody: t.Optional(
    t.Object({
      id: t.Optional(t.Numeric()),
      removeFromClient: t.Optional(t.Boolean()),
      blocklist: t.Optional(t.Boolean()),
      skipRedownload: t.Optional(t.Boolean()),
    })
  ),

  deleteQueueResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
  }),

  // ===========================================================================
  // 11. Release
  // ===========================================================================
  releaseQuery: t.Optional(
    t.Object({
      movieId: t.Optional(t.Numeric()),
      seriesId: t.Optional(t.Numeric()),
      seasonNumber: t.Optional(t.Numeric()),
      episodeId: t.Optional(t.Numeric()),
      term: t.Optional(t.String()),
      indexerId: t.Optional(t.Numeric()),
    })
  ),

  releaseResponse: t.Object({
    success: t.Boolean(),
    provider: t.String(),
    releases: t.Array(t.Any()),
    message: t.Optional(t.String()),
  }),

  grabReleaseBody: t.Object({
    guid: t.Optional(t.String()),
    indexerId: t.Optional(t.Number()),
    title: t.Optional(t.String()),
    downloadUrl: t.Optional(t.String()),
    protocol: t.Optional(t.String()),
    publishDate: t.Optional(t.String()),
  }),

  grabReleaseResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
    data: t.Optional(t.Any()),
  }),

  // ===========================================================================
  // 12. Rename
  // ===========================================================================
  renameQuery: t.Optional(
    t.Object({
      movieId: t.Optional(t.Numeric()),
      seriesId: t.Optional(t.Numeric()),
      seasonNumber: t.Optional(t.Numeric()),
    })
  ),

  renameResponse: t.Object({
    success: t.Boolean(),
    connected: t.Boolean(),
    provider: t.String(),
    records: t.Array(t.Any()),
    message: t.Optional(t.String()),
  }),

  renameBody: t.Object({
    movieId: t.Optional(t.Number()),
    seriesId: t.Optional(t.Number()),
    files: t.Array(t.Number()),
  }),

  executeRenameResponse: t.Object({
    success: t.Boolean(),
    connected: t.Boolean(),
    provider: t.String(),
    message: t.Optional(t.String()),
  }),

  // ===========================================================================
  // 13. Wanted (Cutoff & Missing)
  // ===========================================================================
  wantedQuery: t.Optional(
    t.Object({
      page: t.Optional(t.Numeric()),
      pageSize: t.Optional(t.Numeric()),
      sortKey: t.Optional(t.String()),
      sortDirection: t.Optional(
        t.Union([t.Literal('ascending'), t.Literal('descending')])
      ),
      monitored: t.Optional(t.Union([t.Boolean(), t.String()])),
    })
  ),

  wantedResponse: t.Object({
    success: t.Boolean(),
    connected: t.Boolean(),
    provider: t.String(),
    page: t.Optional(t.Number()),
    pageSize: t.Optional(t.Number()),
    totalRecords: t.Optional(t.Number()),
    records: t.Array(t.Any()),
    message: t.Optional(t.String()),
  }),

  // ===========================================================================
  // 14. Radarr Specific (Movies & Feeds)
  // ===========================================================================
  idParam: t.Object({
    id: t.Numeric({ description: 'Resource ID' }),
  }),

  radarrMovieFeedItem: t.Object({
    title: t.String(),
    tmdbId: t.Optional(t.Number()),
    imdbId: t.Optional(t.String()),
    year: t.Optional(t.Number()),
    monitored: t.Boolean(),
    hasFile: t.Boolean(),
  }),

  radarrMoviesFeedResponse: t.Array(
    t.Object({
      title: t.String(),
      tmdbId: t.Optional(t.Number()),
      imdbId: t.Optional(t.String()),
      year: t.Optional(t.Number()),
      monitored: t.Boolean(),
      hasFile: t.Boolean(),
    })
  ),

  radarrMovieDetailResponse: t.Object({
    success: t.Boolean(),
    connected: t.Boolean(),
    provider: t.String(),
    movie: t.Optional(t.Any()),
    files: t.Optional(t.Array(t.Any())),
    message: t.Optional(t.String()),
  }),

  radarrMovieUpdateBody: t.Any(),

  radarrMovieUpdateResponse: t.Object({
    success: t.Boolean(),
    connected: t.Boolean(),
    provider: t.String(),
    movie: t.Optional(t.Any()),
    message: t.Optional(t.String()),
  }),

  deleteItemQuery: t.Optional(
    t.Object({
      deleteFiles: t.Optional(t.Union([t.Boolean(), t.String()])),
      addImportListExclusion: t.Optional(t.Union([t.Boolean(), t.String()])),
    })
  ),

  deleteItemBody: t.Optional(
    t.Object({
      deleteFiles: t.Optional(t.Boolean()),
      addImportListExclusion: t.Optional(t.Boolean()),
    })
  ),

  deleteItemResponse: t.Object({
    success: t.Boolean(),
    connected: t.Boolean(),
    provider: t.String(),
    message: t.Optional(t.String()),
  }),

  qualityProfileResponse: t.Array(
    t.Object({
      id: t.Number(),
      name: t.String(),
    })
  ),

  systemStatusResponse: t.Object({
    version: t.String(),
    appName: t.String(),
  }),

  // ===========================================================================
  // 15. Sonarr Specific (Series, Episodes & Feeds)
  // ===========================================================================
  sonarrSeriesFeedItem: t.Object({
    title: t.String(),
    tvdbId: t.Number(),
    imdbId: t.Optional(t.String()),
    year: t.Optional(t.Number()),
    monitored: t.Boolean(),
    seriesType: t.Union([t.Literal('anime'), t.Literal('standard')]),
    seasonFolder: t.Boolean(),
  }),

  sonarrSeriesFeedResponse: t.Array(
    t.Object({
      title: t.String(),
      tvdbId: t.Number(),
      imdbId: t.Optional(t.String()),
      year: t.Optional(t.Number()),
      monitored: t.Boolean(),
      seriesType: t.Union([t.Literal('anime'), t.Literal('standard')]),
      seasonFolder: t.Boolean(),
    })
  ),

  sonarrSeriesDetailResponse: t.Object({
    success: t.Boolean(),
    connected: t.Boolean(),
    provider: t.String(),
    series: t.Optional(t.Any()),
    episodes: t.Optional(t.Array(t.Any())),
    files: t.Optional(t.Array(t.Any())),
    message: t.Optional(t.String()),
  }),

  sonarrSeriesUpdateBody: t.Any(),

  sonarrSeriesUpdateResponse: t.Object({
    success: t.Boolean(),
    connected: t.Boolean(),
    provider: t.String(),
    series: t.Optional(t.Any()),
    message: t.Optional(t.String()),
  }),

  sonarrEpisodeUpdateBody: t.Any(),

  sonarrEpisodeUpdateResponse: t.Object({
    success: t.Boolean(),
    connected: t.Boolean(),
    provider: t.String(),
    episode: t.Optional(t.Any()),
    message: t.Optional(t.String()),
  }),

  episodeMonitorBody: t.Object({
    episodeIds: t.Array(t.Number()),
    monitored: t.Boolean(),
  }),

  episodeMonitorResponse: t.Object({
    success: t.Boolean(),
    connected: t.Boolean(),
    provider: t.String(),
    message: t.Optional(t.String()),
  }),

  // ===========================================================================
  // Standard Errors
  // ===========================================================================
  unauthorizedError: t.Object(
    {
      type: t.String(),
      title: t.String(),
      status: t.Literal(401),
      detail: t.String(),
      code: t.String(),
      instance: t.Optional(t.String()),
    },
    { description: 'Authentication required' }
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

export const SERVARR_QUALITY_PROFILES: { id: number; name: string }[] = [
  {
    id: 1,
    name: 'Any',
  },
]

export const SERVARR_SYSTEM_STATUS = {
  version: '3.0.0',
  appName: 'IRIS',
}

export type ServarrModel = {
  [k in keyof typeof ServarrModel]: UnwrapSchema<(typeof ServarrModel)[k]>
}

