import { elysia } from "@/lib/elysia"
import {
  getProfileCustomization,
  type UserProfileCustomization,
} from "@IRIS/shared"

export interface UserProfileData {
  id?: string
  username: string
  profile: UserProfileCustomization
  createdAt?: string
}

const userProfileCache = new Map<string, { data: any; timestamp: number }>()
const userProfileInFlight = new Map<string, Promise<any>>()
const USER_PROFILE_CACHE_TTL = 30 * 1000 // 30 seconds

export function invalidateCarinaUserCache(userIdOrUsername?: string) {
  if (userIdOrUsername) {
    userProfileCache.delete(userIdOrUsername.trim().toLowerCase())
  } else {
    userProfileCache.clear()
  }
}

/**
 * Fetches user profile customization via Elysia Eden Treaty API (/carina/users/:userId)
 * with in-flight deduplication and 30s cache.
 */
export async function fetchCarinaUser(
  userIdOrUsername: string
): Promise<any | null> {
  if (!userIdOrUsername) return null
  const key = userIdOrUsername.trim().toLowerCase()

  const cached = userProfileCache.get(key)
  if (cached && Date.now() - cached.timestamp < USER_PROFILE_CACHE_TTL) {
    return cached.data
  }

  const existing = userProfileInFlight.get(key)
  if (existing) {
    return await existing
  }

  const promise = (async () => {
    try {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          userIdOrUsername
        )
      let userData: any = null
      if (isUuid) {
        const res = await elysia.carina.users({ userId: userIdOrUsername }).get()
        if (!res.error && res.data?.user) {
          userData = res.data.user
        }
      } else {
        const searchRes = await elysia.carina.users.get({
          query: { q: userIdOrUsername, limit: 1 },
        })
        const found = searchRes.data?.users?.find(
          (u) => u.username.toLowerCase() === userIdOrUsername.toLowerCase()
        )
        if (found) {
          const profileRes = await elysia.carina.users({ userId: found.id }).get()
          if (!profileRes.error && profileRes.data?.user) {
            userData = profileRes.data.user
          }
        }
      }

      if (userData) {
        userProfileCache.set(key, { data: userData, timestamp: Date.now() })
        if (userData.id && userData.id.toLowerCase() !== key) {
          userProfileCache.set(userData.id.toLowerCase(), {
            data: userData,
            timestamp: Date.now(),
          })
        }
        if (userData.username && userData.username.toLowerCase() !== key) {
          userProfileCache.set(userData.username.toLowerCase(), {
            data: userData,
            timestamp: Date.now(),
          })
        }
      }

      return userData
    } catch (error) {
      console.error(
        `[fetchCarinaUser] Failed to fetch profile for ${userIdOrUsername}:`,
        error
      )
      return null
    }
  })().finally(() => {
    userProfileInFlight.delete(key)
  })

  userProfileInFlight.set(key, promise)
  return await promise
}

/**
 * Fetches user profile customization via Elysia Eden Treaty API (/users/:username).
 */
export async function getUserProfile(
  username: string
): Promise<UserProfileData | null> {
  if (!username) return null

  try {
    const userData = await fetchCarinaUser(username)
    if (!userData) {
      return null
    }

    const profile = getProfileCustomization(userData.customization)

    return {
      id: userData.id,
      username: userData.username,
      profile,
      createdAt: userData.createdAt,
    }
  } catch (error) {
    console.error(
      `[getUserProfile] Failed to fetch profile for ${username}:`,
      error
    )
    return null
  }
}

/**
 * Resolves an identifier (UUID or username) to a user ID.
 */
export async function resolveUserId(
  identifier: string
): Promise<string | null> {
  if (!identifier) return null
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      identifier
    )
  if (isUuid) return identifier
  const user = await getUserProfile(identifier)
  return user?.id || null
}
