import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { ServarrModel } from '../../models/servarr/servarr.model'
import { ServarrServ } from '../../../services/servarr/servarr.serv'

export const servarrController = new Elysia({ prefix: '/servarr' })
  .use(session())

  // ===========================================================================
  // 1. Blocklist
  // ===========================================================================

  // GET /servarr/:app/blocklist (Get blocklist entries)
  .get(
    '/:app/blocklist',
    {
      params: ServarrModel.appParam,
      query: ServarrModel.blocklistQuery,
      detail: {
        summary: 'Get blocklist entries',
        description:
          'Fetches blacklisted releases that failed or were manually rejected.',
        tags: ['Servarr - Blocklist'],
      },
      response: {
        200: ServarrModel.blocklistResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { app }, query, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.getBlocklist(app, user.id, query)
    }
  )

  // DELETE /servarr/:app/blocklist (Clear blocklist entries)
  .delete(
    '/:app/blocklist',
    {
      params: ServarrModel.appParam,
      query: ServarrModel.deleteBlocklistQuery,
      body: ServarrModel.deleteBlocklistBody,
      detail: {
        summary: 'Clear blocklist entries',
        description:
          'Removes one or more releases from the blocklist to allow re-downloading.',
        tags: ['Servarr - Blocklist'],
      },
      response: {
        200: ServarrModel.deleteBlocklistResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { app }, query, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.deleteBlocklist(app, user.id, query, body)
    }
  )

  // ===========================================================================
  // 2. Command
  // ===========================================================================

  // POST /servarr/:app/command (Trigger backend command/task)
  .post(
    '/:app/command',
    {
      params: ServarrModel.appParam,
      body: ServarrModel.commandBody,
      detail: {
        summary: 'Trigger backend command/task',
        description:
          'Triggers maintenance commands (Refresh, RssSync, MissingSearch, RenameFiles, etc.).',
        tags: ['Servarr - Command'],
      },
      response: {
        200: ServarrModel.commandResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { app }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.executeCommand(app, user.id, body)
    }
  )

  // ===========================================================================
  // 3. Files
  // ===========================================================================

  // GET /servarr/:app/files (List downloaded media files)
  .get(
    '/:app/files',
    {
      params: ServarrModel.appParam,
      query: ServarrModel.filesQuery,
      detail: {
        summary: 'List downloaded media files',
        description:
          'Fetches downloaded media files and media info for a movie or TV series.',
        tags: ['Servarr - Files'],
      },
      response: {
        200: ServarrModel.filesResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { app }, query, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.getFiles(app, user.id, query)
    }
  )

  // DELETE /servarr/:app/files (Delete downloaded file)
  .delete(
    '/:app/files',
    {
      params: ServarrModel.appParam,
      query: ServarrModel.deleteFileQuery,
      body: ServarrModel.deleteFileBody,
      detail: {
        summary: 'Delete downloaded file',
        description:
          'Deletes a specific movie or episode media file from disk.',
        tags: ['Servarr - Files'],
      },
      response: {
        200: ServarrModel.deleteFileResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { app }, query, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.deleteFile(app, user.id, query, body)
    }
  )

  // ===========================================================================
  // 4. History
  // ===========================================================================

  // GET /servarr/:app/history (Get activity history)
  .get(
    '/:app/history',
    {
      params: ServarrModel.appParam,
      query: ServarrModel.historyQuery,
      detail: {
        summary: 'Get activity history',
        description:
          'Fetches audit log of grab, import, upgrade, and file deletion events.',
        tags: ['Servarr - History'],
      },
      response: {
        200: ServarrModel.historyResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { app }, query, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.getHistory(app, user.id, query)
    }
  )

  // ===========================================================================
  // 5. Indexer
  // ===========================================================================

  // GET /servarr/:app/indexer (List indexers)
  .get(
    '/:app/indexer',
    {
      params: ServarrModel.appParam,
      detail: {
        summary: 'List indexers',
        description: 'Returns configured torrent/usenet indexers.',
        tags: ['Servarr - Indexer'],
      },
      response: {
        200: ServarrModel.indexerResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { app }, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.getIndexers(app, user.id)
    }
  )

  // ===========================================================================
  // 6. Library
  // ===========================================================================

  // GET /servarr/:app/library (Get full media library)
  .get(
    '/:app/library',
    {
      params: ServarrModel.appParam,
      detail: {
        summary: 'Get full media library',
        description:
          'Fetches added media library directly from the connected instance with local database fallback.',
        tags: ['Servarr - Library'],
      },
      response: {
        200: ServarrModel.libraryResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { app }, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.getLibrary(app, user.id)
    }
  )

  // ===========================================================================
  // 7. Lookup
  // ===========================================================================

  // GET /servarr/:app/lookup (Lookup media details ?term=...)
  .get(
    '/:app/lookup',
    {
      params: ServarrModel.appParam,
      query: ServarrModel.lookupQuery,
      detail: {
        summary: 'Lookup media details (?term=...)',
        description:
          'Searches for new media items to add, including root folders and quality profiles.',
        tags: ['Servarr - Lookup'],
      },
      response: {
        200: ServarrModel.lookupResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { app }, query, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.lookup(app, user.id, query)
    }
  )

  // POST /servarr/:app/lookup (Lookup media by external ID / Add media)
  .post(
    '/:app/lookup',
    {
      params: ServarrModel.appParam,
      body: ServarrModel.addLookupBody,
      detail: {
        summary: 'Lookup media by external ID / Add media',
        description: 'Adds a new media item to library.',
        tags: ['Servarr - Lookup'],
      },
      response: {
        200: ServarrModel.addLookupResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { app }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.addMedia(app, user.id, body)
    }
  )

  // ===========================================================================
  // 8. Manage (Batch Update / Delete)
  // ===========================================================================

  // PUT /servarr/:app/manage (Update library items in batch)
  .put(
    '/:app/manage',
    {
      params: ServarrModel.appParam,
      body: ServarrModel.managePutBody,
      detail: {
        summary: 'Update library items in batch',
        description:
          'Mass edits media items (monitored, profile, series type, root folder).',
        tags: ['Servarr - Manage'],
      },
      response: {
        200: ServarrModel.managePutResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { app }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.bulkUpdate(app, user.id, body)
    }
  )

  // DELETE /servarr/:app/manage (Delete library items in batch)
  .delete(
    '/:app/manage',
    {
      params: ServarrModel.appParam,
      body: ServarrModel.manageDeleteBody,
      detail: {
        summary: 'Delete library items in batch',
        description: 'Mass deletes media items from library.',
        tags: ['Servarr - Manage'],
      },
      response: {
        200: ServarrModel.manageDeleteResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { app }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.bulkDelete(app, user.id, body)
    }
  )

  // ===========================================================================
  // 9. Manual Import
  // ===========================================================================

  // GET /servarr/:app/manualimport (Preview files for manual import)
  .get(
    '/:app/manualimport',
    {
      params: ServarrModel.appParam,
      query: ServarrModel.manualImportQuery,
      detail: {
        summary: 'Preview files for manual import',
        description: 'Scans a folder or download for manual importing.',
        tags: ['Servarr - Manual Import'],
      },
      response: {
        200: ServarrModel.manualImportResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { app }, query, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.getManualImport(app, user.id, query)
    }
  )

  // POST /servarr/:app/manualimport (Execute manual import)
  .post(
    '/:app/manualimport',
    {
      params: ServarrModel.appParam,
      body: ServarrModel.manualImportBody,
      detail: {
        summary: 'Execute manual import',
        description: 'Imports selected files into library.',
        tags: ['Servarr - Manual Import'],
      },
      response: {
        200: ServarrModel.executeManualImportResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { app }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.executeManualImport(app, user.id, body)
    }
  )

  // ===========================================================================
  // 10. Queue
  // ===========================================================================

  // GET /servarr/:app/queue (Get active download queue)
  .get(
    '/:app/queue',
    {
      params: ServarrModel.appParam,
      query: ServarrModel.queueQuery,
      detail: {
        summary: 'Get active download queue',
        description: 'Fetches active and queued downloads.',
        tags: ['Servarr - Queue'],
      },
      response: {
        200: ServarrModel.queueResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { app }, query, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.getQueue(app, user.id, query)
    }
  )

  // DELETE /servarr/:app/queue (Remove item from download queue)
  .delete(
    '/:app/queue',
    {
      params: ServarrModel.appParam,
      query: ServarrModel.deleteQueueQuery,
      body: ServarrModel.deleteQueueBody,
      detail: {
        summary: 'Remove item from download queue',
        description: 'Cancels or removes a queued download item.',
        tags: ['Servarr - Queue'],
      },
      response: {
        200: ServarrModel.deleteQueueResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { app }, query, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.deleteQueue(app, user.id, query, body)
    }
  )

  // ===========================================================================
  // 11. Release
  // ===========================================================================

  // GET /servarr/:app/release (Search releases for media)
  .get(
    '/:app/release',
    {
      params: ServarrModel.appParam,
      query: ServarrModel.releaseQuery,
      detail: {
        summary: 'Search releases for media',
        description:
          'Searches indexers for available releases (interactive search).',
        tags: ['Servarr - Release'],
      },
      response: {
        200: ServarrModel.releaseResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { app }, query, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.getReleases(app, user.id, query)
    }
  )

  // POST /servarr/:app/release (Grab specific release)
  .post(
    '/:app/release',
    {
      params: ServarrModel.appParam,
      body: ServarrModel.grabReleaseBody,
      detail: {
        summary: 'Grab specific release',
        description: 'Instructs the application to download a specific release.',
        tags: ['Servarr - Release'],
      },
      response: {
        200: ServarrModel.grabReleaseResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { app }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.grabRelease(app, user.id, body)
    }
  )

  // ===========================================================================
  // 12. Rename
  // ===========================================================================

  // GET /servarr/:app/rename (Preview file rename operations)
  .get(
    '/:app/rename',
    {
      params: ServarrModel.appParam,
      query: ServarrModel.renameQuery,
      detail: {
        summary: 'Preview file rename operations',
        description:
          'Returns preview diff of proposed filename changes for media files.',
        tags: ['Servarr - Rename'],
      },
      response: {
        200: ServarrModel.renameResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { app }, query, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.getRenamePreview(app, user.id, query)
    }
  )

  // POST /servarr/:app/rename (Execute file rename)
  .post(
    '/:app/rename',
    {
      params: ServarrModel.appParam,
      body: ServarrModel.renameBody,
      detail: {
        summary: 'Execute file rename',
        description: 'Applies standard naming conventions to selected files.',
        tags: ['Servarr - Rename'],
      },
      response: {
        200: ServarrModel.executeRenameResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { app }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.executeRename(app, user.id, body)
    }
  )

  // ===========================================================================
  // 13. Wanted (Cutoff & Missing)
  // ===========================================================================

  // GET /servarr/:app/wanted/cutoff (List media not meeting cutoff profile)
  .get(
    '/:app/wanted/cutoff',
    {
      params: ServarrModel.appParam,
      query: ServarrModel.wantedQuery,
      detail: {
        summary: 'List media not meeting cutoff profile',
        description:
          'Fetches media whose file quality is below the profile cutoff.',
        tags: ['Servarr - Wanted'],
      },
      response: {
        200: ServarrModel.wantedResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { app }, query, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.getWantedCutoff(app, user.id, query)
    }
  )

  // GET /servarr/:app/wanted/missing (List missing media items)
  .get(
    '/:app/wanted/missing',
    {
      params: ServarrModel.appParam,
      query: ServarrModel.wantedQuery,
      detail: {
        summary: 'List missing media items',
        description: 'Fetches monitored media that is missing from disk.',
        tags: ['Servarr - Wanted'],
      },
      response: {
        200: ServarrModel.wantedResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { app }, query, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.getWantedMissing(app, user.id, query)
    }
  )

  // ===========================================================================
  // 14. Radarr Specific (Movies & Feeds)
  // ===========================================================================

  // GET /servarr/radarr/movies (List managed movies)
  .get(
    '/radarr/movies',
    {
      detail: {
        summary: 'List managed movies',
        description:
          'Fetches Radarr movie import feed based on user settings and library.',
        tags: ['Servarr - Radarr'],
      },
      response: {
        200: ServarrModel.radarrMoviesFeedResponse,
        401: ServarrModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.getRadarrMoviesFeed(user.id)
    }
  )

  // GET /servarr/radarr/movies/anime (List managed anime movies)
  .get(
    '/radarr/movies/anime',
    {
      detail: {
        summary: 'List managed anime movies',
        description:
          'Fetches Radarr anime movie import feed based on user settings and library.',
        tags: ['Servarr - Radarr'],
      },
      response: {
        200: ServarrModel.radarrMoviesFeedResponse,
        401: ServarrModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.getRadarrAnimeMoviesFeed(user.id)
    }
  )

  // GET /servarr/radarr/movies/anime/api/v3/movie (Raw Radarr Anime v3 movie API proxy)
  .get(
    '/radarr/movies/anime/api/v3/movie',
    {
      detail: {
        summary: 'Raw Radarr Anime v3 movie API proxy',
        description:
          'Emulates Radarr movie endpoint for anime movie import lists.',
        tags: ['Servarr - Radarr'],
      },
      response: {
        200: ServarrModel.radarrMoviesFeedResponse,
        401: ServarrModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.getRadarrAnimeMoviesFeed(user.id)
    }
  )

  // GET /servarr/radarr/movies/anime/api/v3/qualityprofile (Raw Radarr Anime v3 quality profile proxy)
  .get(
    '/radarr/movies/anime/api/v3/qualityprofile',
    {
      detail: {
        summary: 'Raw Radarr Anime v3 quality profile proxy',
        description: 'Returns mock quality profiles for Radarr list validation.',
        tags: ['Servarr - Radarr'],
      },
      response: {
        200: ServarrModel.qualityProfileResponse,
      },
    },
    () => ServarrServ.getQualityProfiles()
  )

  // GET /servarr/radarr/movies/anime/api/v3/system/status (Raw Radarr Anime v3 system status proxy)
  .get(
    '/radarr/movies/anime/api/v3/system/status',
    {
      detail: {
        summary: 'Raw Radarr Anime v3 system status proxy',
        description: 'Returns mock system status for Radarr list validation.',
        tags: ['Servarr - Radarr'],
      },
      response: {
        200: ServarrModel.systemStatusResponse,
      },
    },
    () => ServarrServ.getSystemStatus()
  )

  // GET /servarr/radarr/movies/api/v3/movie (Raw Radarr Standard v3 movie API proxy)
  .get(
    '/radarr/movies/api/v3/movie',
    {
      detail: {
        summary: 'Raw Radarr Standard v3 movie API proxy',
        description:
          'Emulates Radarr movie endpoint for standard movie import lists.',
        tags: ['Servarr - Radarr'],
      },
      response: {
        200: ServarrModel.radarrMoviesFeedResponse,
        401: ServarrModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.getRadarrMoviesFeed(user.id)
    }
  )

  // GET /servarr/radarr/movies/api/v3/qualityprofile (Raw Radarr Standard v3 quality profile proxy)
  .get(
    '/radarr/movies/api/v3/qualityprofile',
    {
      detail: {
        summary: 'Raw Radarr Standard v3 quality profile proxy',
        description: 'Returns mock quality profiles for Radarr list validation.',
        tags: ['Servarr - Radarr'],
      },
      response: {
        200: ServarrModel.qualityProfileResponse,
      },
    },
    () => ServarrServ.getQualityProfiles()
  )

  // GET /servarr/radarr/movies/api/v3/system/status (Raw Radarr Standard v3 system status proxy)
  .get(
    '/radarr/movies/api/v3/system/status',
    {
      detail: {
        summary: 'Raw Radarr Standard v3 system status proxy',
        description: 'Returns mock system status for Radarr list validation.',
        tags: ['Servarr - Radarr'],
      },
      response: {
        200: ServarrModel.systemStatusResponse,
      },
    },
    () => ServarrServ.getSystemStatus()
  )

  // GET /servarr/radarr/movies/:id (Get movie details by ID)
  .get(
    '/radarr/movies/:id',
    {
      params: ServarrModel.idParam,
      detail: {
        summary: 'Get movie details by ID',
        description: 'Fetches full movie data, media info, and disk files.',
        tags: ['Servarr - Radarr'],
      },
      response: {
        200: ServarrModel.radarrMovieDetailResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { id }, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.getRadarrMovieById(user.id, Number(id))
    }
  )

  // PUT /servarr/radarr/movies/:id (Update movie details)
  .put(
    '/radarr/movies/:id',
    {
      params: ServarrModel.idParam,
      body: ServarrModel.radarrMovieUpdateBody,
      detail: {
        summary: 'Update movie details',
        description:
          'Updates movie metadata, monitoring, or profile configuration.',
        tags: ['Servarr - Radarr'],
      },
      response: {
        200: ServarrModel.radarrMovieUpdateResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { id }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.updateRadarrMovie(user.id, Number(id), body)
    }
  )

  // DELETE /servarr/radarr/movies/:id (Delete movie from library)
  .delete(
    '/radarr/movies/:id',
    {
      params: ServarrModel.idParam,
      query: ServarrModel.deleteItemQuery,
      body: ServarrModel.deleteItemBody,
      detail: {
        summary: 'Delete movie from library',
        description: 'Removes movie and optionally deletes files from disk.',
        tags: ['Servarr - Radarr'],
      },
      response: {
        200: ServarrModel.deleteItemResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { id }, query, body, session: userSession }) => {
      const user = userSession.requireUser()
      const deleteFiles =
        query?.deleteFiles === 'true' ||
        query?.deleteFiles === true ||
        body?.deleteFiles === true
      const addExclusion =
        query?.addImportListExclusion === 'true' ||
        query?.addImportListExclusion === true ||
        body?.addImportListExclusion === true

      return await ServarrServ.deleteRadarrMovie(user.id, Number(id), {
        deleteFiles,
        addImportListExclusion: addExclusion,
      })
    }
  )

  // ===========================================================================
  // 15. Sonarr Specific (Series, Episodes & Feeds)
  // ===========================================================================

  // GET /servarr/sonarr/anime (List managed anime series)
  .get(
    '/sonarr/anime',
    {
      detail: {
        summary: 'List managed anime series',
        description:
          'Fetches Sonarr anime series import feed based on user settings and library.',
        tags: ['Servarr - Sonarr'],
      },
      response: {
        200: ServarrModel.sonarrSeriesFeedResponse,
        401: ServarrModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.getSonarrAnimeFeed(user.id)
    }
  )

  // GET /servarr/sonarr/anime/api/v3/series (Raw Sonarr Anime v3 series API proxy)
  .get(
    '/sonarr/anime/api/v3/series',
    {
      detail: {
        summary: 'Raw Sonarr Anime v3 series API proxy',
        description:
          'Emulates Sonarr series endpoint for anime series import lists.',
        tags: ['Servarr - Sonarr'],
      },
      response: {
        200: ServarrModel.sonarrSeriesFeedResponse,
        401: ServarrModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.getSonarrAnimeFeed(user.id)
    }
  )

  // GET /servarr/sonarr/anime/api/v3/qualityprofile (Raw Sonarr Anime v3 quality profile proxy)
  .get(
    '/sonarr/anime/api/v3/qualityprofile',
    {
      detail: {
        summary: 'Raw Sonarr Anime v3 quality profile proxy',
        description: 'Returns mock quality profiles for Sonarr list validation.',
        tags: ['Servarr - Sonarr'],
      },
      response: {
        200: ServarrModel.qualityProfileResponse,
      },
    },
    () => ServarrServ.getQualityProfiles()
  )

  // GET /servarr/sonarr/anime/api/v3/system/status (Raw Sonarr Anime v3 system status proxy)
  .get(
    '/sonarr/anime/api/v3/system/status',
    {
      detail: {
        summary: 'Raw Sonarr Anime v3 system status proxy',
        description: 'Returns mock system status for Sonarr list validation.',
        tags: ['Servarr - Sonarr'],
      },
      response: {
        200: ServarrModel.systemStatusResponse,
      },
    },
    () => ServarrServ.getSystemStatus()
  )

  // GET /servarr/sonarr/tv (List managed TV series)
  .get(
    '/sonarr/tv',
    {
      detail: {
        summary: 'List managed TV series',
        description:
          'Fetches Sonarr TV series import feed based on user settings and library.',
        tags: ['Servarr - Sonarr'],
      },
      response: {
        200: ServarrModel.sonarrSeriesFeedResponse,
        401: ServarrModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.getSonarrTvFeed(user.id)
    }
  )

  // GET /servarr/sonarr/tv/api/v3/series (Raw Sonarr TV v3 series API proxy)
  .get(
    '/sonarr/tv/api/v3/series',
    {
      detail: {
        summary: 'Raw Sonarr TV v3 series API proxy',
        description:
          'Emulates Sonarr series endpoint for TV series import lists.',
        tags: ['Servarr - Sonarr'],
      },
      response: {
        200: ServarrModel.sonarrSeriesFeedResponse,
        401: ServarrModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.getSonarrTvFeed(user.id)
    }
  )

  // GET /servarr/sonarr/tv/api/v3/qualityprofile (Raw Sonarr TV v3 quality profile proxy)
  .get(
    '/sonarr/tv/api/v3/qualityprofile',
    {
      detail: {
        summary: 'Raw Sonarr TV v3 quality profile proxy',
        description: 'Returns mock quality profiles for Sonarr list validation.',
        tags: ['Servarr - Sonarr'],
      },
      response: {
        200: ServarrModel.qualityProfileResponse,
      },
    },
    () => ServarrServ.getQualityProfiles()
  )

  // GET /servarr/sonarr/tv/api/v3/system/status (Raw Sonarr TV v3 system status proxy)
  .get(
    '/sonarr/tv/api/v3/system/status',
    {
      detail: {
        summary: 'Raw Sonarr TV v3 system status proxy',
        description: 'Returns mock system status for Sonarr list validation.',
        tags: ['Servarr - Sonarr'],
      },
      response: {
        200: ServarrModel.systemStatusResponse,
      },
    },
    () => ServarrServ.getSystemStatus()
  )

  // GET /servarr/sonarr/series/:id (Get series details by ID)
  .get(
    '/sonarr/series/:id',
    {
      params: ServarrModel.idParam,
      detail: {
        summary: 'Get series details by ID',
        description:
          'Fetches full series data, season/episode list, and episode files.',
        tags: ['Servarr - Sonarr'],
      },
      response: {
        200: ServarrModel.sonarrSeriesDetailResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { id }, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.getSonarrSeriesById(user.id, Number(id))
    }
  )

  // PUT /servarr/sonarr/series/:id (Update series details)
  .put(
    '/sonarr/series/:id',
    {
      params: ServarrModel.idParam,
      body: ServarrModel.sonarrSeriesUpdateBody,
      detail: {
        summary: 'Update series details',
        description:
          'Updates series metadata, monitoring, or profile configuration.',
        tags: ['Servarr - Sonarr'],
      },
      response: {
        200: ServarrModel.sonarrSeriesUpdateResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { id }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.updateSonarrSeries(user.id, Number(id), body)
    }
  )

  // DELETE /servarr/sonarr/series/:id (Delete series from library)
  .delete(
    '/sonarr/series/:id',
    {
      params: ServarrModel.idParam,
      query: ServarrModel.deleteItemQuery,
      body: ServarrModel.deleteItemBody,
      detail: {
        summary: 'Delete series from library',
        description: 'Removes series and optionally deletes files from disk.',
        tags: ['Servarr - Sonarr'],
      },
      response: {
        200: ServarrModel.deleteItemResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { id }, query, body, session: userSession }) => {
      const user = userSession.requireUser()
      const deleteFiles =
        query?.deleteFiles === 'true' ||
        query?.deleteFiles === true ||
        body?.deleteFiles === true
      const addExclusion =
        query?.addImportListExclusion === 'true' ||
        query?.addImportListExclusion === true ||
        body?.addImportListExclusion === true

      return await ServarrServ.deleteSonarrSeries(user.id, Number(id), {
        deleteFiles,
        addImportListExclusion: addExclusion,
      })
    }
  )

  // PUT /servarr/sonarr/episode/monitor (Batch toggle episode monitor state)
  .put(
    '/sonarr/episode/monitor',
    {
      body: ServarrModel.episodeMonitorBody,
      detail: {
        summary: 'Batch toggle episode monitor state',
        description:
          'Enables or disables monitoring for a list of episode IDs.',
        tags: ['Servarr - Sonarr'],
      },
      response: {
        200: ServarrModel.episodeMonitorResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.setEpisodeMonitoring(
        user.id,
        body.episodeIds,
        body.monitored
      )
    }
  )

  // PUT /servarr/sonarr/episode/:id (Update episode details)
  .put(
    '/sonarr/episode/:id',
    {
      params: ServarrModel.idParam,
      body: ServarrModel.sonarrEpisodeUpdateBody,
      detail: {
        summary: 'Update episode details',
        description: 'Updates episode properties, including monitoring status.',
        tags: ['Servarr - Sonarr'],
      },
      response: {
        200: ServarrModel.sonarrEpisodeUpdateResponse,
        401: ServarrModel.unauthorizedError,
        422: ServarrModel.validationError,
      },
    },
    async ({ params: { id }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await ServarrServ.updateSonarrEpisode(user.id, Number(id), body)
    }
  )

export default servarrController

