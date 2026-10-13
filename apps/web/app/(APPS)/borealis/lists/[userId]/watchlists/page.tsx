import { redirect } from "next/navigation"

type Props = {
  params: Promise<{ userId: string }>
}

export default async function WatchlistsPage({ params }: Props) {
  const { userId } = await params
  redirect(`/borealis/lists/${userId}/custom-lists`)
}
