import { redirect } from "next/navigation"

type Props = {
  params: Promise<{ username: string }>
}

export default async function UserListsIndexPage({ params }: Props) {
  const { username } = await params
  redirect(`/IRIS-list/lists/${username}/anime`)
}
