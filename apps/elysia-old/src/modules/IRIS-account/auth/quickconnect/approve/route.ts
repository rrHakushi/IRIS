import { defineRoute, t } from "../../../../../router"
import { notifyUserLogin } from "../../../../../utils/client-info"

export default defineRoute({
  schema: {
    body: t.Object({
      code: t.String({ minLength: 6, maxLength: 64 }),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
      }),
    },
  },

  async POST({ body, session, cache, request }) {
    if (!session.isAuthenticated) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Authentication required",
        }),
        { status: 401, headers: { "content-type": "application/json" } }
      )
    }

    const sessionUser = session.getUser()
    if (!sessionUser) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "User session not found",
        }),
        { status: 401, headers: { "content-type": "application/json" } }
      )
    }

    const raw = body.code.trim().toUpperCase()
    const cleanNoDash = raw.replaceAll("-", "")
    const formattedCode =
      cleanNoDash.length === 8
        ? `${cleanNoDash.slice(0, 4)}-${cleanNoDash.slice(4, 8)}`
        : raw

    // 1. Resolve sessionToken from short code
    const sessionToken =
      (await cache.get<string>(`auth:quickconnect:code:${formattedCode}`)) ||
      (await cache.get<string>(`auth:quickconnect:code:${raw}`))

    if (!sessionToken) {
      return new Response(
        JSON.stringify({
          error: "BadRequest",
          message: "Invalid or expired device pairing code.",
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      )
    }

    // 2. Fetch session data
    const sessionData = await cache.get<{
      status: string
      code: string
      deviceName: string
      userId: string | null
    }>(`auth:quickconnect:session:${sessionToken}`)

    if (!sessionData) {
      return new Response(
        JSON.stringify({
          error: "BadRequest",
          message: "Device pairing session expired.",
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      )
    }

    // 3. Mark session as approved with the current user's ID
    await cache.set(
      `auth:quickconnect:session:${sessionToken}`,
      {
        ...sessionData,
        status: "approved",
        userId: sessionUser.id,
      },
      300
    )

    // Delete the code lookup so it cannot be claimed twice
    await Promise.all([
      cache.del(`auth:quickconnect:code:${formattedCode}`),
      cache.del(`auth:quickconnect:code:${raw}`),
    ])

    return {
      success: true,
      message: "Device approved successfully",
    }
  },
})
