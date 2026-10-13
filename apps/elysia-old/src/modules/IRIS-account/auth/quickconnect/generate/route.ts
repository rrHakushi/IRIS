import { randomBytes } from "node:crypto"
import { defineRoute, t } from "../../../../../router"
import { sendQuickConnectInputNotification } from "../../../../../utils/client-info"

export default defineRoute({
  schema: {
    body: t.Optional(
      t.Object({
        deviceName: t.Optional(t.String({ maxLength: 64 })),
        userIdentifier: t.Optional(t.String({ minLength: 3, maxLength: 255 })),
      })
    ),
    response: {
      200: t.Object({
        code: t.String(),
        sessionToken: t.String(),
        qrPayload: t.String(),
        expiresIn: t.Number(),
      }),
    },
  },

  async POST({ body, cache, prisma, session }) {
    // 1. Generate 8-character human-readable pairing code
    const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    const bytes = randomBytes(8)
    let rawCode = ""
    for (let i = 0; i < 8; i++) {
      rawCode += CHARS[bytes[i]! % CHARS.length]
    }
    const code = `${rawCode.slice(0, 4)}-${rawCode.slice(4, 8)}`

    // 2. Generate private 256-bit unguessable polling session token
    const sessionToken = randomBytes(32).toString("hex")

    const baseUrl = process.env.NEXTAUTH_URL!
    const qrPayload = `${baseUrl.replace(/\/$/, "")}/auth-test?code=${code}`

    // 3. Store pairing records in cache (300 seconds TTL)
    await Promise.all([
      cache.set(`auth:quickconnect:code:${code}`, sessionToken, 300),
      cache.set(
        `auth:quickconnect:session:${sessionToken}`,
        {
          status: "pending",
          code,
          deviceName: body?.deviceName ?? "Device",
          userId: null,
        },
        300
      ),
    ])

    // 4. Optionally dispatch an ACTION_INPUT notification to target user session
    let targetUserId: string | null = null

    if (body?.userIdentifier) {
      const lower = body.userIdentifier.trim().toLowerCase()
      const targetUser = await prisma.user.findFirst({
        where: {
          OR: [{ email: lower }, { username: body.userIdentifier.trim() }],
        },
        select: { id: true },
      })
      if (targetUser) {
        targetUserId = targetUser.id
      }
    } else if (session?.isAuthenticated) {
      targetUserId = session.getUser()?.id || session.user?.id || null
    }

    if (targetUserId) {
      await sendQuickConnectInputNotification(targetUserId, code)
    }

    return {
      code,
      sessionToken,
      qrPayload,
      expiresIn: 300,
    }
  },
})
