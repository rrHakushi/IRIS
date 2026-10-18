import { getServerSession } from "next-auth/next"
import { authOptions } from "@IRIS/auth"
import { redirect } from "next/navigation"

export default async function CarinaPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect("/carina/auth/login")
  }

  redirect(`/carina/users/${session.user.id}`)
}
