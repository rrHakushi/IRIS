import { auth } from "@/lib/auth"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export default async function RootPage() {
  const session = await auth()

  if (!session) {
    redirect("/carina/auth/login")
  }

  const cookieStore = await cookies()
  const rawLastApp = cookieStore.get("iris_last_app")?.value
  let targetPath = "/borealis"

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
      targetPath = "/borealis"
    }
  }

  redirect(targetPath)
}
