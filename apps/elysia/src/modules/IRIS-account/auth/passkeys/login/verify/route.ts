import { verifyAuthenticationResponse } from "@simplewebauthn/server"
import { defineRoute, t } from "../../../../../../router"
import { signUserJwt } from "../../../../../../utils/auth-crypto"
import { notifyUserLogin } from "../../../../../../utils/client-info"

export default defineRoute({
  schema: {
    body: t.Object({
      passkeyResponse: t.Object({
        id: t.String(),
        rawId: t.String(),
        response: t.Any(),
        type: t.Optional(t.String()),
        clientExtensionResults: t.Optional(t.Any()),
      }),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
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
    const payload = body as {
      passkeyResponse: {
        id: string
        rawId: string
        response: any
        type?: string
        clientExtensionResults?: any
      }
    }

    // 1. Locate passkey and user in database
    const passkey = await prisma.passkey.findUnique({
      where: { id: payload.passkeyResponse.id },
      include: { user: true },
    })

    if (!passkey || !passkey.user) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Passkey credential not recognized.",
        }),
        { status: 401, headers: { "content-type": "application/json" } }
      )
    }

    // 2. Extract challenge from clientDataJSON
    let challenge: string | null = null
    try {
      const clientDataJSON = payload.passkeyResponse.response?.clientDataJSON
      if (clientDataJSON) {
        const clientData = JSON.parse(
          Buffer.from(clientDataJSON, "base64url").toString("utf8")
        )
        challenge = clientData.challenge
      }
    } catch {
      challenge = null
    }

    if (!challenge) {
      return new Response(
        JSON.stringify({
          error: "BadRequest",
          message: "Invalid client assertion payload.",
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      )
    }

    // 3. Verify challenge in cache
    const expectedChallenge = await cache.get<string>(
      `auth:passkey-auth:${challenge}`
    )

    if (!expectedChallenge) {
      return new Response(
        JSON.stringify({
          error: "BadRequest",
          message: "Passkey authentication challenge expired or invalid.",
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      )
    }

    const originHeader =
      request?.headers.get("origin") || request?.headers.get("referer")
    const allowedOrigins = new Set<string>()
    if (process.env.NEXTAUTH_URL) allowedOrigins.add(process.env.NEXTAUTH_URL)
    if (process.env.NEXT_PUBLIC_URL) allowedOrigins.add(process.env.NEXT_PUBLIC_URL)
    allowedOrigins.add("http://localhost:3000")
    allowedOrigins.add("http://127.0.0.1:3000")
    if (originHeader) {
      try {
        const u = new URL(originHeader)
        allowedOrigins.add(`${u.protocol}//${u.host}`)
      } catch {}
    }
    const expectedOrigin = Array.from(allowedOrigins)

    let expectedRPID = "localhost"
    try {
      const primaryOrigin = process.env.NEXTAUTH_URL || "http://localhost:3000"
      const hostname = originHeader ? new URL(originHeader).hostname : new URL(primaryOrigin).hostname
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        expectedRPID = "localhost"
      } else if (process.env.RP_ID && process.env.RP_ID.trim()) {
        expectedRPID = process.env.RP_ID.trim()
      } else {
        expectedRPID = hostname
      }
    } catch {
      expectedRPID = "localhost"
    }

    // 4. Verify signature & counter
    let verification
    try {
      verification = await verifyAuthenticationResponse({
        response: payload.passkeyResponse as any,
        expectedChallenge,
        expectedOrigin,
        expectedRPID,
        credential: {
          id: passkey.id,
          publicKey: Buffer.from(passkey.publicKey, "base64url"),
          counter: passkey.counter,
          transports: passkey.transports as any,
        },
      })
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Passkey verification failed"
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: msg }),
        { status: 401, headers: { "content-type": "application/json" } }
      )
    }

    if (!verification.verified || !verification.authenticationInfo) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Passkey authentication verification failed.",
        }),
        { status: 401, headers: { "content-type": "application/json" } }
      )
    }

    // 5. Update authenticator counter to prevent replay
    await prisma.passkey.update({
      where: { id: passkey.id },
      data: { counter: verification.authenticationInfo.newCounter },
    })

    // Invalidate cached challenge
    await cache.del(`auth:passkey-auth:${challenge}`)

    // 6. Sign session token
    const token = await signUserJwt({
      ...passkey.user,
      username: passkey.user.username.trim(),
    })

    notifyUserLogin(passkey.user.id, request)

    return {
      success: true,
      user: {
        id: passkey.user.id,
        username: passkey.user.username.trim(),
        email: passkey.user.email,
        passwordChangedAt: passkey.user.passwordChangedAt
          ? Math.floor(passkey.user.passwordChangedAt.getTime() / 1000)
          : null,
      },
      token,
    }
  },
})
