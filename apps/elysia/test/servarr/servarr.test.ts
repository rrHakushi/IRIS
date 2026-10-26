import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia, ValidationError } from 'elysia'
import { servarrController } from '../../src/api/controllers/servarr/servarr.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { encryptConnectionData, getConnectionAdapter } from '@IRIS/connections'
import { prisma } from '@Iris/db'

// -----------------------------------------------------------------------------
// Test App Setup
// -----------------------------------------------------------------------------

const app = new Elysia()
  .onError(({ error, set }) => {
    if (isHttpError(error)) {
      set.status = error.status
      return error.toResponse()
    }
    if (error instanceof ValidationError) {
      set.status = 422
      return {
        type: 'validation',
        title: 'Unprocessable Content',
        status: 422,
        code: 'validation',
        detail: error.message,
      }
    }
  })
  .use(servarrController)

// -----------------------------------------------------------------------------
// Mock Data & Fixtures
// -----------------------------------------------------------------------------

const ALICE_ID = '00000000-0000-0000-0000-000000000001'
const BOB_ID = '00000000-0000-0000-0000-000000000002'

let mockUsers: any[] = []
let mockConnections: any[] = []
let mockMovieLists: any[] = []
let mockTvLists: any[] = []
let mockAnimeLists: any[] = []

function setupPrismaMock() {
  Bun.env.JWT_SECRET = 'iris-default-secret-key-32-chars!!'

  mockUsers = [
    {
      id: ALICE_ID,
      username: 'alice',
      email: 'alice@example.com',
      permissions: [],
      passwordChangedAt: null,
      settings: {
        servarr: {
          radarrEnabled: true,
          sonarrEnabled: true,
          radarrMovie: {
            enabled: true,
            monitored: true,
            listStatuses: ['COMPLETED', 'PLANNING'],
            movieStatuses: ['RELEASED'],
          },
          radarrAnime: {
            enabled: true,
            monitored: true,
            listStatuses: ['PLANNING'],
            animeStatuses: ['FINISHED', 'RELEASING'],
            animeMovieFormats: ['MOVIE'],
          },
          sonarrAnime: {
            enabled: true,
            monitored: true,
            listStatuses: ['WATCHING', 'PLANNING'],
            animeStatuses: ['FINISHED', 'RELEASING'],
            animeFormats: ['TV', 'TV_SHORT'],
          },
          sonarrTv: {
            enabled: true,
            monitored: true,
            listStatuses: ['WATCHING', 'PLANNING'],
            tvStatuses: ['RETURNING_SERIES', 'ENDED'],
          },
        },
      },
    },
    {
      id: BOB_ID,
      username: 'bob',
      email: 'bob@example.com',
      permissions: [],
      passwordChangedAt: null,
      settings: {},
    },
  ]

  const encryptedRadarr = encryptConnectionData(
    { hostUrl: 'http://localhost:7878', apiKey: 'test-radarr-key' },
    ALICE_ID
  )
  const encryptedSonarr = encryptConnectionData(
    { hostUrl: 'http://localhost:8989', apiKey: 'test-sonarr-key' },
    ALICE_ID
  )

  mockConnections = [
    {
      id: 'conn-radarr-1',
      userId: ALICE_ID,
      provider: 'RADARR',
      status: 'CONNECTED',
      profileUrl: 'http://localhost:7878',
      encryptedData: encryptedRadarr,
      settings: { hostUrl: 'http://localhost:7878' },
    },
    {
      id: 'conn-sonarr-1',
      userId: ALICE_ID,
      provider: 'SONARR',
      status: 'CONNECTED',
      profileUrl: 'http://localhost:8989',
      encryptedData: encryptedSonarr,
      settings: { hostUrl: 'http://localhost:8989' },
    },
  ]

  mockMovieLists = [
    {
      id: 1,
      userId: ALICE_ID,
      status: 'COMPLETED',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      movie: {
        id: 501,
        tmdbId: 501,
        titlePrimary: 'Spirited Away',
        titleSecondary: 'Sen to Chihiro no Kamikakushi',
        releaseDateYear: 2001,
        description: 'A young girl enters the spirit world.',
        coverImage: 'https://example.com/spirited.jpg',
        bannerImage: 'https://example.com/spirited-banner.jpg',
        imdbId: 'tt0245429',
        genres: ['Animation', 'Adventure'],
        status: 'RELEASED',
        sources: [{ provider: 'TMDB', externalId: '501' }],
      },
    },
  ]

  mockTvLists = [
    {
      id: 1,
      userId: ALICE_ID,
      status: 'WATCHING',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      tv: {
        id: 601,
        titlePrimary: 'Breaking Bad',
        titleSecondary: null,
        releaseDateYear: 2008,
        firstAiredYear: 2008,
        description: 'A chemistry teacher turns to crime.',
        coverImage: 'https://example.com/bb.jpg',
        bannerImage: 'https://example.com/bb-banner.jpg',
        tvDBId: 81189,
        imdbId: 'tt0903747',
        genres: ['Crime', 'Drama'],
        status: 'ENDED',
        sources: [{ provider: 'TVDB', externalId: '81189' }],
      },
    },
  ]

  mockAnimeLists = [
    {
      id: 1,
      userId: ALICE_ID,
      status: 'PLANNING',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      anime: {
        id: 701,
        titlePrimary: 'Your Name.',
        format: 'MOVIE',
        status: 'FINISHED',
        startDateYear: 2016,
        sources: [
          { provider: 'TMDB', externalId: '372058' },
          { provider: 'IMDB', externalId: 'tt5311514' },
        ],
      },
    },
    {
      id: 2,
      userId: ALICE_ID,
      status: 'WATCHING',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      anime: {
        id: 702,
        titlePrimary: "Frieren: Beyond Journey's End",
        tvDBId: 412444,
        format: 'TV',
        status: 'FINISHED',
        startDateYear: 2023,
        sources: [{ provider: 'IMDB', externalId: 'tt22247940' }],
      },
    },
  ]

  ;((prisma as any).user.findUnique as any) = async ({ where }: any) => {
    return mockUsers.find((u) => u.id === where.id) ?? null
  }

  ;((prisma as any).connection.findFirst as any) = async ({ where }: any) => {
    return (
      mockConnections.find(
        (c) =>
          c.userId === where.userId &&
          c.provider === where.provider &&
          c.status === where.status
      ) ?? null
    )
  }

  ;((prisma as any).movieList.findMany as any) = async ({ where }: any) => {
    return mockMovieLists.filter((m) => {
      if (where.userId && m.userId !== where.userId) return false
      if (where.status?.in && !where.status.in.includes(m.status)) return false
      if (
        where.movie?.status?.in &&
        !where.movie.status.in.includes(m.movie.status)
      )
        return false
      return true
    })
  }

  ;((prisma as any).tvList.findMany as any) = async ({ where }: any) => {
    return mockTvLists.filter((t) => {
      if (where.userId && t.userId !== where.userId) return false
      if (where.status?.in && !where.status.in.includes(t.status)) return false
      if (where.tv?.status?.in && !where.tv.status.in.includes(t.tv.status))
        return false
      return true
    })
  }

  ;((prisma as any).animeList.findMany as any) = async ({ where }: any) => {
    return mockAnimeLists.filter((a) => {
      if (where.userId && a.userId !== where.userId) return false
      if (where.status?.in && !where.status.in.includes(a.status)) return false
      if (
        where.anime?.format?.in &&
        !where.anime.format.in.includes(a.anime.format)
      )
        return false
      if (
        where.anime?.status?.in &&
        !where.anime.status.in.includes(a.anime.status)
      )
        return false
      return true
    })
  }
}

// -----------------------------------------------------------------------------
// Setup Adapters Mock
// -----------------------------------------------------------------------------

function setupAdaptersMock() {
  const radarrAdapter = getConnectionAdapter('RADARR') as any
  const sonarrAdapter = getConnectionAdapter('SONARR') as any

  // Radarr mocks
  radarrAdapter.getBlocklist = async () => ({
    page: 1,
    pageSize: 50,
    totalRecords: 1,
    records: [{ id: 10, movieTitle: 'Oppenheimer', protocol: 'torrent' }],
  })
  radarrAdapter.deleteBlocklist = async () => ({})
  radarrAdapter.deleteBlocklistBulk = async () => ({})
  radarrAdapter.executeCommand = async (_cred: any, payload: any) => ({
    id: 99,
    name: payload.name,
    state: 'started',
  })
  radarrAdapter.getMovieFiles = async () => [
    { id: 101, movieId: 1, relativePath: 'Oppenheimer.2023.mkv', size: 10737418240 },
  ]
  radarrAdapter.deleteMovieFile = async () => ({})
  radarrAdapter.getHistory = async () => ({
    page: 1,
    pageSize: 50,
    totalRecords: 1,
    records: [{ id: 201, eventType: 'grabbed', sourceTitle: 'Oppenheimer.2023' }],
  })
  radarrAdapter.getIndexers = async () => [
    { id: 1, name: 'Prowlarr Torrents', enableRss: true },
  ]
  radarrAdapter.getMovies = async () => [
    {
      id: 1,
      tmdbId: 872585,
      title: 'Oppenheimer',
      originalTitle: 'Oppenheimer',
      year: 2023,
      overview: 'The story of J. Robert Oppenheimer.',
      monitored: true,
      hasFile: true,
      qualityProfileId: 1,
      sizeOnDisk: 10737418240,
      images: [
        { coverType: 'poster', remoteUrl: 'https://example.com/opp.jpg' },
        { coverType: 'fanart', remoteUrl: 'https://example.com/opp-fanart.jpg' },
      ],
    },
  ]
  radarrAdapter.getQualityProfiles = async () => [
    { id: 1, name: 'Ultra-HD' },
    { id: 2, name: 'HD-1080p' },
  ]
  radarrAdapter.getRootFolders = async () => [
    { id: 1, path: '/data/media/movies', freeSpace: 500000000000 },
  ]
  radarrAdapter.lookupMovies = async () => [
    { id: 1, title: 'Oppenheimer', tmdbId: 872585, year: 2023 },
  ]
  radarrAdapter.addMovie = async (_cred: any, movie: any) => ({
    id: 1,
    ...movie,
  })
  radarrAdapter.bulkUpdateMovies = async (_cred: any, payload: any) => [
    { id: 1, ...payload },
  ]
  radarrAdapter.bulkDeleteMovies = async () => ({})
  radarrAdapter.getManualImport = async () => [
    { id: 1, path: '/downloads/Oppenheimer.mkv', quality: { name: 'Bluray-1080p' } },
  ]
  radarrAdapter.executeManualImport = async () => ({ imported: 1 })
  radarrAdapter.getQueue = async () => ({
    page: 1,
    pageSize: 50,
    totalRecords: 1,
    records: [{ id: 301, title: 'Oppenheimer', status: 'downloading', size: 1000000 }],
  })
  radarrAdapter.deleteQueueItem = async () => ({})
  radarrAdapter.getReleases = async () => [
    { guid: 'rel-1', title: 'Oppenheimer.2023.2160p', indexer: 'Tracker1' },
  ]
  radarrAdapter.downloadRelease = async () => ({ grabbed: true })
  radarrAdapter.getRenamePreview = async () => [
    { movieId: 1, existingPath: 'opp.mkv', newPath: 'Oppenheimer (2023).mkv' },
  ]
  radarrAdapter.getWantedCutoff = async () => ({
    page: 1,
    pageSize: 50,
    totalRecords: 1,
    records: [{ id: 1, title: 'Dune: Part Two' }],
  })
  radarrAdapter.getWantedMissing = async () => ({
    page: 1,
    pageSize: 50,
    totalRecords: 1,
    records: [{ id: 2, title: 'Civil War' }],
  })
  radarrAdapter.getMovieById = async (_cred: any, id: number) => ({
    id,
    title: 'Oppenheimer',
    tmdbId: 872585,
    year: 2023,
  })
  radarrAdapter.updateMovie = async (_cred: any, movie: any) => ({
    ...movie,
    title: movie.title || 'Oppenheimer',
    updated: true,
  })
  radarrAdapter.deleteMovie = async () => ({})

  // Sonarr mocks
  sonarrAdapter.getBlocklist = async () => ({
    page: 1,
    pageSize: 50,
    totalRecords: 1,
    records: [{ id: 11, seriesTitle: 'The Bear', protocol: 'torrent' }],
  })
  sonarrAdapter.deleteBlocklist = async () => ({})
  sonarrAdapter.deleteBlocklistBulk = async () => ({})
  sonarrAdapter.executeCommand = async (_cred: any, payload: any) => ({
    id: 100,
    name: payload.name,
    state: 'started',
  })
  sonarrAdapter.getEpisodeFiles = async () => [
    { id: 201, seriesId: 10, relativePath: 'Season 01/The.Bear.S01E01.mkv', size: 1048576000 },
  ]
  sonarrAdapter.deleteEpisodeFile = async () => ({})
  sonarrAdapter.getHistory = async () => ({
    page: 1,
    pageSize: 50,
    totalRecords: 1,
    records: [{ id: 401, eventType: 'downloadFolderImported', sourceTitle: 'The.Bear.S01E01' }],
  })
  sonarrAdapter.getIndexers = async () => [
    { id: 2, name: 'Usenet Indexer', enableRss: true },
  ]
  sonarrAdapter.getSeries = async () => [
    {
      id: 10,
      tvdbId: 403294,
      title: 'The Bear',
      originalTitle: 'The Bear',
      year: 2022,
      overview: 'A young chef returns home to manage family shop.',
      monitored: true,
      qualityProfileId: 1,
      statistics: {
        episodeCount: 18,
        episodeFileCount: 18,
        seasonCount: 2,
        sizeOnDisk: 18874368000,
      },
      images: [
        { coverType: 'poster', remoteUrl: 'https://example.com/bear.jpg' },
        { coverType: 'fanart', remoteUrl: 'https://example.com/bear-fanart.jpg' },
      ],
    },
  ]
  sonarrAdapter.getQualityProfiles = async () => [
    { id: 1, name: 'Web-1080p' },
  ]
  sonarrAdapter.getRootFolders = async () => [
    { id: 1, path: '/data/media/tv', freeSpace: 800000000000 },
  ]
  sonarrAdapter.lookupSeries = async () => [
    { id: 10, title: 'The Bear', tvdbId: 403294, year: 2022 },
  ]
  sonarrAdapter.addSeries = async (_cred: any, series: any) => ({
    id: 10,
    ...series,
  })
  sonarrAdapter.bulkUpdateSeries = async (_cred: any, payload: any) => [
    { id: 10, ...payload },
  ]
  sonarrAdapter.bulkDeleteSeries = async () => ({})
  sonarrAdapter.getManualImport = async () => [
    { id: 2, path: '/downloads/The.Bear.S02E01.mkv', seasonNumber: 2 },
  ]
  sonarrAdapter.executeManualImport = async () => ({ imported: 1 })
  sonarrAdapter.getQueue = async () => ({
    page: 1,
    pageSize: 50,
    totalRecords: 1,
    records: [{ id: 501, title: 'The Bear S02E01', status: 'downloading', size: 1048576000 }],
  })
  sonarrAdapter.deleteQueueItem = async () => ({})
  sonarrAdapter.getReleases = async () => [
    { guid: 'rel-2', title: 'The.Bear.S02E01.1080p', indexer: 'Tracker2' },
  ]
  sonarrAdapter.downloadRelease = async () => ({ grabbed: true })
  sonarrAdapter.getRenamePreview = async () => [
    { seriesId: 10, existingPath: 'bear.s01e01.mkv', newPath: 'The Bear - S01E01.mkv' },
  ]
  sonarrAdapter.getWantedCutoff = async () => ({
    page: 1,
    pageSize: 50,
    totalRecords: 1,
    records: [{ id: 10, title: 'The Bear' }],
  })
  sonarrAdapter.getWantedMissing = async () => ({
    page: 1,
    pageSize: 50,
    totalRecords: 1,
    records: [{ id: 20, title: 'Severance' }],
  })
  sonarrAdapter.getSeriesById = async (_cred: any, id: number) => ({
    id,
    title: 'The Bear',
    tvdbId: 403294,
    year: 2022,
  })
  sonarrAdapter.getEpisodes = async (_cred: any, seriesId: number) => [
    { id: 101, seriesId, episodeNumber: 1, title: 'System' },
  ]
  sonarrAdapter.updateSeries = async (_cred: any, series: any) => ({
    ...series,
    title: series.title || 'The Bear',
    updated: true,
  })
  sonarrAdapter.deleteSeries = async () => ({})
  sonarrAdapter.updateEpisode = async (_cred: any, ep: any) => ({
    ...ep,
    monitored: false,
    updated: true,
  })
  sonarrAdapter.setEpisodeMonitoring = async () => ({})
}

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------

describe('Unified Servarr Endpoints Test Suite (/servarr/:app/*)', () => {
  let aliceToken: string
  let bobToken: string

  beforeEach(async () => {
    setupPrismaMock()
    setupAdaptersMock()

    aliceToken = await signUserJwt({
      id: ALICE_ID,
      username: 'alice',
      email: 'alice@example.com',
    })

    bobToken = await signUserJwt({
      id: BOB_ID,
      username: 'bob',
      email: 'bob@example.com',
    })
  })

  // ===========================================================================
  // 1. Auth & Param Validation
  // ===========================================================================
  describe('Authentication & Parameter Validation', () => {
    it('returns 401 Unauthorized when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/blocklist')
      )
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.status).toBe(401)
    })

    it('returns 422 Unprocessable Content for invalid app param', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/invalid_app/blocklist', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(422)
    })

    it('returns connected: false gracefully when user has no connection', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/blocklist', {
          headers: { Authorization: `Bearer ${bobToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.connected).toBe(false)
      expect(body.message).toContain('No active RADARR connection found')
    })
  })

  // ===========================================================================
  // 2. Blocklist
  // ===========================================================================
  describe('Blocklist Operations', () => {
    it('GET /servarr/radarr/blocklist returns blocklist records', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/blocklist?page=1&pageSize=10', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.connected).toBe(true)
      expect(body.provider).toBe('RADARR')
      expect(body.records.length).toBe(1)
    })

    it('DELETE /servarr/radarr/blocklist removes single item by query id', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/blocklist?id=10', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it('DELETE /servarr/sonarr/blocklist bulk removes items by body ids', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/sonarr/blocklist', {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ids: [11, 12] }),
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })
  })

  // ===========================================================================
  // 3. Command
  // ===========================================================================
  describe('Command Operations', () => {
    it('POST /servarr/radarr/command triggers command', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/command', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ command: 'refresh' }),
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.command).toBe('RefreshMovie')
    })

    it('POST /servarr/sonarr/command triggers command', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/sonarr/command', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ command: 'searchMissing' }),
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.command).toBe('MissingEpisodeSearch')
    })
  })

  // ===========================================================================
  // 4. Files
  // ===========================================================================
  describe('Files Operations', () => {
    it('GET /servarr/radarr/files returns movie files', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/files?movieId=1', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.files.length).toBe(1)
    })

    it('GET /servarr/sonarr/files returns episode files', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/sonarr/files?seriesId=10', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.files.length).toBe(1)
    })

    it('DELETE /servarr/radarr/files deletes movie file', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/files?fileId=101', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })
  })

  // ===========================================================================
  // 5. History & Indexer
  // ===========================================================================
  describe('History & Indexer Operations', () => {
    it('GET /servarr/radarr/history returns audit records', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/history?page=1&pageSize=10', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.records.length).toBe(1)
    })

    it('GET /servarr/radarr/indexer returns configured indexers', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/indexer', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.indexers.length).toBe(1)
    })
  })

  // ===========================================================================
  // 6. Library & Local DB Fallback
  // ===========================================================================
  describe('Library Operations', () => {
    it('GET /servarr/radarr/library returns live Radarr library', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/library', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.items.length).toBe(1)
      expect(body.items[0].title).toBe('Oppenheimer')
      expect(body.items[0].qualityProfile).toBe('Ultra-HD')
      expect(body.items[0].status).toBe('Downloaded')
    })

    it('GET /servarr/sonarr/library returns live Sonarr series library', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/sonarr/library', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.items.length).toBe(1)
      expect(body.items[0].title).toBe('The Bear')
      expect(body.items[0].episodeCount).toBe(18)
    })

    it('GET /servarr/radarr/library falls back to local database when live fetch fails', async () => {
      const radarrAdapter = getConnectionAdapter('RADARR') as any
      radarrAdapter.getMovies = async () => {
        throw new Error('Connection refused')
      }

      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/library', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.isLocalFallback).toBe(true)
      expect(body.items[0].title).toBe('Spirited Away')
    })
  })

  // ===========================================================================
  // 7. Lookup & Add Media
  // ===========================================================================
  describe('Lookup & Add Media', () => {
    it('GET /servarr/radarr/lookup returns search results and root folders', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/lookup?term=Oppenheimer', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.records.length).toBe(1)
      expect(body.rootFolders.length).toBe(1)
      expect(body.qualityProfiles.length).toBe(2)
    })

    it('POST /servarr/radarr/lookup adds movie', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/lookup', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Inception',
            tmdbId: 27205,
            rootFolderPath: '/data/media/movies',
            qualityProfileId: 1,
          }),
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.movie.title).toBe('Inception')
    })
  })

  // ===========================================================================
  // 8. Manage (Batch Update / Delete)
  // ===========================================================================
  describe('Batch Manage Operations', () => {
    it('PUT /servarr/radarr/manage updates movies in batch', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/manage', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            movieIds: [1],
            monitored: false,
          }),
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('Successfully updated 1 movies')
    })

    it('DELETE /servarr/radarr/manage deletes movies in batch', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/manage', {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            movieIds: [1],
            deleteFiles: true,
          }),
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('Successfully deleted 1 movies')
    })
  })

  // ===========================================================================
  // 9. Manual Import
  // ===========================================================================
  describe('Manual Import Operations', () => {
    it('GET /servarr/radarr/manualimport previews files', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/manualimport?folder=/downloads', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.items.length).toBe(1)
    })

    it('POST /servarr/radarr/manualimport executes import', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/manualimport', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            files: [{ path: '/downloads/Oppenheimer.mkv', movieId: 1 }],
          }),
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('Manual import initiated successfully')
    })
  })

  // ===========================================================================
  // 10. Queue
  // ===========================================================================
  describe('Download Queue Operations', () => {
    it('GET /servarr/radarr/queue returns download queue', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/queue', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.records.length).toBe(1)
    })

    it('DELETE /servarr/radarr/queue removes item from queue', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/queue?id=301&removeFromClient=true', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('Download removed from queue successfully')
    })
  })

  // ===========================================================================
  // 11. Release Search & Grab
  // ===========================================================================
  describe('Release Operations', () => {
    it('GET /servarr/radarr/release returns release search results', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/release?movieId=1', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.releases.length).toBe(1)
    })

    it('POST /servarr/radarr/release grabs release', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/release', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            guid: 'rel-1',
            title: 'Oppenheimer.2023.2160p',
          }),
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('Release grabbed and queued for download')
    })
  })

  // ===========================================================================
  // 12. Rename
  // ===========================================================================
  describe('Rename Operations', () => {
    it('GET /servarr/radarr/rename previews filename rename', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/rename?movieId=1', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.records.length).toBe(1)
    })

    it('POST /servarr/radarr/rename executes rename', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/rename', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            movieId: 1,
            files: [101],
          }),
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })
  })

  // ===========================================================================
  // 13. Wanted (Cutoff & Missing)
  // ===========================================================================
  describe('Wanted Cutoff & Missing Operations', () => {
    it('GET /servarr/radarr/wanted/cutoff returns cutoff unmet items', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/wanted/cutoff', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.records.length).toBe(1)
    })

    it('GET /servarr/radarr/wanted/missing returns missing items', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/wanted/missing', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.records.length).toBe(1)
    })
  })

  // ===========================================================================
  // 14. Radarr Specific (Movies & Feeds)
  // ===========================================================================
  describe('Radarr Specific Operations', () => {
    it('GET /servarr/radarr/movies returns managed movies feed', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/movies', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body)).toBe(true)
      expect(body.length).toBe(1)
      expect(body[0].title).toBe('Spirited Away')
      expect(body[0].tmdbId).toBe(501)
      expect(body[0].monitored).toBe(true)
      expect(body[0].hasFile).toBe(true)
    })

    it('GET /servarr/radarr/movies/:id returns movie details and files', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/movies/1', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.movie.title).toBe('Oppenheimer')
      expect(body.files.length).toBe(1)
    })

    it('PUT /servarr/radarr/movies/:id updates movie details', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/movies/1', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ monitored: false }),
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.movie.updated).toBe(true)
    })

    it('DELETE /servarr/radarr/movies/:id deletes movie from library', async () => {
      const res = await app.handle(
        new Request(
          'http://localhost/servarr/radarr/movies/1?deleteFiles=true&addImportListExclusion=true',
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${aliceToken}` },
          }
        )
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.provider).toBe('RADARR')
    })

    it('GET /servarr/radarr/movies/anime returns anime movies import feed', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/movies/anime', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body)).toBe(true)
      expect(body.length).toBe(1)
      expect(body[0].title).toBe('Your Name.')
      expect(body[0].tmdbId).toBe(372058)
    })

    it('GET /servarr/radarr/movies/anime/api/v3/movie proxies anime movie feed', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/movies/anime/api/v3/movie', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body)).toBe(true)
      expect(body.length).toBe(1)
      expect(body[0].title).toBe('Your Name.')
    })

    it('GET /servarr/radarr/movies/anime/api/v3/qualityprofile returns quality profiles without auth', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/movies/anime/api/v3/qualityprofile')
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body)).toBe(true)
      expect(body[0].name).toBe('Any')
    })

    it('GET /servarr/radarr/movies/anime/api/v3/system/status returns system status without auth', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/movies/anime/api/v3/system/status')
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.appName).toBe('IRIS')
      expect(body.version).toBe('3.0.0')
    })

    it('GET /servarr/radarr/movies/api/v3/movie proxies standard movies feed', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/movies/api/v3/movie', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body)).toBe(true)
      expect(body[0].title).toBe('Spirited Away')
    })

    it('GET /servarr/radarr/movies/api/v3/qualityprofile returns quality profiles', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/movies/api/v3/qualityprofile')
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body[0].name).toBe('Any')
    })

    it('GET /servarr/radarr/movies/api/v3/system/status returns system status', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/radarr/movies/api/v3/system/status')
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.appName).toBe('IRIS')
    })
  })

  // ===========================================================================
  // 15. Sonarr Specific (Series, Episodes & Feeds)
  // ===========================================================================
  describe('Sonarr Specific Operations', () => {
    it('GET /servarr/sonarr/series/:id returns series details, episodes, and files', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/sonarr/series/10', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.series.title).toBe('The Bear')
      expect(body.episodes.length).toBe(1)
      expect(body.files.length).toBe(1)
    })

    it('PUT /servarr/sonarr/series/:id updates series details', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/sonarr/series/10', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ monitored: false }),
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.series.updated).toBe(true)
    })

    it('DELETE /servarr/sonarr/series/:id deletes series from library', async () => {
      const res = await app.handle(
        new Request(
          'http://localhost/servarr/sonarr/series/10?deleteFiles=true&addImportListExclusion=true',
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${aliceToken}` },
          }
        )
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.provider).toBe('SONARR')
    })

    it('PUT /servarr/sonarr/episode/:id updates episode details', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/sonarr/episode/101', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ monitored: false }),
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.episode.updated).toBe(true)
    })

    it('PUT /servarr/sonarr/episode/monitor batch toggles episode monitor state', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/sonarr/episode/monitor', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ episodeIds: [101, 102], monitored: false }),
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.provider).toBe('SONARR')
    })

    it('GET /servarr/sonarr/anime returns anime series feed', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/sonarr/anime', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body)).toBe(true)
      expect(body.length).toBe(1)
      expect(body[0].title).toBe("Frieren: Beyond Journey's End")
      expect(body[0].tvdbId).toBe(412444)
      expect(body[0].seriesType).toBe('anime')
      expect(body[0].seasonFolder).toBe(true)
    })

    it('GET /servarr/sonarr/anime/api/v3/series proxies anime series feed', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/sonarr/anime/api/v3/series', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body)).toBe(true)
      expect(body[0].title).toBe("Frieren: Beyond Journey's End")
    })

    it('GET /servarr/sonarr/anime/api/v3/qualityprofile returns quality profiles', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/sonarr/anime/api/v3/qualityprofile')
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body[0].name).toBe('Any')
    })

    it('GET /servarr/sonarr/anime/api/v3/system/status returns system status', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/sonarr/anime/api/v3/system/status')
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.appName).toBe('IRIS')
    })

    it('GET /servarr/sonarr/tv returns managed TV series feed', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/sonarr/tv', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body)).toBe(true)
      expect(body.length).toBe(1)
      expect(body[0].title).toBe('Breaking Bad')
      expect(body[0].tvdbId).toBe(81189)
      expect(body[0].seriesType).toBe('standard')
      expect(body[0].seasonFolder).toBe(true)
    })

    it('GET /servarr/sonarr/tv/api/v3/series proxies TV series feed', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/sonarr/tv/api/v3/series', {
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body)).toBe(true)
      expect(body[0].title).toBe('Breaking Bad')
    })

    it('GET /servarr/sonarr/tv/api/v3/qualityprofile returns quality profiles', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/sonarr/tv/api/v3/qualityprofile')
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body[0].name).toBe('Any')
    })

    it('GET /servarr/sonarr/tv/api/v3/system/status returns system status', async () => {
      const res = await app.handle(
        new Request('http://localhost/servarr/sonarr/tv/api/v3/system/status')
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.appName).toBe('IRIS')
    })
  })
})
