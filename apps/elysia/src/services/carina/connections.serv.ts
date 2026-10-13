import {
  prisma,
  Prisma,
  type ConnectionProvider,
  type ConnectionStatus,
  type ConnectionAuthType,
} from '@IRIS/database'
import {
  encryptConnectionData,
  decryptConnectionData,
  createOAuthStateToken,
  verifyOAuthStateToken,
  getConnectionAdapter,
  getSupportedProviders,
  SearchProxyManager,
  type MediaType,
  type OAuthTokens,
  type ConnectionCredentials,
} from '@IRIS/connections'
import { NotFound, BadRequest } from '../../lib/errors'

export class CarinaConnectionsServ {
  /**
   * Helper to format a Prisma connection record for API responses (safely omitting raw tokens).
   */
  public static formatConnection(conn: {
    id: string
    userId: string
    provider: ConnectionProvider
    authType: ConnectionAuthType
    externalId: string | null
    displayName: string | null
    avatarUrl: string | null
    profileUrl: string | null
    status: ConnectionStatus
    errorMessage: string | null
    settings: any
    lastSyncedAt: Date | null
    expiresAt: Date | null
    createdAt: Date
    updatedAt: Date
  }) {
    return {
      id: conn.id,
      userId: conn.userId,
      provider: conn.provider,
      authType: conn.authType,
      externalId: conn.externalId,
      displayName: conn.displayName,
      avatarUrl: conn.avatarUrl,
      profileUrl: conn.profileUrl,
      status: conn.status,
      errorMessage: conn.errorMessage,
      settings: conn.settings,
      lastSyncedAt: conn.lastSyncedAt ? conn.lastSyncedAt.toISOString() : null,
      expiresAt: conn.expiresAt ? conn.expiresAt.toISOString() : null,
      createdAt: conn.createdAt.toISOString(),
      updatedAt: conn.updatedAt.toISOString(),
    }
  }

  /**
   * Lists connected accounts for authenticated user (10 per page default).
   */
  public static async listConnections(
    userId: string,
    query?: {
      page?: number
      limit?: number
      provider?: string
      status?: string
    }
  ) {
    const page = Math.max(1, query?.page ?? 1)
    const limit = Math.max(1, Math.min(50, query?.limit ?? 10))
    const skip = (page - 1) * limit

    const where: Prisma.ConnectionWhereInput = { userId }

    if (query?.provider?.trim()) {
      where.provider = query.provider.trim().toUpperCase() as ConnectionProvider
    }
    if (query?.status?.trim()) {
      where.status = query.status.trim().toUpperCase() as ConnectionStatus
    }

    const [total, rawConnections] = await Promise.all([
      prisma.connection.count({ where }),
      prisma.connection.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    const totalPages = Math.max(1, Math.ceil(total / limit))
    const hasMore = page < totalPages

    const connections = rawConnections.map((c) => this.formatConnection(c))

    return {
      success: true,
      total,
      connections,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore,
      },
    }
  }

  /**
   * Lists all available third-party providers with capabilities and configuration state.
   */
  public static listProviders() {
    const providers = getSupportedProviders()
    return {
      success: true,
      total: providers.length,
      providers,
    }
  }

  /**
   * Manually creates or updates a connected account with API key or credentials.
   */
  public static async createManualConnection(
    userId: string,
    body: {
      provider: string
      authType?: string
      apiKey?: string
      hostUrl?: string
      username?: string
      password?: string
      settings?: any
    }
  ) {
    const provider = body.provider.trim().toUpperCase() as ConnectionProvider
    let adapter
    try {
      adapter = getConnectionAdapter(provider)
    } catch {
      throw new BadRequest(`Unsupported provider: ${body.provider}`)
    }

    const credentials: ConnectionCredentials = {
      apiKey: body.apiKey,
      hostUrl: body.hostUrl,
      username: body.username,
      password: body.password,
    }

    const testResult = await adapter.testConnection(credentials)
    if (!testResult.ok) {
      throw new BadRequest(testResult.message || 'Failed to authenticate with provider')
    }

    const finalCredentials = testResult.credentials || credentials
    const encryptedData = encryptConnectionData(finalCredentials, userId)
    const profile = testResult.profile

    const connection = await prisma.connection.upsert({
      where: {
        userId_provider_externalId: {
          userId,
          provider: provider as ConnectionProvider,
          externalId: profile?.id || body.username || 'default',
        },
      },
      create: {
        userId,
        provider: provider as ConnectionProvider,
        authType:
          (body.authType?.toUpperCase() as any) ||
          (adapter.authType as any) ||
          'API_KEY',
        externalId: profile?.id || body.username || 'default',
        displayName:
          profile?.displayName ||
          profile?.username ||
          body.username ||
          provider,
        avatarUrl: profile?.avatarUrl,
        profileUrl: profile?.profileUrl || body.hostUrl,
        encryptedData,
        status: 'CONNECTED',
        settings: {
          librarySync: true,
          isPrivate: false,
          ...(body.hostUrl ? { hostUrl: body.hostUrl } : {}),
          ...(body.settings || {}),
        },
        lastSyncedAt: new Date(),
      },
      update: {
        displayName:
          profile?.displayName ||
          profile?.username ||
          body.username ||
          provider,
        avatarUrl: profile?.avatarUrl,
        profileUrl: profile?.profileUrl || body.hostUrl,
        encryptedData,
        status: 'CONNECTED',
        errorMessage: null,
        settings: {
          librarySync: true,
          isPrivate: false,
          ...(body.hostUrl ? { hostUrl: body.hostUrl } : {}),
          ...(body.settings || {}),
        },
        lastSyncedAt: new Date(),
      },
    })

    return {
      success: true,
      connection: {
        id: connection.id,
        provider: connection.provider,
        displayName: connection.displayName,
        status: connection.status,
      },
    }
  }

  /**
   * Retrieves single connected account details strictly by connection ID.
   */
  public static async getConnection(userId: string, connectionId: string) {
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId.trim() },
    })

    if (!connection || connection.userId !== userId) {
      throw new NotFound('Connection not found')
    }

    return {
      success: true,
      connection: this.formatConnection(connection),
    }
  }

  /**
   * Updates settings or custom profile fields for a connected account.
   */
  public static async updateConnection(
    userId: string,
    connectionId: string,
    body: {
      settings?: any
      displayName?: string
      avatarUrl?: string
      profileUrl?: string
    }
  ) {
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId.trim() },
    })

    if (!connection || connection.userId !== userId) {
      throw new NotFound('Connection not found')
    }

    let mergedSettings = connection.settings
    if (body.settings !== undefined) {
      const current = typeof connection.settings === 'object' && connection.settings !== null
        ? connection.settings
        : {}
      mergedSettings = { ...current, ...body.settings }
    }

    const updated = await prisma.connection.update({
      where: { id: connection.id },
      data: {
        settings: mergedSettings ?? Prisma.JsonNull,
        ...(body.displayName !== undefined ? { displayName: body.displayName.trim() || null } : {}),
        ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl.trim() || null } : {}),
        ...(body.profileUrl !== undefined ? { profileUrl: body.profileUrl.trim() || null } : {}),
      },
    })

    return {
      success: true,
      connection: this.formatConnection(updated),
      message: 'Connection updated successfully',
    }
  }

  /**
   * Disconnects / deletes a connected account strictly by connection ID.
   */
  public static async deleteConnection(userId: string, connectionId: string) {
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId.trim() },
    })

    if (!connection || connection.userId !== userId) {
      throw new NotFound('Connection not found')
    }

    await prisma.connection.delete({
      where: { id: connection.id },
    })

    return {
      success: true,
      id: connection.id,
      message: 'Connection disconnected successfully',
    }
  }

  /**
   * Generates OAuth authorization initiation URL for target connection or provider.
   */
  public static async getAuthUrl(
    userId: string,
    connectionIdOrProvider: string,
    query?: {
      redirectUri?: string
      hostUrl?: string
      returnTo?: string
    }
  ) {
    const normalized = connectionIdOrProvider.trim().toUpperCase()

    // 1. Resolve target provider: check if param is a direct provider key or an existing connection ID
    let provider: ConnectionProvider | null = null
    const registeredProviders: readonly string[] = [
      'ANILIST',
      'MAL',
      'SIMKL',
      'BANGUMI',
      'STEAM',
      'RIOT_GAMES',
      'RADARR',
      'SONARR',
      'READARR',
      'LIDARR',
      'JELLYFIN',
      'PLEX',
      'DEEZER',
      'LASTFM',
      'CUSTOM',
      'IRIS',
    ]

    if (registeredProviders.includes(normalized)) {
      provider = normalized as ConnectionProvider
    } else {
      const existing = await prisma.connection.findUnique({
        where: { id: connectionIdOrProvider.trim() },
      })
      if (existing && existing.userId === userId) {
        provider = existing.provider
      }
    }

    if (!provider) {
      throw new NotFound('Provider or connection not found')
    }

    const adapter = getConnectionAdapter(provider)
    if (!adapter.capabilities.supportsOAuth) {
      throw new BadRequest(`Provider ${provider} does not support OAuth authentication`)
    }

    const redirectUri =
      query?.redirectUri?.trim() ||
      process.env.CONNECTIONS_REDIRECT_URI ||
      'http://localhost:4000/carina/connections/callback'

    const stateToken = createOAuthStateToken({
      userId,
      provider,
      redirectUri,
      hostUrl: query?.hostUrl?.trim(),
      returnTo: query?.returnTo?.trim(),
    })

    const authResult = await adapter.getAuthUrl({
      state: stateToken,
      redirectUri,
    })

    return {
      success: true,
      url: authResult.url,
      state: stateToken,
      provider,
    }
  }

  /**
   * Handles OAuth authorization code exchange callback and securely persists encrypted tokens.
   */
  public static async handleOAuthCallback(
    userId: string,
    connectionIdOrProvider: string,
    query: {
      code?: string
      state?: string
      error?: string
      error_description?: string
    }
  ) {
    if (query.error) {
      throw new BadRequest(query.error_description || query.error)
    }

    if (!query.code || !query.state) {
      throw new BadRequest('Missing required OAuth code or state parameter')
    }

    const statePayload = verifyOAuthStateToken(query.state)
    if (!statePayload) {
      throw new BadRequest('Invalid or expired OAuth state token')
    }

    if (statePayload.userId !== userId) {
      throw new BadRequest('OAuth state user mismatch')
    }

    const provider = statePayload.provider
    const adapter = getConnectionAdapter(provider)

    const tokens: OAuthTokens = await adapter.exchangeAuthCode(
      query.code,
      statePayload.redirectUri,
      statePayload.codeVerifier,
      { hostUrl: statePayload.hostUrl }
    )

    const profile = await adapter.getProfile(tokens)

    // Securely encrypt tokens using AES-256-GCM derived per-user key
    const encryptedData = encryptConnectionData(tokens, userId)

    const externalId = profile.id || profile.username || null
    const displayName = profile.displayName || profile.username || null
    const avatarUrl = profile.avatarUrl || null
    const profileUrl = profile.profileUrl || null
    const expiresAt = tokens.expiresAt ? new Date(tokens.expiresAt) : null

    // Check if target is an existing connection ID
    let target = await prisma.connection.findUnique({
      where: { id: connectionIdOrProvider.trim() },
    })

    if (target && target.userId === userId) {
      target = await prisma.connection.update({
        where: { id: target.id },
        data: {
          encryptedData,
          status: 'CONNECTED',
          errorMessage: null,
          externalId,
          displayName,
          avatarUrl,
          profileUrl,
          expiresAt,
        },
      })
    } else {
      // Find existing connection for this user and provider/externalId, or create new
      const existing = await prisma.connection.findFirst({
        where: {
          userId,
          provider,
          ...(externalId ? { externalId } : {}),
        },
      })

      if (existing) {
        target = await prisma.connection.update({
          where: { id: existing.id },
          data: {
            encryptedData,
            status: 'CONNECTED',
            errorMessage: null,
            displayName,
            avatarUrl,
            profileUrl,
            expiresAt,
          },
        })
      } else {
        target = await prisma.connection.create({
          data: {
            userId,
            provider,
            authType: adapter.authType ?? 'OAUTH2',
            encryptedData,
            status: 'CONNECTED',
            externalId,
            displayName,
            avatarUrl,
            profileUrl,
            expiresAt,
          },
        })
      }
    }

    return {
      success: true,
      connection: this.formatConnection(target),
      message: 'Account connected successfully',
    }
  }

  /**
   * Triggers immediate synchronization of library, watchlist, or games from provider.
   */
  public static async syncConnection(userId: string, connectionId: string) {
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId.trim() },
    })

    if (!connection || connection.userId !== userId) {
      throw new NotFound('Connection not found')
    }

    const credentials = decryptConnectionData<ConnectionCredentials>(
      connection.encryptedData,
      userId
    )

    const adapter = getConnectionAdapter(connection.provider)
    let syncedItemsCount = 0

    if (adapter.getLibrary) {
      const items = await adapter.getLibrary(credentials)
      syncedItemsCount = Array.isArray(items) ? items.length : 0
    } else if (adapter.getGames) {
      const games = await adapter.getGames(credentials)
      syncedItemsCount = Array.isArray(games) ? games.length : 0
    }

    const updated = await prisma.connection.update({
      where: { id: connection.id },
      data: {
        lastSyncedAt: new Date(),
        status: 'CONNECTED',
        errorMessage: null,
      },
    })

    return {
      success: true,
      id: updated.id,
      lastSyncedAt: updated.lastSyncedAt!.toISOString(),
      syncedItemsCount,
      message: 'Library synced successfully',
    }
  }

  /**
   * Tests connection health and validity against external provider API.
   */
  public static async testConnection(userId: string, connectionId: string) {
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId.trim() },
    })

    if (!connection || connection.userId !== userId) {
      throw new NotFound('Connection not found')
    }

    const credentials = decryptConnectionData<ConnectionCredentials>(
      connection.encryptedData,
      userId
    )

    const adapter = getConnectionAdapter(connection.provider)
    const testResult = await adapter.testConnection(credentials)

    const newStatus: ConnectionStatus = testResult.ok ? 'CONNECTED' : 'ERROR'
    const newErrorMessage = testResult.ok ? null : (testResult.message || 'Health check failed')

    await prisma.connection.update({
      where: { id: connection.id },
      data: {
        status: newStatus,
        errorMessage: newErrorMessage,
      },
    })

    return {
      success: true,
      ok: testResult.ok,
      status: newStatus,
      message: testResult.message || (testResult.ok ? 'Connection active' : 'Connection failed'),
      profile: testResult.profile ?? null,
    }
  }

  /**
   * Dispatches media search query or direct ID lookup via third-party provider proxy.
   */
  public static async searchProxy(
    userId: string,
    query: {
      provider: string
      q?: string
      id?: string
      type?: string
      page?: number
      perPage?: number
    }
  ) {
    const rawProvider = query.provider.trim().toUpperCase()
    const provider = rawProvider as ConnectionProvider

    // Handle Last.fm connection search natively if requested
    if (rawProvider === 'LASTFM') {
      const apiKey = process.env.LASTFM_API_KEY?.trim()
      const searchQuery = (query.q || query.id || '').trim()

      if (!apiKey || !searchQuery) {
        return {
          success: true,
          provider: 'LASTFM',
          results: [],
        }
      }

      try {
        const rawType = query.type?.toUpperCase()
        const baseUrl = 'https://ws.audioscrobbler.com/2.0/'

        if (query.id) {
          const trackMatch = query.id.match(/\/music\/([^/]+)\/_\/([^/?#]+)/i)
          const albumMatch = query.id.match(/\/music\/([^/]+)\/([^/?#]+)/i)

          if (trackMatch && trackMatch[1] && trackMatch[2]) {
            const artist = decodeURIComponent(trackMatch[1])
            const trackTitle = decodeURIComponent(trackMatch[2])
            const res = await fetch(
              `${baseUrl}?method=track.getInfo&api_key=${apiKey}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(trackTitle)}&format=json`
            )
            if (res.ok) {
              const data = (await res.json()) as any
              if (data?.track) {
                const tr = data.track
                const img = tr.album?.image?.reverse()?.find((i: any) => i['#text']?.trim())?.['#text'] || null
                return {
                  success: true,
                  provider: 'LASTFM',
                  results: [
                    {
                      id: tr.mbid || tr.url || query.id,
                      externalId: tr.url || query.id,
                      provider: 'LASTFM',
                      mediaType: 'MUSIC_TRACK',
                      format: 'TRACK',
                      title: {
                        userPreferred: `${tr.name} - ${tr.artist?.name || ''}`.trim(),
                        english: tr.name,
                      },
                      coverImage: img ? { large: img, medium: img } : undefined,
                      url: tr.url || query.id,
                    },
                  ],
                }
              }
            }
          } else if (albumMatch && albumMatch[1] && albumMatch[2] && albumMatch[2] !== '_') {
            const artist = decodeURIComponent(albumMatch[1])
            const albumTitle = decodeURIComponent(albumMatch[2])
            const res = await fetch(
              `${baseUrl}?method=album.getInfo&api_key=${apiKey}&artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(albumTitle)}&format=json`
            )
            if (res.ok) {
              const data = (await res.json()) as any
              if (data?.album) {
                const al = data.album
                const img = al.image?.reverse()?.find((i: any) => i['#text']?.trim())?.['#text'] || null
                return {
                  success: true,
                  provider: 'LASTFM',
                  results: [
                    {
                      id: al.mbid || al.url || query.id,
                      externalId: al.url || query.id,
                      provider: 'LASTFM',
                      mediaType: 'MUSIC_ALBUM',
                      format: 'ALBUM',
                      title: {
                        userPreferred: `${al.name} - ${al.artist}`.trim(),
                        english: al.name,
                      },
                      coverImage: img ? { large: img, medium: img } : undefined,
                      url: al.url || query.id,
                    },
                  ],
                }
              }
            }
          }
        }

        const isAlbum = rawType === 'ALBUM' || rawType === 'MUSIC_ALBUM'
        const method = isAlbum ? 'album.search' : 'track.search'
        const paramKey = isAlbum ? 'album' : 'track'
        const limit = Math.min(query.perPage ?? 15, 50)

        const res = await fetch(
          `${baseUrl}?method=${method}&${paramKey}=${encodeURIComponent(searchQuery)}&limit=${limit}&api_key=${apiKey}&format=json`
        )
        if (res.ok) {
          const data = (await res.json()) as any
          const list = isAlbum
            ? data?.results?.albummatches?.album
            : data?.results?.trackmatches?.track
          const normalized = Array.isArray(list) ? list : list ? [list] : []
          const results = normalized.map((item: any) => {
            const img = item.image?.reverse()?.find((i: any) => i['#text']?.trim())?.['#text'] || null
            return {
              id: item.mbid || item.url,
              externalId: item.url || item.mbid || `${item.artist} - ${item.name}`,
              provider: 'LASTFM',
              mediaType: isAlbum ? 'MUSIC_ALBUM' : 'MUSIC_TRACK',
              format: isAlbum ? 'ALBUM' : 'TRACK',
              title: {
                userPreferred: `${item.name} - ${item.artist}`,
                english: item.name,
              },
              coverImage: img ? { large: img, medium: img } : undefined,
              url: item.url,
            }
          })
          return {
            success: true,
            provider: 'LASTFM',
            results,
          }
        }
      } catch {
        return {
          success: true,
          provider: 'LASTFM',
          results: [],
        }
      }
    }

    // Lookup user's connection if available to leverage user credentials
    const userConnection = await prisma.connection.findFirst({
      where: {
        userId,
        provider: provider as ConnectionProvider,
        status: 'CONNECTED',
      },
    })

    if (query.id) {
      try {
        const direct = await SearchProxyManager.getById(
          provider,
          query.id,
          userConnection,
          {
            type: query.type?.toUpperCase() as MediaType,
          }
        )
        if (direct) {
          const hasValidExt =
            Boolean(direct.externalId) &&
            direct.externalId !== 'undefined' &&
            direct.externalId !== 'null'
          const hasValidId =
            Boolean(direct.id) &&
            direct.id !== 'undefined' &&
            direct.id !== 'null'
          const finalId = hasValidExt
            ? direct.externalId
            : hasValidId
              ? direct.id
              : query.id

          return {
            success: true,
            provider,
            results: [
              {
                ...direct,
                id: hasValidId ? direct.id : finalId,
                externalId: finalId,
              },
            ],
          }
        }
      } catch { }
    }

    const searchQuery = (query.q || '').trim()
    if (!searchQuery) {
      return {
        success: true,
        provider,
        results: [],
      }
    }

    const results = await SearchProxyManager.search(
      provider,
      searchQuery,
      userConnection,
      {
        type: query.type?.toUpperCase() as MediaType,
        page: query.page,
        perPage: query.perPage,
      },
      async (connId, updatedEncrypted, expiresAt) => {
        await prisma.connection.update({
          where: { id: connId },
          data: {
            encryptedData: updatedEncrypted,
            expiresAt,
          },
        })
      }
    )

    const cleanedResults = (results || []).map((r, idx: number) => {
      const hasValidExt =
        Boolean(r.externalId) &&
        r.externalId !== 'undefined' &&
        r.externalId !== 'null'
      const hasValidId =
        Boolean(r.id) && r.id !== 'undefined' && r.id !== 'null'
      const finalId = hasValidExt
        ? r.externalId
        : hasValidId
          ? r.id
          : String(idx)

      return {
        ...r,
        id: hasValidId ? r.id : finalId,
        externalId: finalId,
        url:
          r.url && !r.url.endsWith('/undefined')
            ? r.url
            : `https://simkl.com/anime/${finalId}`,
      }
    })

    return {
      success: true,
      provider,
      results: cleanedResults,
    }
  }
}
