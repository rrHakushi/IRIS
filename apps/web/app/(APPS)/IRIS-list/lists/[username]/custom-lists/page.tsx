import type { Metadata } from "next"
import { getUserProfile } from "@/lib/user-profile"
import { CustomListsView } from "@/components/lists/custom-lists-view"

type Props = {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  const decodedUsername = decodeURIComponent(username)
  return {
    title: `IRIS List | ${decodedUsername}'s Custom Lists`,
    description: `View ${decodedUsername}'s custom lists.`,
  }
}

export default async function CustomListsPage({ params }: Props) {
  const { username } = await params
  const decodedUsername = decodeURIComponent(username)
  const userData = await getUserProfile(decodedUsername)

  return (
    <CustomListsView
      username={decodedUsername}
      initialProfile={userData?.profile ?? null}
    />
  )
}
