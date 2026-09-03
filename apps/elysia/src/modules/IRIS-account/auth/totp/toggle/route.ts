import { verify as verifyTotp } from "otplib"
import { defineRoute, t } from "../../../../../router"
import {
  encryptSecret,
  decryptSecret,
  verifyPassword,
  generateBackupCodes,
} from "../../../../../utils/auth-crypto"

export default defineRoute({
  schema: {
    body: t.Object({
      enabled: t.Boolean(),
      code: t.Optional(t.String({ minLength: 6, maxLength: 6 })),
      password: t.Optional(t.String({ minLength: 1 })),
      secret: t.Optional(t.String()),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        backupCodes: t.Optional(t.Array(t.String())),
      }),
    },
  },

  async POST({ body, session, prisma, cache }) {
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

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: { passkeys: true },
    })

    if (!user) {
      return new Response(
        JSON.stringify({ error: "NotFound", message: "User not found" }),
        { status: 404, headers: { "content-type": "application/json" } }
      )
    }

    // --- Case 1: Enabling TOTP ---
    if (body.enabled) {
      if (!body.code) {
        return new Response(
          JSON.stringify({
            error: "BadRequest",
            message:
              "A 6-digit verification code is required to activate TOTP.",
          }),
          { status: 400, headers: { "content-type": "application/json" } }
        )
      }

      const cachedSecret = await cache.get<string>(
        `auth:totp:pending:${user.id}`
      )
      const secretToVerify = cachedSecret || body.secret

      if (!secretToVerify) {
        return new Response(
          JSON.stringify({
            error: "BadRequest",
            message:
              "TOTP setup session expired or was not initiated. Please generate a new QR code.",
          }),
          { status: 400, headers: { "content-type": "application/json" } }
        )
      }

      const verifyResult = await verifyTotp({
        token: body.code.trim(),
        secret: secretToVerify,
        epochTolerance: 30,
      })

      if (!verifyResult.valid) {
        return new Response(
          JSON.stringify({
            error: "BadRequest",
            message:
              "Invalid verification code. Check that the time on your authenticator device is synchronized.",
          }),
          { status: 400, headers: { "content-type": "application/json" } }
        )
      }

      const encryptedSecret = encryptSecret(secretToVerify)

      // Generate backup codes if user doesn't already have them
      let plainBackupCodes: string[] = []
      let hashedBackupCodes: string[] | undefined = undefined

      const hasExistingCodes = user.backupCodes.length > 0
      if (!hasExistingCodes) {
        const generated = await generateBackupCodes()
        plainBackupCodes = generated.plain
        hashedBackupCodes = generated.hashed
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          TOTPSecret: encryptedSecret,
          TOTPEnabled: true,
          ...(hashedBackupCodes ? { backupCodes: hashedBackupCodes } : {}),
        },
      })

      // Clear pending and cached user record so GET /users/me reflects new state immediately
      await cache.del(`auth:totp:pending:${user.id}`)
      await cache.del(`users:me:user:${user.id}`)
      await cache.del(`user:${user.id}`)

      return {
        success: true,
        message: "TOTP has been enabled",
        backupCodes: plainBackupCodes.length > 0 ? plainBackupCodes : undefined,
      }
    }

    // --- Case 2: Disabling TOTP (Requires TOTP code or Password) ---
    let isAuthorized = false

    // Option A: Verify via TOTP code
    if (body.code && user.TOTPSecret) {
      const decryptedSecret = decryptSecret(user.TOTPSecret)
      const verifyResult = await verifyTotp({
        token: body.code.trim(),
        secret: decryptedSecret,
        epochTolerance: 30,
      })

      if (verifyResult.valid) {
        isAuthorized = true
      } else {
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
            message: "Invalid authenticator verification code.",
          }),
          { status: 401, headers: { "content-type": "application/json" } }
        )
      }
    }
    // Option B: Verify via Account Password
    else if (body.password) {
      if (user.passwordHash) {
        const isPasswordValid = await verifyPassword(
          body.password,
          user.passwordHash
        )
        if (isPasswordValid) {
          isAuthorized = true
        } else {
          return new Response(
            JSON.stringify({
              error: "Unauthorized",
              message: "Incorrect password confirmation.",
            }),
            { status: 401, headers: { "content-type": "application/json" } }
          )
        }
      } else {
        // User has no password (e.g. Passkey/OAuth user)
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({
          error: "BadRequest",
          message:
            "Please enter a 6-digit authenticator code or your account password to disable TOTP.",
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      )
    }

    const remainingMfa = user.emailMfaEnabled || user.passkeys.length > 0

    await prisma.user.update({
      where: { id: user.id },
      data: {
        TOTPEnabled: false,
        TOTPSecret: null,
        ...(!remainingMfa ? { backupCodes: [] } : {}),
      },
    })

    // Invalidate cached user record so GET /users/me reflects new state immediately
    await cache.del(`users:me:user:${user.id}`)
    await cache.del(`user:${user.id}`)

    return {
      success: true,
      message: "TOTP has been disabled",
    }
  },
})
