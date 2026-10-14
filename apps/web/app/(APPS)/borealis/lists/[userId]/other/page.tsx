import type { Metadata } from "next"
import { getUserProfile } from "@/lib/user-profile"

type Props = {
  params: Promise<{ userId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { userId } = await params
  const userData = await getUserProfile(userId)
  const displayName = userData?.username ?? userId
  return {
    title: `Borealis | Lists > ${displayName} > Other Lists`,
    description: `View ${displayName}'s other lists on Borealis.`,
  }
}

export default function Page() {
  return <>page</>
}
