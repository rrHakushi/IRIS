import type { Metadata } from "next"
import { getUserProfile } from "@/lib/user-profile"
import { CustomListsView } from "@/components/lists/custom-lists-view"

type Props = {
  params: Promise<{ userId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { userId } = await params
  const userData = await getUserProfile(userId)
  const displayName = userData?.username ?? userId
  return {
    title: `Borealis | Lists > ${displayName} > Custom Lists`,
    description: `View ${displayName}'s custom lists on Borealis.`,
  }
}

export default async function CustomListsPage({ params }: Props) {
  const { userId } = await params
  const userData = await getUserProfile(userId)

  return (
    <CustomListsView
      username={userData?.username ?? userId}
      userId={userData?.id ?? userId}
      initialProfile={userData?.profile ?? null}
    />
  )
}
