import { defineRoute, t } from "../../../../../router"
import { sendMfaVerificationEmail } from "../../../../../utils/mailer"

export default defineRoute({
  schema: {
    body: t.Object({
      mfaTicket: t.String({ minLength: 10 }),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
      }),
    },
  },

  async POST({ body, prisma, cache }) {
    // 1. Resolve MFA ticket from cache
    const ticketData = await cache.get<{ userId: string }>(
      `auth:mfa-ticket:${body.mfaTicket}`
    )

    if (!ticketData || !ticketData.userId) {
      return new Response(
        JSON.stringify({
          error: "BadRequest",
          message: "Invalid or expired MFA session ticket.",
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      )
    }

    // 2. Fetch target user
    const user = await prisma.user.findUnique({
      where: { id: ticketData.userId },
      select: { id: true, email: true, emailMfaEnabled: true },
    })

    if (!user || !user.email) {
      return new Response(
        JSON.stringify({
          error: "NotFound",
          message: "User account or email address not found.",
        }),
        { status: 404, headers: { "content-type": "application/json" } }
      )
    }

    // 3. Generate 6-digit code and cache for 5 minutes
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    await cache.set(`auth:mfa-email-code:${user.id}`, code, 300)

    // 4. Send email using React Email template
    await sendMfaVerificationEmail(user.email, code, 5)

    return {
      success: true,
      message: "Verification code sent to registered email",
    }
  },
})
