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
    title: `Borealis | Lists > ${displayName} > Other`,
    description: `View ${displayName}'s custom tracked items on Borealis.`,
  }
}

export default async function OtherListPage({ params }: Props) {
  const { userId } = await params
  const userData = await getUserProfile(userId)

  return (
    <UserListView
      username={userData?.username ?? userId}
      userId={userData?.id ?? userId}
      mediaType="other"
      initialProfile={userData?.profile ?? null}
    />
  )
}
