import { generateSecret, generateURI } from "otplib"
import QRCode from "qrcode"
import { defineRoute, t } from "../../../../../router"

export default defineRoute({
  schema: {
    response: {
      200: t.Object({
        secret: t.String(),
        otpauthUrl: t.String(),
        qrCodeDataUrl: t.String(),
      }),
    },
  },

  async POST({ session, cache }) {
    if (!session.isAuthenticated) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Authentication required",
        }),
        { status: 401, headers: { "content-type": "application/json" } }
      )
    }

    const user = session.getUser()
    if (!user) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "User session not found",
        }),
        { status: 401, headers: { "content-type": "application/json" } }
      )
    }

    // 1. Generate new TOTP Base32 secret
    const secret = generateSecret()
    const isDev =
      process.env.NODE_ENV === "development" || !process.env.NODE_ENV
    const issuer = isDev ? "IRIS account-dev" : "IRIS account"
    const label = user.email
      ? `${user.username} (${user.email})`
      : user.username

    const otpauthUrl = generateURI({
      issuer,
      label,
      secret,
    })

    // 2. Generate PNG QR Code Data URL directly
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      margin: 2,
      width: 280,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })

    // 3. Cache pending TOTP secret for 10 minutes (600s)
    await cache.set(`auth:totp:pending:${user.id}`, secret, 600)

    return {
      secret,
      otpauthUrl,
      qrCodeDataUrl,
    }
  },
})
