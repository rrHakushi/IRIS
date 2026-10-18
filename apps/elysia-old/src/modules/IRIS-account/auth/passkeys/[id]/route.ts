import { defineRoute, t } from "../../../../../router"

export default defineRoute({
  schema: {
    params: t.Object({
      id: t.String(),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
      }),
    },
  },

  async DELETE({ params, session, prisma }) {
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

    const passkey = await prisma.passkey.findFirst({
      where: { id: params.id, userId: sessionUser.id },
    })

    if (!passkey) {
      return new Response(
        JSON.stringify({ error: "NotFound", message: "Passkey not found" }),
        { status: 404, headers: { "content-type": "application/json" } }
      )
    }

    // Delete passkey
    await prisma.passkey.delete({
      where: { id: passkey.id },
    })

    // Check remaining MFA methods
    const remainingUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: { passkeys: true },
    })

    if (remainingUser) {
      const remainingMfa =
        remainingUser.TOTPEnabled ||
        remainingUser.emailMfaEnabled ||
        remainingUser.passkeys.length > 0

      if (!remainingMfa && remainingUser.backupCodes.length > 0) {
        await prisma.user.update({
          where: { id: sessionUser.id },
          data: { backupCodes: [] },
        })
      }
    }

    return {
      success: true,
      message: `Passkey ${params.id} deleted successfully`,
    }
  },
})
