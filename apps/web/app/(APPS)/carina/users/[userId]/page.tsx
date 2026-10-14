import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { elysia } from "@/lib/elysia"
import { getProfileCustomization } from "@IRIS/shared"
import { UserProfileView } from "@/components/account/user-profile-view"

type Props = {
  params: Promise<{ userId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { userId } = await params
  return {
    title: `Carina | Profile > ${userId}`,
    description: `View user profile, media library, stats, and activity on IRIS.`,
  }
}

export default async function Page({ params }: Props) {
  const { userId } = await params

  let userData: any = null

  try {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        userId
      )
    if (isUuid) {
      const res = await elysia.carina.users({ userId }).get()
      if (!res.error && res.data?.success && res.data.user) {
        userData = res.data.user
      }
    } else {
      // Backward-compatibility: if legacy route provided a username, search for ID
      const searchRes = await elysia.carina.users.get({
        query: { q: userId, limit: 1 },
      })
      const found = searchRes.data?.users?.find(
        (u) => u.username.toLowerCase() === userId.toLowerCase()
      )
      if (found) {
        const res = await elysia.carina.users({ userId: found.id }).get()
        if (!res.error && res.data?.success && res.data.user) {
          userData = res.data.user
        }
      }
    }
  } catch (err) {
    console.error(`[UserProfilePage] Failed to fetch user '${userId}':`, err)
  }

  if (!userData) {
    notFound()
  }

  const profile = getProfileCustomization(userData.customization)

  return (
    <UserProfileView
      user={{
        id: userData.id,
        username: userData.username,
        customization: userData.customization,
        createdAt: userData.createdAt,
        connections: userData.connections || [],
      }}
      profile={profile}
    />
  )
}
