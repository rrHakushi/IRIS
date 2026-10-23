import { cookies } from "next/headers"
import { jwtVerify } from "jose"

export interface SessionUser {
  id: string
  name?: string | null
  username?: string | null
  email?: string | null
  image?: string | null
  permissions?: number[]
}

export interface Session {
  user: SessionUser
  expires?: string
}

/**
 * Server-side session verification using the `session` cookie and JWT_SECRET.
 * Strict implementation with zero fallbacks.
 */
export async function auth(): Promise<Session | null> {
  const secret =
    typeof Bun !== "undefined" ? Bun.env.JWT_SECRET : process.env.JWT_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required")
  }

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get("session")?.value

  if (!sessionToken) {
    return null
  }

  try {
    const secretKey = new TextEncoder().encode(secret)
    const { payload } = await jwtVerify(sessionToken, secretKey)

    if (!payload || !payload.id) {
      return null
    }

    return {
      user: {
        id: String(payload.id),
        name: (payload.username as string) ?? (payload.name as string) ?? null,
        username: (payload.username as string) ?? null,
        email: (payload.email as string) ?? null,
        permissions: Array.isArray(payload.permissions) ? (payload.permissions as number[]) : [],
      },
      expires: payload.exp ? new Date(payload.exp * 1000).toISOString() : undefined,
    }
  } catch {
    return null
  }
}

export const getServerSession = auth
