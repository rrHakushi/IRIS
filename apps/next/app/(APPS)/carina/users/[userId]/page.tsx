import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { fetchCarinaUser } from "@/lib/user-profile"
import { getProfileCustomization } from "@NamelessLiberty/shared"
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

  const userData = await fetchCarinaUser(userId)

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
