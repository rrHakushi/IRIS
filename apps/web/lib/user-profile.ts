import { elysia } from "@/lib/elysia"
import {
  getProfileCustomization,
  type UserProfileCustomization,
} from "@IRIS/shared"

export interface UserProfileData {
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
    const { data, error } = await elysia.users({ username }).get()

    if (error || !data?.user) {
      return null
    }

    const userData = data.user
    const profile = getProfileCustomization(userData.customization)

    return {
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
