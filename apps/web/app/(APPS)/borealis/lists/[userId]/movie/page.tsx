import type { Metadata } from "next"
import { getUserProfile } from "@/lib/user-profile"
import { UserListView } from "@/components/lists/user-list-view"

type Props = {
  params: Promise<{ userId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { userId } = await params
  const userData = await getUserProfile(userId)
  const displayName = userData?.username ?? userId
  return {
    title: `Borealis | ${displayName}'s Movie List`,
    description: `View ${displayName}'s movie list on Borealis.`,
  }
}

export default async function MovieListPage({ params }: Props) {
  const { userId } = await params
  const userData = await getUserProfile(userId)

  return (
    <UserListView
      username={userData?.username ?? userId}
      userId={userData?.id ?? userId}
      mediaType="movie"
      initialProfile={userData?.profile ?? null}
    />
  )
}
