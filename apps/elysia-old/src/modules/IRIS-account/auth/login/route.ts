import { randomBytes } from "node:crypto"
import { defineRoute, t } from "../../../../router"
import { verifyPassword, signUserJwt } from "../../../../utils/auth-crypto"
import { notifyUserLogin } from "../../../../utils/client-info"

export default defineRoute({
  schema: {
    body: t.Object({
      identifier: t.String({ minLength: 3, maxLength: 255 }),
      password: t.String({ minLength: 1, maxLength: 128 }),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        mfaRequired: t.Boolean(),
        mfaTicket: t.Nullable(t.String()),
        allowedMfaTypes: t.Nullable(
          t.Array(
            t.Union([
              t.Literal("totp"),
              t.Literal("email"),
              t.Literal("passkey"),
            ])
          )
        ),
        user: t.Nullable(
          t.Object({
            id: t.String(),
            username: t.String(),
            email: t.String(),
            passwordChangedAt: t.Nullable(t.Number()),
          })
        ),
        token: t.Nullable(t.String()),
      }),
    },
  },

  async POST({ body, prisma, cache, request }) {
    const rawIdentifier = body.identifier.trim()
    const lowerIdentifier = rawIdentifier.toLowerCase()

    // 1. Locate user by username or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: lowerIdentifier }, { username: rawIdentifier }],
      },
      include: {
        passkeys: true,
      },
    })

    if (!user) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Invalid username, email, or password.",
        }),
        { status: 401, headers: { "content-type": "application/json" } }
      )
    }

    // 2. Verify password
    const isPasswordValid = await verifyPassword(
      body.password,
      user.passwordHash
    )
    if (!isPasswordValid) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Invalid username, email, or password.",
        }),
        { status: 401, headers: { "content-type": "application/json" } }
      )
    }

    // 3. Inspect MFA requirements
    const hasTotp = user.TOTPEnabled && Boolean(user.TOTPSecret)
    const hasEmail = user.emailMfaEnabled
    const hasPasskeys = user.passkeys.length > 0
    const isMfaActive = hasTotp || hasEmail || hasPasskeys

    if (isMfaActive) {
      const mfaTicket = `mfa_${randomBytes(24).toString("hex")}`

      // Cache ticket for 5 minutes (300 seconds)
      await cache.set(`auth:mfa-ticket:${mfaTicket}`, { userId: user.id }, 300)

      const allowedMfaTypes: ("totp" | "email" | "passkey")[] = []
      if (hasTotp) allowedMfaTypes.push("totp")
      if (hasEmail) allowedMfaTypes.push("email")
      if (hasPasskeys) allowedMfaTypes.push("passkey")

      return {
        success: true,
        mfaRequired: true,
        mfaTicket,
        allowedMfaTypes,
        user: null,
        token: null,
      }
    }

    // 4. Issue authenticated session token
    const token = await signUserJwt({
      ...user,
      username: user.username.trim(),
    })

    // Send login notification asynchronously
    notifyUserLogin(user.id, request)

    return {
      success: true,
      mfaRequired: false,
      mfaTicket: null,
      allowedMfaTypes: null,
      user: {
        id: user.id,
        username: user.username.trim(),
        email: user.email,
        passwordChangedAt: user.passwordChangedAt
          ? Math.floor(user.passwordChangedAt.getTime() / 1000)
          : null,
      },
      token,
    }
  },
})
