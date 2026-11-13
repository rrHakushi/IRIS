import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function CarinaPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/carina/auth/login")
  }

  redirect(`/carina/users/${session.user.id}`)
}
