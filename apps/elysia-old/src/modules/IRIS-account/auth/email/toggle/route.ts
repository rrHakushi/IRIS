import { defineRoute, t } from "../../../../../router"
import { generateBackupCodes } from "../../../../../utils/auth-crypto"

export default defineRoute({
  schema: {
    body: t.Object({
      enabled: t.Boolean(),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
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

    const currentUser = session.getUser()
    if (!currentUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: "User not found" }),
        { status: 401, headers: { "content-type": "application/json" } }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      include: { passkeys: true },
    })

    if (!user) {
      return new Response(
        JSON.stringify({ error: "NotFound", message: "User not found" }),
        { status: 404, headers: { "content-type": "application/json" } }
      )
    }

    if (body.enabled) {
      // If user has no existing backup codes and no other MFA, generate them
      let hashedBackupCodes: string[] | undefined = undefined
      const otherMfaActive = user.TOTPEnabled || user.passkeys.length > 0
      if (!otherMfaActive && user.backupCodes.length === 0) {
        const generated = await generateBackupCodes()
        hashedBackupCodes = generated.hashed
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailMfaEnabled: true,
          ...(hashedBackupCodes ? { backupCodes: hashedBackupCodes } : {}),
        },
      })

      // Invalidate cached user record
      await cache.del(`users:me:user:${user.id}`)
      await cache.del(`user:${user.id}`)

      return {
        success: true,
        message: "Email MFA has been enabled",
      }
    } else {
      // Disabling email MFA
      const otherMfaActive = user.TOTPEnabled || user.passkeys.length > 0

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailMfaEnabled: false,
          ...(!otherMfaActive ? { backupCodes: [] } : {}),
        },
      })

      // Invalidate cached user record
      await cache.del(`users:me:user:${user.id}`)
      await cache.del(`user:${user.id}`)

      return {
        success: true,
        message: "Email MFA has been disabled",
      }
    }
  },
})
