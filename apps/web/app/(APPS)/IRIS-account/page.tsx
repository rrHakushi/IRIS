import { getServerSession } from "next-auth/next"
import { authOptions } from "@IRIS/auth"
import { redirect } from "next/navigation"

export default async function IrisAccountPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.username) {
    redirect("/IRIS-account/auth/login")
  }

  redirect(`/IRIS-account/users/${encodeURIComponent(session.user.username)}`)
}
