import { NextResponse, type NextRequest } from "next/server"

function getCookieDomain(): string | undefined {
  if (process.env.COOKIE_DOMAIN) {
    return process.env.COOKIE_DOMAIN
  }
  if (process.env.NODE_ENV === "production") {
    return ".runerra.org"
  }
  return undefined
}

export default function proxy(request: NextRequest) {
  const response = NextResponse.next()
  const domain = getCookieDomain()

  if (domain) {
    const sessionCookie = request.cookies.get(
      "__Secure-next-auth.session-token"
    )
    if (sessionCookie?.value) {
      response.cookies.set(
        "__Secure-next-auth.session-token",
        sessionCookie.value,
        {
          domain,
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          maxAge: 365 * 24 * 60 * 60,
        }
      )
    }
  }

  return response
}
