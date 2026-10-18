import { randomBytes } from "node:crypto"
import { defineRoute, t } from "../../../../../router"
import { sendPasswordResetEmail } from "../../../../../utils/mailer"

export default defineRoute({
  schema: {
    body: t.Object({
      email: t.String({ format: "email" }),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
      }),
    },
  },

  async POST({ body, prisma, cache }) {
    const lowerEmail = body.email.trim().toLowerCase()

    // 1. Locate user account by email
    const user = await prisma.user.findUnique({
      where: { email: lowerEmail },
      select: { id: true, email: true },
    })

    if (user && user.email) {
      // 2. Generate secure 256-bit reset token
      const resetToken = randomBytes(32).toString("hex")

      // Cache token for 15 minutes (900 seconds)
      await cache.set(`auth:pwd-reset:${resetToken}`, user.id, 900)

      const baseUrl = process.env.NEXTAUTH_URL!
      const resetUrl = `${baseUrl.replace(/\/$/, "")}/auth-test?resetToken=${resetToken}`

      // 3. Dispatch reset link using React Email template
      await sendPasswordResetEmail(user.email, resetUrl, 15)
    }

    // Always return success response to prevent user enumeration
    return {
      success: true,
      message: "Password recovery instructions sent to email",
    }
  },
})
