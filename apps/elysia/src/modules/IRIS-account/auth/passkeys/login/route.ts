import {
  generateAuthenticationOptions,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server"
import { defineRoute, t } from "../../../../../router"

export default defineRoute({
  schema: {
    body: t.Optional(
      t.Object({
        identifier: t.Optional(t.String({ minLength: 3 })),
      })
    ),
    response: {
      200: t.Object({
        challenge: t.String(),
        rpId: t.Optional(t.String()),
        allowCredentials: t.Optional(
          t.Array(
            t.Object({
              id: t.String(),
              type: t.Literal("public-key"),
              transports: t.Optional(t.Array(t.String())),
            })
          )
        ),
        timeout: t.Optional(t.Number()),
        userVerification: t.Optional(
          t.Union([
            t.Literal("required"),
            t.Literal("preferred"),
            t.Literal("discouraged"),
          ])
        ),
      }),
    },
  },

  async POST({ body, prisma, cache, request }) {
    const originHeader =
      request?.headers.get("origin") || request?.headers.get("referer")
    let origin = process.env.NEXTAUTH_URL!
    if (originHeader) {
      try {
        const u = new URL(originHeader)
        origin = `${u.protocol}//${u.host}`
      } catch {}
    }

    let rpID = "localhost"
    try {
      rpID = process.env.RP_ID || new URL(origin).hostname
    } catch {
      rpID = "localhost"
    }

    let allowCredentials:
      | {
          id: string
          type: "public-key"
          transports?: AuthenticatorTransportFuture[]
        }[]
      | undefined = undefined

    if (body?.identifier) {
      const rawIdentifier = body.identifier.trim()
      const lowerIdentifier = rawIdentifier.toLowerCase()

      const user = await prisma.user.findFirst({
        where: {
          OR: [{ email: lowerIdentifier }, { username: rawIdentifier }],
        },
        include: { passkeys: true },
      })

      if (user && user.passkeys.length > 0) {
        allowCredentials = user.passkeys.map((pk) => ({
          id: pk.id,
          type: "public-key" as const,
          transports: pk.transports as AuthenticatorTransportFuture[],
        }))
      }
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: "preferred",
    })

    // Cache challenge for 5 minutes
    await cache.set(
      `auth:passkey-auth:${options.challenge}`,
      options.challenge,
      300
    )

    return {
      challenge: options.challenge,
      rpId: options.rpId ?? rpID,
      allowCredentials: options.allowCredentials?.map((cred) => ({
        id: cred.id,
        type: "public-key" as const,
        transports: cred.transports,
      })),
      timeout: options.timeout ?? 60000,
      userVerification: options.userVerification,
    }
  },
})
