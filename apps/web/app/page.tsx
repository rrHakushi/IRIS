import { getServerSession } from "next-auth/next"
import { authOptions } from "@IRIS/auth"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export default async function RootPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/IRIS-account/auth/login")
  }

  const cookieStore = await cookies()
  const rawLastApp = cookieStore.get("iris_last_app")?.value
  let targetPath = "/IRIS-list"

  if (rawLastApp) {
    try {
      const decoded = decodeURIComponent(rawLastApp)
      // Ensure target path is a safe internal route and not an auth page
      if (
        decoded.startsWith("/") &&
        !decoded.startsWith("//") &&
        !decoded.includes("/auth/")
      ) {
        targetPath = decoded
      }
    } catch {
      targetPath = "/IRIS-list"
    }
  }

  redirect(targetPath)
}
