import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { elysia } from "@/lib/elysia"
import { getProfileCustomization } from "@IRIS/shared"
import { UserProfileView } from "@/components/account/user-profile-view"

type Props = {
  params: Promise<{ name: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params
  const decodedName = decodeURIComponent(name)
  return {
    title: `${decodedName} | IRIS Profile`,
    description: `View ${decodedName}'s profile, media library, stats, and activity on IRIS.`,
  }
}

export default async function Page({ params }: Props) {
  const { name } = await params
  const decodedName = decodeURIComponent(name)

  let userData: any = null

  try {
    const res = await elysia.users({ username: decodedName }).get()
    if (!res.error && res.data?.success && res.data.user) {
      userData = res.data.user
    }
  } catch (err) {
    console.error(`[UserProfilePage] Failed to fetch user '${decodedName}':`, err)
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
