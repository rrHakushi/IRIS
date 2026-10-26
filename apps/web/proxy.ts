import { NextResponse, type NextRequest } from "next/server"
import { getDomainConfig } from "@/lib/domain"

export default function proxy(request: NextRequest) {
  const response = NextResponse.next()
  const { cookieDomain, isSecure } = getDomainConfig()

  if (cookieDomain) {
    const sessionCookie = request.cookies.get("session")
    if (sessionCookie?.value) {
      response.cookies.set("session", sessionCookie.value, {
        domain: cookieDomain,
        path: "/",
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        maxAge: 365 * 24 * 60 * 60,
      })
    }
  }

  return response
}
