================================================================================
  IRIS Elysia 2 Route Specification & Migration TODO
================================================================================
Apps:
  - Carina   (Iris account  - Auth, OAuth 2.0/OIDC, Users, Social, Friends, Notifications)
  - Borealis (Iris list     - Media Lists, Catalog Metadata, Calendar, Playlists)
  - Kiroshi  (Iris search   - Web Search, Suggestions, History, Settings)
  - Akaromi  (Iris pass     - Vault Ciphers, Folders, Encryption, Sync)
  - Servarr  (Iris servarr  - Radarr & Sonarr Automation & Media Download Integrations)
================================================================================


--------------------------------------------------------------------------------
 [Carina] (Iris account)
--------------------------------------------------------------------------------

  -- OpenID Connect & OAuth 2.0 Discovery (RFC root endpoints) --
  GET     /.well-known/openid-configuration                 OpenID Connect discovery document
  GET     /.well-known/oauth-authorization-server           OAuth 2.0 authorization server metadata


  POST    /carina/auth/twofactor/email/setup                Setup 2FA email
  POST    /carina/auth/twofactor/email/send                 Send 2FA verification email
  POST    /carina/auth/twofactor/email/verify               Verify 2FA email code
  DELETE  /carina/auth/twofactor/email                      Remove 2FA email


  -- OAuth 2.0 / OIDC Identity Provider --
  GET     /carina/oauth/authorize                           OAuth authorization endpoint (consent / prompt)
  POST    /carina/oauth/authorize                           Process OAuth authorization grant
  POST    /carina/oauth/token                               Exchange authorization code for token
  GET     /carina/oauth/userinfo                            Get userinfo profile for access token
  POST    /carina/oauth/revoke                              Revoke OAuth token
  POST    /carina/oauth/introspect                          Introspect OAuth token
  POST    /carina/oauth/register                            Dynamic client registration

  GET     /carina/oauth/apps                                List registered OAuth applications
  POST    /carina/oauth/apps                                Create new OAuth application
  GET     /carina/oauth/apps/:id                            Get OAuth application details
  PATCH   /carina/oauth/apps/:id                            Update OAuth application
  DELETE  /carina/oauth/apps/:id                            Delete OAuth application
  POST    /carina/oauth/apps/:id/regenerate-secret          Regenerate OAuth application client secret

  GET     /carina/oauth/authorizations                      List user authorized OAuth applications
  DELETE  /carina/oauth/authorizations/:id                  Revoke authorized OAuth application

--------------------------------------------------------------------------------
 [Borealis] (Iris list)
--------------------------------------------------------------------------------

  -- Media Lists: Anime --
  GET     /borealis/lists/anime                             Get anime list (40 per page)
  GET     /borealis/lists/anime/:animeId                    Check / get anime in user list
  POST    /borealis/lists/anime/:animeId                    Add or update anime in list
  DELETE  /borealis/lists/anime/:animeId                    Remove anime from list
  POST    /borealis/lists/anime/:animeId/increment          Increment episode progress
  GET     /borealis/lists/anime/stats                       Get anime list statistics
  GET     /borealis/lists/anime/filters                     Get available anime list filters

  -- Media Lists: Manga --
  GET     /borealis/lists/manga                             Get manga list (40 per page)
  GET     /borealis/lists/manga/:mangaId                    Check / get manga in user list
  POST    /borealis/lists/manga/:mangaId                    Add or update manga in list
  DELETE  /borealis/lists/manga/:mangaId                    Remove manga from list
  POST    /borealis/lists/manga/:mangaId/increment          Increment chapter/volume progress
  GET     /borealis/lists/manga/stats                       Get manga list statistics
  GET     /borealis/lists/manga/filters                     Get available manga list filters

  -- Media Lists: Movies --
  GET     /borealis/lists/movies                            Get movies list (40 per page)
  GET     /borealis/lists/movies/:movieId                   Check / get movie in user list
  POST    /borealis/lists/movies/:movieId                   Add or update movie in list
  DELETE  /borealis/lists/movies/:movieId                   Remove movie from list
  POST    /borealis/lists/movies/:movieId/increment         Increment rewatch progress
  GET     /borealis/lists/movies/stats                      Get movies list statistics
  GET     /borealis/lists/movies/filters                    Get available movies list filters

  -- Media Lists: TV --
  GET     /borealis/lists/tv                                Get TV list (40 per page)
  GET     /borealis/lists/tv/:tvId                          Check / get TV series in user list
  POST    /borealis/lists/tv/:tvId                          Add or update TV series in list
  DELETE  /borealis/lists/tv/:tvId                          Remove TV series from list
  POST    /borealis/lists/tv/:tvId/increment                Increment episode progress
  GET     /borealis/lists/tv/stats                          Get TV list statistics
  GET     /borealis/lists/tv/filters                        Get available TV list filters

  -- Media Lists: Games --
  GET     /borealis/lists/games                             Get games list (40 per page)
  GET     /borealis/lists/games/:gameId                     Check / get game in user list
  POST    /borealis/lists/games/:gameId                     Add or update game in list
  DELETE  /borealis/lists/games/:gameId                     Remove game from list
  POST    /borealis/lists/games/:gameId/increment           Increment playtime / hours progress
  GET     /borealis/lists/games/stats                       Get games list statistics
  GET     /borealis/lists/games/filters                     Get available games list filters

  -- Media Lists: Books --
  GET     /borealis/lists/books                             Get books list (40 per page)
  GET     /borealis/lists/books/:bookId                     Check / get book in user list
  POST    /borealis/lists/books/:bookId                     Add or update book in list
  DELETE  /borealis/lists/books/:bookId                     Remove book from list
  POST    /borealis/lists/books/:bookId/increment           Increment page / chapter progress
  GET     /borealis/lists/books/stats                       Get books list statistics
  GET     /borealis/lists/books/filters                     Get available books list filters

  -- Media Lists: Music --
  GET     /borealis/lists/music                             Get music list (40 per page)
  GET     /borealis/lists/music/:musicId                    Check / get album/track in user list
  POST    /borealis/lists/music/:musicId                    Add or update music in list
  DELETE  /borealis/lists/music/:musicId                    Remove music from list
  POST    /borealis/lists/music/:musicId/increment          Increment listen count progress
  GET     /borealis/lists/music/stats                       Get music list statistics
  GET     /borealis/lists/music/filters                     Get available music list filters

  -- Media Lists: Other --
  GET     /borealis/lists/other                             Get custom/other list (40 per page)
  GET     /borealis/lists/other/:otherId                    Check / get item in other list
  POST    /borealis/lists/other/:otherId                    Add or update item in other list
  DELETE  /borealis/lists/other/:otherId                    Remove item from other list
  POST    /borealis/lists/other/:otherId/increment          Increment custom progress
  GET     /borealis/lists/other/stats                       Get other list statistics
  GET     /borealis/lists/other/filters                     Get available other list filters

  -- Playlists & Custom Lists --
  GET     /borealis/playlists                               Get user custom playlists
  POST    /borealis/playlists                               Create new playlist
  PATCH   /borealis/playlists/:playlistId                   Update playlist details
  DELETE  /borealis/playlists/:playlistId                   Delete playlist
  GET     /borealis/playlists/:playlistId/entries           Get playlist entries
  POST    /borealis/playlists/:playlistId/entries           Add entry to playlist
  PATCH   /borealis/playlists/:playlistId/entries           Update entry in playlist
  DELETE  /borealis/playlists/:playlistId/entries           Remove entry from playlist

  -- Global List Operations --
  GET     /borealis/lists/export                            Export user lists to JSON
  POST    /borealis/lists/import                            Import lists from JSON / external backups
  GET     /borealis/lists/stats                             Get aggregated multi-media list statistics

  -- Media Search --
  GET     /borealis/search                                  Search media catalog (?q=...&category=...)

  -- Media Metadata: Anime --
  GET     /borealis/media/anime                             Get anime catalog entries (40 per page)
  GET     /borealis/media/anime/filters                     Get available catalog filters for anime
  GET     /borealis/media/anime/:id                         Get anime metadata by ID
  POST    /borealis/media/anime/:id/refresh                 Refresh anime metadata from external providers
  GET     /borealis/media/anime/:id/similar                 Get similar anime recommendations

  -- Media Metadata: Manga --
  GET     /borealis/media/manga                             Get manga catalog entries (40 per page)
  GET     /borealis/media/manga/filters                     Get available catalog filters for manga
  GET     /borealis/media/manga/:id                         Get manga metadata by ID
  POST    /borealis/media/manga/:id/refresh                 Refresh manga metadata from external providers
  GET     /borealis/media/manga/:id/similar                 Get similar manga recommendations

  -- Media Metadata: Movies --
  GET     /borealis/media/movies                            Get movie catalog entries (40 per page)
  GET     /borealis/media/movies/filters                    Get available catalog filters for movies
  GET     /borealis/media/movies/:id                        Get movie metadata by ID
  POST    /borealis/media/movies/:id/refresh                Refresh movie metadata from external providers
  GET     /borealis/media/movies/:id/similar                Get similar movies recommendations

  -- Media Metadata: TV --
  GET     /borealis/media/tv                                Get TV catalog entries (40 per page)
  GET     /borealis/media/tv/filters                        Get available catalog filters for TV
  GET     /borealis/media/tv/:id                            Get TV metadata by ID
  POST    /borealis/media/tv/:id/refresh                    Refresh TV metadata from external providers
  GET     /borealis/media/tv/:id/similar                    Get similar TV recommendations

  -- Media Metadata: Books --
  GET     /borealis/media/books                             Get books catalog entries (40 per page)
  GET     /borealis/media/books/filters                     Get available catalog filters for books
  GET     /borealis/media/books/:id                         Get book metadata by ID
  POST    /borealis/media/books/:id/refresh                 Refresh book metadata from external providers
  GET     /borealis/media/books/:id/similar                 Get similar books recommendations

  -- Media Metadata: Games --
  GET     /borealis/media/games                             Get games catalog entries (40 per page)
  GET     /borealis/media/games/filters                     Get available catalog filters for games
  GET     /borealis/media/games/:id                         Get game metadata by ID
  POST    /borealis/media/games/:id/refresh                 Refresh game metadata from external providers
  GET     /borealis/media/games/:id/similar                 Get similar games recommendations

  -- Media Metadata: Music --
  GET     /borealis/media/music                             Get music catalog entries (40 per page)
  GET     /borealis/media/music/filters                     Get available catalog filters for music
  GET     /borealis/media/music/:id                         Get music metadata by ID
  POST    /borealis/media/music/:id/refresh                 Refresh music metadata from external providers
  GET     /borealis/media/music/:id/similar                 Get similar music recommendations

  -- Characters, People & Studios --
  GET     /borealis/characters                              Get characters catalog (40 per page)
  GET     /borealis/characters/filters                      Get available character filters
  GET     /borealis/characters/:id                          Get character details by ID
  GET     /borealis/people                                  Get people (staff/voice actors) (40 per page)
  GET     /borealis/people/filters                          Get available people filters
  GET     /borealis/people/:id                              Get person details by ID
  GET     /borealis/studios                                 Get studios (40 per page)
  GET     /borealis/studios/filters                         Get available studio filters
  GET     /borealis/studios/:id                             Get studio details by ID
  GET     /borealis/calendar                                Media broadcast / release calendar

--------------------------------------------------------------------------------
 [Servarr] (Iris servarr)
--------------------------------------------------------------------------------

  -- Unified Servarr Endpoints (/servarr/:app/* where :app is radarr or sonarr) --
  GET     /servarr/:app/blocklist                           Get blocklist entries
  DELETE  /servarr/:app/blocklist                           Clear blocklist entries
  POST    /servarr/:app/command                             Trigger backend command/task
  GET     /servarr/:app/files                               List downloaded media files
  DELETE  /servarr/:app/files                               Delete downloaded file
  GET     /servarr/:app/history                             Get activity history
  GET     /servarr/:app/indexer                             List indexers
  GET     /servarr/:app/library                             Get full media library
  GET     /servarr/:app/lookup                              Lookup media details (?term=...)
  POST    /servarr/:app/lookup                              Lookup media by external ID
  PUT     /servarr/:app/manage                              Update library items in batch
  DELETE  /servarr/:app/manage                              Delete library items in batch
  GET     /servarr/:app/manualimport                        Preview files for manual import
  POST    /servarr/:app/manualimport                        Execute manual import
  GET     /servarr/:app/queue                               Get active download queue
  DELETE  /servarr/:app/queue                               Remove item from download queue
  GET     /servarr/:app/release                             Search releases for media
  POST    /servarr/:app/release                             Grab specific release
  GET     /servarr/:app/rename                              Preview file rename operations
  POST    /servarr/:app/rename                              Execute file rename
  GET     /servarr/:app/wanted/cutoff                       List media not meeting cutoff profile
  GET     /servarr/:app/wanted/missing                      List missing media items

  -- Radarr Specific (Movies) --
  GET     /servarr/radarr/movies                            List managed movies
  GET     /servarr/radarr/movies/:id                        Get movie details by ID
  PUT     /servarr/radarr/movies/:id                        Update movie details
  DELETE  /servarr/radarr/movies/:id                        Delete movie from library
  GET     /servarr/radarr/movies/anime                      List managed anime movies
  GET     /servarr/radarr/movies/anime/api/v3/movie         Raw Radarr Anime v3 movie API proxy
  GET     /servarr/radarr/movies/anime/api/v3/qualityprofile Raw Radarr Anime v3 quality profile proxy
  GET     /servarr/radarr/movies/anime/api/v3/system/status Raw Radarr Anime v3 system status proxy
  GET     /servarr/radarr/movies/api/v3/movie               Raw Radarr Standard v3 movie API proxy
  GET     /servarr/radarr/movies/api/v3/qualityprofile      Raw Radarr Standard v3 quality profile proxy
  GET     /servarr/radarr/movies/api/v3/system/status       Raw Radarr Standard v3 system status proxy

  -- Sonarr Specific (TV & Anime Series) --
  GET     /servarr/sonarr/series/:id                        Get series details by ID
  PUT     /servarr/sonarr/series/:id                        Update series details
  DELETE  /servarr/sonarr/series/:id                        Delete series from library
  PUT     /servarr/sonarr/episode/:id                       Update episode details
  PUT     /servarr/sonarr/episode/monitor                   Batch toggle episode monitor state
  GET     /servarr/sonarr/anime                             List managed anime series
  GET     /servarr/sonarr/anime/api/v3/series               Raw Sonarr Anime v3 series API proxy
  GET     /servarr/sonarr/anime/api/v3/qualityprofile       Raw Sonarr Anime v3 quality profile proxy
  GET     /servarr/sonarr/anime/api/v3/system/status        Raw Sonarr Anime v3 system status proxy
  GET     /servarr/sonarr/tv                                List managed TV series
  GET     /servarr/sonarr/tv/api/v3/series                  Raw Sonarr TV v3 series API proxy
  GET     /servarr/sonarr/tv/api/v3/qualityprofile          Raw Sonarr TV v3 quality profile proxy
  GET     /servarr/sonarr/tv/api/v3/system/status           Raw Sonarr TV v3 system status proxy

