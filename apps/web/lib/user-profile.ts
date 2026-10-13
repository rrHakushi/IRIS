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

/**
 * Fetches user profile customization via Elysia Eden Treaty API (/users/:username).
 */
export async function getUserProfile(
  username: string
): Promise<UserProfileData | null> {
  if (!username) return null

  try {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        username
      )
    let userData: any = null
    if (isUuid) {
      const res = await elysia.carina.users({ userId: username }).get()
      if (!res.error && res.data?.user) {
        userData = res.data.user
      }
    } else {
      const searchRes = await elysia.carina.users.get({
        query: { q: username, limit: 1 },
      })
      const found = searchRes.data?.users?.find(
        (u) => u.username.toLowerCase() === username.toLowerCase()
      )
      if (found) {
        const profileRes = await elysia.carina.users({ userId: found.id }).get()
        if (!profileRes.error && profileRes.data?.user) {
          userData = profileRes.data.user
        }
      }
    }

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
