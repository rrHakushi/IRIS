import type { Metadata } from "next"
import { getUserProfile } from "@/lib/user-profile"
import { UserListView } from "@/components/lists/user-list-view"

type Props = {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  const decodedUsername = decodeURIComponent(username)
  return {
    title: `IRIS List | ${decodedUsername}'s Anime List`,
    description: `Browse ${decodedUsername}'s anime list, ratings, and progress on IRIS List.`,
  }
}

export default async function AnimeListPage({ params }: Props) {
  const { username } = await params
  const decodedUsername = decodeURIComponent(username)
  const userData = await getUserProfile(decodedUsername)

  return (
    <UserListView
      username={decodedUsername}
      mediaType="anime"
      initialProfile={userData?.profile ?? null}
    />
  )
}
