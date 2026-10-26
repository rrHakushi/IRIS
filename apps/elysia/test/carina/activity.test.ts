import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia } from 'elysia'
import { carinaUsers } from '../../src/api/controllers/carina/users.ctrl'
import { ActivityServ } from '../../src/services/carina/activity.serv'
import { CarinaUsersServ } from '../../src/services/carina/users.serv'
import { prisma } from '@IRIS/database'

// -----------------------------------------------------------------------------
// In-Memory Database Mock for Activity Testing
// -----------------------------------------------------------------------------

interface MockActivityLog {
  id: string
  userId: string
  type: string
  mediaType: string | null
  mediaId: number | null
  status?: string | null
  progress?: number | null
  progressVolumes?: number | null
  score?: number | null
  title: string
  content?: string | null
  metadata: any
  isPrivate: boolean
  isSpoiler?: boolean
  likeCount?: number
  replyCount?: number
  createdAt: Date
}

let mockActivities: MockActivityLog[] = []
let mockUsers: any[] = []

function setupPrismaMock() {
  mockActivities = []
  mockUsers = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'alice',
      email: 'alice@example.com',
      permissions: [],
      customization: {
        accentColor: '#3b82f6',
        profileColor: '#1d4ed8',
        banner: 'https://example.com/banner.jpg',
        avatar: 'https://example.com/avatar.jpg',
        bio: 'Hello world',
        roleBadge: 'FOUNDER',
      },
      profile: {
        name: 'Alice Cooper',
      },
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      username: 'bob',
      email: 'bob@example.com',
      permissions: [],
      customization: null,
      profile: null,
    },
  ]

  // Mock ActivityLog.create
  ;((prisma as any).activityLog.create as any) = async ({ data }: any) => {
    const entry: MockActivityLog = {
      id: `act-${mockActivities.length + 1}`,
      userId: data.userId,
      type: data.type,
      mediaType: data.mediaType ?? null,
      mediaId: data.mediaId ?? null,
      status: data.status ?? null,
      progress: data.progress ?? null,
      progressVolumes: data.progressVolumes ?? null,
      score: data.score ?? null,
      title: data.title,
      content: data.content ?? null,
      metadata: data.metadata ?? null,
      isPrivate: Boolean(data.isPrivate),
      isSpoiler: Boolean(data.isSpoiler),
      likeCount: data.likeCount ?? 0,
      replyCount: data.replyCount ?? 0,
      createdAt: new Date(),
    }
    mockActivities.unshift(entry)
    return entry
  }

  // Mock ActivityLog.findMany
  ;((prisma as any).activityLog.findMany as any) = async (args: any = {}) => {
    let items = [...mockActivities]
    const where = args.where || {}

    if (where.userId) {
      items = items.filter((a) => a.userId === where.userId)
    }
    if (where.isPrivate === false) {
      items = items.filter((a) => !a.isPrivate)
    }
    if (where.type) {
      if (typeof where.type === 'string') {
        items = items.filter((a) => a.type === where.type)
      } else if (where.type.in) {
        items = items.filter((a) => where.type.in.includes(a.type))
      }
    }
    if (where.mediaType) {
      if (typeof where.mediaType === 'string') {
        items = items.filter((a) => a.mediaType === where.mediaType)
      } else if (where.mediaType.in) {
        items = items.filter((a) => where.mediaType.in.includes(a.mediaType))
      }
    }
    if (where.createdAt?.lt) {
      items = items.filter((a) => a.createdAt < where.createdAt.lt)
    }

    const skip = args.skip || 0
    const take = args.take || items.length
    const paged = items.slice(skip, skip + take)

    return paged.map((a) => ({
      ...a,
      user: mockUsers.find((u) => u.id === a.userId) || {
        id: a.userId,
        username: 'user',
        customization: null,
      },
    }))
  }

  // Mock ActivityLog.count
  ;((prisma as any).activityLog.count as any) = async (args: any = {}) => {
    const items = await ((prisma as any).activityLog.findMany as any)(args)
    return items.length
  }

  // Mock ActivityLog.deleteMany
  ;((prisma as any).activityLog.deleteMany as any) = async ({ where }: any) => {
    const beforeCount = mockActivities.length
    if (where?.createdAt?.lt) {
      mockActivities = mockActivities.filter((a) => a.createdAt >= where.createdAt.lt)
    }
    return { count: beforeCount - mockActivities.length }
  }

  // Mock User.findUnique
  ;((prisma as any).user.findUnique as any) = async ({ where }: any) => {
    return mockUsers.find((u) => u.id === where.id || u.username === where.username) ?? null
  }

  // Mock Anime.findUnique
  ;((prisma as any).anime.findUnique as any) = async ({ where }: any) => {
    if (where.id === 101) {
      return {
        id: 101,
        titlePrimary: "Frieren: Beyond Journey's End",
        titleSecondary: "Sousou no Frieren",
        coverImage: "https://example.com/cover.jpg",
      }
    }
    return null
  }
}

describe('Activity Tracking & Feed System', () => {
  beforeEach(() => {
    setupPrismaMock()
  })

  it('records media list activity correctly via ActivityServ', async () => {
    ActivityServ.recordMediaListActivity({
      userId: '00000000-0000-0000-0000-000000000001',
      mediaType: 'ANIME',
      mediaId: 101,
      action: 'ADDED',
      title: 'Frieren: Beyond Journey\'s End',
      coverImage: 'https://example.com/cover.jpg',
      status: 'PLANNING',
      progress: 0,
    })

    // Wait for setImmediate
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(mockActivities.length).toBe(1)
    const act = mockActivities[0]!
    expect(act.type).toBe('LIST_ITEM_ADDED')
    expect(act.mediaType).toBe('ANIME')
    expect(act.mediaId).toBe(101)
    expect(act.title).toBe('Frieren: Beyond Journey\'s End')
    expect(act.metadata?.coverImage).toBe('https://example.com/cover.jpg')
  })

  it('records favorite activity correctly', async () => {
    ActivityServ.recordFavoriteActivity({
      userId: '00000000-0000-0000-0000-000000000001',
      action: 'FAVORITE_ADDED',
      favoriteType: 'ANIME',
      targetId: 101,
    })

    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(mockActivities.length).toBe(1)
    const act = mockActivities[0]!
    expect(act.type).toBe('FAVORITE_ADDED')
    expect(act.mediaType).toBe('ANIME')
    expect(act.mediaId).toBe(101)
    expect(act.title).toBe("Added Frieren: Beyond Journey's End to favorites")
  })

  it('records bilateral friendship activity', async () => {
    ActivityServ.recordFriendActivity({
      userId: '00000000-0000-0000-0000-000000000001',
      friendId: '00000000-0000-0000-0000-000000000002',
      friendUsername: 'bob',
    })

    await new Promise((resolve) => setTimeout(resolve, 30))

    // Calling recordFriendActivity records activity with type FRIEND_ADDED
    expect(mockActivities.length).toBe(1)
    const act = mockActivities[0]!
    expect(act.type).toBe('FRIEND_ADDED')
    expect(act.metadata?.friendId).toBe('00000000-0000-0000-0000-000000000002')
  })

  it('correctly filters activity by category and mediaType in CarinaUsersServ', async () => {
    // Seed Anime, Manga, and Social activities
    mockActivities.push(
      {
        id: '1',
        userId: '00000000-0000-0000-0000-000000000001',
        type: 'LIST_ITEM_ADDED',
        mediaType: 'ANIME',
        mediaId: 101,
        title: 'Added Anime',
        metadata: { mediaType: 'ANIME' },
        isPrivate: false,
        createdAt: new Date(),
      },
      {
        id: '2',
        userId: '00000000-0000-0000-0000-000000000001',
        type: 'LIST_PROGRESS_UPDATED',
        mediaType: 'MANGA',
        mediaId: 202,
        title: 'Read chapter 5',
        metadata: { mediaType: 'MANGA' },
        isPrivate: false,
        createdAt: new Date(),
      },
      {
        id: '3',
        userId: '00000000-0000-0000-0000-000000000001',
        type: 'FAVORITE_ADDED',
        mediaType: null,
        mediaId: null,
        title: 'Favorited a character',
        metadata: {},
        isPrivate: false,
        createdAt: new Date(),
      }
    )

    const sessionUser = { id: '00000000-0000-0000-0000-000000000001', permissions: [] }

    // Query 'anime' category
    const animeResult = await CarinaUsersServ.getUserActivityByCategory(
      '00000000-0000-0000-0000-000000000001',
      'anime',
      { page: 1, limit: 10 },
      sessionUser
    )
    expect(animeResult.activities.length).toBe(1)
    expect(animeResult.activities[0]!.mediaType).toBe('ANIME')

    // Query 'manga' category
    const mangaResult = await CarinaUsersServ.getUserActivityByCategory(
      '00000000-0000-0000-0000-000000000001',
      'manga',
      { page: 1, limit: 10 },
      sessionUser
    )
    expect(mangaResult.activities.length).toBe(1)
    expect(mangaResult.activities[0]!.mediaType).toBe('MANGA')

    // Query 'social' category
    const socialResult = await CarinaUsersServ.getUserActivityByCategory(
      '00000000-0000-0000-0000-000000000001',
      'social',
      { page: 1, limit: 10 },
      sessionUser
    )
    expect(socialResult.activities.length).toBe(1)
    expect(socialResult.activities[0]!.type).toBe('FAVORITE_ADDED')

    // Query 'overview' category
    const overviewResult = await CarinaUsersServ.getUserActivityByCategory(
      '00000000-0000-0000-0000-000000000001',
      'overview',
      { page: 1, limit: 10 },
      sessionUser
    )
    expect(overviewResult.activities.length).toBe(3)
  })

  it('filters activity by action query parameter', async () => {
    mockActivities.push(
      {
        id: '1',
        userId: '00000000-0000-0000-0000-000000000001',
        type: 'LIST_ITEM_ADDED',
        mediaType: 'ANIME',
        mediaId: 101,
        title: 'Added Anime',
        metadata: {},
        isPrivate: false,
        createdAt: new Date(),
      },
      {
        id: '2',
        userId: '00000000-0000-0000-0000-000000000001',
        type: 'LIST_PROGRESS_UPDATED',
        mediaType: 'ANIME',
        mediaId: 101,
        title: 'Watched episode 2',
        metadata: {},
        isPrivate: false,
        createdAt: new Date(),
      }
    )

    const sessionUser = { id: '00000000-0000-0000-0000-000000000001', permissions: [] }

    const result = await CarinaUsersServ.getUserActivityByCategory(
      '00000000-0000-0000-0000-000000000001',
      'anime',
      { page: 1, limit: 10, action: 'PROGRESS' },
      sessionUser
    )
    expect(result.activities.length).toBe(1)
    expect(result.activities[0]!.type).toBe('LIST_PROGRESS_UPDATED')
  })

  it('purges activities older than retention threshold', async () => {
    const oldDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000)
    mockActivities.push(
      {
        id: 'old',
        userId: '00000000-0000-0000-0000-000000000001',
        type: 'LIST_ITEM_ADDED',
        mediaType: 'ANIME',
        mediaId: 1,
        title: 'Ancient activity',
        metadata: {},
        isPrivate: false,
        createdAt: oldDate,
      },
      {
        id: 'fresh',
        userId: '00000000-0000-0000-0000-000000000001',
        type: 'LIST_ITEM_ADDED',
        mediaType: 'ANIME',
        mediaId: 2,
        title: 'Fresh activity',
        metadata: {},
        isPrivate: false,
        createdAt: new Date(),
      }
    )

    const purged = await ActivityServ.purgeOldActivities(30)
    expect(purged).toBe(1)
    expect(mockActivities.length).toBe(1)
    expect(mockActivities[0]!.id).toBe('fresh')
  })

  it('Elysia route accepts media categories without 400 Bad Request', async () => {
    const testApp = new Elysia().use(carinaUsers)

    const res = await testApp.handle(
      new Request('http://localhost/carina/users/00000000-0000-0000-0000-000000000001/activity/anime')
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(Array.isArray(json.activities)).toBe(true)
  })
})
